import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createChatbot } from '../packages/core/dist/index.js';
const originalFetch=globalThis.fetch;
const streamReply=text=>new Response(`data: ${JSON.stringify({choices:[{delta:{content:text}}]})}\n\ndata: [DONE]\n\n`,{headers:{'content-type':'text/event-stream'}});
async function fixture({capabilities,reply='Answer'}={}){
 const dir=await mkdtemp(`${tmpdir()}/chat-files-`),bodies=[];let user='u';
 globalThis.fetch=async(_url,init)=>{bodies.push(JSON.parse(init.body));return streamReply(reply);};
 const bot=createChatbot({provider:{baseUrl:'https://mock.test/v1/',apiKey:'test',model:'test'},identity:()=>({userId:user}),storage:{filename:`${dir}/db.sqlite`},capabilities});await bot.ready;
 const call=(path,init={})=>bot.handle(new Request(`http://app.test${path}`,init));
 const json=(path,method,body)=>call(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const id=(await(await call('/conversations',{method:'POST'})).json()).conversation.id;
 const upload=(name,type,content)=>{const form=new FormData();form.append('conversationId',id);form.append('file',new File([content],name,{type}));return call('/media',{method:'POST',body:form});};
 const send=async body=>{const response=await json(`/conversations/${id}/messages`,'POST',body);await response.text();return response;};
 return {call,json,id,upload,send,bodies,as:next=>{user=next;},async close(){await bot.close();globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}};
}

test('an attached PDF is read by the host extractor, reaches the model, and is listed under Files',async()=>{
 const seen=[];
 const f=await fixture({capabilities:{documents:{enabled:true,extract:({bytes,mime,name})=>{seen.push({mime,name,size:bytes.length});return 'GPA 3.8, IELTS 7.5';}}}});
 try{
  const config=await(await f.call('/config')).json();
  assert.equal(config.capabilities.documents,true);
  assert.ok(config.capabilities.documentTypes.includes('application/pdf'));
  const uploaded=await f.upload('transcript.pdf','application/pdf','%PDF-1.4 fake');
  assert.equal(uploaded.status,201);
  const doc=await uploaded.json();
  assert.equal(doc.kind,'document');assert.equal(doc.name,'transcript.pdf');
  assert.deepEqual(seen,[{mime:'application/pdf',name:'transcript.pdf',size:13}]);
  assert.equal((await f.send({content:'What does my transcript say?',documentIds:[doc.mediaId]})).status,200);
  const userTurn=f.bodies[0].messages.findLast(m=>m.role==='user');
  assert.match(String(userTurn.content),/What does my transcript say\?\n\n<attached-file name="transcript.pdf">\nGPA 3.8, IELTS 7.5\n<\/attached-file>/);
  const shared=await(await f.call('/shared')).json();
  assert.deepEqual(shared.files.map(file=>[file.name,file.conversationId,file.conversationTitle]),[['transcript.pdf',f.id,'What does my transcript say?']]);
  assert.deepEqual(shared.media,[]);
 }finally{await f.close();}
});

test('the input guard gets the whole message plus the typed text and each file apart',async()=>{
 const dir=await mkdtemp(`${tmpdir()}/chat-files-guard-`),seen=[];
 globalThis.fetch=async()=>streamReply('ok');
 const bot=createChatbot({provider:{baseUrl:'https://mock.test/v1/',apiKey:'test',model:'test'},identity:()=>({userId:'u'}),storage:{filename:`${dir}/db.sqlite`},capabilities:{documents:{enabled:true}},inputGuard:ctx=>{seen.push(ctx);return {allow:true};}});
 try{
  await bot.ready;const call=(path,init={})=>bot.handle(new Request(`http://app.test${path}`,init));
  const id=(await(await call('/conversations',{method:'POST'})).json()).conversation.id;
  const form=new FormData();form.append('conversationId',id);form.append('file',new File(['My CV text'],'cv.txt',{type:'text/plain'}));
  const doc=await(await call('/media',{method:'POST',body:form})).json();
  await(await call(`/conversations/${id}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content:'Review it',documentIds:[doc.mediaId]})})).text();
  assert.equal(seen[0].typed,'Review it');
  assert.deepEqual(seen[0].documents,[{name:'cv.txt',text:'My CV text'}]);
  assert.match(seen[0].content,/^Review it\n\n<attached-file name="cv.txt">\nMy CV text\n<\/attached-file>$/);
 }finally{await bot.close();globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}
});

test('without an extractor only text files are read; other types and empty text are refused',async()=>{
 const f=await fixture({capabilities:{documents:{enabled:true}}});
 try{
  assert.equal((await f.upload('notes.md','','# Plan\nApply in March')).status,201);
  assert.equal((await f.upload('cv.pdf','application/pdf','%PDF')).status,415);
  assert.equal((await f.upload('blank.txt','text/plain','   ')).status,422);
 }finally{await f.close();}
});

test('a document id cannot be sent as an image, and files are refused when documents are off',async()=>{
 const f=await fixture({capabilities:{images:{enabled:true},documents:{enabled:true}}});
 try{
  const doc=await(await f.upload('notes.txt','text/plain','hello')).json();
  assert.equal((await f.send({content:'Look',mediaIds:[doc.mediaId]})).status,400);
 }finally{await f.close();}
 const off=await fixture();
 try{assert.equal((await off.send({content:'Look',documentIds:['x']})).status,403);}finally{await off.close();}
});

test('a chat is named after its first message and can be renamed by its owner only',async()=>{
 const f=await fixture();
 try{
  await f.send({content:'  Which   universities fit my profile?  '});
  let list=(await(await f.call('/conversations')).json()).conversations;
  assert.equal(list[0].title,'Which universities fit my profile?');
  await f.send({content:'A second question'});
  list=(await(await f.call('/conversations')).json()).conversations;
  assert.equal(list[0].title,'Which universities fit my profile?');
  const renamed=await f.json(`/conversations/${f.id}`,'PATCH',{title:' UK shortlist '});
  assert.equal(renamed.status,200);
  assert.equal((await renamed.json()).conversation.title,'UK shortlist');
  assert.equal((await f.json(`/conversations/${f.id}`,'PATCH',{title:'  '})).status,400);
  assert.equal((await f.json(`/conversations/${f.id}`,'PATCH',{title:'x'.repeat(121)})).status,400);
  f.as('someone-else');
  assert.equal((await f.json(`/conversations/${f.id}`,'PATCH',{title:'Mine now'})).status,404);
 }finally{await f.close();}
});

test('links from replies are collected once each, with their text and source chat',async()=>{
 const f=await fixture({reply:'Start here: [Create your journey](https://www.lattu.ai/questionnaire). Also https://www.lattu.ai/journey/42, and again [the form](https://www.lattu.ai/questionnaire).'});
 try{
  await f.send({content:'How do I start?'});
  const {links}=await(await f.call('/shared')).json();
  assert.deepEqual(links.map(link=>[link.url,link.title,link.conversationTitle]),[
   ['https://www.lattu.ai/questionnaire','Create your journey','How do I start?'],
   ['https://www.lattu.ai/journey/42','https://www.lattu.ai/journey/42','How do I start?'],
  ]);
 }finally{await f.close();}
});
