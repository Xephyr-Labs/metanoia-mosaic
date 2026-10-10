# Rich Responses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render GFM tables, charts, Mermaid diagrams, KaTeX math, model SVG, inline images, and clickable choice buttons in widget replies, and tell the model about these formats.

**Architecture:** The widget's inline Markdown renderer moves to `packages/widget/src/render/`. A line-based block parser dispatches fenced blocks by language tag to small renderers. Heavy libraries (Mermaid, KaTeX) load lazily via a cached dynamic `import(url)`, and their results are cached by key so a streaming re-render does not flicker. Core appends a short format guide to the system prompt.

**Tech Stack:** TypeScript (tsc, NodeNext ESM), esbuild (custom-element IIFE), node:test + jsdom, Mermaid 11.4.1 and KaTeX 0.16.11 from jsdelivr at runtime only.

**Spec:** `docs/superpowers/specs/2026-10-10-rich-responses-design.md`

## Global Constraints

- Model output is never parsed as HTML. The only `innerHTML` is KaTeX's own output.
- Model SVG and Mermaid output are displayed only as `<img src="data:image/svg+xml;charset=utf-8,…">`.
- No new runtime or dev dependencies in any `package.json`.
- Defaults: `mermaidUrl = https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs`, `katexUrl = https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs`.
- KaTeX options: `{displayMode, throwOnError:false, trust:false, output:"mathml"}`. Mermaid: `securityLevel:"strict"`, `htmlLabels:false`, `suppressErrorRendering:true`.
- Limits: chart ≤ 8 series, ≤ 8 pie slices, ≤ 500 points per series. Choices ≤ 12 options, labels ≤ 80 chars. SVG ≤ 100 000 chars.
- Image URLs: `http:`, `https:`, or `data:image/(png|jpeg|gif|webp);base64,` only.
- Every `rich` feature defaults on; `false` renders the block as plain code.
- Chart colors (light / dark), fixed order: `#2a78d6/#3987e5, #eb6834/#d95926, #1baf7a/#199e70, #eda100/#c98500, #e87ba4/#d55181, #008300/#008300, #4a3aa7/#9085e9, #e34948/#e66767`.
- No inline `style` attributes from the renderer (CSP `style-src` safe); color via classes plus CSS custom properties. The one exception is table cell `style.textAlign`, which uses the CSSOM and is CSP-safe.
- Follow the file's dense one-line style in `index.ts`; new render modules may use short multi-line functions.
- Build + test command: `npm test` (builds every workspace, then runs `node --test tests/*.test.mjs`).

## Review Focus

1. **Prices that look like math:** "costs $5 and $10" must stay text. Pinned in Task 1 test `currency is not math`.
2. **Model forgets to close a fence:** the final (non-streaming) render must show the content, not a permanent "Rendering…". Pinned in Task 2 test `unclosed chart at end of reply renders`.
3. **Stopped stream mid-block:** after Stop, the partial reply must not keep a placeholder forever. Pinned in Task 2 test `stopping mid-chart leaves no placeholder`.
4. **Choice click while a reply is still streaming:** must not send or mark the button chosen. Pinned in Task 3 test `choices stay disabled until the reply finishes`.
5. **SVG without `xmlns`** (very common from models): must still display as an image. Pinned in Task 4 test `svg block renders only as an image`.

---

## File Structure

- Create `packages/widget/src/render/util.ts`: shared types (`RichOptions`, `RichLabel`, `RenderContext`), `mk`, `pending`, the lazy module loader `load`, and the async result cache `deferred`.
- Create `packages/widget/src/render/markdown.ts`: block and inline Markdown parser, tables, images.
- Create `packages/widget/src/render/blocks.ts`: fenced-block dispatch, code block with copy, math, SVG, Mermaid.
- Create `packages/widget/src/render/chart.ts`: SVG charts and palette.
- Create `packages/widget/src/render/choices.ts`: choice buttons.
- Modify `packages/widget/src/index.ts`: remove the old renderer, wire in `draw`/`sendChoice`, labels, the `rich` option, CSS, and series colors.
- Modify `packages/widget/src/loader.ts`: add the `rich` property on `<metanoia-chat>`.
- Modify `packages/core/src/types.ts`, `packages/core/src/context.ts`, `packages/core/src/index.ts`: add the `richResponses` capability and format guide.
- Create `tests/rich-rendering.test.mjs`, `tests/rich-prompt.test.mjs`.
- Modify `examples/express/src/server.js`, `docs/customization.md`; create `.changeset/rich-responses.md`.

---

### Task 1: Renderer module, GFM extras, images, code blocks, math

**Files:**
- Create: `packages/widget/src/render/util.ts`, `packages/widget/src/render/markdown.ts`, `packages/widget/src/render/blocks.ts`
- Modify: `packages/widget/src/index.ts` (labels lines 2-11 and 19; `WidgetOptions` lines 14-20; CSS string; `mount` body; old `renderMarkdown`/`inline` at lines 189-218; the call sites in `loadMessages` and `submit`)
- Test: `tests/rich-rendering.test.mjs`

**Interfaces:**
- Produces (in `render/util.ts`):
  - `type RichOptions={tables?:boolean;charts?:boolean;choices?:boolean;diagrams?:boolean;math?:boolean;svg?:boolean;images?:boolean;mermaidUrl?:string;katexUrl?:string}`
  - `type RichLabel="copyCode"|"copied"|"renderFailed"|"rendering"|"sendChoices"|"illustration"|"diagram"`
  - `type RenderContext={rich:RichOptions;streaming:boolean;interactive:boolean;dark:boolean;send:(text:string)=>boolean;label:(key:RichLabel)=>string}`
  - `mk(tag:string,cls?:string):HTMLElement`, `pending(ctx:RenderContext):HTMLElement`
  - `load<T>(url:string):Promise<T>`
  - `deferred(key:string,make:()=>Promise<Node>,fallback:()=>Node,placeholder:HTMLElement):Node`
- Produces (in `render/markdown.ts`): `renderMarkdown(host:HTMLElement,text:string,ctx:RenderContext):void`, `inline(host:HTMLElement,text:string,ctx:RenderContext):void`
- Produces (in `render/blocks.ts`): `renderBlock(lang:string,source:string,closed:boolean,ctx:RenderContext):Node`, `code(lang:string,source:string,ctx:RenderContext,failed?:boolean):HTMLElement`, `math(tex:string,display:boolean,ctx:RenderContext):Node`, `flags:Record<string,keyof RichOptions>`
- Produces (in `index.ts` `mount` scope): `draw(host:HTMLElement,text:string,streaming?:boolean,interactive?:boolean):void`, `sendChoice(text:string):boolean`, `isDark:boolean`

- [ ] **Step 1: Write the failing tests**

