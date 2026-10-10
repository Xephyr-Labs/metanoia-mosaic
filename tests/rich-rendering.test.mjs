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
let posts=[],replies=[],live;
// A reply is a Markdown string (streamed then done) or 'pending' (stream stays open; push frames with emit()).
function stream(reply){return new Response(new ReadableStream({start(c){if(reply==='pending'){live=c;return;}c.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({text:reply})}\n\nevent: done\ndata: {}\n\n`));c.close();}}));}
const emit=(event,data)=>live.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
function setup({history}={}){
 document.body.replaceChildren();posts=[];replies=[];
 globalThis.fetch=async(input,init={})=>{const url=String(input);
  if(url.endsWith('/config'))return Response.json(config);
  if(url.endsWith('/conversations'))return Response.json({conversation:{id:'chat'},conversations:[{id:'chat',title:'Chat'}]});
  if(url.endsWith('/conversations/chat'))return Response.json({messages:history??[]});
  if(url.endsWith('/messages')){posts.push(JSON.parse(init.body).content);return stream(replies.shift()??'ok');}
  return Response.json({});};
 const host=document.createElement('div');document.body.append(host);return host;
}
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setTimeout(r,0));};
const $=(host,selector)=>host.shadowRoot.querySelector(selector),$$=(host,selector)=>[...host.shadowRoot.querySelectorAll(selector)];
async function say(host,reply,text='Hi'){replies.push(reply);const root=host.shadowRoot;root.querySelector('textarea').value=text;root.querySelector('form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await settle();}
const last=host=>$$(host,'.msg.rich').at(-1);
const moduleUrl=code=>`data:text/javascript,${encodeURIComponent(code)}`;
const katexStub=moduleUrl('export default {renderToString:(t,o)=>"<math data-display=\\""+o.displayMode+"\\">"+t+"</math>"}');

test('tables render with header, alignment, and inline markdown',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'| Plan | Price |\n|:--|--:|\n| **Pro** | 9 |\n| Team |');
  const msg=last(host);assert.deepEqual([...msg.querySelectorAll('th')].map(n=>n.textContent),['Plan','Price']);
  const cells=[...msg.querySelectorAll('tbody td')];assert.equal(cells.length,4);assert.equal(cells[0].querySelector('strong')?.textContent,'Pro');assert.equal(cells[1].style.textAlign,'right');assert.equal(cells[3].textContent,'');
 }finally{widget.destroy();}
});
test('blockquotes, rules, strikethrough, and task lists render',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'> quoted **bit**\n\n---\n\n~~old~~ new\n\n- [x] done\n- [ ] todo');
  const msg=last(host);assert.equal(msg.querySelector('blockquote strong')?.textContent,'bit');assert.ok(msg.querySelector('hr'));assert.equal(msg.querySelector('del')?.textContent,'old');
  const boxes=[...msg.querySelectorAll('li.task input[type=checkbox]')];assert.deepEqual(boxes.map(b=>[b.checked,b.disabled]),[[true,true],[false,true]]);
 }finally{widget.destroy();}
});
test('images allow only http(s) and raster data URLs',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'![cat](https://img.test/c.png) ![bad](javascript:alert(1)) ![svg](data:image/svg+xml;base64,PHN2Zz4=)');
  const imgs=[...last(host).querySelectorAll('img')];assert.deepEqual(imgs.map(i=>i.getAttribute('src')),['https://img.test/c.png']);assert.equal(imgs[0].alt,'cat');assert.equal(imgs[0].closest('a')?.target,'_blank');
  assert.match(last(host).textContent,/javascript:alert/);
 }finally{widget.destroy();}
});
test('fenced code shows its language and a copy button',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'```js\nconst a = 1;\n```');
  const block=last(host).querySelector('.code-block');assert.equal(block.querySelector('pre').textContent,'const a = 1;');assert.equal(block.querySelector('.code-bar span').textContent,'js');assert.equal(block.querySelector('button.copy').textContent,'Copy');
 }finally{widget.destroy();}
});
test('inline and display math render through the KaTeX loader',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api',rich:{katexUrl:katexStub}});
 try{await widget.ready;await say(host,'Area is $x^2$.\n\n$$\na+b\n$$');await settle();
  const msg=last(host);assert.equal(msg.querySelector('.math math')?.textContent,'x^2');assert.equal(msg.querySelector('.math-display math')?.getAttribute('data-display'),'true');assert.equal(msg.querySelector('.math-display math')?.textContent,'a+b');
 }finally{widget.destroy();}
});
test('currency is not math',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api',rich:{katexUrl:katexStub}});
 try{await widget.ready;await say(host,'It costs $5 and $10, or $5-$10.');await settle();
  assert.equal(last(host).querySelector('.math,.math-source'),null);assert.equal(last(host).textContent,'It costs $5 and $10, or $5-$10.');
 }finally{widget.destroy();}
});
test('math falls back to its source when KaTeX cannot load',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api',rich:{katexUrl:moduleUrl('throw new Error("blocked")')}});
 try{await widget.ready;await say(host,'Use $e=mc^2$ here.');await settle();
  assert.equal(last(host).querySelector('code.math-source')?.textContent,'$e=mc^2$');
 }finally{widget.destroy();}
});
test('text after a code block keeps a top margin',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});const style=document.createElement('style');
 try{await widget.ready;style.textContent=host.shadowRoot.querySelector('style').textContent;document.head.append(style);
  const msg=document.createElement('div');msg.className='msg rich';msg.innerHTML='<div class="code-block"></div><p id="after"></p>';document.body.append(msg);
  const after=msg.querySelector('#after');
  const margins=[...style.sheet.cssRules].filter(rule=>rule.selectorText&&after.matches(rule.selectorText)).map(rule=>rule.style.getPropertyValue('margin-top')).filter(Boolean);
  assert.equal(parseFloat(margins.at(-1)),.65);msg.remove();
 }finally{style.remove();widget.destroy();}
});

const chart=JSON.stringify({type:'bar',title:'Revenue',labels:['Q1','Q2'],series:[{name:'2025',data:[4,6]},{name:'2026',data:[5,-2]}],unit:'$k'});
test('chart blocks render accessible SVG with legend and data table',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'```chart\n'+chart+'\n```');
  const fig=last(host).querySelector('figure.chart');assert.equal(fig.querySelector('figcaption').textContent,'Revenue');
  const svg=fig.querySelector('svg');assert.equal(svg.getAttribute('role'),'img');assert.equal(svg.getAttribute('aria-label'),'Revenue');
  const bars=[...svg.querySelectorAll('rect.bar')];assert.equal(bars.length,4);assert.match(bars[0].querySelector('title').textContent,/2025 · Q1: 4 \$k/);
  assert.ok(bars[3].classList.contains('series-2'));
  assert.deepEqual([...fig.querySelectorAll('.legend li')].map(li=>li.textContent),['2025','2026']);
  assert.equal(fig.querySelectorAll('table.sr-only tbody tr').length,2);
 }finally{widget.destroy();}
});
test('line, area, pie, and scatter charts render their marks',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 const blocks=[{type:'line',series:[{data:[1,3,2]}]},{type:'area',series:[{data:[1,3,2]}]},{type:'pie',labels:['A','B'],series:[{data:[1,3]}]},{type:'scatter',series:[{name:'s',data:[[1,2],[3,4]]}]}];
 try{await widget.ready;await say(host,blocks.map(b=>'```chart\n'+JSON.stringify(b)+'\n```').join('\n\n'));
  const figs=[...last(host).querySelectorAll('figure.chart')];assert.equal(figs.length,4);
  assert.equal(figs[0].querySelectorAll('polyline.line').length,1);assert.equal(figs[0].querySelectorAll('circle.dot').length,3);assert.equal(figs[0].querySelector('.legend'),null);
  assert.equal(figs[1].querySelectorAll('polygon.area').length,1);
  assert.equal(figs[2].querySelectorAll('path.slice').length,2);assert.equal(figs[2].querySelectorAll('.legend li').length,2);
  assert.equal(figs[3].querySelectorAll('circle.dot').length,2);
 }finally{widget.destroy();}
});
test('invalid chart JSON falls back to a code block with a note',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'```chart\n{"type":"bar","series":[{"data":["x"]}]}\n```');
  const block=last(host).querySelector('.code-block');assert.equal(block.querySelector('pre').textContent,'{"type":"bar","series":[{"data":["x"]}]}');assert.ok(block.querySelector('.render-note'));
 }finally{widget.destroy();}
});
test('an unclosed chart shows a placeholder while streaming',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'pending');emit('delta',{text:'Here:\n```chart\n{"type":'});await settle();
  assert.ok(last(host).querySelector('.render-pending'));assert.equal(last(host).querySelector('.code-block'),null);
 }finally{widget.destroy();}
});
test('unclosed chart at end of reply renders',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'```chart\n'+chart);
  assert.equal(last(host).querySelector('.render-pending'),null);assert.ok(last(host).querySelector('figure.chart'));
 }finally{widget.destroy();}
});
test('stopping mid-chart leaves no placeholder',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'pending');emit('delta',{text:'```chart\n{"type":'});await settle();
  host.shadowRoot.querySelector('form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await settle();
  assert.equal(last(host).querySelector('.render-pending'),null);assert.ok(last(host).querySelector('.code-block'));
 }finally{widget.destroy();}
});
test('disabled charts render as code',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api',rich:{charts:false}});
 try{await widget.ready;await say(host,'```chart\n'+chart+'\n```');
  assert.equal(last(host).querySelector('figure.chart'),null);assert.equal(last(host).querySelector('.code-block .render-note'),null);assert.ok(last(host).querySelector('.code-block'));
 }finally{widget.destroy();}
});

