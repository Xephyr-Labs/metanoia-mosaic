import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createChatbot } from '../packages/core/dist/index.js';
import { inspectImage } from '../packages/core/dist/media.js';
const originalFetch=globalThis.fetch;
const streamReply=()=>new Response('data: {"choices":[{"delta":{"content":"Answer"}}]}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
async function fixture(extra={},provider=()=>streamReply()){
 const dir=await mkdtemp(`${tmpdir()}/chat-fixes-`);
 globalThis.fetch=async(_,init)=>provider(JSON.parse(init.body),init);
 const bot=createChatbot({provider:{baseUrl:'https://mock.test/v1/',apiKey:'test',model:'test'},identity:()=>({userId:'u'}),storage:{filename:`${dir}/db.sqlite`},...extra});await bot.ready;
 const call=(path,init={})=>bot.handle(new Request(`http://app.test${path}`,init));
 const id=(await(await call('/conversations',{method:'POST'})).json()).conversation.id;
 return {bot,call,id,async close(){await bot.close();globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}};
}
test('malformed or non-object JSON bodies are client errors, not 500s',async()=>{
 const f=await fixture();
 try{
  for(const [path,method,body] of [['/preferences','PUT','{'],['/memories','POST','null'],[`/conversations/x/messages`,'POST','[']]){
   const response=await f.call(path,{method,headers:{'content-type':'application/json'},body});
   assert.ok(response.status===400||response.status===404,`${path} returned ${response.status}`);
  }
  const bad=await f.call('/preferences',{method:'PUT',headers:{'content-type':'application/json'},body:'{'});
  assert.equal(bad.status,400);assert.equal((await bad.json()).error.code,'invalid_input');
 }finally{await f.close();}
});
test('deleting user data during suggestion generation still ends the reply stream',async()=>{
 let entered;const started=new Promise(r=>entered=r);
 const f=await fixture({capabilities:{suggestions:{enabled:true}}},async(p,init)=>{if(p.stream)return streamReply();entered();await new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(Error('abort')),{once:true}));});
 try{
  const response=await f.call(`/conversations/${f.id}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content:'Help'})});
  const text=response.text();await started;
  assert.equal((await f.call('/user-data',{method:'DELETE'})).status,204);
  const body=await Promise.race([text,new Promise((_,reject)=>setTimeout(()=>reject(Error('stream never closed')),2000))]);
  assert.match(body,/Answer/);
 }finally{await f.close();}
});
test('lossy (VP8) WebP images are measured',()=>{
 const bytes=Buffer.alloc(30);bytes.write('RIFF',0,'ascii');bytes.write('WEBP',8,'ascii');bytes.write('VP8 ',12,'ascii');
 bytes[23]=0x9d;bytes[24]=0x01;bytes[25]=0x2a;bytes.writeUInt16LE(640,26);bytes.writeUInt16LE(480,28);
 assert.deepEqual(inspectImage(bytes,'image/webp',4096),{mime:'image/webp',width:640,height:480});
});
test('OpenAI compatibility sends max_completion_tokens and no temperature so reasoning models accept every request',async()=>{
 const bodies=[];
 const f=await fixture({provider:{baseUrl:'https://mock.test/v1/',apiKey:'test',model:'gpt-5-mini',compatibility:'openai'},capabilities:{suggestions:{enabled:true}}},p=>{bodies.push(p);return p.stream?streamReply():Response.json({choices:[{message:{content:'{"suggestions":["Next?"]}'}}]});});
 try{
  await(await f.call(`/conversations/${f.id}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content:'Hi'})})).text();
  assert.equal(bodies.length,2);
  for(const body of bodies){assert.ok(body.max_completion_tokens>0);assert.equal(body.max_tokens,undefined);assert.equal(body.temperature,undefined);}
 }finally{await f.close();}
});