Create `tests/rich-rendering.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: FAIL on every new test (no `th`, no `.code-block`, and so on); existing tests still pass.

- [ ] **Step 3: Create `packages/widget/src/render/util.ts`**

```ts
export type RichOptions={tables?:boolean;charts?:boolean;choices?:boolean;diagrams?:boolean;math?:boolean;svg?:boolean;images?:boolean;mermaidUrl?:string;katexUrl?:string};
export type RichLabel="copyCode"|"copied"|"renderFailed"|"rendering"|"sendChoices"|"illustration"|"diagram";
export type RenderContext={rich:RichOptions;streaming:boolean;interactive:boolean;dark:boolean;send:(text:string)=>boolean;label:(key:RichLabel)=>string};

export const mk=(tag:string,cls?:string)=>{const node=document.createElement(tag);if(cls)node.className=cls;return node;};
export function pending(ctx:RenderContext){const node=mk("div","render-pending");node.textContent=ctx.label("rendering");return node;}

// One import per URL; a rejected import stays cached so a blocked CDN is not retried on every delta.
const modules=new Map<string,Promise<unknown>>();
export function load<T>(url:string):Promise<T>{
 let module=modules.get(url);
 if(!module){module=import(url).then((m:{default?:unknown})=>m.default??m);modules.set(url,module);}
 return module as Promise<T>;
}

// Streaming re-renders the whole reply on every delta; finished async output is cloned from here so it never flickers.
// ponytail: unbounded per page; add LRU eviction if a session renders thousands of distinct blocks.
const results=new Map<string,Node|Error>(),jobs=new Map<string,Promise<Node>>();
export function deferred(key:string,make:()=>Promise<Node>,fallback:()=>Node,placeholder:HTMLElement):Node{
 const ready=results.get(key);
 if(ready)return ready instanceof Error?fallback():ready.cloneNode(true);
 let job=jobs.get(key);
 if(!job){job=make();jobs.set(key,job);job.then(node=>{results.set(key,node);},error=>{results.set(key,error instanceof Error?error:Error(String(error)));});}
 job.then(node=>{if(placeholder.isConnected)placeholder.replaceWith(node.cloneNode(true));},()=>{if(placeholder.isConnected)placeholder.replaceWith(fallback());});
 return placeholder;
}
```

- [ ] **Step 4: Create `packages/widget/src/render/blocks.ts`**

```ts
import { deferred, load, mk, pending, type RenderContext, type RichOptions } from "./util.js";

export const KATEX_URL="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs";
type Katex={renderToString(tex:string,options:Record<string,unknown>):string};
// Fence tag -> the `rich` flag that enables it.
export const flags:Record<string,keyof RichOptions>={math:"math"};

export function renderBlock(lang:string,source:string,closed:boolean,ctx:RenderContext):Node{
 const flag=Object.hasOwn(flags,lang)?flags[lang]!:undefined,kind=flag&&ctx.rich[flag]!==false?lang:"";
 if(kind&&!closed&&ctx.streaming)return pending(ctx);
 try{
  if(kind==="math")return math(source,true,ctx);
 }catch{return code(lang,source,ctx,true);}
 return code(lang,source,ctx);
}

export function code(lang:string,source:string,ctx:RenderContext,failed=false){
 const box=mk("div","code-block"),bar=mk("div","code-bar"),name=mk("span"),copy=mk("button","copy") as HTMLButtonElement,pre=mk("pre");
 name.textContent=lang;copy.type="button";copy.textContent=ctx.label("copyCode");pre.textContent=source;
 copy.onclick=()=>{void navigator.clipboard?.writeText(source).then(()=>{copy.textContent=ctx.label("copied");setTimeout(()=>{copy.textContent=ctx.label("copyCode");},2000);},()=>{});};
 bar.append(name,copy);box.append(bar,pre);
 if(failed){const note=mk("p","render-note");note.textContent=ctx.label("renderFailed");box.append(note);}
 return box;
}

export function math(tex:string,display:boolean,ctx:RenderContext):Node{
 const url=ctx.rich.katexUrl??KATEX_URL;
 const source=()=>{const node=mk(display?"pre":"code","math-source");node.textContent=display?tex:`$${tex}$`;return node;};
 return deferred(`${url}|${display}|${tex}`,async()=>{
  const katex=await load<Katex>(url),node=mk(display?"div":"span",display?"math-display":"math");
  // KaTeX builds this markup from the TeX source; MathML needs no KaTeX CSS or fonts inside the shadow root.
  node.innerHTML=katex.renderToString(tex,{displayMode:display,throwOnError:false,trust:false,output:"mathml"});
  return node;
 },source,source());
}
```

- [ ] **Step 5: Create `packages/widget/src/render/markdown.ts`**

```ts
import { math, renderBlock } from "./blocks.js";
import { mk, type RenderContext } from "./util.js";

// A Markdown subset built from DOM nodes so model output is never parsed as HTML.
export function renderMarkdown(host:HTMLElement,text:string,ctx:RenderContext){
 host.replaceChildren();
 const lines=text.split("\n");let list:HTMLElement|undefined,para:string[]=[];
 const flush=()=>{if(para.length){const p=mk("p");inline(p,para.join("\n"),ctx);host.append(p);para=[];}};
 const block=(node:Node)=>{flush();list=undefined;host.append(node);};
 for(let i=0;i<lines.length;i++){
  const line=lines[i]!,next=lines[i+1];
  const fence=line.match(/^\s*```\s*([\w+-]*)/);
  if(fence){
   const body:string[]=[];let closed=false;
   for(i++;i<lines.length;i++){if(/^\s*```\s*$/.test(lines[i]!)){closed=true;break;}body.push(lines[i]!);}
   block(renderBlock(fence[1]!.toLowerCase(),body.join("\n"),closed,ctx));continue;
  }
  if(ctx.rich.math!==false&&line.trim().startsWith("$$")){
   let tex=line.trim().slice(2),closed=tex.endsWith("$$");
   if(closed)tex=tex.slice(0,-2);
   else{const body=[tex];for(i++;i<lines.length;i++){const end=lines[i]!.trimEnd();if(end.endsWith("$$")){body.push(end.slice(0,-2));closed=true;break;}body.push(lines[i]!);}tex=body.join("\n");}
   block(renderBlock("math",tex.trim(),closed,ctx));continue;
  }
  if(ctx.rich.tables!==false&&line.includes("|")&&next?.includes("|")&&/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(next)){
   const rows=[line];for(i+=2;i<lines.length&&lines[i]!.includes("|");i++)rows.push(lines[i]!);i--;
   block(table(rows,next,ctx));continue;
  }
  if(/^\s*>/.test(line)){
   const body:string[]=[];for(;i<lines.length&&/^\s*>/.test(lines[i]!);i++)body.push(lines[i]!.replace(/^\s*>\s?/,""));i--;
   const quote=mk("blockquote");renderMarkdown(quote,body.join("\n"),ctx);block(quote);continue;
  }
  if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)){block(mk("hr"));continue;}
  const item=line.match(/^\s*(?:([-*+•])|(\d+)[.)])\s+(.*)$/);
  if(item){
   flush();const tag=item[1]?"ul":"ol";
   if(list?.tagName.toLowerCase()!==tag){list=mk(tag);host.append(list);}
   const li=mk("li"),task=item[3]!.match(/^\[([ xX])\]\s+(.*)$/);
   if(task){const box=mk("input") as HTMLInputElement;box.type="checkbox";box.checked=task[1]!==" ";box.disabled=true;li.className="task";li.append(box," ");inline(li,task[2]!,ctx);}
   else inline(li,item[3]!,ctx);
   list!.append(li);continue;
  }
  const heading=line.match(/^#{1,6}\s+(.*)$/);
  if(heading){const p=mk("p","heading");inline(p,heading[1]!,ctx);block(p);continue;}
  if(!line.trim()){flush();list=undefined;continue;}
  list=undefined;para.push(line);
 }
 flush();
}

