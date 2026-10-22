import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabase';
import { isFinalQuotation, quoteLabel } from './model';
import QuotationForm from './QuotationForm';
import DocumentPages from './DocumentPages';
import { generateQuotationPdf, downloadQuotationFile } from './pdf';
import { useGlobalPopup } from '../components/GlobalPopup';
import './quotation.css';

export default function LeadQuotation({ customer, user, meta, isEditable, documents, onFileUpload, onFilePreview }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null);
    const [preview, setPreview] = useState(false);
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [reload, setReload] = useState(0);
    const { showAlert, showConfirm } = useGlobalPopup();
    useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        Promise.resolve(supabase.from('quotations').select('*').eq('source_lead_id',customer.id).order('created_at',{ascending:false}))
            .then(({data,error: failure}) => { if (!active) return; if (failure) setError('Could not load final quotations. Try again.'); else setRows((data || []).filter(isFinalQuotation)); })
            .catch(() => { if (active) setError('Could not load final quotations. Try again.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    },[customer.id,reload]);
    const savePdf = async row => {
        if (busy) return;
        setBusy(true);
        try {
            const file = await generateQuotationPdf(row);
            if (isEditable) {
                const saved = await onFileUpload({target:{files:[file],value:''}}, 'lead_quotation');
                if (!saved) throw new Error('The PDF was not saved. Please retry.');
            }
            downloadQuotationFile(file);
            if (isEditable) showAlert('Final quotation saved under Lead documents and downloaded.',{type:'success'});
        } catch (failure) { showAlert(failure.message,{type:'error'}); }
        finally { setBusy(false); }
    };
    const close = async () => {
        if (dirty && !await showConfirm('Leave the final quotation editor? Unsaved edits remain in device recovery.',{confirmLabel:'Leave editor'})) return;
        setEditing(null); setDirty(false); setReload(n => n + 1);
    };
    return <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
        <h4 className="text-sm font-bold">Final quotation</h4>
        <p className="text-xs text-stone-500">The selected panel only, with terms and warranty. Save a fresh PDF after edits to keep the lead’s documents up to date.</p>
        {loading && <p role="status" className="text-xs">Loading quotations…</p>}
        {error && <p role="alert" className="text-xs text-red-700">{error} <button onClick={() => setReload(n => n + 1)}>Retry</button></p>}
        {!loading && !error && !rows.length && <p className="text-xs text-stone-500">Select a panel when converting a quotation to a lead to create its final quotation.</p>}
        {rows.map(row => <div key={row.id} className="flex flex-wrap items-center gap-2 text-xs"><strong>{quoteLabel(row)}</strong>
            <button type="button" className="rounded-lg border px-3 py-2" onClick={() => {setEditing(row);setPreview(true);}}>Preview</button>
            {isEditable && <button type="button" className="rounded-lg border px-3 py-2" onClick={() => {setEditing(row);setPreview(false);}}>Edit final quotation</button>}
            <button type="button" disabled={busy} className="rounded-lg bg-amber-100 px-3 py-2 font-bold" onClick={() => savePdf(row)}>{busy ? 'Preparing…' : isEditable ? 'Download & save to Lead documents' : 'Download'}</button>
        </div>)}
        {(documents || []).filter(doc => ['lead_quotation', 'loan_quotation'].includes(doc.doc_type)).map(doc => <button key={doc.id} type="button" className="block text-xs text-blue-700 underline" onClick={() => onFilePreview(doc)}>Saved final quotation: {doc.file_name || doc.name || 'PDF'}</button>)}
        {editing && createPortal(<div className="q-module" style={{position:'fixed',inset:0,zIndex:95,overflow:'auto',background:'#f6f7f9'}}>
            <div className="q-content"><div className="q-actions"><button type="button" onClick={close}>Back to Lead</button><strong>{quoteLabel(editing)}</strong>
                {preview && isEditable && <button onClick={() => setPreview(false)}>Edit values</button>}
                {preview && <button disabled={busy} onClick={() => savePdf(editing)}>{isEditable ? 'Download & save to Lead documents' : 'Download'}</button>}</div>
                {preview ? <div style={{overflowX:'auto'}}><DocumentPages row={editing} /></div> : <QuotationForm key={editing.id} id={editing.id} initialRow={editing} user={user} meta={meta} onDirty={setDirty} onSaved={row => {setEditing(row);setRows(current => current.map(item => item.id === row.id ? row : item));}} onDraftSaved={() => {setEditing(null);setDirty(false);setReload(n => n + 1);}} onPreview={row => {setEditing(row);setPreview(true);}} />}
            </div></div>,document.body)}
    </section>;
}
