import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createFeasibilityPdf } from '../src/feasibilityReport.js';

await mkdir('output/pdf', { recursive: true });
const stamp = await readFile('public/stamp.png');
const blob = await createFeasibilityPdf({
  consumerName: 'TEST CUSTOMER', consumerNo: '12345678901', feasibilityNo: 'NP-GJUG26-12345678',
  janSamarthNo: 'ANS-SOLAR-1234', address: 'HOUSE 12, TEST ROAD, TEST VILLAGE', district: 'PATAN',
  state: 'GUJARAT', pincode: '384151', capacity: '3.24', projectCost: 'Rs. 1,84,000',
  signatureDate: '08/09/2026'
}, {
  stampUrl: `data:image/png;base64,${stamp.toString('base64')}`,
  sitePhotoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/4qJOxgAAAABJRU5ErkJggg=='
});
await writeFile('output/pdf/feasibility-report-test.pdf', Buffer.from(await blob.arrayBuffer()));
