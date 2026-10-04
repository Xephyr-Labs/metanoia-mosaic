export type WidgetColors = Partial<Record<"accent" | "panel" | "text" | "muted" | "userMessage" | "assistantMessage" | "border", string>>;
export type WidgetLabels = Partial<Record<
  | "openChat" | "closeChat" | "assistant" | "hereToHelp" | "chatTools" | "history" | "newChat" | "settings"
  | "messagePlaceholder" | "send" | "attachImage" | "recordVoice" | "voiceUnavailable" | "transcribing"
  | "reviewTranscription" | "transcriptionFailed" | "microphoneDenied" | "assistantResponding" | "nextSteps"
  | "responseComplete" | "startFailed" | "uploadFailed" | "networkFailed" | "useSuggestion" | "listen" | "stopAudio"
  | "audioUnavailable" | "unavailable" | "back" | "conversation" | "preferencesTitle" | "savePreferences" | "saved"
  | "invalidJson" | "rememberedTitle" | "memoryPlaceholder" | "remember" | "save" | "remove"
  | "assistantChat" | "message" | "preferencesJson" | "addMemory" | "imageAttachment" | "describeImage" | "toolWorking" | "toolComplete"
  | "saveFailed" | "removeFailed" | "responseInterrupted" | "noConversations",
  string
