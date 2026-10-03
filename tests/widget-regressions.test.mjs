import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {mount} from '../packages/widget/dist/index.js';
import {OmniChatbot} from '../packages/react/src/index.js';
const dom=new JSDOM('<html><body></body></html>',{url:'http://lan.test/'});
for(const name of ['window','document','location','HTMLElement'])globalThis[name]=dom.window[name];
Object.defineProperty(dom.window.HTMLElement.prototype,'part',{get(){return {add(){}};}});
globalThis.matchMedia=()=>({matches:false});globalThis.CSS={supports:()=>true};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const config={branding:{name:'Mira',greeting:'Hello',theme:'light',placement:'bottom-right',width:380,height:650},capabilities:{suggestions:true}};
let posted=0,streamController;
function setup({pending=false}={}){document.body.replaceChildren();posted=0;globalThis.fetch=async(input,init={})=>{const url=String(input);if(url.endsWith('/config'))return Response.json(config);if(url.endsWith('/conversations'))return Response.json({conversation:{id:'chat'},conversations:[{id:'chat',title:'Chat'}]});if(url.endsWith('/messages')){posted++;return new Response(new ReadableStream({start(c){streamController=c;if(!pending){c.enqueue(new TextEncoder().encode('event: delta\ndata: {"text":"Answer"}\n\nevent: suggestions\ndata: {"prompts":["Next step?"]}\n\nevent: done\ndata: {}\n\n'));c.close();}}}));}return Response.json({messages:[{id:'a',role:'assistant',content:'Answer',status:'complete',suggestions:['Next step?']}]});};const host=document.createElement('div');document.body.append(host);return host;}
const tick=()=>new Promise(r=>setTimeout(r,0));
function send(host,text='Help'){const root=host.shadowRoot;root.querySelector('textarea').value=text;root.querySelector('form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));}
test('LAN send works without randomUUID',async()=>{const crypto=globalThis.crypto;Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:crypto.getRandomValues.bind(crypto)}});const host=setup();const widget=mount(host,{endpoint:'/api'});try{await widget.ready;send(host);await tick();assert.equal(posted,1);assert.equal(host.shadowRoot.querySelector('.status').textContent,'Assistant response complete.');}finally{widget.destroy();Object.defineProperty(globalThis,'crypto',{configurable:true,value:crypto});}});
test('updates preserve draft and stream elements',async()=>{const host=setup({pending:true});const widget=mount(host,{endpoint:'/api'});try{await widget.ready;const area=host.shadowRoot.querySelector('textarea');area.value='Draft';widget.update({name:'New name'});assert.equal(host.shadowRoot.querySelector('textarea').value,'Draft');send(host);await tick();widget.update({theme:'dark'});streamController.enqueue(new TextEncoder().encode('event: delta\ndata: {"text":"Visible reply"}\n\nevent: done\ndata: {}\n\n'));streamController.close();await tick();assert.match(host.shadowRoot.querySelector('.messages').textContent,/Visible reply/);}finally{widget.destroy();}});
test('React parent renders preserve drafts',async()=>{const target=setup();const root=createRoot(target);try{await act(async()=>root.render(React.createElement(OmniChatbot,{endpoint:'/api',name:'Mira'})));const host=target.firstElementChild;host.shadowRoot.querySelector('textarea').value='Keep this draft';await act(async()=>root.render(React.createElement(OmniChatbot,{endpoint:'/api',name:'Mira'})));assert.equal(host.shadowRoot.querySelector('textarea').value,'Keep this draft');}finally{await act(async()=>root.unmount());}});
test('history restores suggestion buttons',async()=>{const host=setup();const widget=mount(host,{endpoint:'/api'});try{await widget.ready;send(host);await tick();host.shadowRoot.querySelector('.toolbar button').click();await tick();host.shadowRoot.querySelector('.action').click();await tick();const pill=host.shadowRoot.querySelector('.followups button');assert.equal(pill?.textContent,'Next step?');pill.click();assert.equal(host.shadowRoot.querySelector('textarea').value,'Next step?');}finally{widget.destroy();}});
test('first send persists the conversation and a remount resumes it',async()=>{
 const host=setup();let saved,created=0;
 const fetcher=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{if(String(input).endsWith('/conversations')&&init?.method==='POST')created++;return fetcher(input,init);};
 const conversationStore={load:()=>saved,save:id=>{saved=id;},clear:()=>{saved=undefined;}};
 let widget=mount(host,{endpoint:'/api',conversationStore});
 try{await widget.ready;send(host);await tick();assert.equal(saved,'chat');widget.destroy();widget=mount(host,{endpoint:'/api',conversationStore});await widget.ready;await tick();send(host,'Continue');await tick();assert.equal(created,1);}finally{widget.destroy();}
});
test('locale and labels updates translate the composer while preserving its draft',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;const area=host.shadowRoot.querySelector('textarea');area.value='Draft';widget.update({locale:'ar',labels:{send:'إرسال',message:'رسالة',messagePlaceholder:'اكتب رسالة',useSuggestion:'استخدم الاقتراح'}});assert.equal(host.shadowRoot.querySelector('.send-button').textContent,'إرسال');assert.equal(area.placeholder,'اكتب رسالة');assert.equal(area.getAttribute('aria-label'),'رسالة');assert.equal(area.value,'Draft');assert.equal(host.lang,'ar');assert.equal(host.shadowRoot.querySelector('.panel').dir,'rtl');}finally{widget.destroy();}
});
test('desktop placements match the CSS rules that anchor panel and launcher',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});const style=document.createElement('style');
 try{await widget.ready;style.textContent=host.shadowRoot.querySelector('style').textContent;document.head.append(style);
  for(const [placement,edge] of [['bottom-right','right'],['bottom-left','left']]){
   widget.update({placement});
   for(const selector of ['.panel','.launcher']){
    const element=host.shadowRoot.querySelector(selector);
    const anchors=Array.from(style.sheet.cssRules).filter(rule=>rule.selectorText&&element.matches(rule.selectorText)).map(rule=>rule.style.getPropertyValue(edge)).filter(Boolean);
    assert.equal(anchors.at(-1),'24px',`${placement} must supply a ${edge} anchor for ${selector}`);
   }
  }
 }finally{style.remove();widget.destroy();}
});
test('welcome branding updates change greeting and prompts without losing the draft',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;const area=host.shadowRoot.querySelector('textarea');area.value='Draft';widget.update({greeting:'Welcome to the new product',suggestedPrompts:['Plan my week']});assert.match(host.shadowRoot.querySelector('.messages').textContent,/Welcome to the new product/);assert.equal(area.value,'Draft');const pill=host.shadowRoot.querySelector('.prompts button');assert.equal(pill.textContent,'Plan my week');pill.click();assert.equal(area.value,'Plan my week');}finally{widget.destroy();}
});
test('suggestion generation status uses the configured localized label',async()=>{
 const host=setup({pending:true});const widget=mount(host,{endpoint:'/api',labels:{nextSteps:'Buscando próximos pasos…'}});
 try{await widget.ready;send(host);await tick();streamController.enqueue(new TextEncoder().encode('event: status\ndata: {"code":"suggestions","message":"Finding useful next steps…"}\n\n'));await tick();assert.equal(host.shadowRoot.querySelector('.status').textContent,'Buscando próximos pasos…');}finally{streamController.close();await tick();widget.destroy();}
});
test('a rejected preference save is shown as failure rather than saved',async()=>{
 const host=setup();const fetcher=globalThis.fetch;
 globalThis.fetch=async(input,init)=>String(input).endsWith('/preferences')?Response.json(init?.method==='PUT'?{error:{message:'Expired token'}}:{preferences:{}},{status:init?.method==='PUT'?401:200}):fetcher(input,init);
 const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;host.shadowRoot.querySelectorAll('.toolbar button')[2].click();await tick();const save=host.shadowRoot.querySelectorAll('.settings .action')[0];save.click();await tick();assert.equal(save.textContent,'Unable to save. Try again.');}finally{widget.destroy();}
});
test('a rejected memory deletion keeps the memory visible',async()=>{
 const host=setup();const fetcher=globalThis.fetch;
 globalThis.fetch=async(input,init)=>String(input).endsWith('/memories')?Response.json({memories:[{id:'memory',content:'Important detail'}]}):init?.method==='DELETE'?Response.json({error:{message:'Expired token'}},{status:401}):fetcher(input,init);
 const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;host.shadowRoot.querySelectorAll('.toolbar button')[2].click();await tick();const row=host.shadowRoot.querySelector('.memory');row.querySelectorAll('button')[1].click();await tick();assert.equal(row.isConnected,true);assert.equal(row.querySelectorAll('button')[1].textContent,'Unable to remove. Try again.');}finally{widget.destroy();}
});