const cells=(row:string)=>row.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(cell=>cell.trim());
function table(rows:string[],separator:string,ctx:RenderContext){
 const align=cells(separator).map(c=>c.startsWith(":")&&c.endsWith(":")?"center":c.endsWith(":")?"right":c.startsWith(":")?"left":""),width=cells(rows[0]!).length;
 const wrap=mk("div","table-wrap"),node=mk("table"),head=mk("thead"),body=mk("tbody");
 rows.forEach((row,r)=>{
  const tr=mk("tr"),values=cells(row);
  for(let c=0;c<width;c++){const cell=mk(r?"td":"th");if(align[c])cell.style.textAlign=align[c]!;inline(cell,values[c]??"",ctx);tr.append(cell);}
  (r?body:head).append(tr);
 });
 node.append(head,body);wrap.append(node);wrap.tabIndex=0;return wrap;
}

function image(alt:string,src:string){
 const img=mk("img","inline-image") as HTMLImageElement;img.alt=alt;img.setAttribute("loading","lazy");img.setAttribute("referrerpolicy","no-referrer");img.src=src;img.onerror=()=>img.replaceWith(alt);
 if(!/^https?:/i.test(src))return img;
 const link=mk("a") as HTMLAnchorElement;link.href=src;link.target="_blank";link.rel="noopener noreferrer";link.append(img);return link;
}

// Inline math needs a non-space after the opening `$` and before the closing `$`, and no digit after it, so "$5 and $10" stays text.
const INLINE=/!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)[^\s)]+)\)|\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|~~(.+?)~~|\$(?=\S)([^$\n]+?)(?<=\S)\$(?!\d)|\*([^*\s][^*]*?)\*/g;
export function inline(host:HTMLElement,text:string,ctx:RenderContext){
 let last=0;
 for(const m of text.matchAll(INLINE)){
  host.append(text.slice(last,m.index));let node:Node;
  if(m[2]!==undefined)node=ctx.rich.images===false?document.createTextNode(m[1]!):image(m[1]!,m[2]);
  else if(m[3]!==undefined){node=mk("strong");inline(node as HTMLElement,m[3],ctx);}
  else if(m[4]!==undefined){node=mk("code");node.textContent=m[4];}
  else if(m[5]!==undefined){const link=mk("a") as HTMLAnchorElement;link.href=m[6]!;link.target="_blank";link.rel="noopener noreferrer";link.textContent=m[5];node=link;}
  else if(m[7]!==undefined){node=mk("del");inline(node as HTMLElement,m[7],ctx);}
  else if(m[8]!==undefined)node=ctx.rich.math===false?document.createTextNode(m[0]):math(m[8],false,ctx);
  else{node=mk("em");node.textContent=m[9]!;}
  host.append(node);last=m.index!+m[0].length;
 }
 host.append(text.slice(last));
}
```

- [ ] **Step 6: Wire into `packages/widget/src/index.ts`**

1. Add at the top of the file:
```ts
import { renderMarkdown } from "./render/markdown.js";
import type { RichOptions } from "./render/util.js";
export type { RichOptions } from "./render/util.js";
```
2. In the `WidgetLabels` union, change the last line from `| "saveFailed" | … | "retry",` to append ` | "copyCode" | "copied" | "renderFailed" | "rendering" | "sendChoices" | "illustration" | "diagram"` before the comma.
3. In `WidgetOptions`, after `launcher?:"bubble"|"button"; greeting?:string; suggestedPrompts?:string[];`, add a line: ` rich?:RichOptions;`
4. In `labelDefaults`, after `retry:"Retry"` add: `,copyCode:"Copy",copied:"Copied",renderFailed:"Couldn't render this block.",rendering:"Rendering…",sendChoices:"Send selection",illustration:"Illustration",diagram:"Diagram"`
5. Delete the whole `// A deliberately small Markdown subset…` comment, `function renderMarkdown(…){…}`, and `function inline(…){…}` (lines 189-218).
6. In `mount`'s first `let` list, after `destroyed=false` add `,isDark=false`. In `paint`, immediately after `const previous=…;const wasOpen=…,…,hostStyle=(root.host as HTMLElement).style;` add `isDark=dark;`.
7. Right after the `const mk=…` line inside `mount`, add:
```ts
 const draw=(host:HTMLElement,text:string,streaming=false,interactive=false)=>renderMarkdown(host,text,{rich:current.rich??{},streaming,interactive,dark:isDark,send:sendChoice,label});
 function sendChoice(text:string){const area=panel.querySelector<HTMLTextAreaElement>(".compose textarea");if(submitting||destroyed||!area?.form)return false;area.value=text;area.form.requestSubmit();return true;}
```
8. Replace the call sites:
   - In `loadMessages`: `else renderMarkdown(el,m.content);` becomes `else draw(el,m.content);`
   - In `submit`'s delta handler: `renderMarkdown(answer,raw);` becomes `draw(answer,raw,true);`
   - In `submit`'s `event==="done"` branch: insert `draw(answer,raw,false,true);` right after `finished=true;`
   - In `fail`: `if(raw)return;` becomes `if(raw){draw(answer,raw);return;}`
   - In the final `catch` aborted branch: `if(!raw){answer.remove();sources.remove();}` becomes `if(!raw){answer.remove();sources.remove();}else draw(answer,raw);`
