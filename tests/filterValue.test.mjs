import test from 'node:test';
import assert from 'node:assert/strict';
import { filterValue } from '../src/utils/filterValue.js';

test('typed search text is quoted for Supabase filters', () => {
    assert.equal(filterValue('%Patel, R%'), '"%Patel, R%"');
    assert.equal(filterValue('A (B).c'), '"A (B).c"');
    assert.equal(filterValue('say "hi"'), '"say \\"hi\\""');
    assert.equal(filterValue('a\\b'), '"a\\\\b"');
    assert.equal(filterValue(9876543210), '"9876543210"');
});
