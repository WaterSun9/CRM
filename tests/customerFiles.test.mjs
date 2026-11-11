import test from 'node:test';
import assert from 'node:assert/strict';

import { customerFilePaths } from '../src/utils/customerFiles.js';

const fake = (docs, folder) => ({
    from: () => ({ select: () => ({ eq: async () => ({ data: docs, error: null }) }) }),
    storage: { from: () => ({ list: async (_id, { offset }) => ({ data: offset ? [] : folder, error: null }) }) },
});

test('collects document paths and folder files once each, skipping demo paths', async () => {
    const paths = await customerFilePaths(fake(
        [{ storage_path: 'c1/a_bill.pdf' }, { storage_path: 'mock/x.pdf' }, { storage_path: null }],
        [{ id: '1', name: 'a_bill.pdf' }, { id: '2', name: 'b_photo.jpg' }, { id: null, name: 'sub' }]), 'c1');
    assert.deepEqual(paths.sort(), ['c1/a_bill.pdf', 'c1/b_photo.jpg']);
});
