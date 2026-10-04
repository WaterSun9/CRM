import test from 'node:test';
import assert from 'node:assert/strict';
import { getEligibleBatchProjects } from '../src/utils/deliveryBatchSelection.js';

test('editing keeps saved stops visible in route order after their stages change', () => {
    const customers = [
        { id: 'new', customer_name: 'New site', stage: 'MATERIAL DELIVERY', delivery_batch_id: null },
        { id: 'priya', customer_name: 'Priya', stage: 'INSTALLATION STATUS', delivery_batch_id: 'BATCH-1' },
        { id: 'other', customer_name: 'Other batch', stage: 'MATERIAL DELIVERY', delivery_batch_id: 'BATCH-2' },
        { id: 'nikhil', customer_name: 'Nikhil', stage: 'COMPLETED', delivery_batch_id: 'BATCH-1' }
    ];
    const visible = getEligibleBatchProjects(customers, ['nikhil', 'priya'], { batch_no: 'BATCH-1' }, '', 'MATERIAL DELIVERY');
    assert.deepEqual(visible.map(row => row.id), ['nikhil', 'priya', 'new']);
});

test('creating a batch still excludes customers in another batch', () => {
    const visible = getEligibleBatchProjects([
        { id: 'free', stage: 'MATERIAL DELIVERY', delivery_batch_id: null },
        { id: 'taken', stage: 'MATERIAL DELIVERY', delivery_batch_id: 'BATCH-2' }
    ], [], null, '', 'MATERIAL DELIVERY');
    assert.deepEqual(visible.map(row => row.id), ['free']);
});
