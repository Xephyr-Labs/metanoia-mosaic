import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createChatbot } from '../packages/core/dist/index.js';
const originalFetch=globalThis.fetch;
const sse=chunks=>new Response(chunks.map(c=>`data: ${JSON.stringify({choices:[{delta:{content:c}}]})}\n\n`).join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
async function fixture(extra,provider){
 const dir=await mkdtemp(`${tmpdir()}/chat-inline-`);const calls=[];
 globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body);calls.push({body,signal:init.signal});return provider(body,init);};
 const bot=createChatbot({provider:{baseUrl:'https://mock.test/v1/',apiKey:'test',model:'test'},identity:()=>({userId:'u'}),storage:{filename:`${dir}/db.sqlite`},...extra});await bot.ready;
 const call=(path,init={})=>bot.handle(new Request(`http://app.test${path}`,init));
 const id=(await(await call('/conversations',{method:'POST'})).json()).conversation.id;
 const send=content=>call(`/conversations/${id}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content})});
 const history=async()=>(await(await call(`/conversations/${id}`)).json()).messages;
 return {calls,send,history,async close(){await bot.close();globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}};
}
const deltas=body=>[...body.matchAll(/event: delta\ndata: (.*)/g)].map(m=>JSON.parse(m[1]).text).join('');

test('inline suggestions: one provider call, the block never reaches the user or the history',async()=>{
 // The fence is split across chunks, as a real stream would split it.
 const f=await fixture({capabilities:{suggestions:{enabled:true,count:2,inline:true}}},()=>sse(['Waterloo fits your profile.\n\n``','`sugg','estions\n["Compare Waterloo and Dalhousie","Costs in Waterloo"]\n```']));
 try{
  const body=await(await f.send('Which university?')).text();
  assert.equal(f.calls.length,1,'no separate suggestions call');
  assert.equal(deltas(body).trim(),'Waterloo fits your profile.');
  assert.match(body,/event: suggestions\ndata: {"prompts":\["Compare Waterloo and Dalhousie","Costs in Waterloo"\]}/);
  const [,assistant]=await f.history();
  assert.equal(assistant.content.trim(),'Waterloo fits your profile.');
  assert.deepEqual(assistant.suggestions,['Compare Waterloo and Dalhousie','Costs in Waterloo']);
  assert.match(JSON.stringify(f.calls[0].body.messages),/suggestions/,'the model is told to add the block');
 }finally{await f.close();}
});

test('inline suggestions: an answer without the block streams in full and has no suggestions',async()=>{
 const f=await fixture({capabilities:{suggestions:{enabled:true,inline:true}}},()=>sse(['Use ``','`code`',' here.']));
 try{
  const body=await(await f.send('hi')).text();
  assert.equal(deltas(body),'Use ```code` here.');
  assert.doesNotMatch(body,/event: suggestions/);
 }finally{await f.close();}
});

test('parallel guard: the model starts at once, but nothing it says is sent before the guard allows',async()=>{
 let release;const verdict=new Promise(r=>{release=r;});
 const f=await fixture({inputGuardTiming:'parallel',inputGuard:()=>verdict},()=>sse(['Hello there.']));
 try{
  const pending=f.send('hi');
  await new Promise(r=>setTimeout(r,30));
  assert.equal(f.calls.length,1,'provider called while the guard is still deciding');
  release({allow:true});
  assert.equal(deltas(await(await pending).text()),'Hello there.');
 }finally{await f.close();}
});

test('parallel guard: a refusal aborts the model, streams the reply and withholds the text',async()=>{
 const f=await fixture({inputGuardTiming:'parallel',inputGuard:async()=>{await new Promise(r=>setTimeout(r,20));return {allow:false,reply:'Study abroad only.'};}},()=>sse(['Here is a joke...']));
 try{
  const body=await(await f.send('tell me a joke')).text();
  assert.equal(deltas(body),'Study abroad only.');
  assert.doesNotMatch(body,/joke/);
  assert.equal(f.calls[0].signal.aborted,true,'the model request is aborted');
  const messages=await f.history();
  assert.deepEqual(messages.map(m=>[m.role,m.content]),[['user','[Message withheld by the safety filter]'],['assistant','Study abroad only.']]);
 }finally{await f.close();}
});

test('parallel guard: a guard error fails closed with 503 and aborts the model',async()=>{
 const f=await fixture({inputGuardTiming:'parallel',inputGuard:()=>{throw new Error('down');}},()=>sse(['x']));
 try{
  const response=await f.send('hi');
  assert.equal(response.status,503);
  assert.equal(f.calls.length===0||f.calls[0].signal.aborted,true);
 }finally{await f.close();}
});
