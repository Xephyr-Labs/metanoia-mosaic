import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Row, Store as StoreContract, StoredMemory } from "./storage/interface.js";

export class SqliteStore implements StoreContract {
  private db: Database.Database;
  private activeLocks=new Set<string>();
  constructor(filename = "./data/chatbot.sqlite") {
    const path = resolve(filename);
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    const schemaVersion=(this.db.pragma("user_version",{simple:true}) as number)??0;
    if(schemaVersion>7)throw new Error(`Chatbot database schema ${schemaVersion} is newer than this package supports.`);
    if(schemaVersion===0)this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (instance_id TEXT NOT NULL, user_id TEXT NOT NULL, profile TEXT NOT NULL DEFAULT '{}', preferences TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, PRIMARY KEY(instance_id,user_id));
      CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, user_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT 'New conversation', summary TEXT, summary_message_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(instance_id,user_id,updated_at DESC);
      CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'complete', request_id TEXT, usage_input INTEGER, usage_output INTEGER, created_at TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS messages_request ON messages(conversation_id,request_id) WHERE request_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, user_id TEXT NOT NULL, source_conversation TEXT, content TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS memories_owner ON memories(instance_id,user_id);
      CREATE TABLE IF NOT EXISTS usage (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, user_id TEXT NOT NULL, conversation_id TEXT, input_estimate INTEGER NOT NULL DEFAULT 0, input_actual INTEGER, output_actual INTEGER, cached_input INTEGER, kind TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, user_id TEXT NOT NULL, conversation_id TEXT, mime TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS conversation_locks (lock_key TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS user_rate_limits (instance_id TEXT NOT NULL, user_id TEXT NOT NULL, window_start INTEGER NOT NULL, request_count INTEGER NOT NULL, PRIMARY KEY(instance_id,user_id));
      PRAGMA user_version = 5;
    `);
    if(schemaVersion===1)this.db.exec("CREATE TABLE IF NOT EXISTS conversation_locks (lock_key TEXT PRIMARY KEY, expires_at TEXT NOT NULL); PRAGMA user_version = 2;");
    if(schemaVersion===1||schemaVersion===2)this.db.exec("ALTER TABLE conversations ADD COLUMN summary_message_count INTEGER NOT NULL DEFAULT 0; PRAGMA user_version = 3;");
    if(schemaVersion>=1&&schemaVersion<=3)this.db.exec("CREATE TABLE IF NOT EXISTS user_rate_limits (instance_id TEXT NOT NULL, user_id TEXT NOT NULL, window_start INTEGER NOT NULL, request_count INTEGER NOT NULL, PRIMARY KEY(instance_id,user_id)); PRAGMA user_version = 4;");
    if(schemaVersion>=1&&schemaVersion<=4)this.db.exec("ALTER TABLE usage ADD COLUMN cached_input INTEGER; PRAGMA user_version = 5;");
    if(schemaVersion<6)this.db.exec("ALTER TABLE messages ADD COLUMN suggestions TEXT NOT NULL DEFAULT '[]'; PRAGMA user_version = 6;");
    if(schemaVersion<7)this.db.exec("ALTER TABLE messages ADD COLUMN media_ids TEXT NOT NULL DEFAULT '[]'; PRAGMA user_version = 7;");
  }
  user(instance: string, user: string, profile?: Record<string, unknown>) {
    const at = new Date().toISOString();
    if(profile)this.db.prepare("INSERT INTO users(instance_id,user_id,profile,created_at) VALUES(?,?,?,?) ON CONFLICT(instance_id,user_id) DO UPDATE SET profile=excluded.profile").run(instance,user,JSON.stringify(profile),at);
    else this.db.prepare("INSERT OR IGNORE INTO users(instance_id,user_id,profile,created_at) VALUES(?,?,?,?)").run(instance,user,"{}",at);
    const row = this.db.prepare("SELECT profile,preferences FROM users WHERE instance_id=? AND user_id=?").get(instance,user) as {profile:string;preferences:string};
    const seed = JSON.parse(row.profile) as Record<string,unknown>;
    const preferences = JSON.parse(row.preferences) as Record<string,unknown>;
    const merged = { ...seed, ...preferences };
    return merged;
  }
  list(instance: string,user:string) { return this.db.prepare("SELECT id,title,created_at,updated_at FROM conversations WHERE instance_id=? AND user_id=? ORDER BY updated_at DESC LIMIT 100").all(instance,user); }
  create(instance:string,user:string,title="New conversation") { const id=crypto.randomUUID(),at=new Date().toISOString();this.db.prepare("INSERT INTO conversations(id,instance_id,user_id,title,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(id,instance,user,title,at,at);return {id,title,created_at:at,updated_at:at}; }
  conversation(instance:string,user:string,id:string): Row|null { return (this.db.prepare("SELECT * FROM conversations WHERE instance_id=? AND user_id=? AND id=?").get(instance,user,id) as Row|undefined) ?? null; }
  summary(id:string) { const row=this.db.prepare("SELECT summary,summary_message_count FROM conversations WHERE id=?").get(id) as {summary:string|null;summary_message_count:number}|undefined;return {content:row?.summary??null,messageCount:row?.summary_message_count??0}; }
  updateSummary(id:string,content:string,messageCount:number) { this.db.prepare("UPDATE conversations SET summary=?,summary_message_count=? WHERE id=?").run(content,messageCount,id); }
  messages(id:string) { return (this.db.prepare("SELECT id,role,content,status,created_at,suggestions,media_ids FROM messages WHERE conversation_id=? ORDER BY created_at ASC,rowid ASC").all(id) as Array<{id:string;role:string;content:string;status:string;created_at:string;suggestions:string;media_ids:string}>).map(row=>({...row,suggestions:JSON.parse(row.suggestions) as string[],mediaIds:JSON.parse(row.media_ids) as string[]})); }
  setSuggestions(id:string,prompts:string[]) { this.db.prepare("UPDATE messages SET suggestions=? WHERE id=?").run(JSON.stringify(prompts),id); }
  addMessage(id:string,role:string,content:string,status="complete",requestId?:string,mediaIds:string[]=[]) { const at=new Date().toISOString();const msg=crypto.randomUUID();this.db.prepare("INSERT INTO messages(id,conversation_id,role,content,status,request_id,created_at,media_ids) VALUES(?,?,?,?,?,?,?,?)").run(msg,id,role,content,status,requestId??null,at,JSON.stringify(mediaIds));this.db.prepare("UPDATE conversations SET updated_at=? WHERE id=?").run(at,id);return msg; }
  hasRequest(id:string,requestId:string) { return !!this.db.prepare("SELECT 1 FROM messages WHERE conversation_id=? AND request_id=?").get(id,requestId); }
  completeMessage(id:string,content:string,status:string,input?:number,output?:number) { this.db.prepare("UPDATE messages SET content=?,status=?,usage_input=?,usage_output=? WHERE id=?").run(content,status,input??null,output??null,id); }
  deleteConversation(instance:string,user:string,id:string) { this.db.prepare("DELETE FROM memories WHERE instance_id=? AND user_id=? AND source_conversation=?").run(instance,user,id);this.db.prepare("DELETE FROM media WHERE instance_id=? AND user_id=? AND conversation_id=?").run(instance,user,id);return this.db.prepare("DELETE FROM conversations WHERE instance_id=? AND user_id=? AND id=?").run(instance,user,id).changes>0; }
  prefs(instance:string,user:string) { const row=this.db.prepare("SELECT preferences FROM users WHERE instance_id=? AND user_id=?").get(instance,user) as {preferences:string}|undefined;return row?JSON.parse(row.preferences):{}; }
  updatePrefs(instance:string,user:string,value:Record<string,unknown>) { this.db.prepare("UPDATE users SET preferences=? WHERE instance_id=? AND user_id=?").run(JSON.stringify(value),instance,user); }
  memories(instance:string,user:string) { return this.db.prepare("SELECT id,content,created_at FROM memories WHERE instance_id=? AND user_id=? ORDER BY created_at DESC").all(instance,user) as StoredMemory[]; }
  addMemory(instance:string,user:string,content:string,sourceConversation?:string) { const id=crypto.randomUUID();this.db.prepare("INSERT INTO memories(id,instance_id,user_id,source_conversation,content,created_at) VALUES(?,?,?,?,?,?)").run(id,instance,user,sourceConversation??null,content,new Date().toISOString());return id; }
  setMemory(instance:string,user:string,id:string,content:string) { this.db.prepare("UPDATE memories SET content=? WHERE instance_id=? AND user_id=? AND id=?").run(content,instance,user,id); }
  deleteMemory(instance:string,user:string,id:string) { return this.db.prepare("DELETE FROM memories WHERE instance_id=? AND user_id=? AND id=?").run(instance,user,id).changes>0; }
  addUsage(instance:string,user:string,conversation:string,inputEstimate:number,inputActual:number|undefined,outputActual:number|undefined,kind="chat",cachedInput?:number) { this.db.prepare("INSERT INTO usage(id,instance_id,user_id,conversation_id,input_estimate,input_actual,output_actual,cached_input,kind,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(crypto.randomUUID(),instance,user,conversation,inputEstimate,inputActual??null,outputActual??null,cachedInput??null,kind,new Date().toISOString()); }
  userData(instance:string,user:string) { const tx=this.db.transaction(()=>{this.db.prepare("DELETE FROM media WHERE instance_id=? AND user_id=?").run(instance,user);this.db.prepare("DELETE FROM usage WHERE instance_id=? AND user_id=?").run(instance,user);this.db.prepare("DELETE FROM memories WHERE instance_id=? AND user_id=?").run(instance,user);this.db.prepare("DELETE FROM conversations WHERE instance_id=? AND user_id=?").run(instance,user);this.db.prepare("DELETE FROM user_rate_limits WHERE instance_id=? AND user_id=?").run(instance,user);this.db.prepare("DELETE FROM users WHERE instance_id=? AND user_id=?").run(instance,user);});tx(); }
  putMedia(instance:string,user:string,conversation:string|undefined,mime:string,bytes:Buffer) { const id=crypto.randomUUID();this.db.prepare("INSERT INTO media(id,instance_id,user_id,conversation_id,mime,bytes,created_at) VALUES(?,?,?,?,?,?,?)").run(id,instance,user,conversation??null,mime,bytes,new Date().toISOString());return id; }
  getMedia(instance:string,user:string,id:string) { return this.db.prepare("SELECT mime,bytes FROM media WHERE instance_id=? AND user_id=? AND id=?").get(instance,user,id) as {mime:string;bytes:Buffer}|undefined; }
  mediaForMessage(instance:string,user:string,id:string,conversation:string) { return this.db.prepare("SELECT mime,bytes FROM media WHERE instance_id=? AND user_id=? AND id=? AND conversation_id=?").get(instance,user,id,conversation) as {mime:string;bytes:Buffer}|undefined; }
  tryLock(key:string) { if(this.activeLocks.has(key))return null;this.activeLocks.add(key);let released=false;return ()=>{if(released)return;released=true;this.activeLocks.delete(key);}; }
  hitRateLimit(instance:string,user:string,limit:number,windowMs:number) { const now=Date.now();this.db.prepare("INSERT INTO user_rate_limits(instance_id,user_id,window_start,request_count) VALUES(?,?,?,1) ON CONFLICT(instance_id,user_id) DO UPDATE SET window_start=CASE WHEN user_rate_limits.window_start+?<=? THEN ? ELSE user_rate_limits.window_start END,request_count=CASE WHEN user_rate_limits.window_start+?<=? THEN 1 ELSE user_rate_limits.request_count+1 END").run(instance,user,now,windowMs,now,now,windowMs,now);const row=this.db.prepare("SELECT request_count FROM user_rate_limits WHERE instance_id=? AND user_id=?").get(instance,user) as {request_count:number};return row.request_count<=limit; }
  close() { this.db.close(); }
}
