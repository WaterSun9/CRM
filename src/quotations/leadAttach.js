// Quote PDF ↔ lead documents (19 Nov 2026 client bug).
// Plain helpers with no imports so the Node tests can load them.

// A quote's PDF is stored under its file name, e.g. "Ramesh Patel (Quote-3255-1).pdf".
// The same name under the same lead means the same quote: never store it twice.
export const sameQuotePdf = (doc, fileName) => doc?.doc_type === 'lead_quotation'
    && String(doc?.file_name || '').trim().toLowerCase() === String(fileName || '').trim().toLowerCase()
    && String(fileName || '').trim() !== '';
export const quotePdfCopies = (docs, fileName) => (docs || []).filter(doc => sameQuotePdf(doc, fileName));

// Add saved documents to a list on screen and drop removed ones, one row per id.
export const mergeDocuments = (docs, added = [], removedIds = []) => {
    const removed = new Set(removedIds);
    const kept = (docs || []).filter(doc => doc && !removed.has(doc.id));
    const fresh = (added || []).filter(doc => doc?.id && !removed.has(doc.id) && !kept.some(item => item.id === doc.id));
    return fresh.length || kept.length !== (docs || []).length ? [...kept, ...fresh] : docs;
};

// Anything that saves a lead document in the background tells the open customer card,
// so the card shows it at once instead of after a page refresh.
export const LEAD_DOCUMENTS_EVENT = 'lead-documents-changed';
export const announceLeadDocuments = (customerId, { added = [], removedIds = [] } = {}, target = globalThis) => {
    if (!customerId || typeof target?.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
    target.dispatchEvent(new CustomEvent(LEAD_DOCUMENTS_EVENT, { detail: { customerId, added, removedIds } }));
};
export const onLeadDocuments = (customerId, handler, target = globalThis) => {
    if (!customerId || typeof target?.addEventListener !== 'function') return () => {};
    const listener = event => { if (event?.detail?.customerId === customerId) handler(event.detail); };
    target.addEventListener(LEAD_DOCUMENTS_EVENT, listener);
    return () => target.removeEventListener(LEAD_DOCUMENTS_EVENT, listener);
};
