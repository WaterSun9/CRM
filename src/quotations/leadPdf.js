import { uploadDocument } from '../utils';

// Keep the saved PDF of a quote added to leads with the lead’s documents.
export async function saveLeadQuotationPdf(row, file, user) {
    if (!row.source_lead_id) throw new Error('This quotation is not linked to a lead.');
    const saved = await uploadDocument(file, row.source_lead_id, 'lead_quotation', user.id);
    if (!saved) throw new Error('The quotation PDF could not be saved under Lead documents.');
    return saved;
}
