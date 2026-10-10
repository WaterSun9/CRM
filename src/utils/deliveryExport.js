import { buildMultiSheetWorkbook } from './vendorPaymentsWorkbook.js';

// Columns read from admin for the Material Delivery Excel export.
export const DELIVERY_EXPORT_COLUMNS = 'id, folder_no, customer_name, phone_number, full_address, villages, sub_divisions, district, pincode, system_capacity_kwp, no_of_modules, module_brand, inverter_make, installation_date, channel_partner, sub_channel_partner, stage, delivery_status';

// Rupees and kWp arrive as numbers or strings like "1,500"; anything else counts as 0.
export const toAmount = value => {
    const number = Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(number) ? number : 0;
};
const round2 = value => Math.round(value * 100) / 100;
const dateKey = value => (/^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '');
// Paid-on is an ISO timestamp; show the India calendar date.
const istDate = value => {
    const time = Date.parse(String(value || ''));
    return Number.isFinite(time) ? new Date(time + 330 * 60000).toISOString().slice(0, 10) : value;
};
const statusLabel = status => (status === 'IN_TRANSIT' ? 'In Transit' : status === 'DELIVERED' ? 'Delivered' : status || '');

// One row per trip and one row per customer on a trip. Rent sits only on the trip row,
// so it is never counted once per customer. Customers deleted from admin are left out of
// both sheets, which keeps the customer count and kWp equal on the two sheets.
export function buildDeliveryExportRows(batches, customersById) {
    const lookup = customersById instanceof Map ? customersById : new Map(Object.entries(customersById || {}));
    const trips = [];
    const stops = [];
    for (const batch of batches) {
        const customers = (batch.project_ids || [])
            .map((id, index) => ({ customer: lookup.get(String(id)) || lookup.get(id), stop: index + 1 }))
            .filter(entry => entry.customer);
        const rent = toAmount(batch.rent_amount);
        const paid = batch.car_rent_paid === 'Yes';
        const kwp = round2(customers.reduce((total, entry) => total + toAmount(entry.customer.system_capacity_kwp), 0));
        trips.push({
            ...batch,
            rent,
            rentPaid: paid ? rent : 0,
            rentPending: paid ? 0 : rent,
            customerCount: customers.length,
            kwp,
            rentPerKwp: kwp > 0 ? round2(rent / kwp) : null
        });
        for (const { customer, stop } of customers) {
            stops.push({ ...customer, batch, stop, kwp: toAmount(customer.system_capacity_kwp), count: 1 });
        }
    }
    // Trips by date, customers by installation date (blank last), then trip date and stop.
    const byDate = (a, b) => (a ? (b ? a.localeCompare(b) : -1) : (b ? 1 : 0));
    trips.sort((a, b) => byDate(dateKey(a.dispatch_date), dateKey(b.dispatch_date)) || String(a.batch_no || '').localeCompare(String(b.batch_no || ''), undefined, { numeric: true }));
    stops.sort((a, b) => byDate(dateKey(a.installation_date), dateKey(b.installation_date))
        || byDate(dateKey(a.batch.dispatch_date), dateKey(b.batch.dispatch_date))
        || String(a.batch.batch_no || '').localeCompare(String(b.batch.batch_no || ''), undefined, { numeric: true })
        || a.stop - b.stop);
    return { trips, stops };
}

