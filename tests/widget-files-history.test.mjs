import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mount} from '../packages/widget/dist/index.js';
const dom=new JSDOM('<html><body></body></html>',{url:'http://lan.test/'});
for(const name of ['window','document','location','HTMLElement','Event','KeyboardEvent','File','FormData'])globalThis[name]=dom.window[name];
Object.defineProperty(dom.window.HTMLElement.prototype,'part',{get(){return {add(){}};}});
globalThis.matchMedia=()=>({matches:false});globalThis.CSS={supports:()=>true};
const tick=()=>new Promise(r=>setTimeout(r,0));
const config={branding:{name:'Mira',greeting:'Hello',theme:'light',placement:'bottom-right',width:380,height:650},capabilities:{images:true,documents:true,documentTypes:['application/pdf','text/plain'],suggestions:false}};
const stream=()=>new Response('event: delta\ndata: {"text":"Read it."}\n\nevent: done\ndata: {"messageId":"m"}\n\n',{headers:{'content-type':'text/event-stream'}});
function setup(routes={}){
 document.body.replaceChildren();const calls=[];
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input)),path=url.pathname.replace(/^\/api/,''),method=init.method??'GET';calls.push({path,method,body:init.body});
  const route=routes[`${method} ${path}`];if(route)return route(init);
  if(path==='/config')return Response.json(config);
  if(path==='/conversations'&&method==='POST')return Response.json({conversation:{id:'chat',title:'New conversation'}});
  if(path==='/media')return Response.json({mediaId:'doc-1',kind:'document',name:'transcript.pdf'},{status:201});
  if(path.endsWith('/messages'))return stream();
  if(path.startsWith('/conversations/'))return Response.json({conversation:{id:'chat'},messages:[]});
  return Response.json({error:{message:'unexpected'}},{status:404});
 };
 const host=document.createElement('div');document.body.append(host);return {host,calls};
}
const pick=(root,files)=>{const picker=root.querySelector('input[type=file]');Object.defineProperty(picker,'files',{configurable:true,value:files});picker.dispatchEvent(new Event('change'));};

test('attaching a file shows a removable chip and sends it as a document the bubble names',async()=>{
 const {host,calls}=setup();const widget=mount(host,{endpoint:'/api'});
 try{
  await widget.ready;const root=host.shadowRoot;
  assert.equal(root.querySelector('.attach').getAttribute('aria-label'),'Attach file');
  assert.match(root.querySelector('input[type=file]').accept,/application\/pdf.*\.pdf/);
  pick(root,[new File(['%PDF'],'transcript.pdf',{type:'application/pdf'}),new File(['x'],'extra.txt',{type:'text/plain'})]);
  assert.deepEqual([...root.querySelectorAll('.attachments .chip span:not(.kind)')].map(n=>n.textContent),['transcript.pdf','extra.txt']);
  root.querySelectorAll('.attachments .chip button')[1].click();
  assert.deepEqual([...root.querySelectorAll('.attachments .chip span:not(.kind)')].map(n=>n.textContent),['transcript.pdf']);
  root.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));await tick();await tick();
  const sent=JSON.parse(calls.find(c=>c.path.endsWith('/messages')).body);
  assert.equal(sent.content,'Take a look at this file.');assert.deepEqual(sent.documentIds,['doc-1']);assert.deepEqual(sent.mediaIds,[]);
  assert.equal(root.querySelector('.msg.user .chip span:not(.kind)').textContent,'transcript.pdf');
  assert.equal(root.querySelectorAll('.attachments .chip').length,0);
 }finally{widget.destroy();}
});

test('a saved message shows its attached file as a chip, not the file text',async()=>{
 const {host}=setup({'GET /conversations/chat':()=>Response.json({conversation:{id:'chat'},messages:[{id:'1',role:'user',status:'complete',content:'Check this\n\n<attached-file name="cv.pdf">\nSecret long text\n</attached-file>\n\n<attached-file name="notes.txt">\nMore\n</attached-file>'}]})});
 const widget=mount(host,{endpoint:'/api',conversationStore:{load:()=>'chat',save(){}}});
 try{
  await widget.ready;await tick();const bubble=host.shadowRoot.querySelector('.msg.user');
  assert.deepEqual([...bubble.querySelectorAll('.chip span:not(.kind)')].map(n=>n.textContent),['cv.pdf','notes.txt']);
  assert.doesNotMatch(bubble.textContent,/Secret long text/);assert.match(bubble.textContent,/^Check this/);
 }finally{widget.destroy();}
});

