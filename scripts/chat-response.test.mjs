import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unfinishedResponse, toolActivity } from '../src/lib/chat-response.ts';

const message = parts => ({ id: 'response', role: 'assistant', parts });
const text = value => ({ type: 'text', text: value });
const inventory = { type: 'tool-checkInventory', state: 'output-available', output: { available: true } };

test('a response ending after a tool check needs continuation even if it has earlier text', () => {
  assert.ok(unfinishedResponse(message([text('Let me check another option.'), inventory]), 'stop'));
  assert.equal(unfinishedResponse(message([inventory, text('This one is in stock.')]), 'stop'), null);
});

test('token truncation and empty output get a continuation notice', () => {
  assert.match(unfinishedResponse(message([text('The alternative is')]), 'length'), /limit/);
  assert.ok(unfinishedResponse(message([]), 'stop'));
});

test('pending approvals are intentional pauses, not incomplete answers', () => {
  assert.equal(unfinishedResponse(message([{ type: 'tool-placeOrder', state: 'approval-requested' }]), 'tool-calls'), null);
});

test('out-of-stock inventory is a completed check rather than an error', () => {
  const result = toolActivity({ ...inventory, output: { available: false, stock: 0 } });
  assert.equal(result.complete, true);
  assert.equal(result.failed, false);
  assert.match(result.label, /unavailable/);
  assert.equal(toolActivity({ ...inventory, output: { error: 'Product not found' } }).failed, true);
});

test('failed or declined purchases cannot render a successful checkout', () => {
  for (const part of [{ state: 'output-error' }, { state: 'output-available', output: { error: 'Sold out' } }, { state: 'output-denied' }]) {
    const result = toolActivity({ type: 'tool-placeOrder', ...part });
    assert.equal(result.complete, false);
    assert.equal(result.failed, true);
  }
});

import { chatErrorMessage } from '../src/lib/chat-error.ts';

test('rate limits are explained without exposing provider request details', () => {
  assert.match(chatErrorMessage({ statusCode: 429, requestBodyValues: { secret: 'hidden' } }), /rate limit/);
  assert.match(chatErrorMessage({ lastError: { statusCode: 429 } }), /rate limit/);
  assert.equal(chatErrorMessage(new Error('private provider details')), 'Pilot could not finish this response. Please try again.');
});
