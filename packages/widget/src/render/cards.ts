import { mk, type RenderContext } from "./util.js";
import { parseButtons, renderButton } from "./actions.js";

const MAX_CARDS=6,MAX_FACTS=3,MAX_CARD_BUTTONS=2;
const text=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max):"";
const safeImage=(v:unknown)=>{if(typeof v!=="string")return "";try{const u=new URL(v);return u.protocol==="https:"||u.protocol==="http:"?u.href:"";}catch{return "";}};

/** A list of cards: an optional image, a title, a subtitle, a few short facts and up to two buttons. */
export function renderCards(source:string,ctx:RenderContext){
 const spec=JSON.parse(source) as {cards?:unknown}|unknown[];
 const raw=Array.isArray(spec)?spec:spec?.cards;
 if(!Array.isArray(raw))throw Error("cards");
 const list=mk("div","cards");list.setAttribute("role","list");
 for(const item of raw.slice(0,MAX_CARDS)){
  if(!item||typeof item!=="object")continue;
  const c=item as {title?:unknown;subtitle?:unknown;image?:unknown;facts?:unknown;buttons?:unknown};
  const title=text(c.title,120);if(!title)continue;
  const card=mk("article","card");card.setAttribute("role","listitem");
  const image=safeImage(c.image);
  if(image){const img=mk("img","card-image") as HTMLImageElement;img.src=image;img.alt="";img.loading="lazy";card.append(img);}
  const body=mk("div","card-body"),h=mk("p","card-title");h.textContent=title;body.append(h);
  const subtitle=text(c.subtitle,160);if(subtitle){const s=mk("p","card-subtitle");s.textContent=subtitle;body.append(s);}
  const facts=(Array.isArray(c.facts)?c.facts:[]).map(f=>text(f,80)).filter(Boolean).slice(0,MAX_FACTS);
  if(facts.length){const ul=mk("ul","card-facts");for(const f of facts){const li=mk("li","card-fact");li.textContent=f;ul.append(li);}body.append(ul);}
  const buttons=parseButtons(c.buttons,MAX_CARD_BUTTONS);
  if(buttons.length){const row=mk("div","card-actions");row.append(...buttons.map(b=>renderButton(b,ctx)));body.append(row);}
  card.append(body);list.append(card);
 }
 if(!list.childElementCount)throw Error("cards");
 return list;
}
