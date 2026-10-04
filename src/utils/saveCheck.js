import { ADMIN_COLUMNS } from '../constants.js';

// ─── Save check (data-loss audit, Oct 2026) ───────────────────────────────────
// After a save, compare what was sent with what the database now holds. A
// field the database does not have is reported to the user straight away,
// instead of looking saved and disappearing later.

// JSON with keys in a fixed order - the database (jsonb) may return object keys
// re-ordered, which must not count as a difference.
export const stableStringify = (value) => {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value ?? null);
};

// True when a form value and a stored value mean the same thing.
//  - empty, null and undefined are all "empty"
//  - booleans by truthiness; objects by content (any key order)
//  - numbers: only when one side really IS a number (a numeric column), so
//    '1,71,000' matches 171000 and '6' matches 6, while text such as a consumer
//    number keeps exact matching ('0123' is not '123').
export const valuesMatch = (a, b) => {
    const aEmpty = a === undefined || a === null || a === '';
    const bEmpty = b === undefined || b === null || b === '';
    if (aEmpty && bEmpty) return true;
    if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b);
    if ((a && typeof a === 'object') || (b && typeof b === 'object')) return stableStringify(a) === stableStringify(b);
    if (String(a ?? '').trim() === String(b ?? '').trim()) return true;
    if (!aEmpty && !bEmpty && (typeof a === 'number' || typeof b === 'number')) {
        const na = Number(String(a).replace(/,/g, '').trim());
        const nb = Number(String(b).replace(/,/g, '').trim());
        return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
    }
    return false;
};

export const findUnsavedFields = (sent = {}, stored = {}) => {
    const unsaved = [];
    Object.keys(sent || {}).forEach(key => {
        // Only real columns can be checked; keys the app strips before writing
        // are not columns (sanitizeAdminUpdate warns about those separately).
        if (!ADMIN_COLUMNS.has(key) || ['id', 'created_at', 'updated_at', 'crn'].includes(key)) return;
        if (!valuesMatch(sent[key], stored?.[key])) unsaved.push(key);
    });
    return unsaved;
};

export const fieldLabel = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());


// The record the form should show after a fresh full read of the row:
// the database values, except fields the user has changed (relative to the
// previous baseline) and not saved yet - those keep what was typed.
// Returns { next, unsavedKeys }.
export const mergeServerRecord = (currentForm = {}, previousBaseline = {}, serverRow = {}) => {
    const next = { ...serverRow };
    const unsavedKeys = [];
    const keys = new Set([...Object.keys(currentForm || {}), ...Object.keys(previousBaseline || {})]);
    keys.forEach(key => {
        if (['id', 'created_at', 'updated_at', 'crn'].includes(key)) return;
        if (!(key in (currentForm || {}))) return;
        if (!valuesMatch(currentForm[key], previousBaseline?.[key])) {
            next[key] = currentForm[key];
            unsavedKeys.push(key);
        }
    });
    return { next, unsavedKeys };
};
