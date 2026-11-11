import test from 'node:test';
import assert from 'node:assert/strict';
import { liveWhileVisible } from '../src/utils/liveWhileVisible.js';

function fakeDocument(state = 'visible') {
    const listeners = new Set();
    return {
        visibilityState: state,
        addEventListener: (_, fn) => listeners.add(fn),
        removeEventListener: (_, fn) => listeners.delete(fn),
        show(next) { this.visibilityState = next; listeners.forEach(fn => fn()); },
        get listening() { return listeners.size; },
    };
}

test('live updates close while hidden and reopen with a catch-up', () => {
    globalThis.document = fakeDocument('visible');
    const opened = [], removed = []; let resumed = 0;
    const client = { removeChannel: ch => removed.push(ch) };
    const stop = liveWhileVisible(client, () => { const ch = `ch${opened.length + 1}`; opened.push(ch); return ch; }, () => { resumed += 1; });
    assert.deepEqual(opened, ['ch1']);
    document.show('hidden');
    assert.deepEqual(removed, ['ch1']);
    document.show('hidden');
    assert.equal(removed.length, 1);
    document.show('visible');
    assert.deepEqual(opened, ['ch1', 'ch2']);
    assert.equal(resumed, 1);
    stop();
    assert.deepEqual(removed, ['ch1', 'ch2']);
    assert.equal(document.listening, 0);
});

test('a page opened in a background tab connects when first shown', () => {
    globalThis.document = fakeDocument('hidden');
    const opened = [];
    const stop = liveWhileVisible({ removeChannel() {} }, () => { opened.push(1); return 'ch'; }, null);
    assert.equal(opened.length, 0);
    document.show('visible');
    assert.equal(opened.length, 1);
    stop();
});
