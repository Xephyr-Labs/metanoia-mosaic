import type { Chatbot } from "./types.js";
import { Readable } from "node:stream";

type ExpressRequest=NodeJS.ReadableStream&{method?:string;url?:string;protocol?:string;headers:Record<string,string|string[]|undefined>;body?:unknown;on:(event:string,cb:()=>void)=>void};
type ExpressResponse={status:(code:number)=>ExpressResponse;setHeader:(name:string,value:string)=>void;end:(body?:string|Uint8Array)=>void;write:(body:Uint8Array)=>boolean;on?:(event:string,cb:()=>void)=>void;once?:(event:string,cb:(error?:Error)=>void)=>void;removeListener?:(event:string,cb:(error?:Error)=>void)=>void;headersSent?:boolean};
export function expressHandler(chatbot:Chatbot){
  return async(req:ExpressRequest,res:ExpressResponse,next?:(error?:unknown)=>void)=>{
    let controller:AbortController|undefined;
    try{
      const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(", "):value);}
      const method=(req.method??"GET").toUpperCase(),url=new URL(req.url??"/",`${req.protocol??"http"}://${headers.get("host")??"localhost"}`);
      let body:BodyInit|undefined;if(method!=="GET"&&method!=="HEAD"){
        if(req.body!==undefined){body=typeof req.body==="string"?req.body:JSON.stringify(req.body);if(!headers.has("content-type"))headers.set("content-type","application/json");}
        else body=Readable.toWeb(req as unknown as Readable) as ReadableStream<Uint8Array>;
      }
      let responseEnded=false;controller=new AbortController();const requestController=controller;req.on("aborted",()=>requestController.abort());res.on?.("close",()=>{if(!responseEnded)requestController.abort();});
      const response=await chatbot.handle(new Request(url,{method,headers,body,signal:requestController.signal,...(body?{duplex:"half"} as RequestInit:{})}));res.status(response.status);response.headers.forEach((value,key)=>res.setHeader(key,value));
      if(!response.body){responseEnded=true;res.end();return;}
      const reader=response.body.getReader();
      const waitForDrain=()=>new Promise<void>((resolve,reject)=>{
        const cleanup=()=>{res.removeListener?.("drain",onDrain);res.removeListener?.("close",onClose);res.removeListener?.("error",onError);};
        const onDrain=()=>{cleanup();resolve();};
        const onClose=()=>{cleanup();reject(new Error("Client disconnected while waiting for response drain."));};
        const onError=(error?:Error)=>{cleanup();reject(error??new Error("Response stream failed."));};
        res.once?.("drain",onDrain);res.once?.("close",onClose);res.once?.("error",onError);
        if(!res.once)reject(new Error("Express response does not support drain events."));
      });
      try{while(true){const{done,value}=await reader.read();if(done)break;if(!res.write(value))await waitForDrain();}responseEnded=true;res.end();}
      catch(error){try{await reader.cancel(error);}catch{/* stream already canceled */}throw error;}
      finally{reader.releaseLock();}
    }catch(error){if(controller?.signal.aborted||res.headersSent)return;if(next)next(error);else res.status(500).end("Internal Server Error");}
  };
}
