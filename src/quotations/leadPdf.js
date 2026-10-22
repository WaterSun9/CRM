import { uploadDocument } from '../utils';
import { isFinalQuotation } from './model';

// Keep the saved final PDF with the lead’s documents.
export async function saveLeadQuotationPdf(row, file, user) {
    if (!isFinalQuotation(row) || !row.source_lead_id) throw new Error('This final quotation is not linked to a customer.');
    const saved = await uploadDocument(file, row.source_lead_id, 'lead_quotation', user.id);
    if (!saved) throw new Error('The quotation PDF could not be saved under Lead documents.');
    return saved;
}
