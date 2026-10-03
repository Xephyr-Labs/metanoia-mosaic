import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import { createChatbotClient } from '../packages/client/dist/index.js';

const source = await readFile(new URL('../examples/react-native/App.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function fixture({ denied = false, pickerGate } = {}) {
  const dom = new JSDOM('<body><div id="root"></div></body>', { url: 'https://app.test/' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const originalFetch = globalThis.fetch;
  let input, signal, pickerCalls = 0, uploaded;
  const buttons = new Map();
  const requests = [];
  const native = {
    View: ({ children }) => React.createElement('div', null, children),
    ScrollView: ({ children }) => React.createElement('div', null, children),
    Text: ({ children }) => React.createElement('span', null, children),
    TextInput: props => { input = props; return React.createElement('span', null, props.value); },
    Button: props => { buttons.set(props.title, props); return React.createElement('button', { disabled: props.disabled }, props.title); },
  };
  const makeFetch = streaming => async (url, init = {}) => {
    requests.push(String(url));
    if (String(url).endsWith('/config')) return Response.json({ capabilities: { images: true } });
    if (denied) return Response.json({ error: { message: 'Please sign in.', code: 'unauthorized' } }, { status: 401 });
    if (String(url).endsWith('/conversations')) return Response.json({ conversation: { id: 'chat' } });
    if (String(url).endsWith('/media')) {
      uploaded = init.body.get('file');
      return Response.json({ mediaId: 'image' });
    }
    signal = init.signal;
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(`event: delta\ndata: {"text":"${streaming ? 'Partial reply' : 'Buffered fallback'}"}\n\n`));
      if (!streaming) controller.close();
      else init.signal.addEventListener('abort', () => { try { controller.error(new DOMException('Aborted', 'AbortError')); } catch {} }, { once: true });
    } }));
  };
  globalThis.fetch = makeFetch(false);
  const modules = {
    react: React, 'react/jsx-runtime': jsxRuntime, 'react-native': native,
    '@metanoia/client': { createChatbotClient },
    'expo/fetch': { fetch: makeFetch(true) },
    'expo-file-system': { File: class extends Blob { constructor() { super(['image-bytes'], { type: 'image/png' }); this.name = 'photo.png'; } } },
    './auth': { getFreshAccessToken: async () => 'verified-token' },
    'expo-image-picker': { launchImageLibraryAsync: async () => {
      pickerCalls++;
      if (pickerGate) await pickerGate;
      return { canceled: false, assets: [{ uri: 'file:///photo.png', fileName: 'photo.png', mimeType: 'image/png' }] };
    } },
  };
  const exports = {};
  new Function('require', 'exports', 'process', compiled)(name => {
    if (!(name in modules)) throw new Error(`Unmocked native module: ${name}`);
    return modules[name];
  }, exports, { env: { EXPO_PUBLIC_CHATBOT_URL: 'https://app.test/assistant' } });
  const root = createRoot(document.querySelector('#root'));
  await act(async () => { root.render(React.createElement(exports.default)); await tick(); });
  return {
    requests, get signal() { return signal; }, get uploaded() { return uploaded; }, get pickerCalls() { return pickerCalls; },
    async send() { await act(async () => input.onChangeText('Help')); await act(async () => { buttons.get('Send').onPress(); await tick(); }); },
    async attachTwice() { await act(async () => { const attach = buttons.get('Attach image').onPress; attach(); attach(); await tick(); }); },
    async attach() { await act(async () => { buttons.get('Attach image').onPress(); await tick(); }); },
    get text() { return document.body.textContent; },
    async close() { await act(async () => { root.unmount(); await tick(); }); globalThis.fetch = originalFetch; dom.window.close(); },
  };
}

test('Expo example displays incremental replies using its streaming Fetch', async () => {
  const f = await fixture();
  try { await f.send(); assert.match(f.text, /Partial reply/); } finally { await f.close(); }
});

test('unmounting the mobile screen cancels an active request', async () => {
  const f = await fixture();
  await f.send();
  const signal = f.signal;
  await f.close();
  assert.equal(signal.aborted, true);
});

test('Expo image upload sends file bytes rather than a URI descriptor string', async () => {
  const f = await fixture();
  try { await f.attach(); assert.ok(f.uploaded instanceof Blob); assert.equal(await f.uploaded.text(), 'image-bytes'); } finally { await f.close(); }
});

test('rapid attachment clicks open only one picker and start one operation', async () => {
  let release;
  const pickerGate = new Promise(resolve => { release = resolve; });
  const f = await fixture({ pickerGate });
  try { await f.attachTwice(); assert.equal(f.pickerCalls, 1); } finally {
    await act(async () => { release(); await tick(); });
    await f.close();
  }
});
test('mobile authentication failures appear in the UI and release the busy state', async () => {
  const f = await fixture({ denied: true });
  try { await f.send(); assert.match(f.text, /Please sign in\./); assert.doesNotMatch(f.text, /Responding…/); } finally { await f.close(); }
});
