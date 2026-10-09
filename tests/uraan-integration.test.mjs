import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createChatbot } from '../packages/core/dist/index.js';

test('allowedOrigins accepts a predicate for pattern-based origins', async () => {
  const dir = await mkdtemp(`${tmpdir()}/chat-origin-`);
  const bot = createChatbot({
    provider: { baseUrl: 'https://mock.test/v1/', apiKey: 'test', model: 'test' },
    identity: () => ({ userId: 'u' }),
    storage: { filename: `${dir}/db.sqlite` },
    allowedOrigins: (origin) => /^https:\/\/[a-z0-9-]+\.preview\.test$/.test(origin)
  });
  try {
    await bot.ready;
    const call = (origin) => bot.handle(new Request('http://api.test/conversations', { headers: { origin } }));
    const allowed = await call('https://pr-12.preview.test');
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://pr-12.preview.test');
    assert.equal((await call('https://evil.test')).status, 403);
  } finally {
    await bot.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('invalid allowedOrigins values are rejected at config time', () => {
  assert.throws(() => createChatbot({ provider: { baseUrl: 'https://mock.test/v1/', apiKey: 't', model: 't' }, anonymous: true, allowedOrigins: 'https://a.test' }), /allowedOrigins/);
});

test('core does not statically import the native SQLite driver', async () => {
  const source = await readFile(new URL('../packages/core/dist/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^import[^;]*["']\.\/storage(\.js|\/postgres\.js)["']/m);
  const pkg = JSON.parse(await readFile(new URL('../packages/core/package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies['better-sqlite3'], undefined);
  assert.ok(pkg.optionalDependencies['better-sqlite3']);
});