const choices='```choices\n{"question":"Which plan?","options":["Starter",{"label":"Pro","value":"I want Pro"}]}\n```';
test('a choice click sends its value and disables the group',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'Pick one:\n'+choices);
  const group=last(host).querySelector('.choices');assert.equal(group.getAttribute('aria-label'),'Which plan?');
  const buttons=[...group.querySelectorAll('button.choice')];assert.deepEqual(buttons.map(b=>[b.textContent,b.disabled]),[['Starter',false],['Pro',false]]);
  buttons[1].click();await settle();
  assert.deepEqual(posts,['Hi','I want Pro']);assert.ok(buttons.every(b=>b.disabled));assert.ok(buttons[1].classList.contains('chosen'));
 }finally{widget.destroy();}
});
test('typing a new message disables earlier choices',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,choices);const first=last(host).querySelector('button.choice');await say(host,'ok','Something else');
  assert.equal(first.disabled,true);assert.equal(first.classList.contains('chosen'),false);
 }finally{widget.destroy();}
});
test('choices stay disabled until the reply finishes',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'pending');emit('delta',{text:choices});await settle();
  const button=last(host).querySelector('button.choice');assert.equal(button.disabled,true);button.click();await settle();assert.deepEqual(posts,['Hi']);assert.equal(button.classList.contains('chosen'),false);
 }finally{widget.destroy();}
});
test('multi-select choices send the picked values together',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'```choices\n{"options":["A","B","C"],"multi":true}\n```');
  const group=last(host).querySelector('.choices'),[a,,c]=group.querySelectorAll('button.choice'),sendButton=group.querySelector('button.choice-send');
  assert.equal(sendButton.disabled,true);a.click();c.click();assert.equal(a.getAttribute('aria-pressed'),'true');assert.equal(sendButton.disabled,false);
  sendButton.click();await settle();assert.equal(posts.at(-1),'A, C');
 }finally{widget.destroy();}
});
test('choices loaded from history are read-only',async()=>{
 const host=setup({history:[{id:'1',role:'user',content:'Hi',status:'complete'},{id:'2',role:'assistant',content:choices,status:'complete'}]});
 const widget=mount(host,{endpoint:'/api',conversationStore:{load:()=>'chat',save(){}}});
 try{await widget.ready;await settle();const buttons=[...last(host).querySelectorAll('button.choice')];assert.equal(buttons.length,2);assert.ok(buttons.every(b=>b.disabled));}finally{widget.destroy();}
});
test('invalid choices fall back to code',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'```choices\n{"options":[]}\n```');assert.ok(last(host).querySelector('.code-block .render-note'));}finally{widget.destroy();}
});
