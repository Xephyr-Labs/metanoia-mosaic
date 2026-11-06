import { mk, type RenderContext } from "./util.js";

/** A button in an `actions` or `cards` block: a value it sends as the user's tap, or an action for the host page. */
export type Button={label:string;value:string}|{label:string;host:{action:string;params:Record<string,unknown>}};

const MAX_BUTTONS=8,MAX_LABEL=80,MAX_VALUE=200,MAX_ACTION=60;

/** Allow-listed fields only; anything malformed is dropped rather than rendered. */
export function parseButton(raw:unknown):Button|undefined{
 if(!raw||typeof raw!=="object")return undefined;
 const b=raw as {label?:unknown;value?:unknown;host?:unknown};
 const label=typeof b.label==="string"?b.label.trim().slice(0,MAX_LABEL):"";
 if(!label)return undefined;
 if(typeof b.value==="string"){const value=b.value.trim();return value&&value.length<=MAX_VALUE?{label,value}:undefined;}
 const host=b.host as {action?:unknown;params?:unknown}|undefined;
 if(host&&typeof host.action==="string"&&host.action&&host.action.length<=MAX_ACTION){
  const params=host.params&&typeof host.params==="object"&&!Array.isArray(host.params)?JSON.parse(JSON.stringify(host.params)) as Record<string,unknown>:{};
  return {label,host:{action:host.action,params}};
 }
 return undefined;
}

export function parseButtons(raw:unknown,max=MAX_BUTTONS):Button[]{
 return Array.isArray(raw)?raw.map(parseButton).filter((b):b is Button=>!!b).slice(0,max):[];
}

/** Only the latest finished reply is interactive, as with choices. */
export function renderButton(button:Button,ctx:RenderContext){
 const node=mk("button","choice action") as HTMLButtonElement;node.type="button";node.textContent=button.label;node.disabled=!ctx.interactive;
 node.onclick=()=>{
  if("host" in button){ctx.host(button.host.action,button.host.params);return;}
  if(ctx.tap(button.label,button.value))node.classList.add("chosen");
 };
 return node;
}

export function renderActions(source:string,ctx:RenderContext){
 const spec=JSON.parse(source) as {heading?:unknown;buttons?:unknown}|unknown[];
 const buttons=parseButtons(Array.isArray(spec)?spec:spec?.buttons);
 if(!buttons.length)throw Error("actions");
 const group=mk("div","actions"),list=mk("div","choice-list");group.setAttribute("role","group");
 const heading=!Array.isArray(spec)&&typeof spec.heading==="string"?spec.heading.trim().slice(0,120):"";
 if(heading){const h=mk("p","actions-heading");h.textContent=heading;group.append(h);group.setAttribute("aria-label",heading);}
 list.append(...buttons.map(b=>renderButton(b,ctx)));group.append(list);
 return group;
}
