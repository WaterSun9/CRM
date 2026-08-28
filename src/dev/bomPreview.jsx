// Dev-only harness for iterating on the BOM print document without logging in.
// Served at /bom-preview.html in `npm run dev`. Not referenced by the app and
// not part of the production build — safe to delete.

import { createRoot } from 'react-dom/client';
import BomPrintView from '../components/BomPrintView';
import { ROOF_BOM_TEMPLATE } from '../constants';
import '../index.css';

const customer = {
    customer_name: 'Ramesh Patel',
    phone_number: '9876543210',
    email_address: 'ramesh.patel@example.com',
    consumer_no: 'MG-4471902',
    folder_no: 'WS/2026/0417',
    villages: 'Bhadran',
    sub_divisions: 'Anand Rural',
    channel_partner: 'Suryodaya Energy',
    sub_channel_partner: 'Nikunj Traders',
    module_brand: 'Waaree',
    module_wp: '545',
    no_of_modules: '12',
    system_capacity_kwp: '6540',
    roof_shed: 'Roof',
    dc_cable: '76',
    ac_cable: '45',
    structure_front_leg_height: '5',
    structure_rear_leg_height: '4',
    invoice_value: '385000',
    inverter_make: 'Growatt MIN 6000TL-X',
    inverter_serial_no: 'GW6000TLX-2026-88113',
    panel_serial_no: JSON.stringify(
        Array.from({ length: 12 }, (_, i) => `WA545M-26${String(4410 + i).padStart(5, '0')}`)
    ),
};

const bom = {
    bom_type: 'ROOF',
    paper_prepared_by: 'Jignesh Shah',
    paper_prepared_date: '2026-08-14',
    material_loaded_by: 'Alpesh Vasava',
    material_loaded_date: '2026-08-18',
};

// Same shape the shared loader produces: template merged with saved quantities.
const bomItems = ROOF_BOM_TEMPLATE.map((item, idx) => ({
    ...item,
    sr_no: idx + 1,
    quantity: item.quantity || (idx % 3 === 0 ? String((idx % 7) + 1) : ''),
    note: idx === 4 ? 'Coil opened at site' : '',
}));

createRoot(document.getElementById('root')).render(
    <div className="bg-stone-200 py-6 min-h-screen">
        {/* A4 at 96dpi so the preview matches the printed sheet. */}
        <div className="mx-auto bg-white text-stone-900 print-document" style={{ width: '794px', padding: '40px' }}>
            <BomPrintView customer={customer} bom={bom} bomItems={bomItems} activeType="ROOF" />
        </div>
    </div>
);