9. In the `css` template, after the `.msg.rich a{…}` line, add:
```css
.msg.rich:has(.table-wrap,.code-block,.chart,.diagram,.illustration,.math-display){width:min(88%,520px)}
.msg.rich .table-wrap{margin-top:.65em;max-width:100%;overflow:auto;border:1px solid var(--omni-border);border-radius:9px}
.msg.rich .table-wrap:focus-visible{outline:2px solid var(--omni-ring);outline-offset:2px}
.msg.rich table{border-collapse:collapse;min-width:100%;font-size:12px}
.msg.rich th,.msg.rich td{padding:6px 9px;border-bottom:1px solid var(--omni-border);text-align:start;vertical-align:top}
.msg.rich tbody tr:last-child td{border-bottom:0}
.msg.rich th{font-weight:650;background:color-mix(in srgb,var(--omni-fg) 4%,transparent)}
.msg.rich blockquote{margin:.65em 0 0;padding-inline-start:10px;border-inline-start:3px solid var(--omni-border);color:var(--omni-muted)}
.msg.rich hr{border:0;border-top:1px solid var(--omni-border);margin:.8em 0}
.msg.rich li.task{list-style:none;margin-inline-start:-1.2em}
.msg.rich img.inline-image{display:block;max-width:100%;height:auto;margin-top:.65em;border-radius:9px}
.msg.rich .code-block{margin-top:.65em;border-radius:9px;overflow:hidden;background:color-mix(in srgb,var(--omni-fg) 6%,transparent)}
.msg.rich .code-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 5px 0 12px;font-size:11px;color:var(--omni-muted)}
.msg.rich .code-bar .copy{min-height:26px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--omni-muted);font-size:11px;cursor:pointer}
.msg.rich .code-bar .copy:hover{background:color-mix(in srgb,var(--omni-fg) 8%,transparent);color:var(--omni-fg)}
.msg.rich .code-block pre{margin:0;background:transparent}
.msg.rich .render-note{margin:0;padding:0 12px 8px;font-size:11px;color:var(--omni-muted)}
.msg.rich .render-pending{margin-top:.65em;padding:14px 12px;border-radius:9px;font-size:12px;color:var(--omni-muted);background:color-mix(in srgb,var(--omni-fg) 4%,transparent)}
.msg.rich .math-display{margin-top:.65em;overflow-x:auto;text-align:center}
.msg.rich pre.math-source{white-space:pre-wrap}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`. If an existing widget test fails because the code `pre` is now inside `.code-block`, fix the renderer, not the test.

- [ ] **Step 8: Commit**

```bash
git add packages/widget/src tests/rich-rendering.test.mjs
git commit -m "feat(widget): tables, quotes, tasks, images, code copy, and math"
```

---

### Task 2: Charts and streaming placeholders

**Files:**
- Create: `packages/widget/src/render/chart.ts`
- Modify: `packages/widget/src/render/blocks.ts`, `packages/widget/src/index.ts` (paint series colors, CSS)
- Test: `tests/rich-rendering.test.mjs`

**Interfaces:**
- Consumes: `mk` from `render/util.ts`; `flags`, `renderBlock` in `render/blocks.ts`; `draw` in `index.ts`
- Produces: `renderChart(source:string):HTMLElement` (throws on invalid input), `seriesColors(dark:boolean):string[]`

- [ ] **Step 1: Write the failing tests** (append to `tests/rich-rendering.test.mjs`)

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: the chart tests FAIL (no `figure.chart`, no `.render-pending`). `disabled charts render as code` and `stopping mid-chart` may already pass, which is fine.

- [ ] **Step 3: Create `packages/widget/src/render/chart.ts`**

