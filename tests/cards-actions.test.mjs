import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mount} from '../packages/widget/dist/index.js';
const dom=new JSDOM('<html><body></body></html>',{url:'http://lan.test/'});
for(const name of ['window','document','location','HTMLElement'])globalThis[name]=dom.window[name];
Object.defineProperty(dom.window.HTMLElement.prototype,'part',{get(){return {add(){}};}});
globalThis.matchMedia=()=>({matches:false});globalThis.CSS={supports:()=>true};
const config={branding:{name:'Mira',greeting:'Hello',theme:'light',placement:'bottom-right',width:380,height:650},capabilities:{}};
const encoder=new TextEncoder();
let bodies=[],replies=[],live;
function stream(reply){return new Response(new ReadableStream({start(c){if(reply==='pending'){live=c;return;}c.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({text:reply})}\n\nevent: done\ndata: {}\n\n`));c.close();}}));}
function setup({history}={}){
 document.body.replaceChildren();bodies=[];replies=[];
 globalThis.fetch=async(input,init={})=>{const url=String(input);
  if(url.endsWith('/config'))return Response.json(config);
  if(url.endsWith('/conversations'))return Response.json({conversation:{id:'chat'},conversations:[{id:'chat',title:'Chat'}]});
  if(url.endsWith('/conversations/chat'))return Response.json({messages:history??[]});
  if(url.endsWith('/messages')){bodies.push(JSON.parse(init.body));const r=replies.shift()??'ok';return r==='fail'?new Response('down',{status:503}):stream(r);}
  return Response.json({});};
 const host=document.createElement('div');document.body.append(host);return host;
}
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setTimeout(r,0));};
const $$=(host,selector)=>[...host.shadowRoot.querySelectorAll(selector)];
async function say(host,reply,text='Hi'){replies.push(reply);const root=host.shadowRoot;root.querySelector('textarea').value=text;root.querySelector('form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await settle();}
const last=host=>$$(host,'.msg.rich').at(-1);
const fence=(kind,json)=>'```'+kind+'\n'+JSON.stringify(json)+'\n```';

test('an actions value button posts its label as content and its value as tap',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,fence('actions',{heading:'Pick a time',buttons:[{label:'Tue 3 pm',value:'opaque-1'}]}));
  const button=last(host).querySelector('.actions button');assert.equal(button.textContent,'Tue 3 pm');
  assert.equal(last(host).querySelector('.actions-heading')?.textContent,'Pick a time');
  button.click();await settle();
  const sent=bodies.at(-1);assert.equal(sent.content,'Tue 3 pm');assert.equal(sent.tap,'opaque-1');
 }finally{widget.destroy();}
});

test('a typed message after a tap carries no tap',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,fence('actions',[{label:'A',value:'v-a'}]));
  last(host).querySelector('.actions button').click();await settle();
  await say(host,'ok','typed');assert.equal(bodies.at(-1).content,'typed');assert.equal('tap' in bodies.at(-1),false);
 }finally{widget.destroy();}
});

test('a host button calls onAction and posts nothing',async()=>{
 const host=setup();const calls=[];const widget=mount(host,{endpoint:'/api',onAction:e=>calls.push(e)});
 try{await widget.ready;await say(host,fence('actions',[{label:'Open',host:{action:'open',params:{id:'x'}}}]));
  const before=bodies.length;last(host).querySelector('.actions button').click();await settle();
  assert.deepEqual(calls,[{action:'open',params:{id:'x'}}]);assert.equal(bodies.length,before);
 }finally{widget.destroy();}
});

test('cards render title, subtitle, at most 3 facts and 2 buttons, and only http(s) images',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,fence('cards',{cards:[
   {title:'One',subtitle:'Sub',image:'https://img.test/a.png',facts:['f1','f2','f3','f4','f5'],buttons:[{label:'b1',value:'v1'},{label:'b2',value:'v2'},{label:'b3',value:'v3'}]},
   {title:'Two',image:'javascript:alert(1)'}]}));
  const cards=last(host).querySelectorAll('.card');assert.equal(cards.length,2);
  assert.equal(cards[0].querySelector('.card-title').textContent,'One');assert.equal(cards[0].querySelector('.card-subtitle').textContent,'Sub');
  assert.equal(cards[0].querySelectorAll('.card-fact').length,3);assert.equal(cards[0].querySelectorAll('button').length,2);
  assert.equal(cards[0].querySelector('img').getAttribute('src'),'https://img.test/a.png');assert.equal(cards[1].querySelector('img'),null);
  cards[0].querySelectorAll('button')[1].click();await settle();assert.equal(bodies.at(-1).tap,'v2');
 }finally{widget.destroy();}
});

test('caps: 6 cards, 8 buttons, 80-character labels, and a value over 200 characters drops its button',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;
  await say(host,fence('cards',{cards:Array.from({length:7},(_,i)=>({title:'C'+i}))}));assert.equal(last(host).querySelectorAll('.card').length,6);
  const buttons=Array.from({length:9},(_,i)=>({label:'B'+i,value:'v'+i}));buttons[0]={label:'x'.repeat(120),value:'v'};buttons[1]={label:'long',value:'y'.repeat(201)};
  await say(host,fence('actions',buttons));const shown=[...last(host).querySelectorAll('.actions button')];
  assert.equal(shown.length,8);assert.equal(shown[0].textContent.length,80);assert.ok(!shown.some(b=>b.textContent==='long'));
 }finally{widget.destroy();}
});

test('buttons die when the next message is sent and are inert in restored history',async()=>{
 const block=fence('actions',[{label:'A',value:'v-a'}]);
 const host=setup({history:[{id:'1',role:'user',content:'hi',status:'complete'},{id:'2',role:'assistant',content:block,status:'complete'}]});
 const widget=mount(host,{endpoint:'/api',conversationStore:{load:()=>'chat',save(){}}});
 try{await widget.ready;await settle();assert.equal(last(host).querySelector('.actions button').disabled,true);
  await say(host,block);const live=last(host).querySelector('.actions button');assert.equal(live.disabled,false);
  await say(host,'ok','something else');assert.equal(live.disabled,true);
 }finally{widget.destroy();}
});

test('unknown fields are ignored and invalid JSON falls back to a code block',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;
  await say(host,fence('actions',[{label:'A',value:'v',onclick:'alert(1)',href:'javascript:x'}]));const b=last(host).querySelector('.actions button');
  assert.equal(b.getAttribute('onclick'),null);assert.equal(b.getAttribute('href'),null);
  await say(host,'```actions\n{not json\n```');assert.ok(last(host).querySelector('.code-block'));
  await say(host,'```cards\n[]\n```');assert.ok(last(host).querySelector('.code-block'));
 }finally{widget.destroy();}
});

test('a host button without onAction does nothing',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,fence('actions',[{label:'Open',host:{action:'open'}}]));
  const before=bodies.length;last(host).querySelector('.actions button').click();await settle();assert.equal(bodies.length,before);
 }finally{widget.destroy();}
});

test('instance.send posts text as a user message, and refuses while a reply streams',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;assert.equal(widget.send('from host'),true);await settle();assert.equal(bodies.at(-1).content,'from host');
  replies.push('pending');widget.send('second');await settle();assert.equal(widget.send('third'),false);
  live.enqueue(encoder.encode('event: done\ndata: {}\n\n'));live.close();await settle();
 }finally{widget.destroy();}
});

test('the rich flags can turn cards and actions off',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api',rich:{cards:false,actions:false}});
 try{await widget.ready;await say(host,fence('actions',[{label:'A',value:'v'}]));assert.equal(last(host).querySelector('.actions'),null);assert.ok(last(host).querySelector('.code-block'));
 }finally{widget.destroy();}
});

test('a button marked primary stands out; others do not, and primary must be true',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,fence('actions',[{label:'Go',value:'v1',primary:true},{label:'Back',value:'v2'},{label:'Odd',value:'v3',primary:'yes'}]));
  const [go,back,odd]=[...last(host).querySelectorAll('.actions button')];
  assert.ok(go.classList.contains('primary'));assert.ok(!back.classList.contains('primary'));assert.ok(!odd.classList.contains('primary'));
 }finally{widget.destroy();}
});

test('Retry after a failed send keeps the tap of the button that was pressed',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,fence('actions',[{label:'Go',value:'opaque-9'}]));
  replies.push('fail');last(host).querySelector('.actions button').click();await settle();
  assert.equal(bodies.at(-1).tap,'opaque-9');
  const retry=[...host.shadowRoot.querySelectorAll('.failed-note button')].at(-1);assert.ok(retry,'a Retry button');
  retry.click();await settle();
  assert.equal(bodies.at(-1).content,'Go');assert.equal(bodies.at(-1).tap,'opaque-9');
 }finally{widget.destroy();}
});
