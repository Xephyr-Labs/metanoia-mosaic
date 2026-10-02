export type Awaitable<T> = T | Promise<T>;
export type Row = { id:string; user_id:string; instance_id:string; title:string; summary?:string|null; summary_message_count?:number; created_at:string; updated_at:string };
export type StoredMessage = { id:string; role:string; content:string; status:string; created_at:string; suggestions?:string[]; mediaIds?:string[] };
export type StoredMemory = { id:string; content:string; created_at:string };
export type StoredMedia = { mime:string; bytes:Buffer };

export interface Store {
  user(instance:string,user:string,profile?:Record<string,unknown>):Awaitable<Record<string,unknown>>;
  list(instance:string,user:string):Awaitable<unknown[]>;
  create(instance:string,user:string,title?:string):Awaitable<{id:string;title:string;created_at:string;updated_at:string}>;
  conversation(instance:string,user:string,id:string):Awaitable<Row|null>;
  summary(id:string):Awaitable<{content:string|null;messageCount:number}>;
  updateSummary(id:string,content:string,messageCount:number):Awaitable<void>;
  messages(id:string):Awaitable<StoredMessage[]>;
  addMessage(id:string,role:string,content:string,status?:string,requestId?:string,mediaIds?:string[]):Awaitable<string>;
  hasRequest(id:string,requestId:string):Awaitable<boolean>;
  completeMessage(id:string,content:string,status:string,input?:number,output?:number):Awaitable<void>;
  setSuggestions(id:string,prompts:string[]):Awaitable<void>;
  deleteConversation(instance:string,user:string,id:string):Awaitable<boolean>;
  prefs(instance:string,user:string):Awaitable<Record<string,unknown>>;
  updatePrefs(instance:string,user:string,value:Record<string,unknown>):Awaitable<void>;
  memories(instance:string,user:string):Awaitable<StoredMemory[]>;
  addMemory(instance:string,user:string,content:string,sourceConversation?:string):Awaitable<string>;
  setMemory(instance:string,user:string,id:string,content:string):Awaitable<void>;
  deleteMemory(instance:string,user:string,id:string):Awaitable<boolean>;
  addUsage(instance:string,user:string,conversation:string,inputEstimate:number,inputActual:number|undefined,outputActual:number|undefined,kind?:string,cachedInput?:number):Awaitable<void>;
  userData(instance:string,user:string):Awaitable<void>;
  putMedia(instance:string,user:string,conversation:string|undefined,mime:string,bytes:Buffer):Awaitable<string>;
  getMedia(instance:string,user:string,id:string):Awaitable<StoredMedia|undefined>;
  mediaForMessage(instance:string,user:string,id:string,conversation:string):Awaitable<StoredMedia|undefined>;
  tryLock(key:string):Awaitable<(()=>Awaitable<void>)|null>;
  hitRateLimit(instance:string,user:string,limit:number,windowMs:number):Awaitable<boolean>;
  close():Awaitable<void>;
}
