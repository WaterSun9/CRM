import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentTypeOptions, isPaymentUndecided, FINANCE_TYPES } from '../src/constants.js';
import { missingDetailsForMove } from '../src/utils/stageRequirements.js';
import { hasClientName } from '../src/quotations/model.js';

test('payment options: Undecided first, no duplicate, default list when metadata is empty', () => {
    assert.deepEqual(paymentTypeOptions(['CASH', 'LOAN']), ['Undecided', 'CASH', 'LOAN']);
    assert.deepEqual(paymentTypeOptions(['Cash', 'UNDECIDED', 'Loan']), ['Undecided', 'Cash', 'Loan']);
    assert.deepEqual(paymentTypeOptions(undefined), ['Undecided', 'CASH', 'LOAN']);
});

test('undecided means empty or Undecided, in any case', () => {
    for (const v of ['', null, undefined, 'Undecided', ' UNDECIDED ']) assert.equal(isPaymentUndecided(v), true);
    for (const v of ['Cash', 'LOAN']) assert.equal(isPaymentUndecided(v), false);
});

test('finance choices', () => {
    assert.deepEqual(FINANCE_TYPES, ['PM Surya Ghar loan', 'Private finance']);
});

test('moving past Registration needs Cash or Loan; Leads to Registration does not', () => {
    const msg = 'Payment type (choose Cash or Loan)';
    assert.ok(!missingDetailsForMove('LEADS', 'REGISTRATION', { payment_type: 'Undecided' }).includes(msg));
    assert.ok(missingDetailsForMove('REGISTRATION', 'LOAN', { payment_type: 'Undecided' }).includes(msg));
    assert.ok(missingDetailsForMove('LEADS', 'CASH', { payment_type: '' }).includes(msg));
    assert.ok(!missingDetailsForMove('REGISTRATION', 'LOAN', { payment_type: 'Loan' }).includes(msg));
    assert.ok(!missingDetailsForMove('REGISTRATION', 'CASH', { payment_type: 'CASH' }).includes(msg));
    // Later moves are not affected.
    assert.ok(!missingDetailsForMove('LOAN', 'MATERIAL ORDER', { payment_type: '' }).includes(msg));
});

test('a quotation needs a real client name', () => {
    for (const n of ['Ramesh Patel', 'Ab', 'રમેશ', 'राम']) assert.equal(hasClientName(n), true, n);
    for (const n of ['', ' ', '.', 'a', '1234', '- .']) assert.equal(hasClientName(n), false, n);
});
