// Makes the sample filled Tata Field Service Report from made-up data (no database):
//   node scripts/tata-service-report-sample.mjs
// Output: docs/client-requests-2026-11-14/tata-oem-form/sample-tata-field-service-report.pdf
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fillTataReport, tataReportValues } from '../src/components/service/tataServiceReport.js';

const template = readFileSync(new URL('../src/assets/tata-field-service-report.pdf', import.meta.url));
const values = tataReportValues({
    issue: { ticket_no: 1007, problem_type: 'Inverter not starting', comment: 'No generation for 3 days, inverter display shows error 117.', customer_name: 'Demo Customer' },
    claim: { oem: 'Tata Power', part: 'Inverter', faulty_serial: 'TPS-DEMO-55K-0001', notes: 'Inverter restarts every few minutes. Earthing and DC side checked: OK.', ticket_no: 'CRN-DEMO-123' },
    card: {
        customer_name: 'Demo Customer (fake)', phone_number: '90000 00000', consumer_no: 'PGVCL-0000', full_address: 'Near Bus Stand, Demo Village', district: 'Patan', pincode: '385340',
        system_capacity_kwp: 3.27, module_brand: 'TATA POWER', module_wp: 545, no_of_modules: 6, inverter_make: 'Tata Power', inverter_serial_no: 'TPS-DEMO-55K-0001', installation_date: '2025-02-14',
    },
    visit: { visit_no: 1, reached_at: '2026-11-18T06:30:00Z', readings: { ac_pn: 232, ac_pe: 231, ac_ne: 2, dc_pm: 380, dc_pe: 190, dc_me: 189, floating: false }, outcome: 'revisit', outcome_note: 'Inverter to be replaced by Tata' },
    technicianName: 'Demo Technician',
});
const doc = await fillTataReport(template, values);
const out = new URL('../docs/client-requests-2026-11-14/tata-oem-form/sample-tata-field-service-report.pdf', import.meta.url);
writeFileSync(out, await doc.save());
console.log('Wrote', fileURLToPath(out));