```ts
import { mk } from "./util.js";

const NS="http://www.w3.org/2000/svg",W=300,H=190,PAD={l:34,r:8,t:8,b:20},TYPES=["bar","line","area","pie","scatter"];
// Validated categorical palette (dataviz reference), fixed order, light then dark steps.
const LIGHT=["#2a78d6","#eb6834","#1baf7a","#eda100","#e87ba4","#008300","#4a3aa7","#e34948"],DARK=["#3987e5","#d95926","#199e70","#c98500","#d55181","#008300","#9085e9","#e66767"];
export const seriesColors=(dark:boolean)=>dark?DARK:LIGHT;

type Point=[number,number];type Series={name?:string;data:(number|Point)[]};type Chart={type:string;title?:string;labels?:unknown[];series:Series[];unit?:string};
const num=new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:2});
const fmt=(v:number,unit="")=>`${num.format(v)}${unit?` ${unit}`:""}`;
const short=(s:string)=>s.length>10?`${s.slice(0,9)}…`:s;
function el(tag:string,attrs:Record<string,string|number>,tip?:string){
 const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));
 if(tip){const title=document.createElementNS(NS,"title");title.textContent=tip;node.append(title);}
 return node;
}
function text(x:number,y:number,value:string,anchor:string){const node=el("text",{x,y,"text-anchor":anchor,class:"tick"});node.textContent=value;return node;}

function parse(source:string):Chart{
 const spec=JSON.parse(source) as Chart,bad=()=>{throw Error("chart");};
 if(!spec||typeof spec!=="object"||!TYPES.includes(spec.type)||!Array.isArray(spec.series)||!spec.series.length||spec.series.length>8)bad();
 if(spec.labels!==undefined&&!Array.isArray(spec.labels))bad();
 for(const s of spec.series){
  if(!Array.isArray(s?.data)||!s.data.length||s.data.length>500)bad();
  const ok=spec.type==="scatter"?s.data.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)):s.data.every(Number.isFinite);
  if(!ok)bad();
 }
 if(spec.type==="pie"){const data=spec.series[0]!.data as number[];if(data.length>8||data.some(v=>v<0)||!(data.reduce((a,b)=>a+b,0)>0))bad();}
 return spec;
}

function ticks(min:number,max:number){
 if(min===max)max=min+1;
 const raw=(max-min)/5,mag=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].map(f=>f*mag).find(s=>s>=raw)!,out:number[]=[];
 for(let v=Math.floor(min/step)*step;v<=Math.ceil(max/step)*step+step/2;v+=step)out.push(+v.toFixed(10));
 return out;
}
function axisY(svg:SVGElement,ys:number[],y:(v:number)=>number){
 for(const v of ys){svg.append(el("line",{x1:PAD.l,x2:W-PAD.r,y1:y(v),y2:y(v),class:v===0?"axis":"grid"}),text(PAD.l-4,y(v)+3,num.format(v),"end"));}
}

export function renderChart(source:string){
 const spec=parse(source),fig=mk("figure","chart"),svg=el("svg",{viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":spec.title??"Chart"}) as SVGElement;
 const label=(i:number)=>String(spec.labels?.[i]??i+1),name=(s:Series,i:number)=>s.name??`Series ${i+1}`;
 if(spec.title){const caption=mk("figcaption");caption.textContent=spec.title;fig.append(caption);}
 if(spec.type==="pie")pie(svg,spec,label);else if(spec.type==="scatter")scatter(svg,spec,name);else cartesian(svg,spec,label,name);
 fig.append(svg);
 const keys=spec.type==="pie"?spec.series[0]!.data.map((_,i)=>label(i)):spec.series.length>1?spec.series.map(name):[];
 if(keys.length){const legend=mk("ul","legend");keys.forEach((key,i)=>{const li=mk("li");li.append(mk("span",`swatch series-${i+1}`),key);legend.append(li);});fig.append(legend);}
 fig.append(dataTable(spec,label,name));
 return fig;
}

function cartesian(svg:SVGElement,spec:Chart,label:(i:number)=>string,name:(s:Series,i:number)=>string){
 const series=spec.series.map(s=>s.data as number[]),n=Math.max(...series.map(d=>d.length)),values=series.flat();
 const ys=ticks(Math.min(0,...values),Math.max(0,...values)),lo=ys[0]!,hi=ys.at(-1)!,pw=W-PAD.l-PAD.r,ph=H-PAD.t-PAD.b,band=pw/n;
 const y=(v:number)=>PAD.t+ph-(v-lo)/(hi-lo)*ph,x=(i:number)=>PAD.l+band*(i+.5);
 axisY(svg,ys,y);
 const every=Math.ceil(n/Math.max(1,Math.floor(pw/42)));
 for(let i=0;i<n;i+=every)svg.append(text(x(i),H-6,short(label(i)),"middle"));
 spec.series.forEach((s,si)=>{
  const data=s.data as number[],cls=`series-${si+1}`,tip=(i:number)=>`${name(s,si)} · ${label(i)}: ${fmt(data[i]!,spec.unit)}`;
  if(spec.type==="bar"){
   const bw=Math.max(1,band*.8/series.length-2);
   data.forEach((v,i)=>svg.append(el("rect",{x:PAD.l+band*i+band*.1+si*(bw+2),y:Math.min(y(v),y(0)),width:bw,height:Math.max(1,Math.abs(y(v)-y(0))),rx:2,class:`bar ${cls}`},tip(i))));
   return;
  }
  const points=data.map((v,i)=>`${x(i)},${y(v)}`).join(" ");
  if(spec.type==="area")svg.append(el("polygon",{points:`${x(0)},${y(0)} ${points} ${x(data.length-1)},${y(0)}`,class:`area ${cls}`}));
  svg.append(el("polyline",{points,class:`line ${cls}`}));
  data.forEach((v,i)=>svg.append(el("circle",{cx:x(i),cy:y(v),r:n>40?1.5:3,class:`dot ${cls}`},tip(i))));
 });
}

function scatter(svg:SVGElement,spec:Chart,name:(s:Series,i:number)=>string){
 const points=spec.series.flatMap(s=>s.data as Point[]),xs=ticks(Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))),ys=ticks(Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[1])));
 const pw=W-PAD.l-PAD.r,ph=H-PAD.t-PAD.b,x=(v:number)=>PAD.l+(v-xs[0]!)/(xs.at(-1)!-xs[0]!)*pw,y=(v:number)=>PAD.t+ph-(v-ys[0]!)/(ys.at(-1)!-ys[0]!)*ph;
 axisY(svg,ys,y);
 for(const v of xs)svg.append(text(x(v),H-6,num.format(v),"middle"));
 spec.series.forEach((s,si)=>(s.data as Point[]).forEach(([a,b])=>svg.append(el("circle",{cx:x(a),cy:y(b),r:3.5,class:`dot ring series-${si+1}`},`${name(s,si)}: ${fmt(a)}, ${fmt(b,spec.unit)}`))));
}

function pie(svg:SVGElement,spec:Chart,label:(i:number)=>string){
 const data=spec.series[0]!.data as number[],total=data.reduce((a,b)=>a+b,0),cx=W/2,cy=H/2,r=H/2-8;let angle=-Math.PI/2;
 const at=(a:number)=>`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`;
 data.forEach((v,i)=>{
  const tip=`${label(i)}: ${fmt(v,spec.unit)} (${Math.round(v/total*100)}%)`,cls=`slice series-${i+1}`;
  if(v===total){svg.append(el("circle",{cx,cy,r,class:cls},tip));return;}
  if(!v)return;
  const end=angle+v/total*Math.PI*2;
  svg.append(el("path",{d:`M${cx},${cy} L${at(angle)} A${r},${r} 0 ${end-angle>Math.PI?1:0} 1 ${at(end)} Z`,class:cls},tip));
  angle=end;
 });
}

function dataTable(spec:Chart,label:(i:number)=>string,name:(s:Series,i:number)=>string){
 const table=mk("table","sr-only"),head=mk("tr"),thead=mk("thead"),body=mk("tbody"),cell=(tag:string,v:string)=>{const c=mk(tag);c.textContent=v;return c;};
 if(spec.type==="scatter"){
  head.append(cell("th",""),cell("th","x"),cell("th","y"));
  spec.series.forEach((s,si)=>(s.data as Point[]).forEach(([a,b])=>{const tr=mk("tr");tr.append(cell("th",name(s,si)),cell("td",fmt(a)),cell("td",fmt(b,spec.unit)));body.append(tr);}));
 }else{
  head.append(cell("th",""),...spec.series.map((s,si)=>cell("th",name(s,si))));
  const n=Math.max(...spec.series.map(s=>s.data.length));
  for(let i=0;i<n;i++){const tr=mk("tr");tr.append(cell("th",label(i)),...spec.series.map(s=>cell("td",typeof s.data[i]==="number"?fmt(s.data[i] as number,spec.unit):"")));body.append(tr);}
 }
 thead.append(head);table.append(thead,body);return table;
}
```

- [ ] **Step 4: Register charts in `packages/widget/src/render/blocks.ts`**

Add `import { renderChart } from "./chart.js";` to the imports. Change `flags` to `{math:"math",chart:"charts"}`. Inside the `try`, before the math line, add `if(kind==="chart")return renderChart(source);`.

- [ ] **Step 5: Series colors and chart CSS in `packages/widget/src/index.ts`**

