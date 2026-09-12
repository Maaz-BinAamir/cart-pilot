import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertToModelMessages } from 'ai';
import { prepareChatHistory } from '../src/lib/chat-history.ts';

const user = (id, text = 'Find headphones under $200') => ({ id, role: 'user', parts: [{ type: 'text', text }] });
const reply = (id, parts = []) => ({ id, role: 'assistant', parts: [{ type: 'text', text: 'Velora Hush X1 is a good fit.' }, ...parts] });
const result = (id, output = { productId: 'aud-001' }) => ({ type: 'tool-searchProducts', toolCallId: id, state: 'output-available', input: {}, output });

test('long catalog-heavy histories shrink without mutating the visible transcript', () => {
  const history = Array.from({ length: 50 }, (_, i) => [user('u' + i), reply('a' + i, [result('t' + i, { products: 'x'.repeat(8000) })])]).flat();
  history.push(user('latest', 'Which one should I choose?'));
  const original = JSON.stringify(history);
  const prepared = prepareChatHistory(history);
  assert.ok(JSON.stringify(prepared).length < 24000);
  assert.equal(JSON.stringify(history), original);
  assert.equal(prepared.at(-1).id, 'latest');
  assert.ok(prepared.some(message => message.id === 'a49'));
  assert.deepEqual(prepareChatHistory(prepared), prepared);
});

test('trims complete old turns, preserving the latest request', () => {
  const history = Array.from({ length: 30 }, (_, i) => [user('u' + i, 'x'.repeat(2000)), reply('a' + i)]).flat();
  const prepared = prepareChatHistory(history);
  assert.ok(prepared.length < history.length);
  assert.equal(prepared[0].role, 'user');
  assert.equal(prepared.at(-1).id, 'a29');
});

test('current checkout approval survives compaction and SDK conversion', async () => {
  const approval = { type: 'tool-placeOrder', toolCallId: 'checkout', state: 'approval-responded', input: { productId: 'aud-001', quantity: 1 }, approval: { id: 'approval-1', approved: true } };
  const prepared = prepareChatHistory([user('buy'), reply('confirm', [approval])]);
  assert.deepEqual(prepared.at(-1).parts.at(-1), approval);
  const model = await convertToModelMessages(prepared);
  assert.ok(JSON.stringify(model).includes('tool-approval-response'));
  assert.ok(JSON.stringify(model).includes('checkout'));
});

test('interrupted tool input is removed so a follow-up can be converted', async () => {
  const interrupted = { type: 'tool-getProduct', toolCallId: 'broken', state: 'input-available', input: { productId: 'aud-001' } };
  const prepared = prepareChatHistory([user('u'), reply('a', [interrupted]), user('retry')]);
  assert.ok(!JSON.stringify(prepared).includes('broken'));
  await assert.doesNotReject(() => convertToModelMessages(prepared));
});

test('completed order results are kept for the next question, stale pending approvals are removed', () => {
  const order = { type: 'tool-placeOrder', toolCallId: 'done', state: 'output-available', input: { productId: 'aud-001' }, output: { id: 'CP-DEMO' } };
  const pending = { type: 'tool-placeOrder', toolCallId: 'pending', state: 'approval-requested', input: { productId: 'aud-001' }, approval: { id: 'old' } };
  const prepared = prepareChatHistory([user('u'), reply('a', [order, pending]), user('next', 'Track that order')]);
  assert.ok(JSON.stringify(prepared).includes('CP-DEMO'));
  assert.ok(!JSON.stringify(prepared).includes('pending'));
});

test('empty histories are supported', () => assert.deepEqual(prepareChatHistory([]), []));
