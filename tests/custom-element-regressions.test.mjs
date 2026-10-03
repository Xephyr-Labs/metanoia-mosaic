import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const loader = await readFile(new URL('../packages/widget/dist/loader.js', import.meta.url), 'utf8');
const config = { branding: { name: 'Mira', greeting: 'Hello', theme: 'light', placement: 'bottom-right', width: 380, height: 650 }, capabilities: {} };
const waitFor = async predicate => {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  assert.fail('Widget did not reach the expected state');
};
function fixture() {
  const dom = new JSDOM('<body></body>', { url: 'https://app.test/', runScripts: 'outside-only' });
  const { window } = dom;
  Object.defineProperty(window.HTMLElement.prototype, 'part', { get: () => ({ add() {} }) });
  Object.assign(window, { Headers, Response, TextDecoder, AbortController, AbortSignal, matchMedia: () => ({ matches: false }), CSS: { supports: () => true } });
  const requests = [];
  window.fetch = async (url, init) => {
    requests.push({ url: String(url), headers: new Headers(init.headers) });
    if (String(url).endsWith('/config')) return Response.json({ ...config, branding: { ...config.branding, name: String(url).includes('/second/') ? 'Second' : 'Mira' } });
    return Response.json({ messages: [] });
  };
  return { dom, window, requests };
}

test('deferred loader upgrades headers, labels and conversationStore set before definition', async () => {
  const { dom, window, requests } = fixture();
  const element = window.document.createElement('metanoia-chat');
  element.setAttribute('endpoint', '/assistant');
  element.headers = async () => ({ authorization: 'Bearer fresh-token' });
  element.labels = { send: 'Enviar' };
  let loaded = false;
  element.conversationStore = { load: () => { loaded = true; }, save() {} };
  window.document.body.append(element);
  try {
    window.eval(loader);
    await waitFor(() => element.shadowRoot?.querySelector('form'));
    assert.equal(requests[0].headers.get('authorization'), 'Bearer fresh-token');
    assert.equal(element.shadowRoot.querySelector('.send-button').textContent, 'Enviar');
    assert.equal(loaded, true);
  } finally { element.remove(); dom.window.close(); }
});

test('an endpoint added after insertion starts the custom element', async () => {
  const { dom, window } = fixture();
  window.eval(loader);
  const element = window.document.createElement('metanoia-chat');
  window.document.body.append(element);
  try {
    element.setAttribute('endpoint', '/assistant');
    await waitFor(() => element.shadowRoot?.querySelector('form'));
  } finally { element.remove(); dom.window.close(); }
});

test('changing the endpoint reloads branding and clears the old draft', async () => {
  const { dom, window, requests } = fixture();
  window.eval(loader);
  const element = window.document.createElement('metanoia-chat');
  element.setAttribute('endpoint', '/first');
  window.document.body.append(element);
  try {
    await waitFor(() => element.shadowRoot?.querySelector('form'));
    element.shadowRoot.querySelector('textarea').value = 'Previous account draft';
    element.setAttribute('endpoint', '/second');
    await waitFor(() => element.shadowRoot?.querySelector('.title')?.textContent === 'Second');
    assert.equal(element.shadowRoot.querySelector('textarea').value, '');
    assert.equal(requests.filter(r => r.url.endsWith('/config')).length, 2);
  } finally { element.remove(); dom.window.close(); }
});

test('invalid custom-element dimensions fall back to server branding', async () => {
  const { dom, window } = fixture();
  window.eval(loader);
  const element = window.document.createElement('metanoia-chat');
  element.setAttribute('endpoint', '/assistant');
  element.setAttribute('width', 'oops');
  window.document.body.append(element);
  try {
    await waitFor(() => element.shadowRoot?.querySelector('form'));
    assert.equal(element.style.getPropertyValue('--omni-width'), '380px');
  } finally { element.remove(); dom.window.close(); }
});
