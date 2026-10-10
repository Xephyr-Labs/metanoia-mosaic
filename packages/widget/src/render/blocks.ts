import { renderChoices } from "./choices.js";
import { renderChart } from "./chart.js";
import { deferred, load, mk, pending, type RenderContext, type RichOptions } from "./util.js";

export const KATEX_URL="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs";
type Katex={renderToString(tex:string,options:Record<string,unknown>):string};
// Fence tag -> the `rich` flag that enables it.
export const flags:Record<string,keyof RichOptions>={math:"math",chart:"charts",choices:"choices"};

export function renderBlock(lang:string,source:string,closed:boolean,ctx:RenderContext):Node{
 const flag=Object.hasOwn(flags,lang)?flags[lang]!:undefined,kind=flag&&ctx.rich[flag]!==false?lang:"";
 if(kind&&!closed&&ctx.streaming)return pending(ctx);
 try{
  if(kind==="chart")return renderChart(source);
  if(kind==="choices")return renderChoices(source,ctx);
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
