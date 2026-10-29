import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Download, Eye, FileText, Plus, Search, Share2 } from 'lucide-react';
import { supabase } from '../supabase';
import AddLeadModal from '../components/AddLeadModal';
import { useGlobalPopup } from '../components/GlobalPopup';
import { canUseQuotations,chosenOptions,fromRow,money,toLead,validate,quoteLabel,isFinalQuotation } from './model';
import { quotationRepository as repo } from './client';
import { PAGE_SIZE, finalQuotationId } from './repository';
import { recoveries } from './recovery';
import QuotationForm from './QuotationForm';
import DocumentPages from './DocumentPages';
import { downloadQuotationFile, generateQuotationPdf, shareQuotationFile } from './pdf';
import { saveLeadQuotationPdf } from './leadPdf';
import { canShareQuotationFile } from './fileShare';
import './quotation.css';

export const openQuotations = () => { window.location.hash = '/quotations'; };
const readRoute = () => window.location.hash.replace(/^#/,'');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statusLabels = ['all','draft','issued','won','converted','lost'];
// Panel selection is Won; successfully adding the admin lead is Converted.
const statusText = status => status;
const statusOf = item => item?.converted_lead_id || item?.status === 'converted' ? 'converted'
    : item?.status === 'issued' && item?.selected_option && !isFinalQuotation(item) ? 'won' : item?.status;
// Downloaded (issued), converted or already-revised quotations cannot be edited.
const supersededOf = item => item?.superseded_by || item?.quotation_data?.superseded_by || null;
const isConverted = item => !!item?.converted_lead_id;
// Only an issued quote is revised; a lost one is reopened first, a converted one is final.
const canRevise = item => !isFinalQuotation(item) && !item?.selected_option && !isConverted(item) && !supersededOf(item) && item?.status !== 'lost';
// Tell the dashboard (sidebar badge) that quotation statuses changed.
// Per-status counts of the live (not replaced) quotations.
const tally = list => {
    const live = list.filter(item => !supersededOf(item));
    const counts = Object.fromEntries(statusLabels.map(s => [s, s === 'all' ? live.length : live.filter(item => statusOf(item) === s).length]));
    counts.open = counts.draft + counts.issued + counts.won;
    return counts;
};
const announceCounts = counts => { if (counts) window.dispatchEvent(new CustomEvent('quotations-changed',{ detail:counts })); };
// 2026-10-16 -> 16-10-2026, as printed on the quotation.
const showDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value).split('-').reverse().join('-') : (value || '');
const isLocked = item => !isFinalQuotation(item) && !!(item?.issued_at || isConverted(item) || supersededOf(item));
/* WhatsApp disabled at owner request. Original helpers preserved:
// WhatsApp: share the PDF from the phone, or open the customer's chat by
// number (wa.me) with the PDF saved to attach - no typing the number again.
const canWhatsAppChat = item => item?.status !== 'lost' && !supersededOf(item);
const waDigits = phone => {
    const digits = String(phone ?? '').replace(/\D/g,'');
    if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
    if (/^91[6-9]\d{9}$/.test(digits)) return digits;
    if (/^0[6-9]\d{9}$/.test(digits)) return `91${digits.slice(1)}`;
    return '';
};

*/

