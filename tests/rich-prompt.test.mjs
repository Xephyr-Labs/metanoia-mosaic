import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createChatbot} from '../packages/core/dist/index.js';
const originalFetch=globalThis.fetch;
async function run(extra={}){
 const dir=await mkdtemp(`${tmpdir()}/chat-rich-`);let system='';
 globalThis.fetch=async(_,init)=>{const body=JSON.parse(init.body);if(body.stream!==false&&!system)system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');return new Response('data: {"choices":[{"delta":{"content":"Answer"}}]}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});};
 const bot=createChatbot({provider:{baseUrl:'https://mock.test/v1/',apiKey:'test',model:'test'},identity:()=>({userId:'u'}),storage:{filename:`${dir}/db.sqlite`},...extra});
 try{
  await bot.ready;const call=(path,init={})=>bot.handle(new Request(`http://app.test${path}`,init));
  const id=(await(await call('/conversations',{method:'POST'})).json()).conversation.id;
  await(await call(`/conversations/${id}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content:'Hi'})})).text();
  return {system,config:await(await call('/config')).json()};
 }finally{await bot.close();globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}
}
test('rich response guide is on by default and exposed in config',async()=>{
 const {system,config}=await run({branding:{personality:'Be brief.'}});
 assert.match(system,/Be brief\./);assert.match(system,/```chart/);assert.match(system,/```choices/);assert.match(system,/```mermaid/);assert.equal(config.capabilities.richResponses,true);
});
test('rich response guide can be turned off',async()=>{
 const {system,config}=await run({capabilities:{richResponses:{enabled:false}}});
 assert.doesNotMatch(system,/```chart/);assert.equal(config.capabilities.richResponses,false);
});
