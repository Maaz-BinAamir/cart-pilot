import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAgentUIStream, createUIMessageStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { createStore } from '../src/lib/store.ts';
import { createBrowserSession, chatStorageKey } from '../src/lib/browser-session.ts';
import { createShoppingAgent } from '../src/lib/shopping-agent.ts';
import { POST as readStore } from '../app/api/store/route.ts';
import { POST as admin } from '../app/api/admin/route.ts';
import { POST as reset } from '../app/api/reset/route.ts';

function storage() {
  const map = new Map();
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key),
  };
}
const request = body => new Request('http://localhost/api/store', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('a checkout reaches order history on a separate request and survives a tab refresh', async () => {
  const tabStorage = storage();
  const tab = createBrowserSession(tabStorage);
  const checkout = createStore(tab.read());
  const initialStock = checkout.checkInventory('aud-001').stock;
  const order = checkout.placeOrder('aud-001', 1, 'approved-checkout');
  tab.write(checkout.getSession());

  const refreshed = createBrowserSession(tabStorage);
  const response = await readStore(request({ session: refreshed.read() }));
  const history = await response.json();
  assert.equal(history.orders[0].id, order.id);
  assert.equal(history.products.find(p => p.id === 'aud-001').stock, initialStock - 1);
  assert.equal(createStore(refreshed.read()).getOrder(order.id).id, order.id);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('fresh tabs and new sessions cannot see another tab orders or stock changes', () => {
  const first = createStore();
  const second = createStore();
  const originalStock = second.checkInventory('aud-001').stock;
  first.placeOrder('aud-001');
  first.updateProduct({ productId: 'aud-001', price: 99 });
  assert.deepEqual(second.listOrders(), []);
  assert.equal(second.checkInventory('aud-001').stock, originalStock);
  assert.notEqual(second.getProduct('aud-001').price, 99);
  assert.equal(createBrowserSession(storage()).read(), null);
  assert.deepEqual(createStore().listOrders(), []);
});

test('replaying an approved checkout does not duplicate the order or reduce stock twice', () => {
  const checkout = createStore();
  const original = checkout.placeOrder('aud-001', 2, 'same-call');
  const retry = createStore(checkout.getSession());
  assert.equal(retry.placeOrder('aud-001', 2, 'same-call').id, original.id);
  assert.equal(retry.listOrders().length, 1);
  assert.equal(retry.checkInventory('aud-001').stock, checkout.checkInventory('aud-001').stock);
});

test('admin changes, cancellation, and reset all operate on the submitted tab', async () => {
  const store = createStore();
  const originalStock = store.checkInventory('aud-001').stock;
  const order = store.placeOrder('aud-001', 1);
  const changed = await (await admin(request({ session: store.getSession(), orderId: order.id, status: 'packed' }))).json();
  const cancel = createStore(changed.session);
  assert.equal(cancel.getOrder(order.id).status, 'packed');
  assert.equal(cancel.cancelOrder(order.id).cancelled, true);
  assert.equal(createStore(cancel.getSession()).checkInventory('aud-001').stock, originalStock);
  assert.equal(cancel.cancelOrder(order.id).cancelled, false);
  const clean = await (await reset()).json();
  assert.deepEqual(clean.orders, []);
  assert.equal(clean.products.find(p => p.id === 'aud-001').stock, originalStock);
  assert.equal(createStore(changed.session).listOrders().length, 1);
});

test('invalid session data fails explicitly instead of silently returning no orders', async () => {
  assert.equal((await readStore(request({ session: { version: 99 } }))).status, 400);
  assert.equal((await admin(request({ session: createStore().getSession(), productId: 'aud-001', stock: -10 }))).status, 400);
});

test('corrupt tab storage resets its matching chat, and unavailable storage works until reload', () => {
  const broken = storage();
  broken.setItem('cart-pilot-store-v1', 'invalid');
  broken.setItem(chatStorageKey, 'old order confirmation');
  assert.equal(createBrowserSession(broken).read(), null);
  assert.equal(broken.getItem(chatStorageKey), null);
  const blocked = createBrowserSession({
    getItem() { throw new Error('Blocked'); },
    setItem() { throw new Error('Blocked'); },
    removeItem() { throw new Error('Blocked'); },
  });
  assert.equal(blocked.read(), null);
  const store = createStore();
  store.placeOrder('aud-001');
  blocked.write(store.getSession());
  assert.equal(blocked.read().orders.length, 1);
});

test('stock failures and invalid quantities never create orders', () => {
  const store = createStore();
  store.updateProduct({ productId: 'aud-001', stock: 0 });
  assert.ok(store.placeOrder('aud-001').error);
  for (const quantity of [-1, 0, 1.5, 6]) assert.ok(store.placeOrder('lap-001', quantity).error);
  assert.deepEqual(store.listOrders(), []);
});

const finish = { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } };
const model = () => new MockLanguageModelV4({
  doStream: async () => ({ stream: ReadableStream.from([
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: 'Done.' },
    { type: 'text-end', id: 'text-1' },
    finish,
  ]) }),
});
async function approvalStream(store, approved) {
  const messages = [
    { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Buy the headphones' }] },
    { id: 'assistant', role: 'assistant', parts: [{
      type: 'tool-placeOrder', toolCallId: 'checkout-1', state: 'approval-responded',
      input: { productId: 'aud-001', quantity: 1 }, approval: { id: 'approval-1', approved },
    }] },
  ];
  return Array.fromAsync(createUIMessageStream({
    execute: async ({ writer }) => {
      const agent = createShoppingAgent(store, session => writer.write({ type: 'data-store', data: session, transient: true }), model());
      writer.merge(await createAgentUIStream({ agent, uiMessages: messages }));
    },
  }));
}

test('approved SDK checkout emits session data before its successful tool result', async () => {
  const chunks = await approvalStream(createStore(), true);
  assert.ok(!chunks.some(chunk => chunk.type === 'error'), JSON.stringify(chunks));
  const snapshotIndex = chunks.findIndex(chunk => chunk.type === 'data-store');
  const resultIndex = chunks.findIndex(chunk => chunk.type === 'tool-output-available');
  assert.ok(snapshotIndex >= 0 && resultIndex > snapshotIndex, JSON.stringify(chunks));
  assert.equal(chunks[snapshotIndex].transient, true);
  const order = chunks[resultIndex].output;
  assert.equal(createStore(chunks[snapshotIndex].data).getOrder(order.id).id, order.id);
});

test('declined or sold-out SDK checkouts do not emit a successful session update', async () => {
  const declined = await approvalStream(createStore(), false);
  assert.ok(declined.some(chunk => chunk.type === 'tool-output-denied'), JSON.stringify(declined));
  assert.ok(!declined.some(chunk => chunk.type === 'data-store'));
  const soldOut = createStore();
  soldOut.updateProduct({ productId: 'aud-001', stock: 0 });
  const failed = await approvalStream(soldOut, true);
  assert.ok(failed.some(chunk => chunk.type === 'tool-output-available' && chunk.output.error), JSON.stringify(failed));
  assert.ok(!failed.some(chunk => chunk.type === 'data-store'));
});