function Preview({ row,onGenerate,onEdit,onRevise,onSaveDraft,busy }) {
    const scrollRef = useRef(null);
    const [zoom,setZoom] = useState(() => Math.min(1, Math.max(0.25, (typeof window !== 'undefined' ? window.innerWidth - 64 : 794) / 794)));
    const [highlights,setHighlights] = useState(false);
    const [full,setFull] = useState(false);
    const manualZoom = useRef(false);

    useEffect(() => {
        const updateZoom = () => {
            if (manualZoom.current) return;
            if (scrollRef.current) {
                const available = scrollRef.current.clientWidth - 28;
                if (available > 0) {
                    setZoom(Math.min(1, Math.max(0.25, available / 794)));
                }
            }
        };
        updateZoom();
        window.addEventListener('resize', updateZoom);
        return () => window.removeEventListener('resize', updateZoom);
    }, [full]);

    const changeZoom = fn => {
        manualZoom.current = true;
        setZoom(fn);
    };

    const fitToWidth = () => {
        manualZoom.current = false;
        const available = scrollRef.current?.clientWidth - 28;
        if (available > 0) setZoom(Math.min(1, Math.max(0.25, available / 794)));
    };

    return <div style={full ? {position:'fixed',inset:0,zIndex:55,background:'#f6f7f9',padding:12,overflow:'auto'} : undefined}><div className="q-preview-toolbar"><div className="q-tools">{!isLocked(row) ? <button onClick={onEdit}>Edit values</button> : (canRevise(row) && <button disabled={busy} onClick={() => onRevise(row)}>Revise</button>)}<div className="q-zoom" role="group" aria-label="Zoom"><button onClick={() => changeZoom(z => Math.max(.25,z - .1))} aria-label="Zoom out">−</button><span aria-live="polite">{Math.round(zoom * 100)}%</span><button onClick={() => changeZoom(z => Math.min(1.5,z + .1))} aria-label="Zoom in">+</button></div><button onClick={fitToWidth}>Fit width</button><button aria-pressed={highlights} onClick={() => setHighlights(v => !v)}>Highlights: {highlights ? 'on' : 'off'}</button><button onClick={() => { manualZoom.current = false; setFull(v => !v); }}>{full ? 'Exit full screen' : 'Full screen'}</button></div><div className="q-send">{isFinalQuotation(row) && <button disabled={busy} onClick={onSaveDraft}>Save as draft & back</button>}<button className="q-primary" disabled={busy} onClick={() => onGenerate(row, 'download')}><Download size={16} /> {busy ? 'Generating…' : isFinalQuotation(row) ? 'Download final quote' : 'Download & save'}</button><button disabled={busy} onClick={() => onGenerate(row, 'share')}><Share2 size={16} /> Share</button>{/* WhatsApp disabled: {onWhatsAppChat && canWhatsAppChat(row) && <button className="q-wa" disabled={busy} onClick={() => onWhatsAppChat(row)}><MessageCircle size={16} /> WhatsApp</button>} */}</div></div><div className="q-preview-scroll" ref={scrollRef}><div style={{width:794 * zoom,height:(1123 * 3 + 60) * zoom,margin:'0 auto'}}><div className="q-preview-surface" style={{width:794,transform:`scale(${zoom})`,transformOrigin:'top left'}}><DocumentPages row={row} highlights={highlights} /></div></div></div></div>;
}
export default function QuotationModule({ user,meta,channelPartners = [],onCreateLead,onViewLead,embedded = false,onClose }) {
    const { showAlert,showConfirm } = useGlobalPopup();
    const [route,setRoute] = useState(readRoute);
    const acceptedRoute = useRef(route);
    const dirty = useRef(false);
    const [allRows,setAllRows] = useState([]);
    const [page,setPage] = useState(0);
    const [search,setSearch] = useState('');
    const [status,setStatus] = useState('all');
    const [refresh,setRefresh] = useState(0);
    const [loading,setLoading] = useState(false);
    const [error,setError] = useState('');
    const [row,setRow] = useState(null);
    const [loadedRoute,setLoadedRoute] = useState('');
    const [profile,setProfile] = useState(user);
    const [busy,setBusy] = useState(false);
    const [waChat,setWaChat] = useState(null);
    const busyRef = useRef(false);
    const [lost,setLost] = useState(null);
    const [reason,setReason] = useState('');
    const [remark,setRemark] = useState('');
    const [conversion,setConversion] = useState(null);
    const [choosing,setChoosing] = useState(null);
    const [finalChoice,setFinalChoice] = useState(null);
    const [leadPrefill,setLeadPrefill] = useState(null);
    const [online,setOnline] = useState(navigator.onLine);
    const allowed = canUseQuotations(user);
    const open = route.startsWith('/quotations');
    const parts = route.split('/');
    const mode = parts[2] === 'new' ? 'new' : parts[3] || 'list';
    const id = mode === 'new' ? parts[3] : parts[2];
    const validId = uuid.test(id || '');
    const setDirty = useCallback(value => { dirty.current = value; },[]);
    const navigate = useCallback(path => { window.location.hash = path; },[]);
    useEffect(() => {
        const change = () => {
            const next = readRoute();
            if (next === acceptedRoute.current) return;
            if (dirty.current && !window.confirm('This quotation has unsaved changes. Leave this screen? A recovery copy remains on this device when storage is available.')) {
                window.history.pushState(null,'',`#${acceptedRoute.current}`); return;
            }
            dirty.current = false; acceptedRoute.current = next; setRoute(next); setError(''); setLost(null); setConversion(null);
        };
        const before = event => { if (dirty.current) { event.preventDefault(); event.returnValue = ''; } };
        const connection = () => setOnline(navigator.onLine);
        window.addEventListener('hashchange',change); window.addEventListener('beforeunload',before);
        window.addEventListener('online',connection); window.addEventListener('offline',connection);
        return () => { window.removeEventListener('hashchange',change); window.removeEventListener('beforeunload',before); window.removeEventListener('online',connection); window.removeEventListener('offline',connection); };
    },[]);
    useEffect(() => {
        if (!open || !allowed) return;
        let current = true;
        supabase.from('profiles').select('*').eq('id',user.id).single().then(({data}) => { if (current && data) setProfile({...user,name:data.name || user.name,phone:data.phone || data.phone_number || data.mobile || ''}); });
        return () => { current = false; };
    },[open,allowed,user]);
    useEffect(() => {
        if (!open || !allowed || mode !== 'list') return;
        let current = true; setLoading(true);
        const timer = setTimeout(() => repo.listAll({search}).then(async result => {
            // Rows marked converted whose lead was deleted go back to issued.
            let listRows = result;
            const linked = listRows.filter(isConverted);
            if (linked.length) {
                const { data: alive } = await supabase.from('admin').select('id').in('id',linked.map(r => r.converted_lead_id)).is('deleted_at',null);
                const aliveIds = new Set((alive || []).map(r => r.id));
                const stale = linked.filter(r => !aliveIds.has(r.converted_lead_id));
                if (stale.length) {
                    await Promise.all(stale.map(r => repo.get(r.id).then(full => repo.verifyConversion(full)).catch(() => null)));
                    listRows = await repo.listAll({search});
                }
            }
            if (current) { setAllRows(listRows); setError(''); if (!search) announceCounts(tally(listRows)); }
        }).catch(err => { if (current) setError(err.message); }).finally(() => { if (current) setLoading(false); }),search ? 250 : 0);
        return () => { current = false; clearTimeout(timer); };
    },[open,allowed,mode,search,refresh,online]);
    // Tabs, counts and pages come from the loaded rows, so switching tabs needs no reload.
    const counts = useMemo(() => tally(allRows),[allRows]);
    const visible = useMemo(() => allRows.filter(item => !supersededOf(item) && (status === 'all' || statusOf(item) === status)),[allRows,status]);
    const count = visible.length;
    const rows = visible.slice(page * PAGE_SIZE,(page + 1) * PAGE_SIZE);
    // Show an action's result on the card at once; the background reload confirms it.
    const patchRow = updated => { if (updated?.id) setAllRows(list => list.map(item => item.id === updated.id ? { ...item, ...updated } : item)); };
    useEffect(() => {
        if (!open || !allowed || !validId) return;
        let current = true; setLoading(true); setRow(null); setLoadedRoute('');
        repo.get(id).then(result => { if (current) { setRow(result); setLoadedRoute(route); } }).catch(err => {
            if (!current) return;
            if (mode === 'new' && err.code === 'PGRST116') { setRow(null); setLoadedRoute(route); }
            else setError(err.message || 'Quotation not found or not accessible.');
        }).finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    },[open,allowed,validId,id,route,mode,refresh]);
    const run = async task => {
        if (busyRef.current) return;
        busyRef.current = true; setBusy(true); setError('');
        try { return await task(); }
        catch (err) { setError(err.message || 'The action could not be completed. Please retry.'); }
        finally { busyRef.current = false; setBusy(false); }
    };
    const generate = async (quotation, action = 'download') => {
        if (action === 'share') { prepareShare(quotation); return; }
        return run(async () => {
            const original = await repo.get(quotation.id);
            const stored = action === 'initial' ? original : original.selected_option && !isFinalQuotation(original) ? await repo.ensureFinal(original,profile) : original;
            const issues = validate(fromRow(stored));
            if (issues.length) { await showAlert(issues.join('\n'),{title:'Complete these fields',type:'warning'}); return; }
            const file = await generateQuotationPdf(stored);
            const updated = await repo.generated(stored,user);
            setRow(updated);
            if (isFinalQuotation(updated) && updated.source_lead_id) await saveLeadQuotationPdf(updated,file,user);
            downloadQuotationFile(file);
            showAlert(`Downloaded ${file.name}${isFinalQuotation(updated) && !updated.source_lead_id ? '. Add this quotation to admin leads to save the PDF in Lead documents.' : ''}`, { title: 'Download complete', type: 'success' });
            setRefresh(n => n + 1);
        });
    };
    // WhatsApp popup: the PDF is made as soon as it opens, so every button
    // below is a fresh tap - phones only allow the share sheet from a tap.
    const prepareShare = item => {
        setWaChat({ row:item, file:null, preparing:true, issued:false });
        run(async () => {
            try {
                const original = await repo.get(item.id);
                const stored = original.selected_option && !isFinalQuotation(original) ? await repo.ensureFinal(original,profile) : original;
                const issues = validate(fromRow(stored));
                if (issues.length) { setWaChat(null); await showAlert(issues.join('\n'),{title:'Complete these fields',type:'warning'}); return; }
                const file = await generateQuotationPdf(stored);
                setWaChat(c => c && c.row.id === item.id ? { ...c, row:stored, file, preparing:false } : c);
            } catch (err) {
                setWaChat(null);
                throw err;
            }
        });
    };
    // Same as Download: the quotation is issued once its PDF goes out. Once per popup.
    const issueFromWhatsApp = async () => {
        if (!waChat || waChat.issued) return;
        setWaChat(c => c && { ...c, issued:true });
        try {
            const updated = await repo.generated(waChat.row,user);
            setRow(current => current?.id === updated.id ? updated : current);
            patchRow(updated);
            setRefresh(n => n + 1);
        } catch (err) {
            showAlert(`The PDF went out, but the CRM could not mark the quotation as issued: ${err.message}`,{title:'Not marked issued',type:'warning'});
        }
    };
    const canShareFile = canShareQuotationFile;
    // The file is already ready, so this tap retains browser user activation.
    const shareWhatsAppFile = async () => {
        const file = waChat?.file;
        if (!file || waChat.sharing) return;
        setWaChat(c => c && { ...c, sharing:true });
        const result = await shareQuotationFile(file);
        setWaChat(c => c && c.file === file ? { ...c, sharing:false } : c);
        if (result === 'shared') await issueFromWhatsApp();
        else if (result === 'download-required') {
            showAlert('This browser could not share the PDF file. Use Save PDF to save the document.', { title:'File sharing unavailable', type:'warning' });
        }
    };
/* WhatsApp chat and message handlers disabled; preserved for future reuse.
    const copyWhatsAppMessage = async () => {
        try {
            await navigator.clipboard.writeText(waChat?.message || '');
            showAlert('Message copied. You can paste it after attaching the PDF.', { title:'Message copied', type:'success' });
        } catch {
            showAlert('Select and copy the message in the box above.', { title:'Copy message', type:'warning' });
        }
    };
    // Customer's chat by number (wa.me). Files cannot ride along on a link,
    // so the PDF is saved to the device to attach.
    const sendWhatsAppChat = () => {
        const to = waDigits(waChat?.phone);
        if (!to) { void showAlert('Enter a valid 10-digit mobile number.',{title:'Check the number',type:'warning'}); return; }
        if (!waChat.file) return;
        downloadQuotationFile(waChat.file);
        window.open(`https://wa.me/${to}?text=${encodeURIComponent(waChat.message || '')}`,'_blank');
        void issueFromWhatsApp();
    };
*/
    const start = () => {
        if (busyRef.current) return;
        navigate(`/quotations/new/${crypto.randomUUID()}`);
    };
    const convert = quotation => run(async () => {
        const current = await repo.verifyConversion(await repo.get(quotation.id));
        if (supersededOf(current)) { await showAlert('This quotation was revised. Use Won on the newest version instead.',{type:'warning'}); return; }
        if (current.converted_lead_id) { await openFinal(current); return; }
        const choices = chosenOptions(fromRow(current));
        // With priced options, the customer's choice is recorded first and fills the lead.
        if (current.selected_option) {
            const final = await repo.ensureFinal(current,profile);
            const form = fromRow(final);
            startLead(current,chosenOptions(form)[0],form); return;
        }
        if (choices.length) { setChoosing({ row:current, choices, picked:current.selected_option || null }); return; }
        startLead(current, null);
    });
    const startLead = (current, choice, form = fromRow(current)) => {
        const lead = toLead(form, choice, meta?.module_brand || []);
        setConversion(current); setLeadPrefill(lead); dirty.current = true;
    };
    const confirmChoice = () => run(async () => {
        const { row: picked, picked: number } = choosing;
        const latest = await repo.get(picked.id);
        const finalId = latest.quotation_data?.final_id || await finalQuotationId(latest.id,latest.converted_lead_id || 'won');
        const saved = await repo.update(latest,{ selected_option:number, quotation_data:{ ...latest.quotation_data, final_id:finalId } });
        patchRow({ ...saved, chosen_brands:saved.quotation_data?.form?.options });
        setChoosing(null);
        setStatus('won'); setPage(0);
        const final = await repo.ensureFinal(saved,profile);
        setFinalChoice(final); setRefresh(n => n + 1);
    });
    const openFinal = (quotation, destination = 'edit') => run(async () => {
        const final = await repo.ensureFinal(quotation, profile);
        dirty.current = false;
        navigate(`/quotations/${final.id}/${destination}`);
        setRefresh(n => n + 1);
    });
    const showLead = async leadId => { const lead = await repo.lead(leadId); dirty.current = false; navigate(''); onViewLead(lead); };
    // A saved draft goes straight into the list too, so it is there on Back.
    const saved = useCallback(savedRow => {
        setRow(savedRow);
        if (savedRow?.id) setAllRows(list => list.some(item => item.id === savedRow.id)
            ? list.map(item => item.id === savedRow.id ? { ...item, ...savedRow } : item)
            : [savedRow, ...list]);
    },[]);
    const revise = quotation => run(async () => {
        if (!await showConfirm('This quotation was already sent, so it is locked. Create a revised copy (for example Quote-12-R1) to make changes?',{confirmLabel:'Create revision'})) return;
        const created = await repo.revise(quotation,profile);
        dirty.current = false;
        setRefresh(n => n + 1);
        navigate(`/quotations/${created.id}/edit`);
    });
    const leaveModule = () => {
        dirty.current = false;
        navigate('');
        onClose?.();
    };
    if (!open) return null;
    if (!allowed) return <div className={`q-module${embedded ? ' q-module-embedded' : ''}`}><div className="q-content q-error">Quotation Maker is unavailable for your role.<button onClick={embedded ? leaveModule : () => navigate('')}>Back to CRM</button></div></div>;
    const localCopies = mode === 'list' ? recoveries(user.id) : [];
    const isPartnerPortal = ['agent','agent2'].includes(user?.userType);
    return <div className={`q-module${embedded ? ' q-module-embedded' : ''}${isPartnerPortal ? ' q-module-partner' : ''}`}>
        {!embedded && <header className="q-header"><button aria-label={mode === 'list' ? 'Back to CRM' : 'Back to quotations'} onClick={() => navigate(mode === 'list' ? '' : '/quotations')}><ArrowLeft size={18} /></button><div style={{flex:1}}><h1>Quotation Maker</h1><p>{validId && row ? `${quoteLabel(row)} · ${statusText(row.status)}` : 'WATERSUN · SOLAR ENERGY'}</p></div><FileText size={22} /></header>}
        <main className="q-content">
            {embedded && mode !== 'list' && <div className="q-subnav"><button aria-label="Back to quotations" onClick={() => navigate('/quotations')}><ArrowLeft size={16} /> Back to quotations</button><span>{validId && row ? `${quoteLabel(row)} · ${statusText(row.status)}` : mode === 'new' ? 'New quotation' : 'Quotation'}</span></div>}
            {!online && <div className="q-notice" role="status">You’re offline. Draft edits can be recovered on this device. Downloads and outcomes need a connection.</div>}
            {error && <div className="q-error" role="alert">{error}<div><button onClick={() => setRefresh(n => n + 1)}>Retry / reload</button></div></div>}
            {mode === 'list' && <>
                <section className="q-list-head" aria-label="Quotation actions"><div className="q-list-heading">{embedded && isPartnerPortal && <button className="q-list-back" aria-label="Back to portal" onClick={leaveModule}><ArrowLeft size={17} /></button>}<div><h2>{isPartnerPortal ? 'Quotations' : 'Quotation records'}</h2><p>{loading && !allRows.length ? 'Loading quotations…' : `${count} ${count === 1 ? 'quotation' : 'quotations'}`}</p></div></div><button className="q-create" onClick={start}><Plus size={17} /> Create Quotation</button></section>
                {!!localCopies.length && <div className="q-notice"><strong>Draft recovery on this device</strong>{localCopies.map(copy => <div key={copy.id}><button onClick={() => navigate(`/quotations/new/${copy.id}`)}>Recover {copy.form?.customer_name || 'unnamed quotation'}</button></div>)}</div>}
                <div className="q-toolbar"><input className="q-search" aria-label="Search quotations" placeholder="Search quote number, customer or phone" value={search} onChange={e => {setSearch(e.target.value);setPage(0);}} /><button aria-label="Refresh quotations" onClick={() => setRefresh(n => n + 1)}><Search size={17} /> Refresh</button></div>
                <div className="q-filters">{statusLabels.map(s => <button key={s} aria-pressed={status === s} onClick={() => {setStatus(s);setPage(0);}}>{statusText(s)[0].toUpperCase() + statusText(s).slice(1)}{counts && counts[s] != null ? <span className="q-count"> {counts[s]}</span> : null}</button>)}</div>
                {loading && !allRows.length ? <div className="q-empty" role="status">Loading quotations…</div> : !rows.length && !error ? <div className="q-empty"><h2>No quotations found</h2><p className="q-muted">Create your first quotation or try another search.</p><button onClick={start}>Create Quotation</button></div> : <div className="q-cards">{rows.map(item => <article className="q-card" key={item.id}><div className="q-card-heading"><span>{quoteLabel(item)} · {showDate(item.quotation_date)}</span><span className={`q-status q-status-${supersededOf(item) ? 'lost' : statusOf(item)}`}>{supersededOf(item) ? 'revised' : statusText(statusOf(item))}</span></div>{supersededOf(item) && <p className="q-muted">Replaced by {supersededOf(item).label}</p>}<h3>{item.customer_name}</h3><p>{item.customer_phone}</p><p>Created by {item.owner_name_snapshot || '—'}</p>{item.selected_option && item.chosen_brands?.[item.selected_option - 1] && <p><strong>Chosen: {item.chosen_brands[item.selected_option - 1].brandName}</strong></p>}<dl><div><dt>System capacity</dt><dd>{item.capacity_kw ? `${item.capacity_kw} kWp` : '—'}</dd></div><div><dt>Starting price</dt><dd>{item.starting_price == null ? '—' : money(item.starting_price)}</dd></div></dl><div className="q-actions">{!isLocked(item) ? <button onClick={() => navigate(`/quotations/${item.id}/edit`)}>{isFinalQuotation(item) ? 'Edit final quotation' : 'Edit'}</button> : (canRevise(item) && <button disabled={busy || !online} onClick={() => revise(item)}>Revise</button>)}<button onClick={() => item.selected_option && !isFinalQuotation(item) ? openFinal(item,'preview') : navigate(`/quotations/${item.id}/preview`)}><Eye size={15} /> Preview</button>{item.status !== 'lost' && <>{item.selected_option && !isFinalQuotation(item) ? <><button disabled={busy || !online} onClick={() => generate(item,'initial')}><Download size={15} /> Download initial quote</button><button disabled={busy || !online} onClick={() => openFinal(item)}>Revise final quote</button><button disabled={busy || !online} onClick={() => generate(item,'download')}><Download size={15} /> Download final quote</button></> : <button disabled={busy || !online} onClick={() => generate(item, 'download')}><Download size={15} /> {isFinalQuotation(item) ? 'Download final quote' : 'Download & save'}</button>}<button disabled={busy || !online} onClick={() => generate(item, 'share')}><Share2 size={15} /> Share</button>{/* WhatsApp disabled: {canWhatsAppChat(item) && <button className="q-wa" disabled={busy || !online} onClick={() => openWhatsAppChat(item)}><MessageCircle size={15} /> WhatsApp</button>} */}</>}</div>{!isFinalQuotation(item) && !supersededOf(item) && (isConverted(item)
                    ? <div className="q-actions"><button disabled={busy || !online} onClick={() => showLead(item.converted_lead_id)}>View lead</button><button disabled={busy || !online} onClick={() => openFinal(item)}>Final quotation</button></div>
                    : item.status === 'lost'
                        ? <div className="q-actions"><button disabled={busy || !online} onClick={() => run(async () => { const latest = await repo.get(item.id); patchRow(await repo.outcome(latest,'reopened',user)); setRefresh(n => n + 1); })}>Reopen</button></div>
                        : item.status === 'issued'
                            ? <div className="q-actions"><button className="q-primary" disabled={busy || !online || !onCreateLead} onClick={() => convert(item)}>{statusOf(item) === 'won' ? 'Add to admin leads' : 'Won'}</button><button disabled={busy || !online} onClick={() => {setLost(item);setReason('');setRemark('');}}>Lost</button></div>
                            : <p className="q-muted">Download it to issue it. Won and Lost appear once it is issued.</p>)}</article>)}</div>}
                <div className="q-pagination"><button disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>{count} quotations · Page {page + 1}</span><button disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>
            </>}
            {validId && (loading || loadedRoute !== route) && !error && <div role="status" className="q-empty">Opening quotation…</div>}
            {validId && loadedRoute === route && mode === 'edit' && row && isLocked(row) && <div className="q-notice" role="status"><strong>{quoteLabel(row)} is locked.</strong> {isConverted(row) ? 'It has been added to leads.' : supersededOf(row) ? `It was replaced by ${supersededOf(row).label}.` : 'It was already downloaded and sent to the customer.'}<div className="q-actions">{canRevise(row) && <button disabled={busy} onClick={() => revise(row)}>Revise</button>}<button onClick={() => navigate(`/quotations/${row.id}/preview`)}>Preview</button></div></div>}
            {validId && loadedRoute === route && ['new','edit'].includes(mode) && !(row && isLocked(row)) && <QuotationForm key={id} id={id} initialRow={row} user={profile} meta={meta} onDirty={setDirty} onSaved={saved} onDraftSaved={() => { dirty.current = false; navigate('/quotations'); setRefresh(n => n + 1); }} onPreview={savedRow => {dirty.current = false; navigate(`/quotations/${savedRow.id}/preview`);}} />}
            {validId && loadedRoute === route && mode === 'preview' && row && <Preview row={row} busy={busy} onSaveDraft={() => run(async () => { const latest = await repo.get(row.id); await repo.save(latest.id,latest,fromRow(latest),latest.quotation_data.template,user); dirty.current = false; navigate('/quotations'); setRefresh(n => n + 1); })} onGenerate={generate} onRevise={revise} onEdit={() => navigate(`/quotations/${id}/edit`)} />}
            {route !== '/quotations' && (!validId || !['new','edit','preview'].includes(mode)) && <div className="q-error">Quotation page not found.</div>}
        </main>
        {choosing && <div className="q-dialog" role="dialog" aria-modal="true" aria-labelledby="q-choose-title"><div className="q-panel"><h2 id="q-choose-title">Which option did the customer choose?</h2><div className="q-choices">{choosing.choices.map(choice => <button key={choice.number} type="button" aria-pressed={choosing.picked === choice.number} className={choosing.picked === choice.number ? 'q-choice q-choice-on' : 'q-choice'} onClick={() => setChoosing(c => ({ ...c, picked:choice.number }))}><span className="q-choice-name">Option {choice.number}: {choice.brandName}</span><span>{choice.solar_panel_qty} modules × {choice.panel_wattage} Wp · {choice.capacity_kw} kWp</span><span>Net payable {money(choice.netPayableAmount)}</span><span className="q-muted">After subsidy {money(choice.netPriceAfterSubsidy)}</span></button>)}</div><div className="q-actions"><button disabled={busy} onClick={() => setChoosing(null)}>Cancel</button><button className="q-primary" disabled={busy || !choosing.picked} onClick={confirmChoice}>Confirm panel & continue</button></div></div></div>}
        {finalChoice && <div className="q-dialog" role="dialog" aria-modal="true" aria-labelledby="q-final-title"><div className="q-panel"><h2 id="q-final-title">{finalChoice.source_lead_id ? 'Quotation converted' : 'Panel selected — quotation won'}</h2><p>Would you like to revise the final document before previewing and downloading it?</p><p className="q-muted">Revise opens steps 1 and 2 with only the selected panel. All three document pages, including terms and warranty, are retained.</p><div className="q-actions"><button onClick={() => { const final = finalChoice; setFinalChoice(null); navigate(`/quotations/${final.id}/preview`); }}>Skip to preview</button><button className="q-primary" onClick={() => { const final = finalChoice; setFinalChoice(null); navigate(`/quotations/${final.id}/edit`); }}>Revise document</button></div></div></div>}
        {waChat && <div className="q-dialog" role="dialog" aria-modal="true" aria-labelledby="q-wa-title"><div className="q-panel"><h2 id="q-wa-title">Share quotation PDF</h2><p className="q-muted">{quoteLabel(waChat.row)} · {waChat.row.customer_name}</p>
            <div className="q-notice" role="status" style={{marginTop:12}}>{waChat.preparing ? <strong>Preparing the PDF…</strong> : <><strong>PDF ready: {waChat.file?.name}</strong><div className="q-actions"><button type="button" onClick={() => generate(waChat.row, 'download')}><Download size={15} /> Save PDF</button></div></>}</div>
            {/* WhatsApp phone, message and chat controls are disabled. Complete original JSX is preserved in docs/parked-quotation-whatsapp/QuotationModule.jsx.disabled. */}
            <p className="q-muted" style={{marginTop:8}}>{waChat.preparing ? 'Preparing the PDF…' : canShareFile(waChat.file) ? 'Share the PDF using your device’s share menu.' : 'File sharing is unavailable in this browser. Use Save PDF.'}</p>
            <div className="q-actions"><button disabled={waChat.sharing} onClick={() => setWaChat(null)}>Close</button>{canShareFile(waChat.file) && <button className="q-primary" disabled={waChat.preparing || waChat.sharing} onClick={shareWhatsAppFile}><Share2 size={16} /> {waChat.sharing ? 'Sharing…' : 'Share PDF'}</button>}</div></div></div>}

        {lost && <div className="q-dialog" role="dialog" aria-modal="true" aria-labelledby="q-lost-title"><div className="q-panel"><h2 id="q-lost-title">Mark quotation lost</h2><label className="q-field"><span>Reason (required)</span><select value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose reason</option>{['Price','Competitor selected','Project postponed','Not interested','Other'].map(r => <option key={r}>{r}</option>)}</select></label><label className="q-field" style={{marginTop:16}}><span>Remark (optional)</span><textarea maxLength={1000} value={remark} onChange={e => setRemark(e.target.value)} /></label><div className="q-actions"><button disabled={busy} onClick={() => setLost(null)}>Cancel</button><button className="q-primary" disabled={busy || !reason} onClick={() => run(async () => { const latest = await repo.get(lost.id); patchRow(await repo.outcome(latest,'lost',user,reason,remark)); setLost(null); setRefresh(n => n + 1); })}>Mark Lost</button></div></div></div>}
        {conversion && createPortal(
            <AddLeadModal isOpen initialValues={leadPrefill} user={user} meta={meta} channel_partners={channelPartners} onClose={() => {setConversion(null);dirty.current = false;}} onSave={async (data,files) => { await onCreateLead(data,files,conversion); const final = await repo.ensureFinal(conversion,profile); dirty.current = false; setConversion(null); setStatus('converted'); setPage(0); setFinalChoice(final); setRefresh(n => n + 1); }} />,
            document.body
        )}
    </div>;
}
