import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/sites-worker.js';

test('deployed worker executes Telegram API instead of returning the app HTML', async () => {
  const env = { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat', ASSETS: {fetch:()=>{assert.fail('API must not fall through to assets');}} };
  const response = await worker.fetch(new Request('https://shop.test/api/telegram'), env, {});
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).configured,{botToken:true,chatId:true});
  const invalid = await worker.fetch(new Request('https://shop.test/api/telegram',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'support',phone:'1',message:'test'})}),env,{});
  assert.equal(invalid.status,400);
});
test('worker retains static assets and rejects unrecognized API routes', async () => {
  const env = {ASSETS:{fetch:async () => new Response('asset')}};
  assert.equal(await (await worker.fetch(new Request('https://shop.test/'),env,{})).text(),'asset');
  assert.equal((await worker.fetch(new Request('https://shop.test/api/missing'),env,{})).status,404);
  const denied = await worker.fetch(new Request('https://shop.test/api/telegram',{headers:{Origin:'https://other.test'}}),env,{});
  assert.equal(denied.status,403);
});
