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