test('History renames a chat in place: Enter saves, Escape cancels',async()=>{
 const {host,calls}=setup({'GET /conversations':()=>Response.json({conversations:[{id:'c1',title:'New conversation'}]}),'PATCH /conversations/c1':()=>Response.json({conversation:{id:'c1',title:'UK plan'}})});
 const widget=mount(host,{endpoint:'/api'});
 try{
  await widget.ready;const root=host.shadowRoot;widget.open();
  root.querySelectorAll('.toolbar button')[0].click();await tick();
  root.querySelector('.list .row .ghost').click();
  let input=root.querySelector('.list .row input');input.value='Draft';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(root.querySelector('.list .row button').textContent,'New conversation');
  assert.equal(root.querySelector('.panel').classList.contains('hidden'),false);
  root.querySelector('.list .row .ghost').click();
  input=root.querySelector('.list .row input');input.value='  UK   plan ';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await tick();
  assert.deepEqual(JSON.parse(calls.find(c=>c.method==='PATCH').body),{title:'UK plan'});
  assert.equal(root.querySelector('.list .row button').textContent,'UK plan');
 }finally{widget.destroy();}
});

test('Shared sorts links into host groups, lists files, and opens the chat a file came from',async()=>{
 const shared={links:[{url:'https://www.lattu.ai/journey/42',title:'Your journey',conversationId:'c1',conversationTitle:'Plan'},{url:'https://example.edu/fees',title:'Fees',conversationId:'c2',conversationTitle:'Costs'}],media:[],files:[{id:'f1',name:'cv.pdf',conversationId:'c2',conversationTitle:'Costs'}]};
 const {host,calls}=setup({'GET /shared':()=>Response.json(shared)});
 const widget=mount(host,{endpoint:'/api',linkGroups:[{label:'Journeys',match:url=>url.pathname.startsWith('/journey')}]});
 try{
  await widget.ready;const root=host.shadowRoot;
  assert.equal(root.querySelectorAll('.toolbar button')[1].textContent,'Shared');
  root.querySelectorAll('.toolbar button')[1].click();await tick();
  const tabs=[...root.querySelectorAll('.tabs button')];
  assert.deepEqual(tabs.map(t=>t.textContent),['Journeys','Links','Media','Files']);
  assert.deepEqual([...root.querySelectorAll('.shared a')].map(a=>a.textContent),['Your journey']);
  tabs[1].click();assert.deepEqual([...root.querySelectorAll('.shared a')].map(a=>a.textContent),['Fees']);
  tabs[2].click();assert.equal(root.querySelector('.shared .empty').textContent,'Images you send will appear here.');
  tabs[3].click();root.querySelector('.shared .name').click();await tick();
  assert.ok(calls.some(c=>c.path==='/conversations/c2'&&c.method==='GET'));
  assert.ok(root.querySelector('.compose'));
 }finally{widget.destroy();}
});

const drag=(el,type,files)=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{types:['Files'],files,dropEffect:'none'}});el.dispatchEvent(e);return e;};

test('files dropped on the open chat are attached like picked ones; types it cannot read are left out',async()=>{
 const {host}=setup();const widget=mount(host,{endpoint:'/api'});
 try{
  await widget.ready;const root=host.shadowRoot;widget.open();const panel=root.querySelector('section');
  assert.equal(drag(panel,'dragenter',[]).defaultPrevented,true);
  assert.ok(panel.classList.contains('dropping'));
  assert.equal(drag(panel,'dragover',[]).defaultPrevented,true);
  drag(panel,'drop',[new File(['%PDF'],'cv.pdf',{type:'application/pdf'}),new File(['x'],'notes.txt',{type:''}),new File(['MZ'],'tool.exe',{type:'application/x-msdownload'})]);
  assert.ok(!panel.classList.contains('dropping'));
  assert.deepEqual([...root.querySelectorAll('.attachments .chip span:not(.kind)')].map(n=>n.textContent),['cv.pdf','notes.txt']);
  assert.match(root.querySelector('.status').textContent,/tool\.exe/);
 }finally{widget.destroy();}
});
