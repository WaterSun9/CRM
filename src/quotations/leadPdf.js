import { supabase } from '../supabase';
import { uploadDocument, deleteDocument } from '../utils';
import { announceLeadDocuments, quotePdfCopies } from './leadAttach';

// Keep the saved PDF of a quote added to leads with the lead’s documents.
// One copy per quote (19 Nov 2026): a retry after a weak-signal timeout, or a second tap,
// finds the copy already there and keeps it. `replace` (Download & save after edits)
// stores the fresh PDF and then removes the older copy of the same quote.
// Either way the open customer card is told, so it shows the PDF without a refresh.
export async function saveLeadQuotationPdf(row, file, user, { replace = false } = {}) {
    const leadId = row.source_lead_id;
    if (!leadId) throw new Error('This quotation is not linked to a lead.');
    const { data: existing, error } = await supabase.from('documents').select('id,customer_id,doc_type,file_name,storage_path,file_type,uploaded_at')
        .eq('customer_id', leadId).eq('doc_type', 'lead_quotation');
    const copies = error ? [] : quotePdfCopies(existing, file.name);
    if (copies.length && !replace) {
        announceLeadDocuments(leadId, { added: [copies[0]] });
        return copies[0];
    }
    const saved = await uploadDocument(file, leadId, 'lead_quotation', user.id);
    if (!saved) throw new Error('The quotation PDF could not be saved under Lead documents.');
    const removedIds = [];
    for (const old of copies) {
        try { if ((await deleteDocument(old.id, old.storage_path))?.ok) removedIds.push(old.id); }
        catch (err) { console.warn('Older copy of the quote PDF was not removed:', err); }
    }
    announceLeadDocuments(leadId, { added: [saved], removedIds });
    return saved;
}
