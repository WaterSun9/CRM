// deno test supabase/functions/whatsapp-send-quotation/helpers.test.ts
// Not imported by index.ts, so it is not bundled on deploy.
import assert from 'node:assert/strict'
import {
  DAY_MS, MAX_PDF_BYTES, PER_PERSON_PER_DAY, PER_PERSON_PER_HOUR, capacityText, failureMessage, formatDateShort, isPdfBytes,
  limitWait, pdfFileName, pdfProblem, quotationValues, quoteLabel, resendWait, sameVersion, sendRefusal, waitText,
  type QuotationRow,
} from './helpers.ts'

const assertEquals = (actual: unknown, expected: unknown) => assert.deepEqual(actual, expected)

const base: QuotationRow = {
  id: 'q1', quotation_no: 1023, status: 'issued', updated_at: '2026-10-12T10:00:00.123456+00:00',
  customer_name: 'Column Name', customer_phone: '9000000000', capacity_kw: 3, valid_until: '2026-10-20',
  form: { customer_name: 'Ramesh Kumar Patel', customer_phone: '+91 98765 43210', capacity_kw: 3.48, valid_until: '2026-10-11' },
}

Deno.test('label and file name match the app (model.js quoteLabel / pdfName)', () => {
  assertEquals(quoteLabel(base), 'Quote-1023')
  assertEquals(quoteLabel({ ...base, quotation_no: 1031, revision: { base_no: 1023, n: 2, of_id: 'x' } }), 'Quote-1023-R2')
  assertEquals(quoteLabel({ ...base, quotation_no: null }), 'Quote-DRAFT')
  assertEquals(pdfFileName(base), 'Ramesh Kumar Patel.pdf')
  assertEquals(pdfFileName({ ...base, revision: { base_no: 1023, n: 1 } }), 'Ramesh Kumar Patel (R1).pdf')
  assertEquals(pdfFileName({ ...base, form: { customer_name: 'A/B:\u0007 "C"\n D' } }), 'A B C D.pdf')
  assertEquals(pdfFileName({ ...base, form: { customer_name: '  ' }, customer_name: null }), 'Quotation.pdf')
})

Deno.test('template values come from the saved form, like the PDF', () => {
  assertEquals(quotationValues(base), {
    customerName: 'Ramesh Kumar Patel', phone: '+91 98765 43210', label: 'Quote-1023', capacity: '3.48', validUntil: '11 Oct 2026',
  })
  // Older rows without the field in the form fall back to the columns.
  const v = quotationValues({ ...base, form: null, capacity_kw: '5.00', valid_until: null })
  assertEquals([v.customerName, v.phone, v.capacity, v.validUntil], ['Column Name', '9000000000', '5', 'the date given in the quotation'])
  assertEquals(capacityText(0), null)
  assertEquals(capacityText('abc'), null)
  assertEquals(formatDateShort('2026-02-30'), '30 Feb 2026')
  assertEquals(formatDateShort('2026-13-01'), null)
})

Deno.test('lost and replaced quotations are refused', () => {
  assertEquals(sendRefusal(base), null)
  assertEquals(sendRefusal({ ...base, status: 'draft' }), null)
  assertEquals(sendRefusal({ ...base, status: 'converted' }), null)
  assertEquals(sendRefusal({ ...base, status: 'lost' })?.code, 'lost')
  const replaced = sendRefusal({ ...base, superseded_by: { id: 'q2', label: 'Quote-1023-R1' } })
  assertEquals(replaced?.code, 'superseded')
  assertEquals(replaced?.error, 'This quotation was replaced by Quote-1023-R1. Send the newest version instead.')
})

Deno.test('version check', () => {
  assertEquals(sameVersion('', 'anything'), true)
  assertEquals(sameVersion(base.updated_at!, base.updated_at), true)
  assertEquals(sameVersion('2026-10-12T10:00:00.123456Z', base.updated_at), true)
  assertEquals(sameVersion('2026-10-12T10:00:00.123457+00:00', base.updated_at), false)
  assertEquals(sameVersion('2026-10-12T10:00:01+00:00', base.updated_at), false)
  assertEquals(sameVersion('garbage', base.updated_at), false)
})

Deno.test('PDF checks', () => {
  const pdf = new TextEncoder().encode('%PDF-1.3\n...')
  assertEquals(isPdfBytes(pdf), true)
  assertEquals(isPdfBytes(new TextEncoder().encode('<html>')), false)
  assertEquals(pdfProblem({ size: pdf.length, type: 'application/pdf' }, pdf), null)
  assertEquals(pdfProblem({ size: 0, type: 'application/pdf' }), 'The quotation PDF is empty. Please try again.')
  assertEquals(pdfProblem({ size: MAX_PDF_BYTES + 1, type: 'application/pdf' }), 'The quotation PDF is too big to send on WhatsApp (10 MB at most).')
  assertEquals(pdfProblem({ size: 10, type: 'text/html' }), 'Only a PDF quotation can be sent.')
  assertEquals(pdfProblem({ size: 6, type: 'application/pdf' }, new TextEncoder().encode('%PDX-1')), 'This file is not a PDF. Please try again.')
})

Deno.test('limits', () => {
  const now = Date.parse('2026-10-12T12:00:00Z')
  const ago = (min: number) => new Date(now - min * 60_000).toISOString()
  assertEquals(limitWait([ago(10), ago(20)], 3, now), 0)
  assertEquals(limitWait([ago(10), ago(20), ago(50)], 3, now), 10 * 60)
  assertEquals(limitWait([ago(10), ago(20), ago(61)], 3, now), 0)
  // Per person: 30 in the last 24 hours (the oldest of them 23 h ago frees a slot in 1 h).
  const day = [...Array.from({ length: 29 }, (_, i) => ago(i)), ago(23 * 60)]
  assertEquals(limitWait(day, PER_PERSON_PER_DAY, now, DAY_MS), 60 * 60)
  assertEquals(limitWait([...day.slice(0, 29), ago(24 * 60 + 1)], PER_PERSON_PER_DAY, now, DAY_MS), 0)
  assertEquals(limitWait(Array.from({ length: 10 }, (_, i) => ago(i + 1)), PER_PERSON_PER_HOUR, now), 50 * 60)
  assertEquals(waitText(50 * 60), '50 minutes')
  assertEquals(waitText(60 * 60), '60 minutes')
  assertEquals(waitText(60 * 60 + 1), '2 hours')
  assertEquals(waitText(1), '1 minute')
  assertEquals(resendWait([{ created_at: ago(0.5), status: 'sent' }], now), 30)
  assertEquals(resendWait([{ created_at: ago(0.5), status: 'failed' }], now), 0)
  assertEquals(resendWait([{ created_at: ago(2), status: 'delivered' }], now), 0)
})

Deno.test('failure messages', () => {
  assertEquals(failureMessage({ code: 'not_on_whatsapp', metaCode: 131026 }), "This customer's number is not on WhatsApp. Use Download or Share for now.")
  assertEquals(failureMessage({ code: 'send_failed', metaCode: 131030 }), 'This number is not on the WhatsApp test list. Use Download or Share for now.')
  assertEquals(failureMessage({ code: 'send_failed', metaCode: null }), 'The quotation could not be sent on WhatsApp. Try again in a minute, or use Download or Share.')
})