>>;
export type ConversationStore = { load():string|undefined|Promise<string|undefined>; save(id:string):void|Promise<void>; clear?():void|Promise<void> };
export type WidgetOptions = {
 endpoint:string; headers?:HeadersInit|(()=>HeadersInit|Promise<HeadersInit>); credentials?:RequestCredentials; fetch?:typeof fetch;
 conversationStore?:ConversationStore; labels?:WidgetLabels; locale?:string; dir?:"ltr"|"rtl"|"auto";
 name?:string; avatarUrl?:string; theme?:"light"|"dark"|"system"; placement?:"bottom-right"|"bottom-left";
 width?:number; height?:number; accent?:string; colors?:WidgetColors; font?:string;
 launcher?:"bubble"|"button"; greeting?:string; suggestedPrompts?:string[];
};
const labelDefaults:Required<WidgetLabels>={openChat:"Open chat",closeChat:"Close chat",assistant:"Assistant",hereToHelp:"Here to help",chatTools:"Chat tools",history:"History",newChat:"New chat",settings:"Settings",messagePlaceholder:"Message…",send:"Send",attachImage:"Attach image",recordVoice:"Record voice message",voiceUnavailable:"Voice input is unavailable in this browser.",transcribing:"Transcribing…",reviewTranscription:"Review the transcription, then send it.",transcriptionFailed:"Voice transcription failed.",microphoneDenied:"Microphone permission was not granted.",assistantResponding:"Assistant is responding…",nextSteps:"Finding useful next steps…",responseComplete:"Assistant response complete.",startFailed:"Unable to start a conversation.",uploadFailed:"One or more images could not be uploaded.",networkFailed:"Could not reach the assistant. Try again.",useSuggestion:"Use suggestion",listen:"Listen",stopAudio:"Stop audio",audioUnavailable:"Audio unavailable",unavailable:"Chat is unavailable",back:"Back",conversation:"Conversation",preferencesTitle:"Your preferences",savePreferences:"Save preferences",saved:"Saved",invalidJson:"Invalid JSON",rememberedTitle:"Remembered about you",memoryPlaceholder:"A detail you want remembered",remember:"Remember",save:"Save",remove:"Remove",assistantChat:"Assistant chat",message:"Message",preferencesJson:"Preferences JSON",addMemory:"Add a memory",imageAttachment:"Image attachment",describeImage:"Describe this image.",toolWorking:"Working…",toolComplete:"complete",saveFailed:"Unable to save. Try again.",removeFailed:"Unable to remove. Try again.",responseInterrupted:"The response was interrupted.",noConversations:"No conversations yet."};
type Config={branding:{name:string;greeting:string;theme:string;placement:string;width:number;height:number;avatarUrl?:string;colors?:Record<string,string>;font?:string;locale?:string;suggestedPrompts?:string[];launcher?:"bubble"|"button"};capabilities:{images:boolean;voiceInput:boolean;voiceOutput:boolean;suggestions:boolean;suggestionCount?:number;voiceInputMaxSeconds?:number}};
type Conversation={id:string;title:string};type Message={id:string;role:string;content:string;status:string;suggestions?:string[]};
const css=`
:host{
  all:initial;
  --omni-accent:#2f5d62;
  --omni-bg:#fdfdfc;
  --omni-fg:#191a22;
  --omni-muted:#737582;
  --omni-border:#e8e8ee;
  --omni-user-bg:var(--omni-accent);
  --omni-assistant-bg:#f4f4f7;
  --omni-font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --omni-ease:cubic-bezier(.2,.8,.2,1);
  color:var(--omni-fg);
  font-family:var(--omni-font);
  font-synthesis:none;
  text-rendering:optimizeLegibility;
}
*{box-sizing:border-box}
button,textarea,input{font:inherit}
button{ -webkit-tap-highlight-color:transparent }
button:disabled{opacity:.6;cursor:wait}
.launcher{
  position:fixed;z-index:2147483000;bottom:24px;width:58px;height:58px;
  border:0;border-radius:20px;background:var(--omni-accent);color:#fff;
  display:grid;place-items:center;box-shadow:0 8px 28px #17152e38;cursor:pointer;
  transition:transform .18s var(--omni-ease),box-shadow .18s var(--omni-ease);
}
.launcher:hover{transform:translateY(-2px);box-shadow:0 12px 32px #17152e45}
.launcher:active{transform:scale(.96)}
.launcher:focus-visible,.panel button:focus-visible,.compose textarea:focus-visible,.settings input:focus-visible,.settings textarea:focus-visible{outline:3px solid color-mix(in srgb,var(--omni-accent) 45%,transparent);outline-offset:2px}
.launcher svg,.utility-button svg{width:22px;height:22px;pointer-events:none}
.launcher.button{display:block;width:auto;max-width:min(260px,calc(100vw - 48px));min-height:52px;border-radius:16px;padding:0 19px;font-size:14px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.right{right:24px}.left{left:24px}
.panel{
  position:fixed;z-index:2147483000;bottom:94px;
  width:min(var(--omni-width,390px),calc(100vw - 28px));
  height:min(var(--omni-height,650px),calc(100dvh - 112px));
  background:var(--omni-bg);color:var(--omni-fg);
  border:1px solid var(--omni-border);border-radius:22px;
  box-shadow:0 24px 72px #17152e2b,0 3px 10px #17152e12;
  display:flex;flex-direction:column;overflow:hidden;
  animation:omni-enter .2s cubic-bezier(.2,.8,.2,1) both;
}
@keyframes omni-enter{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
.right.panel{right:24px}.left.panel{left:24px}.hidden{display:none!important}
.head{
  min-height:76px;background:var(--omni-bg);color:var(--omni-fg);
  display:flex;align-items:center;gap:12px;padding:15px 18px;
  border-bottom:1px solid var(--omni-border);
}
.avatar{width:42px;height:42px;flex:0 0 42px;border-radius:15px;object-fit:cover;background:color-mix(in srgb,var(--omni-accent) 12%,var(--omni-bg))}
.head .identity{min-width:0;display:flex;flex-direction:column;gap:3px}
.head .title{font-size:15px;font-weight:680;letter-spacing:-.025em;overflow-wrap:anywhere}
.head .presence{font-size:11px;color:var(--omni-muted);display:flex;align-items:center;gap:6px}
.head .presence:before{content:"";width:6px;height:6px;border-radius:50%;background:#36a879}
.head button{margin-inline-start:auto;width:34px;height:34px;flex:0 0 34px;color:var(--omni-muted);background:transparent;border:0;border-radius:11px;font-size:21px;cursor:pointer}
.head button:hover,.toolbar button:hover{background:color-mix(in srgb,var(--omni-fg) 6%,transparent);color:var(--omni-fg)}
.toolbar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:center;gap:5px;padding:9px 13px;border-bottom:1px solid var(--omni-border)}
.toolbar button{display:flex;align-items:center;justify-content:center;min-width:0;min-height:34px;border:0;border-radius:10px;padding:0 7px;background:transparent;color:var(--omni-muted);font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer;transition:background .15s var(--omni-ease),color .15s var(--omni-ease)}
.toolbar button:first-child{margin-left:0}
.toolbar button:hover{background:var(--omni-assistant-bg);color:var(--omni-fg)}
.messages{padding:20px 18px;overflow:auto;flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:12px;scrollbar-width:thin;scrollbar-color:var(--omni-border) transparent}
.msg{width:fit-content;max-width:min(88%,520px);white-space:pre-wrap;overflow-wrap:anywhere;padding:12px 15px;border-radius:5px 16px 16px 16px;background:var(--omni-assistant-bg);line-height:1.58;font-size:13px;letter-spacing:.002em}
.msg.rich{white-space:normal}
.msg.rich p,.msg.rich li{white-space:pre-wrap;margin:0}
.msg.rich p+p,.msg.rich p+ul,.msg.rich p+ol,.msg.rich ul+p,.msg.rich ol+p,.msg.rich pre+p,.msg.rich p+pre{margin-top:.65em}
.msg.rich .heading{font-weight:680}
.msg.rich ul,.msg.rich ol{margin:0;padding-inline-start:1.25em}
.msg.rich li+li{margin-top:.3em}
.msg.rich code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em;padding:1px 4px;border-radius:5px;background:color-mix(in srgb,var(--omni-fg) 7%,transparent)}
.msg.rich pre{margin:.65em 0 0;padding:10px 12px;border-radius:9px;overflow:auto;white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:color-mix(in srgb,var(--omni-fg) 6%,transparent)}
.msg.rich a{color:var(--omni-accent);text-underline-offset:2px}
.msg.user{align-self:flex-end;margin-inline-start:auto;background:var(--omni-user-bg);color:#fff;border-radius:16px 5px 16px 16px}
.sources{display:flex;flex-wrap:wrap;gap:7px;max-width:100%;font-size:11px;margin:0 0 2px 3px}
.sources a{max-width:100%;overflow-wrap:anywhere;color:var(--omni-accent);text-decoration:none;border:1px solid var(--omni-border);border-radius:999px;padding:5px 9px}
.sources a:hover{text-decoration:underline}
.prompts{display:flex;flex-wrap:wrap;gap:7px;max-width:100%;margin-top:4px}
.prompts button{max-width:100%;min-height:34px;background:var(--omni-bg);border:1px solid var(--omni-border);border-radius:999px;padding:7px 11px;color:var(--omni-fg);font-size:12px;line-height:1.35;text-align:start;overflow-wrap:anywhere;cursor:pointer;transition:border-color .15s var(--omni-ease),background .15s var(--omni-ease)}
.prompts button:hover{border-color:var(--omni-accent);background:color-mix(in srgb,var(--omni-accent) 6%,var(--omni-bg))}
.prompts button:disabled{opacity:.55;cursor:wait}
.messages>.prompts{width:100%}.followups{width:100%;margin-top:-3px}
.status{min-height:20px;padding:0 17px 7px;color:var(--omni-muted);font-size:12px}
.compose{border-top:1px solid var(--omni-border);padding:12px 14px 14px;display:flex;flex-direction:column;align-items:stretch;gap:8px;background:var(--omni-bg)}
.compose textarea{font:inherit;resize:none;width:100%;max-height:110px;min-height:45px;flex:1;border:1px solid var(--omni-border);border-radius:13px;padding:11px 13px;color:var(--omni-fg);background:var(--omni-bg);font-size:13px;line-height:1.4;transition:border-color .15s var(--omni-ease),box-shadow .15s var(--omni-ease)}
.compose textarea:focus{border-color:var(--omni-accent);outline:0}
.compose textarea:focus-visible{outline:3px solid color-mix(in srgb,var(--omni-accent) 45%,transparent);outline-offset:2px}
.compose textarea::placeholder{color:var(--omni-muted)}
.compose input[type=file]{display:none}
.compose-controls{display:flex;align-items:center;gap:8px;width:100%;min-height:38px}
.compose button,.action{min-height:40px;background:var(--omni-accent);color:#fff;border:0;border-radius:11px;padding:0 15px;font-size:12px;font-weight:650;cursor:pointer;transition:filter .15s var(--omni-ease),transform .15s var(--omni-ease)}
.compose .utility-button{display:grid;place-items:center;width:38px;height:38px;min-height:38px;flex:0 0 38px;padding:0;background:var(--omni-bg);border:1px solid var(--omni-border);border-radius:11px;color:var(--omni-muted);font-size:17px;line-height:1}
.compose .attach{position:relative}.compose .attach[data-count]::after{content:attr(data-count);position:absolute;top:-6px;inset-inline-end:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--omni-accent);color:#fff;font-size:11px;font-weight:650;line-height:18px}
.compose .utility-button.recording{color:#c2413a;border-color:currentColor}
.compose .utility-button:hover{background:var(--omni-assistant-bg);color:var(--omni-fg);filter:none}
.compose .send-button{min-width:76px;min-height:38px;margin-inline-start:auto}
.compose button:hover,.action:hover{filter:brightness(1.08)}
.compose button:active,.action:active{transform:scale(.97)}
.subhead{display:flex;align-items:center;padding:10px 13px;border-bottom:1px solid var(--omni-border)}
.subhead .back{min-height:34px;background:transparent;color:var(--omni-fg);border:1px solid var(--omni-border);padding:0 12px;font-size:12px}
.subhead .back:hover{background:var(--omni-assistant-bg);filter:none}
.ghost{min-height:32px;margin-top:8px;margin-inline-end:6px;padding:0 11px;border:1px solid var(--omni-border);border-radius:9px;background:var(--omni-bg);color:var(--omni-fg);font-size:12px;font-weight:600;cursor:pointer}
.ghost:hover{background:var(--omni-assistant-bg)}
.msg .ghost{display:block;margin-top:10px}
.empty{padding:20px 16px;color:var(--omni-muted);font-size:13px}
.list{display:flex;flex:1;flex-direction:column;gap:4px;padding:12px;overflow:auto}
.list button{border:0;background:transparent;text-align:start;padding:11px 12px;border-radius:11px;color:var(--omni-fg);cursor:pointer}
.list button:hover{background:var(--omni-assistant-bg)}
.settings{padding:16px;overflow:auto;flex:1}.settings .action{margin-top:8px}.settings h3{font-size:13px;letter-spacing:-.01em}
.settings label{display:block;margin:10px 0;font-size:13px}
.settings input,.settings textarea{width:100%;font-size:13px;padding:10px;margin-top:4px;border:1px solid var(--omni-border);border-radius:10px;color:var(--omni-fg);background:var(--omni-bg)}
.settings textarea{min-height:84px}.settings .memory{padding:9px 0;border-bottom:1px solid var(--omni-border);overflow-wrap:anywhere}
@media(max-width:520px){
  .panel{inset:auto 8px 8px;width:auto;height:min(var(--omni-height,650px),calc(100dvh - 16px));max-height:calc(100dvh - 16px);border-radius:20px}
  .right.panel,.left.panel{right:8px;left:8px}
  .launcher{bottom:16px}.right{right:16px}.left{left:16px}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`;;
