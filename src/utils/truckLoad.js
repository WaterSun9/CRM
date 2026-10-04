// Build a loading list only from BOMs that actually exist. Blank template rows
// have no quantity and do not become truck requirements.
export function buildTruckLoad(projectBoms) {
    const rows = new Map();
    const missing = [];
    const uncertain = [];
    for (const { customer, bom, items, loadError } of projectBoms) {
        if (loadError) { missing.push(`${customer.customer_name || customer.id} (BOM could not be read)`); continue; }
        if (!bom) { missing.push(`${customer.customer_name || customer.id} (no BOM)`); continue; }
        for (const item of items || []) {
            const name = String(item.product_name || '').trim();
            const raw = String(item.quantity ?? '').trim();
            if (!name || !raw) continue;
            const uom = String(item.uom || 'No.').trim();
            const key = `${name.toLowerCase().replace(/\s+/g, ' ')}|${uom.toLowerCase()}`;
            const summable = /^\d+(?:\.\d+)?(?:\s*\+\s*\d+(?:\.\d+)?)*$/.test(raw.replace(/,/g, ''));
            if (!summable) {
                uncertain.push({ name, quantity: raw, uom, customer: customer.customer_name || customer.id });
                continue;
            }
            const quantity = raw.replace(/,/g, '').split('+').reduce((sum, part) => sum + Number(part.trim()), 0);
            if (!rows.has(key)) rows.set(key, { name, uom, total: 0, quantitiesByCustomer: {} });
            const row = rows.get(key);
            row.total += quantity;
            row.quantitiesByCustomer[customer.id] = (row.quantitiesByCustomer[customer.id] || 0) + quantity;
        }
    }
    return { rows: [...rows.values()], missing, uncertain };
}

// Fill each landscape page in order. A separate checks page carries the
// signatures itself, so material pages can then use the full table area.
export function paginateTruckRows(rows = [], noteCount = 0, customerCount = 0, signaturesOnLastPage = true) {
    const crowded = customerCount > 4;
    const firstLimit = crowded ? 23 : customerCount > 2 ? 27 : 27;
    const middleLimit = crowded ? 28 : customerCount > 2 ? 31 : 32;
    const lastLimit = signaturesOnLastPage ? (crowded ? 24 : customerCount > 2 ? 27 : 27) : middleLimit;
    const noteReserve = noteCount
        ? Math.ceil(noteCount / 2) + 2 * Math.ceil(Math.min(customerCount, noteCount) / 2) + 2
        : 0;
    const singleLimit = firstLimit - noteReserve;
    if (rows.length <= singleLimit) return [[...rows]];

    let pageCount = 2;
    while (rows.length > firstLimit + lastLimit - noteReserve + (pageCount - 2) * middleLimit) pageCount += 1;
    const pages = [];
    let offset = 0;
    for (let index = 0; index < pageCount; index += 1) {
        const remainingRows = rows.length - offset;
        const limit = index === 0 ? firstLimit : index === pageCount - 1 ? lastLimit - noteReserve : middleLimit;
        const count = index === pageCount - 1 ? remainingRows : Math.min(limit, remainingRows - 1);
        pages.push(rows.slice(offset, offset + count));
        offset += count;
    }
    return pages;
}

export function groupNotesByCustomer(notes = []) {
    const groups = new Map();
    for (const item of notes) {
        const customer = item.customer || 'Customer not specified';
        if (!groups.has(customer)) groups.set(customer, []);
        groups.get(customer).push(item);
    }
    return [...groups].map(([customer, items]) => ({ customer, items }));
}

function paginateChecks(notes) {
    const pages = [];
    let current = [];
    for (const group of groupNotesByCustomer(notes)) {
        if (current.length && current.length + group.items.length > 16) {
            pages.push(current);
            current = [];
        }
        for (const item of group.items) {
            if (current.length === 16) {
                pages.push(current);
                current = [];
            }
            current.push(item);
        }
    }
    if (current.length) pages.push(current);
    return pages;
}

export function planTruckSheetPages(rows = [], uncertain = [], customerCount = 0) {
    const noteGroups = groupNotesByCustomer(uncertain);
    const materialOnlyPages = rows.length === 0 && uncertain.length > 0
        ? []
        : paginateTruckRows(rows, 0, customerCount, uncertain.length === 0);
    const pagesWithChecks = uncertain.length > 0 && uncertain.length <= 8 && noteGroups.length <= 2
        ? paginateTruckRows(rows, uncertain.length, customerCount)
        : null;
    const checksFitWithMaterials = pagesWithChecks
        && pagesWithChecks.length <= materialOnlyPages.length
        && pagesWithChecks.at(-1).length <= (uncertain.length <= 4 ? 17 : 16);
    const materialPages = checksFitWithMaterials ? pagesWithChecks : materialOnlyPages;
    let inlineChecks = checksFitWithMaterials ? uncertain : [];
    let remainingChecks = checksFitWithMaterials ? [] : uncertain;
    if (!checksFitWithMaterials && materialPages.length && noteGroups.length > 2) {
        const firstTwoCustomers = new Set(noteGroups.slice(0, 2).map(group => group.customer));
        const candidateChecks = uncertain.filter(item => firstTwoCustomers.has(item.customer || 'Customer not specified'));
        const middlePageLimit = customerCount > 4 ? 28 : customerCount > 2 ? 31 : 32;
        const estimatedCheckRows = Math.ceil(candidateChecks.length / 2) + 6;
        if (candidateChecks.length <= 8
            && materialPages.at(-1).length <= 16
            && materialPages.at(-1).length + estimatedCheckRows <= middlePageLimit - 3) {
            inlineChecks = candidateChecks;
            remainingChecks = uncertain.filter(item => !firstTwoCustomers.has(item.customer || 'Customer not specified'));
        }
    }
    const pages = materialPages.map((pageRows, index) => ({
        kind: 'materials',
        rows: pageRows,
        notes: index === materialPages.length - 1 ? inlineChecks : []
    }));
    for (const checks of paginateChecks(remainingChecks)) {
        pages.push({ kind: 'notes', rows: [], notes: checks });
    }
    return pages;
}
