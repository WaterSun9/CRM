import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentTypeOptions, isPaymentUndecided, FINANCE_TYPES } from '../src/constants.js';
import { missingDetailsForMove } from '../src/utils/stageRequirements.js';
import { hasClientName } from '../src/quotations/model.js';

test('payment options: only Cash and Loan, any old Undecided entry dropped', () => {
    assert.deepEqual(paymentTypeOptions(['CASH', 'LOAN']), ['CASH', 'LOAN']);
    assert.deepEqual(paymentTypeOptions(['Cash', 'UNDECIDED', 'Loan']), ['Cash', 'Loan']);
    assert.deepEqual(paymentTypeOptions(undefined), ['CASH', 'LOAN']);
});

test('undecided means anything that is not Cash or Loan', () => {
    for (const v of ['', null, undefined, 'Undecided', ' UNDECIDED ']) assert.equal(isPaymentUndecided(v), true);
    for (const v of ['Cash', 'LOAN', ' loan ']) assert.equal(isPaymentUndecided(v), false);
});

test('finance choices', () => {
    assert.deepEqual(FINANCE_TYPES, ['PM Surya Ghar loan', 'Private finance']);
});

test('the payment choice is needed only when leaving the Payment Type stage', () => {
    const msg = 'Payment type (choose Cash or Loan)';
    assert.ok(!missingDetailsForMove('LEADS', 'REGISTRATION', { payment_type: '' }).includes(msg));
    assert.ok(!missingDetailsForMove('REGISTRATION', 'PAYMENT TYPE', { payment_type: '' }).includes(msg));
    assert.ok(missingDetailsForMove('PAYMENT TYPE', 'LOAN', { payment_type: '' }).includes(msg));
    assert.ok(missingDetailsForMove('REGISTRATION', 'CASH', { payment_type: 'Undecided' }).includes(msg));
    assert.ok(!missingDetailsForMove('PAYMENT TYPE', 'LOAN', { payment_type: 'Loan' }).includes(msg));
    assert.ok(!missingDetailsForMove('PAYMENT TYPE', 'CASH', { payment_type: 'CASH' }).includes(msg));
    assert.ok(!missingDetailsForMove('LOAN', 'MATERIAL ORDER', { payment_type: '' }).includes(msg));
});

test('a quotation needs a real client name', () => {
    for (const n of ['Ramesh Patel', 'Ab', 'રમેશ', 'राम', 'રા', 'रा']) assert.equal(hasClientName(n), true, n);
    for (const n of ['', ' ', '.', 'a', '1234', '- .']) assert.equal(hasClientName(n), false, n);
});

test('Payment Type sits between Registration and Loan/Cash', async () => {
    const { PRIMARY_STAGES } = await import('../src/constants.js');
    const ids = PRIMARY_STAGES.map(s => s.id);
    assert.equal(ids.indexOf('PAYMENT TYPE'), ids.indexOf('REGISTRATION') + 1);
    assert.equal(ids.indexOf('LOAN'), ids.indexOf('PAYMENT TYPE') + 1);
});

test('the name rule is not part of validate, so old quotes still print', async () => {
    const { validate, newForm } = await import('../src/quotations/model.js');
    const form = { ...newForm?.() , customer_name: '.' };
    assert.ok(!validate(form).some(issue => /customer's name/.test(issue)));
});