const TRIP_COLUMNS = [
    { header: 'Trip Date', type: 'date', width: 13, value: r => r.dispatch_date },
    { header: 'Batch No', type: 'text', width: 14, value: r => r.batch_no },
    { header: 'Status', type: 'text', width: 12, value: r => statusLabel(r.status) },
    { header: 'Driver', type: 'text', width: 22, value: r => r.driver_name },
    { header: 'Driver Phone', type: 'text', width: 16, value: r => r.driver_phone },
    { header: 'Vehicle', type: 'text', width: 16, value: r => r.vehicle_number },
    { header: 'Vendor', type: 'text', width: 18, value: r => r.vendor },
    { header: 'Rent (INR)', type: 'currency', width: 14, value: r => r.rent },
    { header: 'Rent Paid?', type: 'text', width: 11, value: r => r.car_rent_paid || 'No' },
    { header: 'Rent Paid (INR)', type: 'currency', width: 15, value: r => r.rentPaid },
    { header: 'Rent Pending (INR)', type: 'currency', width: 17, value: r => r.rentPending },
    { header: 'Paid By', type: 'text', width: 16, value: r => r.car_rent_paid_by },
    { header: 'Paid On', type: 'date', width: 13, value: r => istDate(r.car_rent_paid_at) },
    { header: 'Customers', type: 'number', width: 11, value: r => r.customerCount },
    { header: 'Total kWp', type: 'number', width: 11, value: r => r.kwp },
    { header: 'Rent per kWp (INR)', type: 'currency', width: 17, value: r => r.rentPerKwp },
    { header: 'Notes', type: 'text', width: 30, value: r => r.notes }
];
// Rent, paid, pending, customers, kWp.
const TRIP_TOTALS = [7, 9, 10, 13, 14];

const CUSTOMER_COLUMNS = [
    { header: 'Installation Date', type: 'date', width: 15, value: r => r.installation_date },
    { header: 'Trip Date', type: 'date', width: 13, value: r => r.batch.dispatch_date },
    { header: 'Batch No', type: 'text', width: 14, value: r => r.batch.batch_no },
    { header: 'Stop No', type: 'number', width: 9, value: r => r.stop },
    { header: 'File No', type: 'text', width: 10, value: r => r.folder_no },
    { header: 'Customer', type: 'text', width: 26, value: r => r.customer_name },
    { header: 'Phone', type: 'text', width: 15, value: r => r.phone_number },
    { header: 'Full Address', type: 'text', width: 40, value: r => r.full_address },
    { header: 'Village', type: 'text', width: 16, value: r => r.villages },
    { header: 'Taluka', type: 'text', width: 16, value: r => r.sub_divisions },
    { header: 'District', type: 'text', width: 14, value: r => r.district },
    { header: 'Pincode', type: 'text', width: 9, value: r => r.pincode },
    { header: 'kWp', type: 'number', width: 8, value: r => r.kwp },
    { header: 'Modules', type: 'number', width: 9, value: r => r.no_of_modules },
    { header: 'Module Brand', type: 'text', width: 16, value: r => r.module_brand },
    { header: 'Inverter', type: 'text', width: 16, value: r => r.inverter_make },
    { header: 'Channel Partner', type: 'text', width: 20, value: r => r.channel_partner },
    { header: 'Dealer', type: 'text', width: 20, value: r => r.sub_channel_partner },
    { header: 'Stage', type: 'text', width: 18, value: r => r.stage },
    { header: 'Delivery Status', type: 'text', width: 15, value: r => r.delivery_status },
    { header: 'Driver', type: 'text', width: 20, value: r => r.batch.driver_name },
    { header: 'Driver Phone', type: 'text', width: 15, value: r => r.batch.driver_phone },
    { header: 'Vehicle', type: 'text', width: 15, value: r => r.batch.vehicle_number },
    { header: 'Customers', type: 'number', width: 10, value: r => r.count }
];
// kWp, modules, customer count.
const CUSTOMER_TOTALS = [12, 13, 23];

export function buildDeliveryExportWorkbook(batches, customersById) {
    const { trips, stops } = buildDeliveryExportRows(batches, customersById);
    return buildMultiSheetWorkbook([
        { sheetName: 'Trips', columns: TRIP_COLUMNS, records: trips, totalLabel: 'TOTAL', totalColumns: TRIP_TOTALS },
        { sheetName: 'Customers', columns: CUSTOMER_COLUMNS, records: stops, totalLabel: 'TOTAL', totalColumns: CUSTOMER_TOTALS }
    ]);
}