const svg=(body:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const icons={chat:svg('<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z"/>'),attach:svg('<path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>'),mic:svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),stop:svg('<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/>')};
export function mount(target:Element,options:WidgetOptions){
 let current=options,config:Config|undefined,conversationId:string|undefined,abort:AbortController|undefined,recorder:MediaRecorder|undefined,recordingTimer:ReturnType<typeof setTimeout>|undefined,submitting=false,destroyed=false;const mediaControllers=new Set<AbortController>(),audioPlayers=new Set<HTMLAudioElement>();const selectedFiles:File[]=[],objectUrls:string[]=[];const root=target.shadowRoot??target.attachShadow({mode:"open"}),style=document.createElement("style");style.textContent=css;root.replaceChildren(style);
 const label=(key:keyof WidgetLabels)=>current.labels?.[key]??labelDefaults[key];
 const launcher=document.createElement("button");launcher.className="launcher right";launcher.part.add("launcher");launcher.setAttribute("aria-label",label("openChat"));launcher.innerHTML=icons.chat;const panel=document.createElement("section");panel.className="panel right hidden";panel.setAttribute("role","dialog");panel.setAttribute("aria-label",label("assistant"));panel.part.add("panel");root.append(launcher,panel);
 const api=async(path:string,init:RequestInit={})=>{const base=new URL(current.endpoint,location.href);if(!base.pathname.endsWith("/"))base.pathname+="/";const configured=typeof current.headers==="function"?await current.headers():current.headers,headers=new Headers(configured);new Headers(init.headers).forEach((value,key)=>headers.set(key,value));return (current.fetch??fetch)(new URL(path.replace(/^\//,""),base),{...init,credentials:current.credentials??"same-origin",headers});};
 async function persistConversation(id:string|undefined){try{if(id)await current.conversationStore?.save(id);else await current.conversationStore?.clear?.();}catch{/* host persistence must not break a chat turn */}}

 async function mediaRequest<T>(path:string,init:RequestInit,consume:(response:Response)=>Promise<T>){const controller=new AbortController();mediaControllers.add(controller);try{return await consume(await api(path,{...init,signal:controller.signal}));}finally{mediaControllers.delete(controller);}}
 const mk=(tag:string,cls?:string)=>{const node=document.createElement(tag);if(cls)node.className=cls;return node;};
 const color=(value:unknown,fallback:string)=>typeof value==="string"&&value.length<100&&!/[;{}<>]/.test(value)&&CSS.supports("color",value)?value:fallback;
 const font=(value:unknown,fallback:string)=>typeof value==="string"&&value.length<120&&!/[;{}<>\n\r]/.test(value)&&CSS.supports("font-family",value)?value:fallback;
 function close(){panel.classList.add("hidden");launcher.focus();}function open(){panel.classList.remove("hidden");root.querySelector<HTMLTextAreaElement>("textarea")?.focus();}
 function translateComposer(form:HTMLFormElement){
  const area=form.querySelector("textarea");
  if(area){area.placeholder=label("messagePlaceholder");area.setAttribute("aria-label",label("message"));}
  const send=form.querySelector(".send-button");if(send)send.textContent=label("send");
  const picker=form.querySelector<HTMLInputElement>('input[type="file"]');
  if(picker){picker.setAttribute("aria-label",label("attachImage"));picker.previousElementSibling?.setAttribute("aria-label",label("attachImage"));}
  const mic=form.querySelector(".utility-button:not(.attach)");
  mic?.setAttribute("aria-label",label("recordVoice"));
  for(const pill of panel.querySelectorAll<HTMLButtonElement>(".prompts button"))pill.setAttribute("aria-label",`${label("useSuggestion")}: ${pill.textContent}`);
 }
 function paint(preserve=true){if(!config||destroyed)return;const previous=preserve?{messages:panel.querySelector<HTMLElement>(".messages"),status:panel.querySelector<HTMLElement>(".status"),form:panel.querySelector<HTMLFormElement>("form")}:undefined;const wasOpen=!panel.classList.contains("hidden"),b=config.branding,place=(current.placement??b.placement)==="bottom-left"?"left":"right",theme=current.theme??b.theme,dark=theme==="dark"||(theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches),palette={...b.colors,...current.colors},accent=color(current.accent??palette.accent,"#2f5d62"),panelColor=color(palette.panel,dark?"#191a20":"#fdfdfc"),foreground=color(palette.text,dark?"#f5f5f8":"#191a22"),muted=color(palette.muted,dark?"#a2a3af":"#737582"),hostStyle=(root.host as HTMLElement).style;panel.replaceChildren();panel.className=`panel ${place}${wasOpen?"":" hidden"}`;const launcherStyle=current.launcher??b.launcher??"bubble";launcher.className=`launcher ${place} ${launcherStyle}`;if(launcherStyle==="button")launcher.textContent=current.name??b.name??"Chat";else launcher.innerHTML=icons.chat;launcher.setAttribute("aria-label",`${label("openChat")} ${current.name??b.name??label("assistant")}`);panel.setAttribute("aria-label",`${current.name??b.name??label("assistant")} ${label("assistantChat")}`);hostStyle.setProperty("--omni-accent",accent);hostStyle.setProperty("--omni-width",`${Math.min(900,Math.max(280,current.width??b.width))}px`);hostStyle.setProperty("--omni-height",`${Math.min(1200,Math.max(360,current.height??b.height))}px`);hostStyle.setProperty("--omni-bg",panelColor);hostStyle.setProperty("--omni-fg",foreground);hostStyle.setProperty("--omni-muted",muted);hostStyle.setProperty("--omni-border",color(palette.border,dark?"#34353e":"#e8e8ee"));hostStyle.setProperty("--omni-user-bg",color(palette.userMessage,accent));hostStyle.setProperty("--omni-assistant-bg",color(palette.assistantMessage,dark?"#292a32":"#f4f4f7"));hostStyle.setProperty("--omni-font",font(current.font??b.font,"ui-sans-serif,system-ui,-apple-system,\"Segoe UI\",sans-serif"));const locale=current.locale??b.locale??"en";(root.host as HTMLElement).lang=locale;const rtl=/^(ar|fa|he|ur|ps|sd|ug|yi)(-|$)/i.test(locale);hostStyle.direction=current.dir&&current.dir!=="auto"?current.dir:rtl?"rtl":"ltr";panel.dir=hostStyle.direction;
 const header=makeHeader();
 const toolbar=mk("nav","toolbar");toolbar.setAttribute("aria-label",label("chatTools"));for(const [title,action] of [[label("history"),history],[label("newChat"),newChat],[label("settings"),settings]] as const){const btn=mk("button") as HTMLButtonElement;btn.type="button";btn.textContent=title;btn.onclick=()=>{void action().catch(()=>showNotice(label("networkFailed")));};toolbar.append(btn);}
 const messages=mk("div","messages");messages.setAttribute("role","log");messages.setAttribute("aria-live","off");const status=mk("div","status");status.setAttribute("aria-live","polite");panel.onkeydown=e=>{if(e.key==="Escape")close();};const form=mk("form","compose"),controls=mk("div","compose-controls"),area=mk("textarea") as HTMLTextAreaElement;area.placeholder=label("messagePlaceholder");area.setAttribute("aria-label",label("message"));area.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();(form as HTMLFormElement).requestSubmit();}};
 if(config.capabilities.images){const picker=mk("input") as HTMLInputElement;picker.type="file";picker.accept="image/png,image/jpeg,image/webp";picker.multiple=true;picker.setAttribute("aria-label",label("attachImage"));const attach=mk("button") as HTMLButtonElement;attach.type="button";attach.className="utility-button attach";attach.innerHTML=icons.attach;attach.setAttribute("aria-label",label("attachImage"));attach.onclick=()=>picker.click();picker.onchange=()=>{selectedFiles.push(...Array.from(picker.files??[]));if(selectedFiles.length)attach.dataset.count=String(selectedFiles.length);else delete attach.dataset.count;picker.value="";};controls.append(attach,picker);}
 if(config.capabilities.voiceInput){const mic=mk("button") as HTMLButtonElement;mic.type="button";mic.className="utility-button";mic.innerHTML=icons.mic;mic.setAttribute("aria-label",label("recordVoice"));mic.onclick=async()=>{if(recorder?.state==="recording"){recorder.stop();return;}if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status.textContent=label("voiceUnavailable");return;}try{const media=await navigator.mediaDevices.getUserMedia({audio:true});if(destroyed){media.getTracks().forEach(t=>t.stop());return;}recorder=new MediaRecorder(media);const activeRecorder=recorder;const chunks:Blob[]=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{if(recordingTimer)clearTimeout(recordingTimer);recordingTimer=undefined;media.getTracks().forEach(t=>t.stop());mic.innerHTML=icons.mic;mic.classList.remove("recording");if(destroyed)return;const type=(activeRecorder.mimeType||"audio/webm").split(";")[0]!,extension=({"audio/mp4":"m4a","audio/mpeg":"mp3","audio/ogg":"ogg","audio/wav":"wav"} as Record<string,string>)[type]??"webm",blob=new Blob(chunks,{type}),data=new FormData();data.append("file",blob,`voice.${extension}`);status.textContent=label("transcribing");try{const transcription=await mediaRequest("/transcriptions",{method:"POST",body:data},async r=>{if(!r.ok)throw Error();return await r.json() as {text:string};});area.value=transcription.text;area.focus();status.textContent=label("reviewTranscription");}catch{status.textContent=label("transcriptionFailed");}};recorder.start();mic.innerHTML=icons.stop;mic.classList.add("recording");recordingTimer=setTimeout(()=>{if(activeRecorder.state==="recording")activeRecorder.stop();},(config?.capabilities.voiceInputMaxSeconds??60)*1000);}catch{status.textContent=label("microphoneDenied");}};controls.append(mic);}
 const send=mk("button","send-button") as HTMLButtonElement;send.textContent=label("send");send.type="submit";controls.append(send);form.append(area,controls);form.onsubmit=e=>{e.preventDefault();if(submitting||destroyed)return;submitting=true;send.disabled=true;void submit(area,messages,status).catch(()=>{status.textContent=label("networkFailed");}).finally(()=>{submitting=false;abort=undefined;if(!destroyed)send.disabled=false;});};if(previous?.messages&&previous.status&&previous.form){panel.append(header,toolbar,previous.messages,previous.status,previous.form);if(!conversationId){previous.messages.replaceChildren();void loadMessages(previous.messages);}translateComposer(previous.form);}else{panel.append(header,toolbar,messages,status,form);void loadMessages(messages);}}
 function makeHeader(){const b=config!.branding,header=mk("header","head"),avatar=current.avatarUrl??b.avatarUrl;if(avatar){const img=mk("img","avatar") as HTMLImageElement;img.src=avatar;img.alt="";header.append(img);}const identity=mk("div","identity"),title=mk("span","title");title.textContent=current.name??b.name??label("assistant");const presence=mk("span","presence");presence.textContent=label("hereToHelp");identity.append(title,presence);header.append(identity);const x=mk("button") as HTMLButtonElement;x.type="button";x.textContent="×";x.setAttribute("aria-label",label("closeChat"));x.onclick=close;header.append(x);return header;}
 function subview(){panel.replaceChildren();const bar=mk("div","subhead"),back=mk("button","action back") as HTMLButtonElement;back.type="button";back.textContent=label("back");back.onclick=()=>paint();bar.append(back);panel.append(makeHeader(),bar);}
 function showNotice(text:string){const notice=panel.querySelector<HTMLElement>(".status")??mk("div","status");notice.setAttribute("aria-live","polite");notice.textContent=text;if(!notice.isConnected)panel.append(notice);}
 // A deliberately small Markdown subset, built from DOM nodes so model output is never parsed as HTML.
 function renderMarkdown(host:HTMLElement,text:string){
  host.replaceChildren();let list:HTMLElement|undefined,para:string[]=[],code:string[]|undefined;
  const flush=()=>{if(para.length){const p=mk("p");inline(p,para.join("\n"));host.append(p);para=[];}};
  const pre=(lines:string[])=>{const block=mk("pre");block.textContent=lines.join("\n");host.append(block);};
  for(const line of text.split("\n")){
   if(code){if(/^\s*```/.test(line)){pre(code);code=undefined;}else code.push(line);continue;}
   if(/^\s*```/.test(line)){flush();list=undefined;code=[];continue;}
   const item=line.match(/^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/);
   if(item){flush();const tag=item[1]?"ul":"ol";if(list?.tagName.toLowerCase()!==tag){list=mk(tag);host.append(list);}const li=mk("li");inline(li,item[3]!);list!.append(li);continue;}
   const heading=line.match(/^#{1,6}\s+(.*)$/);
   if(heading){flush();list=undefined;const p=mk("p","heading");inline(p,heading[1]!);host.append(p);continue;}
   if(!line.trim()){flush();list=undefined;continue;}
   list=undefined;para.push(line);
  }
  if(code)pre(code);
  flush();
 }
 function inline(host:HTMLElement,text:string){
  let last=0;
  for(const m of text.matchAll(/\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*([^*\s][^*]*?)\*/g)){
   host.append(text.slice(last,m.index));let node:HTMLElement;
   if(m[1]!==undefined){node=mk("strong");inline(node,m[1]);}
   else if(m[2]!==undefined){node=mk("code");node.textContent=m[2];}
   else if(m[3]!==undefined){const link=mk("a") as HTMLAnchorElement;link.href=m[4]!;link.target="_blank";link.rel="noopener noreferrer";link.textContent=m[3];node=link;}
   else{node=mk("em");node.textContent=m[5]!;}
   host.append(node);last=m.index!+m[0].length;
  }
  host.append(text.slice(last));
 }
 function appendSuggestions(messages:HTMLElement,prompts:unknown[]){if(!config?.capabilities.suggestions)return;const followups=mk("div","prompts followups");for(const prompt of prompts){if(typeof prompt!=="string"||!prompt.trim())continue;const pill=mk("button") as HTMLButtonElement;pill.type="button";pill.textContent=prompt;pill.setAttribute("aria-label",`${label("useSuggestion")}: ${prompt}`);pill.onclick=()=>{const area=root.querySelector<HTMLTextAreaElement>("textarea");if(area){area.value=prompt;area.focus();}};followups.append(pill);}if(followups.childElementCount)messages.append(followups);}
 function requestId(){if(typeof crypto.randomUUID==="function")return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]!&15)|64;bytes[8]=(bytes[8]!&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
 async function loadMessages(host:HTMLElement){if(!conversationId){const greeting=mk("div","msg");greeting.textContent=current.greeting??config?.branding.greeting??"Hi! How can I help?";host.append(greeting);const suggestions=current.suggestedPrompts??config?.branding.suggestedPrompts??[];if(suggestions.length){const prompts=mk("div","prompts");for(const prompt of suggestions.slice(0,4)){const button=mk("button");button.textContent=prompt;button.onclick=()=>{const input=root.querySelector<HTMLTextAreaElement>("textarea");if(input){input.value=prompt;input.focus();}};prompts.append(button);}host.append(prompts);}return;}try{const r=await api(`/conversations/${encodeURIComponent(conversationId)}`);if(!r.ok)return;const d=await r.json() as {messages:Message[]};for(const m of d.messages){if(m.role==="assistant"&&!m.content)continue;const el=mk("div",m.role==="user"?"msg user":"msg rich");if(m.role==="user")el.textContent=m.content;else renderMarkdown(el,m.content);host.append(el);if(m.role==="assistant"&&m.suggestions?.length)appendSuggestions(host,m.suggestions);}host.scrollTop=host.scrollHeight;}catch{/* errors appear on next send */}}
 async function newChat(){const r=await api("/conversations",{method:"POST"});if(!r.ok){showNotice(label("startFailed"));return;}conversationId=(await r.json() as {conversation:Conversation}).conversation.id;void persistConversation(conversationId);paint(false);open();}
 async function history(){const r=await api("/conversations");if(!r.ok)throw Error();const d=await r.json() as {conversations:Conversation[]};if(destroyed)return;subview();const list=mk("div","list");if(!d.conversations.length){const empty=mk("p","empty");empty.textContent=label("noConversations");list.append(empty);}for(const c of d.conversations){const b=mk("button") as HTMLButtonElement;b.textContent=c.title||label("conversation");b.type="button";b.onclick=()=>{conversationId=c.id;void persistConversation(c.id);paint();};list.append(b);}panel.append(list);}
 async function settings(){
  try{
   const [pr,mr]=await Promise.all([api("/preferences"),api("/memories")]);
   if(destroyed)return;
   if(!pr.ok||!mr.ok)throw Error();
   const prefs=(await pr.json() as {preferences:Record<string,unknown>}).preferences??{};
   const memories=(await mr.json() as {memories:Array<{id:string;content:string}>}).memories??[];
   subview();
   const box=mk("div","settings"),h=mk("h3");h.textContent=label("preferencesTitle");box.append(h);
   const input=mk("textarea") as HTMLTextAreaElement;input.value=JSON.stringify(prefs,null,2);input.setAttribute("aria-label",label("preferencesJson"));
   const save=mk("button","action") as HTMLButtonElement;save.textContent=label("savePreferences");
   save.onclick=async()=>{
    let preferences:unknown;
    try{preferences=JSON.parse(input.value);}catch{save.textContent=label("invalidJson");return;}
    save.disabled=true;
    try{const response=await api("/preferences",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({preferences})});if(!response.ok)throw Error();save.textContent=label("saved");}
    catch{save.textContent=label("saveFailed");}finally{save.disabled=false;}
   };
   box.append(input,save);
   const mh=mk("h3");mh.textContent=label("rememberedTitle");box.append(mh);
   const memoryInput=mk("input") as HTMLInputElement;memoryInput.placeholder=label("memoryPlaceholder");memoryInput.setAttribute("aria-label",label("addMemory"));
   const add=mk("button","action") as HTMLButtonElement;add.textContent=label("remember");
   add.onclick=async()=>{
    const content=memoryInput.value.trim();if(!content)return;add.disabled=true;
    try{const response=await api("/memories",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({content})});if(!response.ok)throw Error();memoryInput.value="";await settings();}
    catch{add.textContent=label("saveFailed");}finally{add.disabled=false;}
   };
   box.append(memoryInput,add);
   for(const m of memories){
    const row=mk("div","memory"),edit=mk("input") as HTMLInputElement;edit.value=m.content;edit.setAttribute("aria-label",label("memoryPlaceholder"));
    const saveMemory=mk("button","ghost") as HTMLButtonElement;saveMemory.textContent=label("save");
    saveMemory.onclick=async()=>{
     saveMemory.disabled=true;
     try{const response=await api(`/memories/${encodeURIComponent(m.id)}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({content:edit.value})});if(!response.ok)throw Error();saveMemory.textContent=label("saved");}
     catch{saveMemory.textContent=label("saveFailed");}finally{saveMemory.disabled=false;}
    };
    const del=mk("button","ghost") as HTMLButtonElement;del.textContent=label("remove");
    del.onclick=async()=>{
     del.disabled=true;
     try{const response=await api(`/memories/${encodeURIComponent(m.id)}`,{method:"DELETE"});if(!response.ok)throw Error();row.remove();}
     catch{del.textContent=label("removeFailed");}finally{del.disabled=false;}
    };
    row.append(edit,saveMemory,del);box.append(row);
   }
   panel.append(box);
  }catch{
   if(destroyed)return;
   showNotice(label("networkFailed"));
  }
 }
 async function submit(area:HTMLTextAreaElement,messages:HTMLElement,status:HTMLElement){const controller=new AbortController();abort=controller;const text=area.value.trim();if(!text&&!selectedFiles.length)return;if(!conversationId){const r=await api("/conversations",{method:"POST",signal:controller.signal});if(!r.ok){status.textContent=label("startFailed");return;}conversationId=(await r.json() as {conversation:Conversation}).conversation.id;void persistConversation(conversationId);}const mediaIds:string[]=[];try{for(const file of selectedFiles){const data=new FormData();data.append("file",file);data.append("conversationId",conversationId);const upload=await api("/media",{method:"POST",body:data,signal:controller.signal});if(!upload.ok)throw Error();mediaIds.push((await upload.json() as {mediaId:string}).mediaId);}selectedFiles.splice(0);const attached=panel.querySelector<HTMLElement>(".attach");if(attached)delete attached.dataset.count;}catch{status.textContent=label("uploadFailed");return;}area.value="";const user=mk("div","msg user");user.textContent=text||label("imageAttachment");messages.append(user);const answer=mk("div","msg rich"),sources=mk("div","sources");let raw="";messages.append(answer,sources);status.textContent=label("assistantResponding");try{const r=await api(`/conversations/${encodeURIComponent(conversationId)}/messages`,{method:"POST",signal:controller.signal,headers:{"content-type":"application/json"},body:JSON.stringify({content:text||label("describeImage"),mediaIds,requestId:requestId()})});if(!r.ok||!r.body)throw Error();const reader=r.body.getReader(),decoder=new TextDecoder();let buffer="",finished=false;while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const frames=buffer.split("\n\n");buffer=frames.pop()??"";for(const frame of frames){const event=frame.match(/^event: (.+)$/m)?.[1],data=frame.match(/^data: (.+)$/m)?.[1];if(!data)continue;const payload=JSON.parse(data) as {text?:string;message?:string;label?:string;status?:string;code?:string;url?:string;title?:string;prompts?:unknown};if(event==="citation"&&payload.url&&/^https?:\/\//i.test(payload.url)){const link=mk("a") as HTMLAnchorElement;link.href=payload.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent=payload.title??payload.url;sources.append(link);}if(event==="suggestions"&&config?.capabilities.suggestions&&Array.isArray(payload.prompts)){appendSuggestions(messages,payload.prompts);}if(event==="delta"){raw+=payload.text??"";renderMarkdown(answer,raw);}if(event==="status"&&payload.message)status.textContent=payload.code==="suggestions"?label("nextSteps"):payload.message;if(event==="tool")status.textContent=payload.status==="running"?`${payload.label??label("assistant")}…`:payload.status==="complete"?`${payload.label??label("assistant")} ${label("toolComplete")}.`:label("toolWorking");if(event==="error"){finished=true;status.textContent=label("responseInterrupted");}if(event==="done"){finished=true;status.textContent=label("responseComplete");answer.setAttribute("aria-live","polite");if(config?.capabilities.voiceOutput&&answer.textContent)answer.append(listenButton(answer.textContent));}}messages.scrollTop=messages.scrollHeight;}if(!finished)status.textContent=label("responseInterrupted");}catch{status.textContent=label("networkFailed");}finally{abort=undefined;}}
 function listenButton(text:string){
  const play=mk("button","ghost") as HTMLButtonElement;play.type="button";play.textContent=label("listen");let audio:HTMLAudioElement|undefined;
  const reset=()=>{if(audio){audio.pause();audioPlayers.delete(audio);}play.textContent=label("listen");};
  play.onclick=async()=>{
   if(audio&&!audio.paused){reset();return;}
   play.disabled=true;
   try{
    if(!audio){const blob=await mediaRequest("/speech",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text})},async speech=>{if(!speech.ok)throw Error();return await speech.blob();});if(destroyed)return;const url=URL.createObjectURL(blob);objectUrls.push(url);audio=new Audio(url);audio.onended=reset;}
    audio.currentTime=0;audioPlayers.add(audio);await audio.play();play.textContent=label("stopAudio");
   }catch{play.textContent=label("audioUnavailable");}finally{play.disabled=false;}
  };
  return play;
 }
 launcher.onclick=open;const ready=api("/config").then(async r=>{if(!r.ok)throw Error();config=await r.json() as Config;if(current.conversationStore){try{const saved=await current.conversationStore.load();if(saved){const existing=await api(`/conversations/${encodeURIComponent(saved)}`);if(existing.ok)conversationId=saved;else if(existing.status===404)await current.conversationStore.clear?.();}}catch{/* restore is optional; allow a fresh chat */}}paint(false);}).catch(()=>{if(destroyed)return;launcher.title=label("unavailable");showNotice(label("unavailable"));});
 return {ready,update(next:Partial<WidgetOptions>){if(Object.keys(next).every(key=>current[key as keyof WidgetOptions]===next[key as keyof WidgetOptions]))return;current={...current,...next};if(config)paint();},open,close,destroy(){destroyed=true;abort?.abort();for(const controller of mediaControllers)controller.abort();if(recordingTimer)clearTimeout(recordingTimer);recorder?.stop();for(const audio of audioPlayers){audio.pause();audio.src="";}audioPlayers.clear();for(const url of objectUrls)URL.revokeObjectURL(url);root.replaceChildren();}};
}
