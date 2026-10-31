import { math, renderBlock } from "./blocks.js";
import { mk, type RenderContext } from "./util.js";

// A Markdown subset built from DOM nodes so model output is never parsed as HTML.
export function renderMarkdown(host:HTMLElement,text:string,ctx:RenderContext){
 host.replaceChildren();
 const lines=text.split("\n");let list:HTMLElement|undefined,para:string[]=[];
 const flush=()=>{if(para.length){const p=mk("p");inline(p,para.join("\n"),ctx);
 // A link alone on its line is a call to action ("Create your journey"): draw it as a button.
 const only=[...p.childNodes].filter(n=>n.nodeType!==3||n.textContent!.trim());if(only.length===1&&(only[0] as Element).tagName==="A")(only[0] as Element).className="cta";
 host.append(p);para=[];}};
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
