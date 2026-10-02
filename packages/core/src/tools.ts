import { ChatbotError } from "./errors.js";
import type { ChatbotTool, ChatbotToolContext } from "./types.js";

export function providerTools(tools:ChatbotTool[]){
  return tools.map(tool=>({type:"function",function:{name:tool.name,description:tool.description,parameters:tool.parameters}}));
}

function matchesType(value:unknown,type:unknown):boolean{
  if(Array.isArray(type))return type.some(item=>matchesType(value,item));
  switch(type){
    case "object":return !!value&&typeof value==="object"&&!Array.isArray(value);
    case "array":return Array.isArray(value);
    case "string":return typeof value==="string";
    case "integer":return typeof value==="number"&&Number.isInteger(value);
    case "number":return typeof value==="number"&&Number.isFinite(value);
    case "boolean":return typeof value==="boolean";
    case "null":return value===null;
    default:return true;
  }
}

function validateValue(schema:Record<string,unknown>,value:unknown,depth=0):boolean{
  if(depth>8||!matchesType(value,schema.type))return false;
  if(Array.isArray(schema.enum)&&!schema.enum.some(item=>JSON.stringify(item)===JSON.stringify(value)))return false;
  if(typeof value==="string"){
    if(typeof schema.maxLength==="number"&&value.length>schema.maxLength)return false;
    if(typeof schema.minLength==="number"&&value.length<schema.minLength)return false;
  }
  if(typeof value==="number"){
    if(typeof schema.maximum==="number"&&value>schema.maximum)return false;
    if(typeof schema.minimum==="number"&&value<schema.minimum)return false;
  }
  if(Array.isArray(value)&&schema.items&&typeof schema.items==="object"){
    if(typeof schema.maxItems==="number"&&value.length>schema.maxItems)return false;
    if(typeof schema.minItems==="number"&&value.length<schema.minItems)return false;
    if(!value.every(item=>validateValue(schema.items as Record<string,unknown>,item,depth+1)))return false;
  }
  if(value&&typeof value==="object"&&!Array.isArray(value)){
    const object=value as Record<string,unknown>,properties=(schema.properties&&typeof schema.properties==="object"?schema.properties:{}) as Record<string,Record<string,unknown>>;
    const required=Array.isArray(schema.required)?schema.required.filter((key):key is string=>typeof key==="string"):[];
    if(required.some(key=>!Object.prototype.hasOwnProperty.call(object,key)))return false;
    if(schema.additionalProperties===false&&Object.keys(object).some(key=>!Object.prototype.hasOwnProperty.call(properties,key)))return false;
    for(const [key,propertySchema] of Object.entries(properties))if(Object.prototype.hasOwnProperty.call(object,key)&&!validateValue(propertySchema,object[key],depth+1))return false;
  }
  return true;
}

export function parseToolArguments(raw:string,schema:Record<string,unknown>){
  if(raw.length>16_000)throw new ChatbotError("invalid_tool_arguments","Tool arguments are too large.",502);
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new ChatbotError("invalid_tool_arguments","Tool arguments were not valid JSON.",502);}
  if(!value||typeof value!=="object"||Array.isArray(value)||!validateValue(schema,value))throw new ChatbotError("invalid_tool_arguments","Tool arguments did not match the registered schema.",502);
  return value as Record<string,unknown>;
}

export async function executeTool(tool:ChatbotTool,args:Record<string,unknown>,context:ChatbotToolContext,timeoutMs:number){
  const controller=new AbortController(),signal=AbortSignal.any([context.signal,controller.signal]);
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort(new Error("Tool timed out"));reject(new Error("Tool timed out"));},timeoutMs);});
    const result=await Promise.race([Promise.resolve(tool.execute(args,{...context,signal})),timeout]);
    let content:string;
    try{content=typeof result==="string"?result:JSON.stringify(result)??"null";}catch{content="null";}
    return content.slice(0,20_000);
  }finally{if(timer)clearTimeout(timer);}
}
