const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../extension/js/client.js'), 'utf8');

function nativeClient(sendMessage) {
  const requests = [];
  let nextId = 0;
  const context = {
    browser: { runtime: {
      id: 'purrple-test',
      sendMessage(message) {
        const copy = structuredClone(message);
        requests.push(copy);
        return sendMessage(copy, requests.length);
      },
      onMessage: { addListener() {} }
    } },
    crypto: { randomUUID: () => 'request-' + ++nextId },
    setTimeout: callback => callback(),
    addEventListener() {},
    structuredClone
  };
  vm.runInNewContext(source, context);
  return { client:context.PurrpleClient, requests };
}

test('a lost native action reply retries the same ID and immutable payload', async () => {
  const saved = { tasks: [{ title: 'Read a chapter' }] };
  const { client, requests } = nativeClient(async (message, attempt) => {
    if (attempt === 1) throw Error('Message port closed');
    return { ok: true, state: saved };
  });
  const action = { type: 'TASK_ADD', title: 'Read a chapter' };
  const result = client.action(action);
  action.title = 'Do another task';
  assert.deepEqual(await result, saved);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[1].action.title, 'Read a chapter');
  await client.action(action);
  assert.notEqual(requests[2].requestId, requests[1].requestId);
});

test('native action retry is bounded, including when the browser returns no reply', async () => {
  const { client, requests } = nativeClient(() => Promise.resolve(undefined));
  await assert.rejects(client.action({ type: 'TASK_ADD' }), /could not save/);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].requestId, requests[1].requestId);
});

test('native application errors and reads are not retried', async () => {
  const action = nativeClient(() => Promise.resolve({ ok: false, error: 'Choose a valid title.' }));
  await assert.rejects(action.client.action({ type: 'TASK_ADD' }), /Choose a valid title/);
  assert.equal(action.requests.length, 1);

  const read = nativeClient(() => Promise.reject(Error('Message port closed')));
  await assert.rejects(read.client.get(), /Message port closed/);
  assert.equal(read.requests.length, 1);
});
