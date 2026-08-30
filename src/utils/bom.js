// ─── utils/bom.js ───────────────────────────────────────────────────────────
// Single source of truth for loading a customer's BOM.
//
// This was previously inline in MaterialIntegrationTab, so the Agent Portal —
// which read the bom / bom_items tables directly — ended up with a different
// item list than the admin for the same customer: no template merge, so a
// customer with nothing saved yet showed an empty BOM in the portal and the
// full canonical checklist in admin. Both now call this, so both print the
// same document.
// ────────────────────────────────────────────────────────────────────────────

import { supabase } from '../supabase';
import { ROOF_BOM_TEMPLATE, SHED_BOM_TEMPLATE } from '../constants';

export const getBomTemplateForType = (type) => (type === 'SHED' ? SHED_BOM_TEMPLATE : ROOF_BOM_TEMPLATE);

// Roof vs Shed is derived from the Material Order specification.
export const getBomTypeForCustomer = (customer) =>
    String(customer?.roof_shed || '').toUpperCase().includes('SHED') ? 'SHED' : 'ROOF';

const norm = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const getUomForProduct = (prodName, templateList) => {
    if (!prodName) return 'No.';
    const found = templateList.find(t => t.product_name?.toLowerCase() === prodName?.toLowerCase());
    if (found?.uom) return found.uom;
    const lower = prodName.toLowerCase();
    if (lower.includes('cable') || lower.includes('wire') || lower.includes('pipe') || lower.includes('strip')) return 'Mtr';
    if (lower.includes('structure') || lower.includes('clamp') || lower.includes('earthing') || lower.includes('kit') || lower.includes('fastener')) return 'Set';
    if (lower.includes('bag') || lower.includes('cement')) return 'Bag';
    if (lower.includes('box') || lower.includes('dcdb') || lower.includes('acdb')) return 'Box';
    return 'No.';
};

// Merge saved rows onto the canonical template so standard items always appear
// in template order, with any user-added custom items appended after them.
const mergeAgainstTemplate = (savedItems, template) => {
    if (!savedItems || savedItems.length === 0) {
        return template.map((item, idx) => ({ ...item, sr_no: idx + 1, integration_by: '', note: '' }));
    }

    const templateKeys = new Set(template.map(t => norm(t.product_name)));
    const savedMap = new Map();
    const extraCustomItems = [];

    savedItems.forEach(item => {
        const key = norm(item.product_name);
        if (templateKeys.has(key) && !savedMap.has(key)) savedMap.set(key, item);
        else extraCustomItems.push(item);
    });

    const mergedStandardItems = template.map((tItem, idx) => {
        const saved = savedMap.get(norm(tItem.product_name));
        return {
            ...tItem,
            id: saved?.id || null,
            sr_no: idx + 1,
            quantity: saved?.quantity !== undefined && saved?.quantity !== null && String(saved.quantity).trim() !== ''
                ? String(saved.quantity)
                : (tItem.quantity || ''),
            uom: tItem.uom || getUomForProduct(tItem.product_name, template),
            integration_by: saved?.integration_by || '',
            note: saved?.note || '',
        };
    });

    const mergedCustomItems = extraCustomItems.map((item, cIdx) => ({
        id: item.id || null,
        sr_no: template.length + cIdx + 1,
        product_name: item.product_name || '',
        quantity: item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : '',
        uom: item.uom || getUomForProduct(item.product_name, template),
        integration_by: item.integration_by || '',
        note: item.note || '',
    }));

    return [...mergedStandardItems, ...mergedCustomItems];
};

// Resolves in the same order the admin tab always used: the customer's inline
// bom_data JSON, then the relational tables, then the local cache.
export const loadBomForCustomer = async (customer, activeType) => {
    const template = getBomTemplateForType(activeType);
    if (!customer?.id) return { bom: null, items: mergeAgainstTemplate(null, template) };

    let bomData = null;
    let itemData = null;

    const rawBomData = customer?.bom_data;
    if (rawBomData) {
        try {
            const parsed = typeof rawBomData === 'string' ? JSON.parse(rawBomData) : rawBomData;
            if (parsed) {
                bomData = parsed.bom || parsed;
                itemData = parsed.items || (Array.isArray(parsed) ? parsed : null);
            }
        } catch (e) {
            console.warn('Error parsing customer.bom_data:', e);
        }
    }

    // Set when the BOM could not be read. Callers must NOT treat the blank
    // template below as "this customer has no BOM" when this is set - that is
    // how a real Bill of Materials appeared to vanish.
    let loadError = null;

    if (!bomData) {
        try {
            // Was .maybeSingle(), which ERRORS when more than one bom row shares
            // an admin_id. A duplicate row therefore made the BOM permanently
            // unreadable, and the swallowed error fell through to a blank
            // template. Take the earliest row instead, and say so.
            const { data: rows, error } = await supabase
                .from('bom')
                .select('*')
                .eq('admin_id', customer.id)
                .order('created_at', { ascending: true });

            if (error) {
                loadError = error;
            } else if (rows && rows.length > 0) {
                if (rows.length > 1) {
                    console.warn(`Customer ${customer.id} has ${rows.length} bom rows; using the earliest. Run scripts/fix_duplicate_bom_rows.sql.`);
                }
                bomData = rows[0];
                const { data: items, error: itemsError } = await supabase
                    .from('bom_items')
                    .select('*')
                    .eq('bom_id', bomData.id)
                    .order('created_at', { ascending: true });
                if (itemsError) loadError = itemsError;
                itemData = items;
            }
        } catch (netErr) {
            loadError = netErr;
            console.warn('Network loadBOM error, falling back to local:', netErr);
        }
    }

    if (!bomData) {
        try {
            const localRaw = localStorage.getItem(`watersun_bom_${customer.id}`);
            if (localRaw) {
                const parsed = JSON.parse(localRaw);
                bomData = parsed.bom || parsed;
                itemData = parsed.items;
            }
        } catch { /* not valid JSON, fall through to template */ }
    }

    if (!bomData && (!itemData || itemData.length === 0)) {
        return { bom: null, items: mergeAgainstTemplate(null, template), loadError };
    }

    return { bom: bomData, items: mergeAgainstTemplate(itemData, template), loadError };
};
