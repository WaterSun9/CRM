import { uploadDocument } from '../utils';
import { isFinalQuotation } from './model';

// Loan applications keep the exact PDF submitted, even when the editable final changes later.
export async function saveLoanQuotationPdf(row, file, user) {
    if (!isFinalQuotation(row) || !row.source_lead_id) throw new Error('This final quotation is not linked to a customer.');
    const saved = await uploadDocument(file, row.source_lead_id, 'loan_quotation', user.id);
    if (!saved) throw new Error('The quotation PDF could not be saved under Loan documents.');
    return saved;
}
