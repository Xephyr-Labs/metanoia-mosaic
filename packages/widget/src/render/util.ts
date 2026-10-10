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