1. Add `import { seriesColors } from "./render/chart.js";`.
2. In `paint`, right after the `isDark=dark;` added in Task 1, add `seriesColors(dark).forEach((c,i)=>hostStyle.setProperty(`--omni-series-${i+1}`,c));`
3. Append to the CSS block added in Task 1:
```css
.msg.rich .chart{margin:.65em 0 0}
.msg.rich .chart figcaption{font-weight:650;margin-bottom:4px}
.msg.rich .chart svg{display:block;width:100%;height:auto;overflow:visible}
.chart .tick{font-size:9px;fill:var(--omni-muted)}
.chart .grid{stroke:var(--omni-border);stroke-width:.6}.chart .axis{stroke:var(--omni-muted);stroke-width:.8}
.chart .bar,.chart .slice,.chart .dot{fill:var(--c)}
.chart .slice,.chart .dot.ring{stroke:var(--omni-assistant-bg);stroke-width:2}
.chart .line{fill:none;stroke:var(--c);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.chart .area{fill:var(--c);opacity:.16}
.chart .bar:hover,.chart .slice:hover,.chart .dot:hover{opacity:.8}
.series-1{--c:var(--omni-series-1)}.series-2{--c:var(--omni-series-2)}.series-3{--c:var(--omni-series-3)}.series-4{--c:var(--omni-series-4)}.series-5{--c:var(--omni-series-5)}.series-6{--c:var(--omni-series-6)}.series-7{--c:var(--omni-series-7)}.series-8{--c:var(--omni-series-8)}
.chart .legend{display:flex;flex-wrap:wrap;gap:4px 12px;list-style:none;margin:6px 0 0;padding:0;font-size:11px;color:var(--omni-muted)}
.chart .legend li{display:flex;align-items:center;gap:5px;margin:0}
.chart .swatch{width:9px;height:9px;border-radius:3px;background:var(--c)}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 7: Commit**

```bash
git add packages/widget/src tests/rich-rendering.test.mjs
git commit -m "feat(widget): render chart blocks as accessible SVG"
```

---

### Task 3: Choice buttons

**Files:**
- Create: `packages/widget/src/render/choices.ts`
- Modify: `packages/widget/src/render/blocks.ts`, `packages/widget/src/index.ts` (`submit`: disable earlier choices; CSS)
- Test: `tests/rich-rendering.test.mjs`

**Interfaces:**
- Consumes: `RenderContext.send(text):boolean` (from `sendChoice` in Task 1) and `RenderContext.interactive` (true only from the `done` branch's `draw(answer,raw,false,true)`)
- Produces: `renderChoices(source:string,ctx:RenderContext):HTMLElement` (throws on invalid input)

- [ ] **Step 1: Write the failing tests** (append)

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: the choices tests FAIL (no `.choices`).

- [ ] **Step 3: Create `packages/widget/src/render/choices.ts`**

```ts
import { mk, type RenderContext } from "./util.js";

type Option={label:string;value:string};
function parse(source:string){
 const spec=JSON.parse(source) as {question?:unknown;options?:unknown;multi?:unknown}|unknown[],raw=Array.isArray(spec)?spec:spec?.options;
 if(!Array.isArray(raw)||!raw.length||raw.length>12)throw Error("choices");
 const options:Option[]=raw.map(o=>typeof o==="string"?{label:o,value:o}:{label:String((o as Option)?.label??""),value:String((o as Option)?.value??(o as Option)?.label??"")})
  .map(o=>({label:o.label.trim().slice(0,80),value:o.value.trim().slice(0,500)})).filter(o=>o.label&&o.value);
 if(!options.length)throw Error("choices");
 const meta:{question?:unknown;multi?:unknown}=Array.isArray(spec)?{}:spec;
 return {question:typeof meta.question==="string"?meta.question.trim():"",multi:meta.multi===true,options};
}

