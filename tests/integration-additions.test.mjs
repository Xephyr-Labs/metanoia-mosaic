import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, fork } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import Fastify from 'fastify';
import { Hono } from 'hono';
import ts from 'typescript';
import { createChatbotFetchHandler } from '../packages/core/dist/fetch.js';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'packages/create-metanoia-mosaic/src/cli.js');
async function temporary(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'mosaic-integration-'));
  try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('generator accepts --yes with its default template and name', () => temporary(async dir => {
  await run(process.execPath, [cli, '--yes'], { cwd: dir });
  assert.equal(JSON.parse(await readFile(path.join(dir, 'my-assistant/package.json'), 'utf8')).name, 'my-assistant');
}));

test('generator accepts --name without --template and uses a valid npm package name', () => temporary(async dir => {
  await run(process.execPath, [cli, '--name', 'MyAssistant', '--yes'], { cwd: dir });
  assert.equal(JSON.parse(await readFile(path.join(dir, 'MyAssistant/package.json'), 'utf8')).name, 'myassistant');
}));

test('generator reports a missing option value before creating a directory', () => temporary(async dir => {
  await assert.rejects(run(process.execPath, [cli, '--name', '--yes'], { cwd: dir }), error => {
    assert.match(error.stderr, /--name.*(?:value|argument)/i);
    return true;
  });
}));

test('packed starter follows backend and widget versions after a release bump', () => temporary(async dir => {
  const packages = path.join(dir, 'packages');
  const generator = path.join(packages, 'create-metanoia-mosaic');
  await cp(path.join(root, 'packages/create-metanoia-mosaic'), generator, { recursive: true });
  for (const [folder, name, version] of [['core', '@metanoia/chatbot', '0.2.0'], ['widget', '@metanoia/widget', '0.3.0']]) {
    await mkdir(path.join(packages, folder), { recursive: true });
    await writeFile(path.join(packages, folder, 'package.json'), JSON.stringify({ name, version }));
  }
  await run('npm', ['run', 'build', '--if-present'], { cwd: generator });
  const pkg = JSON.parse(await readFile(path.join(generator, 'package.json'), 'utf8'));
  await run(process.execPath, [path.join(generator, pkg.bin['create-metanoia-mosaic']), '--name', 'app', '--template', 'express', '--yes'], { cwd: dir });
  const app = JSON.parse(await readFile(path.join(dir, 'app/package.json'), 'utf8'));
  assert.equal(app.dependencies['@metanoia/chatbot'], '^0.2.0');
  assert.equal(app.dependencies['@metanoia/widget'], '^0.3.0');
}));

