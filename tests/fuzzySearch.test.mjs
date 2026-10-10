import test from 'node:test';
import assert from 'node:assert/strict';
import { skeleton, fuzzyPatterns, nameDistance, mergeSearchResults } from '../src/utils/fuzzySearch.js';

// Postgres ~* and JS RegExp agree on the pieces used here ([...], +, ?, {1,2}, |).
const matches = (query, name) => fuzzyPatterns(query).every(p => new RegExp(p, 'i').test(name));

test('spelling variants reduce to the same skeleton', () => {
    assert.equal(skeleton('Sandeep'), skeleton('SANDIP'));
    assert.equal(skeleton('Shailesh'), skeleton('SAILESH'));
    assert.equal(skeleton('Bhavesh'), skeleton('bavesh'));
    assert.equal(skeleton('Pooja'), skeleton('puja'));
});

test('finds names despite variant spellings and one typo', () => {
    assert.ok(matches('sandeep', 'PATEL SANDIPKUMAR BALDEVBHAI'));
    assert.ok(matches('ksandip', 'SANDIP ISHWERBHAI DESAI'));   // extra letter
    assert.ok(matches('sandop', 'SANDIP ISHWERBHAI DESAI'));    // wrong letter
    assert.ok(matches('sndip', 'SANDIP ISHWERBHAI DESAI'));     // missed letter
    assert.ok(matches('sailesh', 'SHAILESH KANTILAL SHAH'));
    assert.ok(matches('kishor patel', 'CHETANBHAI KISHORBHAI PATEL'));
});

test('does not match unrelated names', () => {
    assert.ok(!matches('sandeep', 'RAVAL SHAILESHKUMAR MANUBHAI'));
    assert.ok(!matches('kishor patel', 'CHETANBHAI KISHORBHAI SHAH'));
});

test('short words and numbers are left to the exact search', () => {
    assert.deepEqual(fuzzyPatterns('ab'), []);
    assert.deepEqual(fuzzyPatterns('9913649832'), []);
});

test('closest names come first, exact matches stay on top', () => {
    assert.ok(nameDistance('sandeep', 'SANDIP DESAI') < nameDistance('sandeep', 'VYAS SANDHYA RAJESHKUMAR'));
    const exact = [{ id: 1, customer_name: 'SANDEEP SHAH' }];
    const loose = [
        { id: 3, customer_name: 'VYAS SANDHYA RAJESHKUMAR' },
        { id: 1, customer_name: 'SANDEEP SHAH' },
        { id: 2, customer_name: 'SANDIP DESAI' },
    ];
    assert.deepEqual(mergeSearchResults('sandeep', exact, loose).map(r => r.id), [1, 2, 3]);
});
