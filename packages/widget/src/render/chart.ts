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
