// Details a customer must have before leaving Material Integration or
// Material Delivery. Enforced in the app only; the database check is on hold
// (docs/BACKLOG.md, stage validation). v_incomplete_customers uses the same list.

const STAGE_RANK = {
    'LEADS': 1,
    'REGISTRATION': 2,
    'LOAN': 3,
    'CASH': 3,
    'MATERIAL ORDER': 4,
    'MATERIAL INTEGRATION': 5,
    'MATERIAL DELIVERY': 6,
    'INSTALLATION STATUS': 7,
    'GEO TAG PHOTO': 8,
    'DISCOM SUBMISSION': 9,
    'METER INSTALLATION': 10,
    'DISCOM INSPECTION': 11,
    'SUBSIDY STATUS': 12,
    'FINAL REVIEW': 13,
    'COMPLETED': 14,
};

// null for LOST PROJECT and unknown stages (never checked)
export const stageRank = (stage) => STAGE_RANK[String(stage || '').trim().toUpperCase()] ?? null;

const isBlank = (value) => {
    if (value === null || value === undefined) return true;
    const text = (typeof value === 'object' ? JSON.stringify(value) : String(value)).trim();
    return text === '' || text === '[]' || text === 'null' || text === '""';
};

// The columns needed to evaluate the rule (for a narrow database read).
export const STAGE_REQUIREMENT_COLUMNS = [
    'inverter_make', 'inverter_serial_no', 'panel_serial_no',
    'vendor', 'invoice_no', 'material_delivery_date', 'driver_name', 'driver_phone_number',
];

// Labels of the details missing for a move from oldStage to newStage.
// Empty list = nothing missing (or a move the rule does not cover).
export const missingDetailsForMove = (oldStage, newStage, record = {}) => {
    const from = stageRank(oldStage);
    const to = stageRank(newStage);
    if (from === null || to === null || to <= from) return [];
    const missing = [];
    if (from <= 5 && to > 5) {
        if (isBlank(record.inverter_make)) missing.push('Inverter make');
        if (isBlank(record.inverter_serial_no)) missing.push('Inverter serial number');
        if (isBlank(record.panel_serial_no)) missing.push('Panel serial numbers');
    }
    if (from <= 6 && to > 6) {
        if (isBlank(record.vendor)) missing.push('Vendor');
        if (isBlank(record.invoice_no)) missing.push('Invoice number');
        if (isBlank(record.material_delivery_date)) missing.push('Delivery date');
        if (isBlank(record.driver_name)) missing.push('Driver name');
        if (isBlank(record.driver_phone_number)) missing.push('Driver phone');
    }
    return missing;
};
