// scope: 'all', 'month' (the current month) or a 'YYYY-MM' month key.
export function filterVendorPayments(records, scope, currentMonth) {
    if (scope === 'all') return records;
    const month = scope === 'month' ? currentMonth : scope;
    return records.filter(row => String(row.installation_date || '').startsWith(month));
}
