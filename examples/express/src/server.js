import express from "express";
import { createChatbot, expressHandler } from "@metanoia/chatbot";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import path from "node:path";

const demoMode=process.env.CHATBOT_DEMO_MODE==="true";
const required=["OPENAI_BASE_URL","OPENAI_API_KEY","OPENAI_MODEL"];
if(!demoMode)for(const key of required)if(!process.env[key])throw new Error(`Missing required environment variable ${key}`);
const app=express(),port=Number(process.env.CHATBOT_PORT??3000),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const providerBaseUrl=demoMode?"http://mock-provider.local/v1":process.env.OPENAI_BASE_URL;
if(demoMode){
  const originalFetch=globalThis.fetch.bind(globalThis);
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(String(input));
    if(url.origin!=="http://mock-provider.local")return originalFetch(input,init);
    const body=JSON.parse(String(init.body??"{}"));
    if(body.stream===false)return Response.json({choices:[{message:{content:JSON.stringify({suggestions:["Can you give me the next steps?","Where can I learn more?","Can you explain that another way?"]})}}],usage:{prompt_tokens:28,completion_tokens:18}});
    const lastUser=[...(body.messages??[])].reverse().find(message=>message.role==="user"),raw=typeof lastUser?.content==="string"?lastUser.content:"your message",topic=raw.replace(/\s+/g," ").slice(0,180);
    const answer=`This is a local demo reply. I heard: “${topic}”. The chat widget, Express adapter, streaming response, and conversation storage are connected. Add your OpenAI-compatible provider settings to try a live assistant.`;
    const encoder=new TextEncoder(),parts=answer.match(/.{1,36}(?:\s|$)|.{1,36}/g)??[answer];let index=0;
    const stream=new ReadableStream({async pull(controller){if(index<parts.length){controller.enqueue(encoder.encode(`data: ${JSON.stringify({choices:[{delta:{content:parts[index++]}}]})}\n\n`));return;}if(index===parts.length){index++;controller.enqueue(encoder.encode(`data: ${JSON.stringify({choices:[{delta:{}}],usage:{prompt_tokens:32,completion_tokens:48}})}\n\n`));return;}controller.enqueue(encoder.encode("data: [DONE]\n\n"));controller.close();}});
    return new Response(stream,{headers:{"content-type":"text/event-stream"}});
  };
  console.log("Local mock-provider mode enabled; assistant responses are synthetic.");
}
const lanOrigins=Object.values(networkInterfaces()).flat().filter(address=>address&&!address.internal&&(address.family==="IPv4"||address.family===4)).map(address=>`http://${address.address}:${port}`);
const allowedOrigins=process.env.CHATBOT_ALLOWED_ORIGINS?.split(",").map(origin=>origin.trim()).filter(Boolean)??[`http://localhost:${port}`,`http://127.0.0.1:${port}`,...lanOrigins];
const bot=createChatbot({
  instanceId:"northstar-help-demo",
  provider:{baseUrl:providerBaseUrl,apiKey:demoMode?"local-demo-key":process.env.OPENAI_API_KEY,model:demoMode?"local-demo-model":process.env.OPENAI_MODEL,...(demoMode?{compatibility:"openai"}:process.env.OPENAI_COMPATIBILITY?{compatibility:process.env.OPENAI_COMPATIBILITY}:{})},
  storage:process.env.CHATBOT_DATABASE_URL?{type:"postgres",connectionString:process.env.CHATBOT_DATABASE_URL}:{type:"sqlite",filename:path.resolve(process.env.CHATBOT_DB??"./data/chatbot.sqlite")},
  anonymous:true,
  allowedOrigins,
  branding:{name:"Mira",avatarUrl:"/assistant.svg",greeting:"Welcome back. What can I help you with?",personality:"Be warm, clear, and concise: answer in at most three short sentences or a short numbered list. Do not invent account details; use host tools when a question requires live account data.",theme:"system",placement:"bottom-right",width:400,height:680,suggestedPrompts:["Help me get started with Northstar","I have a question about plans and billing","I need help with my account or security"],colors:{accent:"#536d62",panel:"#ffffff",text:"#1c2024",muted:"#727a80",userMessage:"#536d62",assistantMessage:"#f1f4f2",border:"#e3e7e9"}},
  capabilities:{suggestions:{enabled:true,count:3}},
  rateLimit:{requests:40,windowMs:60_000},
});
app.use("/widget",express.static(path.resolve(root,"../../packages/widget/dist")));
app.use("/api/chat",expressHandler(bot));
app.use(express.static(path.resolve(root,"public")));
await bot.ready;
const host=process.env.CHATBOT_HOST??"0.0.0.0";
const server=app.listen(port,host,()=>console.log(`Chatbot example: http://localhost:${port} (bound to ${host}; allowed origins: ${allowedOrigins.join(", ")})`));
async function shutdown(){server.close();await bot.close();}
process.on("SIGINT",()=>void shutdown());process.on("SIGTERM",()=>void shutdown());