// Only the latest finished reply is interactive; submit() disables every group when the next message is sent.
export function renderChoices(source:string,ctx:RenderContext){
 const {question,multi,options}=parse(source),group=mk("div","choices"),list=mk("div","choice-list"),submit=mk("button","choice-send") as HTMLButtonElement;
 group.setAttribute("role","group");
 if(question){const q=mk("p","choices-question");q.textContent=question;group.append(q);group.setAttribute("aria-label",question);}
 const pressed=(b:HTMLButtonElement)=>b.getAttribute("aria-pressed")==="true";
 const buttons=options.map(option=>{
  const button=mk("button","choice") as HTMLButtonElement;button.type="button";button.textContent=option.label;button.disabled=!ctx.interactive;
  if(multi)button.setAttribute("aria-pressed","false");
  button.onclick=()=>{
   if(multi){button.setAttribute("aria-pressed",String(!pressed(button)));submit.disabled=!buttons.some(pressed);return;}
   if(ctx.send(option.value))button.classList.add("chosen");
  };
  return button;
 });
 list.append(...buttons);group.append(list);
 if(multi){
  submit.type="button";submit.textContent=ctx.label("sendChoices");submit.disabled=true;
  submit.onclick=()=>{const picked=buttons.filter(pressed);if(picked.length&&ctx.send(options.filter((_,i)=>pressed(buttons[i]!)).map(o=>o.value).join(", ")))picked.forEach(b=>b.classList.add("chosen"));};
  if(!ctx.interactive)submit.hidden=true;
  group.append(submit);
 }
 return group;
}
```

- [ ] **Step 4: Register choices in `packages/widget/src/render/blocks.ts`**

Add `import { renderChoices } from "./choices.js";`. Change `flags` to `{math:"math",chart:"charts",choices:"choices"}`. Inside the `try` add `if(kind==="choices")return renderChoices(source,ctx);`.

- [ ] **Step 5: Disable earlier choices in `packages/widget/src/index.ts` `submit`**

In `submit`, replace `area.value="";const user=mk("div","msg user");` with:
```ts
area.value="";for(const button of messages.querySelectorAll<HTMLButtonElement>(".choices button"))button.disabled=true;const user=mk("div","msg user");
```
Append to the CSS:
```css
.msg.rich .choices{margin-top:.75em}
.msg.rich .choices-question{font-weight:650;margin-bottom:6px}
.msg.rich .choice-list{display:flex;flex-wrap:wrap;gap:6px}
.msg.rich .choice{min-height:34px;padding:7px 12px;border:1px solid var(--omni-field-border);border-radius:999px;background:var(--omni-bg);color:var(--omni-fg);font-size:12px;line-height:1.35;text-align:start;cursor:pointer;transition:border-color .15s var(--omni-ease),background .15s var(--omni-ease)}
.msg.rich .choice:hover:not(:disabled){border-color:var(--omni-accent);background:color-mix(in srgb,var(--omni-accent) 6%,var(--omni-bg))}
.msg.rich .choice[aria-pressed=true],.msg.rich .choice.chosen{background:var(--omni-accent);border-color:var(--omni-accent);color:#fff}
.msg.rich .choices button:disabled{cursor:default;opacity:.55}.msg.rich .choice.chosen:disabled{opacity:1}
.msg.rich .choice-send{margin-top:8px;min-height:34px;padding:0 14px;border:0;border-radius:10px;background:var(--omni-accent);color:#fff;font-size:12px;font-weight:650;cursor:pointer}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 7: Commit**

```bash
git add packages/widget/src tests/rich-rendering.test.mjs
git commit -m "feat(widget): clickable choice blocks in replies"
```

---

### Task 4: SVG illustrations and Mermaid diagrams

**Files:**
- Modify: `packages/widget/src/render/blocks.ts`, `packages/widget/src/index.ts` (CSS)
- Test: `tests/rich-rendering.test.mjs`

**Interfaces:**
- Consumes: `deferred`, `load`, `pending`, `mk` from `render/util.ts`; `code` in `blocks.ts`
- Produces: `MERMAID_URL` const and `svgImage(source:string,alt:string,cls:string):HTMLImageElement` in `blocks.ts`

- [ ] **Step 1: Write the failing tests** (append)

```js
test('svg block renders only as an image',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'```svg\n<svg viewBox="0 0 10 10"><title>Dot</title><script>alert(1)</script><circle r="4"/></svg>\n```');
  const msg=last(host),img=msg.querySelector('img.illustration');assert.equal(msg.querySelector('svg,script,circle'),null);assert.equal(img.alt,'Dot');
  assert.ok(img.src.startsWith('data:image/svg+xml;charset=utf-8,'));assert.match(decodeURIComponent(img.src),/^data:image\/svg\+xml;charset=utf-8,<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox/);
 }finally{widget.destroy();}
});
test('non-svg content in an svg block falls back to code',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api'});
 try{await widget.ready;await say(host,'```svg\n<img src=x onerror=alert(1)>\n```');assert.equal(last(host).querySelector('img'),null);assert.ok(last(host).querySelector('.code-block .render-note'));}finally{widget.destroy();}
});
test('mermaid blocks render through the lazy loader as an image',async()=>{
 const mermaidUrl=moduleUrl('export default {initialize(){},async render(id,src){return {svg:"<svg xmlns=\\"http://www.w3.org/2000/svg\\"><text>"+src+"</text></svg>"}}}');
 const host=setup();const widget=mount(host,{endpoint:'/api',rich:{mermaidUrl}});
 try{await widget.ready;await say(host,'```mermaid\ngraph TD; A-->B\n```');await settle();
  const img=last(host).querySelector('img.diagram');assert.equal(img.alt,'Diagram');assert.match(decodeURIComponent(img.src),/graph TD; A-->B/);assert.equal(last(host).querySelector('.render-pending'),null);
 }finally{widget.destroy();}
});
test('mermaid load failure falls back to code',async()=>{
 const host=setup();const widget=mount(host,{endpoint:'/api',rich:{mermaidUrl:moduleUrl('throw new Error("blocked")')}});
 try{await widget.ready;await say(host,'```mermaid\ngraph LR; X-->Y\n```');await settle();
  const block=last(host).querySelector('.code-block');assert.equal(block.querySelector('.code-bar span').textContent,'mermaid');assert.ok(block.querySelector('.render-note'));
 }finally{widget.destroy();}
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: the svg/mermaid tests FAIL (`img.illustration`, `img.diagram` missing). `non-svg content…` fails on the missing `.render-note`.

- [ ] **Step 3: Add SVG and Mermaid to `packages/widget/src/render/blocks.ts`**

Add below `KATEX_URL`:
```ts
export const MERMAID_URL="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";
type Mermaid={initialize(config:Record<string,unknown>):void;render(id:string,source:string):Promise<{svg:string}>};
let diagrams=0;
```
Change `flags` to `{math:"math",chart:"charts",choices:"choices",svg:"svg",mermaid:"diagrams"}`. Inside the `try` add:
```ts
  if(kind==="svg")return svgImage(source,ctx.label("illustration"),"illustration");
  if(kind==="mermaid")return mermaid(source,ctx);
```
Add these functions at the end of the file:
```ts
// Image-mode SVG never runs scripts or fetches external resources, so model markup is safe without a sanitizer.
export function svgImage(source:string,alt:string,cls:string){
 const text=source.trim().replace(/^<\?xml[^>]*>\s*/i,"");
 if(text.length>100_000||!/^<svg[\s>]/i.test(text))throw Error("svg");
 const img=mk("img",cls) as HTMLImageElement;
 img.alt=text.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim()||alt;
 img.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(/^<svg[^>]*\bxmlns=/i.test(text)?text:text.replace(/^<svg/i,'<svg xmlns="http://www.w3.org/2000/svg"'))}`;
 return img;
}

function mermaid(source:string,ctx:RenderContext){
 const url=ctx.rich.mermaidUrl??MERMAID_URL;
 return deferred(`${url}|${ctx.dark}|${source}`,async()=>{
  const m=await load<Mermaid>(url);
  m.initialize({startOnLoad:false,securityLevel:"strict",theme:ctx.dark?"dark":"default",suppressErrorRendering:true,htmlLabels:false,flowchart:{htmlLabels:false}});
  const {svg}=await m.render(`omni-diagram-${++diagrams}`,source);
  return svgImage(svg,ctx.label("diagram"),"diagram");
 },()=>code("mermaid",source,ctx,true),pending(ctx));
}
```

- [ ] **Step 4: CSS in `packages/widget/src/index.ts`**

Append:
```css
.msg.rich img.illustration,.msg.rich img.diagram{display:block;max-width:100%;height:auto;margin-top:.65em;border-radius:9px}
.msg.rich img.illustration{background:#fff;padding:6px}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add packages/widget/src tests/rich-rendering.test.mjs
git commit -m "feat(widget): SVG illustrations and lazy Mermaid diagrams"
```

---

### Task 5: Core format guide, config flag, custom-element `rich` property

**Files:**
- Modify: `packages/core/src/types.ts:6-12` (Capabilities), `:58` (WidgetConfig); `packages/core/src/context.ts` (export guide); `packages/core/src/index.ts:167` (config), `:277` (buildMessages call); `packages/widget/src/loader.ts`
- Test: `tests/rich-prompt.test.mjs`

**Interfaces:**
- Produces: `richResponseGuide:string` exported from `packages/core/src/context.ts`; `Capabilities.richResponses?: { enabled: boolean }`; `WidgetConfig.capabilities.richResponses: boolean`; `<metanoia-chat>.rich` setter

- [ ] **Step 1: Write the failing test**

Create `tests/rich-prompt.test.mjs`:
```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: both `rich response guide` tests FAIL (no "```chart" in the system prompt; `richResponses` undefined).

- [ ] **Step 3: Implement**

In `packages/core/src/types.ts` `Capabilities`, after the `suggestions` line add:
```ts
  /** Tells the model it may answer with tables, charts, choices, Mermaid, SVG, and math. Defaults to enabled. */
  richResponses?: { enabled: boolean };
```
In `WidgetConfig.capabilities`, add `richResponses: boolean;` after `suggestions: boolean;`.

In `packages/core/src/context.ts`, above `export async function buildMessages`, add:
```ts
export const richResponseGuide=[
  "Formatting: answer in Markdown. When it makes the answer clearer, you may also use:",
  "- Tables: GitHub pipe tables.",
  "- Charts: a fenced code block tagged chart containing JSON {\"type\":\"bar|line|area|pie|scatter\",\"title\":\"...\",\"labels\":[\"...\"],\"series\":[{\"name\":\"...\",\"data\":[1,2]}],\"unit\":\"...\"}. Scatter data is [[x,y],...]. Pie uses the first series, one label per value. At most 8 series.",
  "- Choices: when the user should pick from options, end the reply with a fenced code block tagged choices containing JSON {\"question\":\"...\",\"options\":[\"A\",\"B\"],\"multi\":false}. Use at most one per reply.",
  "- Diagrams: a fenced code block tagged mermaid.",
  "- Illustrations: a fenced code block tagged svg with one self-contained <svg> that has a viewBox and no scripts or external references.",
  "- Math: $inline$ and $$display$$ LaTeX.",
  "- Images: ![alt](https://...) only for image URLs you were given; never invent URLs.",
  "Use these only when they help; plain prose is often best. JSON in fenced blocks must be valid.",
].join("\n");
```
In `packages/core/src/index.ts`:
- Add `richResponseGuide` to the existing import from `./context.js` (the import that brings in `buildMessages`).
- In the `/config` capabilities object, after `suggestions:!!options.capabilities?.suggestions?.enabled,` add `richResponses:options.capabilities?.richResponses?.enabled!==false,`
- In the `buildMessages(...)` call, replace the argument `options.branding?.personality` with `[options.branding?.personality,options.capabilities?.richResponses?.enabled!==false?richResponseGuide:""].filter(Boolean).join("\n\n")`

In `packages/widget/src/loader.ts`:
- Change the import to also bring `type RichOptions` from `./index.js`.
- Add the field `private richOptions?: RichOptions;`.
- In `connectedCallback`, change `["headers", "conversationStore", "labels"]` to `["headers", "conversationStore", "labels", "rich"]`.
- Add after the `labels` setter:
```ts
  set rich(value: RichOptions | undefined) {
    this.richOptions = value;
    if (this.instance) this.instance.update({ rich: value });
  }
```
- In `options()`, add `rich: this.richOptions,` after `labels: this.localizedLabels,`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`. If an existing core test asserts an exact system prompt or `/config` payload, update that assertion to include the new guide or field. That change is expected, not a regression.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src packages/widget/src/loader.ts tests/rich-prompt.test.mjs
git commit -m "feat(core): describe rich response formats to the model"
```

---

### Task 6: Demo, docs, changeset, visual check

**Files:**
- Modify: `examples/express/src/server.js:19-20`, `docs/customization.md`
- Create: `.changeset/rich-responses.md`

- [ ] **Step 1: Demo mock reply.** In `examples/express/src/server.js`, replace the `const answer=…;` line with:
```js
    const showcase=/\b(demo|show|chart|table|rich)\b/i.test(topic);
    const answer=showcase?["Here is what rich replies look like.","","| Plan | Seats | Price |","|:--|--:|--:|","| Starter | 3 | $0 |","| Team | 20 | $49 |","","```chart",JSON.stringify({type:"bar",title:"Weekly active users",labels:["Mon","Tue","Wed","Thu","Fri"],series:[{name:"Web",data:[120,148,160,152,190]},{name:"Mobile",data:[80,96,110,118,140]}]}),"```","","```mermaid","graph LR; Visitor-->Widget-->Backend-->Model","```","","Growth follows $N_t = N_0 e^{rt}$.","","```choices",JSON.stringify({question:"What next?",options:["Compare plans","Show setup steps","Talk to support"]}),"```"].join("\n"):`This is a local demo reply. I heard: “${topic}”. The chat widget, Express adapter, streaming response, and conversation storage are connected. Add your OpenAI-compatible provider settings to try a live assistant. Type “show me a demo” to see rich replies.`;
```
Also add `"Show me a demo of rich replies"` as the first item of `suggestedPrompts` in the `branding` object.

- [ ] **Step 2: Docs.** Append to `docs/customization.md`:
````markdown
## Rich replies

Assistant replies render GitHub tables, task lists, quotes, images, copyable code, and these fenced blocks:

| Fence | Content | Renders as |
|---|---|---|
| `chart` | `{"type":"bar\|line\|area\|pie\|scatter","title","labels","series":[{"name","data"}],"unit"}` | Accessible SVG chart (≤ 8 series) |
| `choices` | `{"question","options":["A",{"label","value"}],"multi"}` | Buttons; a click sends the choice as the next message |
| `mermaid` | Mermaid source | Diagram (Mermaid loads on first use) |
| `svg` | One `<svg>` | Image; scripts and external resources never run |
| `math`, `$…$`, `$$…$$` | LaTeX | MathML via KaTeX (loads on first use) |

The server tells the model about these formats unless you set `capabilities: { richResponses: { enabled: false } }`. In the widget, turn individual features off or self-host the libraries (needed for strict CSP):

```js
mount(el, {
  endpoint: "/api/chat",
  rich: { svg: false, mermaidUrl: "/vendor/mermaid.esm.min.mjs", katexUrl: "/vendor/katex.mjs" },
});
```

A block that is disabled, invalid, or whose library cannot load is shown as plain code.
````

- [ ] **Step 3: Changeset.** Create `.changeset/rich-responses.md`:
```markdown
---
"@metanoia/chatbot": minor
"@metanoia/widget": minor
---

Rich replies: the widget renders GitHub tables, task lists, quotes, images, copyable code blocks, SVG charts, clickable choice buttons, Mermaid diagrams, model-written SVG, and KaTeX math. Mermaid and KaTeX load only when a reply needs them (`rich.mermaidUrl` / `rich.katexUrl` to self-host); model SVG and diagrams are displayed as images so they cannot run scripts. The server adds a short format guide to the system prompt, controlled by `capabilities.richResponses`.
```

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: typecheck exits 0; `# fail 0`.

- [ ] **Step 5: Visual check.** Start `CHATBOT_DEMO_MODE=true npm run dev:example`, open the page with agent-browser, send "show me a demo", and take screenshots in light mode and then with `prefers-color-scheme: dark` emulated, at desktop width and at 390px. Check that:
  - the table scrolls inside the bubble
  - the chart bars and legend are legible and there is no label overlap
  - the Mermaid diagram loads (needs network)
  - the math renders
  - clicking a choice sends it and disables the group
  Fix any layout problem in the CSS before continuing.

- [ ] **Step 6: Commit**

```bash
git add examples/express/src/server.js docs/customization.md .changeset/rich-responses.md
git commit -m "docs: rich replies demo, docs, and changeset"
```