test('generated Express starter shuts down while an SSE reply is still active', () => temporary(async dir => {
  await cp(path.join(root, 'packages/create-metanoia-mosaic/src/templates/express'), dir, { recursive: true });
  await symlink(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  await writeFile(path.join(dir, 'src/auth.js'), 'export async function getAuthenticatedUser() { return { id: "verified-user" }; }');
  await writeFile(path.join(dir, 'preload.mjs'), `
    import { Server } from 'node:http';
    const listen = Server.prototype.listen;
    Server.prototype.listen = function (...args) {
      this.once('listening', () => process.send({ port: this.address().port }));
      return listen.apply(this, args);
    };
    globalThis.fetch = async (_url, init) => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Pending reply"}}]}\\n\\n'));
      init.signal.addEventListener('abort', () => controller.close(), { once: true });
    } }));
  `);
  const child = fork(path.join(dir, 'src/server.js'), [], {
    cwd: dir, execArgv: ['--import', path.join(dir, 'preload.mjs')], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, PORT: '0', AI_BASE_URL: 'https://provider.test/v1', AI_API_KEY: 'test', AI_MODEL: 'test' },
  });
  let reader, timer;
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const exited = once(child, 'exit');
  try {
    const [message] = await Promise.race([
      once(child, 'message'),
      exited.then(() => { throw new Error('Starter exited before listening. ' + stderr); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Starter did not start. ' + stderr)), 5000); }),
    ]);
    clearTimeout(timer);
    const base = `http://127.0.0.1:${message.port}/assistant`;
    const created = await (await fetch(`${base}/conversations`, { method: 'POST' })).json();
    const response = await fetch(`${base}/conversations/${created.conversation.id}/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'Hello' }),
    });
    reader = response.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /Pending reply/);
    child.kill('SIGTERM');
    const [code] = await Promise.race([exited, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Starter did not close active SSE after SIGTERM. ' + stderr)), 3000);
    })]);
    assert.equal(code, 0);
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
    try { await reader?.cancel(); } catch { /* child has closed the socket */ }
  }
}));

test('Fetch adapter preserves multipart body, query, auth and abort through a mount', async () => {
  const form = new FormData();
  form.append('file', new Blob(['image-bytes'], { type: 'image/png' }), 'photo.png');
  const abort = new AbortController();
  let forwarded;
  const handler = createChatbotFetchHandler({ handle: async request => {
    forwarded = request;
    const data = await request.formData();
    return Response.json({ url: request.url, auth: request.headers.get('authorization'), file: await data.get('file').text() });
  } }, { basePath: '/assistant/' });
  const response = await handler(new Request('https://app.test/assistant/media?q=hello', {
    method: 'POST', headers: { authorization: 'Bearer token' }, body: form, signal: abort.signal,
  }));
  assert.deepEqual(await response.json(), { url: 'https://app.test/media?q=hello', auth: 'Bearer token', file: 'image-bytes' });
  abort.abort();
  assert.equal(forwarded.signal.aborted, true);
  assert.equal((await handler(new Request('https://app.test/assistant-other/config'))).status, 404);
});

test('Hono forwards the original streaming response without buffering', async () => {
  const chatbot = { handle: () => new Response('event: delta\ndata: {"text":"hello"}\n\n', { headers: { 'content-type': 'text/event-stream' } }) };
  const handler = createChatbotFetchHandler(chatbot, { basePath: '/assistant' });
  const app = new Hono();
  app.all('/assistant/*', c => handler(c.req.raw));
  const response = await app.request('/assistant/conversations/id/messages');
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  assert.match(await response.text(), /hello/);
});

test('Fastify recipe accepts multipart and leaves the host JSON parser intact', async () => {
  const fastify = Fastify();
  fastify.post('/host-json', async request => ({ object: request.body.value }));
  const chatbot = { ready: Promise.resolve(), handle: async request => {
    if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const form = await request.formData();
      return Response.json({ file: await form.get('file').text() });
    }
    return Response.json({ body: await request.json() });
  } };
  const markdown = await readFile(path.join(root, 'docs/frameworks/fastify.md'), 'utf8');
  const source = markdown.match(/```ts\n([\s\S]*?)```/)[1].replace(/^import .*;\n/gm, '');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const execute = new (Object.getPrototypeOf(async function () {}).constructor)('fastify', 'createChatbot', 'createChatbotFetchHandler', 'Readable', 'pipeline', 'getUserFromRequest', 'baseUrl', 'apiKey', 'model', compiled);
  try {
    await execute(fastify, () => chatbot, createChatbotFetchHandler, Readable, pipeline, () => null, 'https://provider.test', 'key', 'model');
    const multipart = new Request('https://app.test', { method: 'POST', body: (() => {
      const form = new FormData();
      form.append('file', new Blob(['native-bytes'], { type: 'image/png' }), 'photo.png');
      return form;
    })() });
    const response = await fastify.inject({ method: 'POST', url: '/assistant/media', headers: Object.fromEntries(multipart.headers), payload: Buffer.from(await multipart.arrayBuffer()) });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().file, 'native-bytes');
    const host = await fastify.inject({ method: 'POST', url: '/host-json', payload: { value: 'host-app' } });
    assert.deepEqual(host.json(), { object: 'host-app' });
  } finally { await fastify.close(); }
});
