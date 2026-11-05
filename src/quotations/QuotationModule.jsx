import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Download, Eye, FileText, Pencil, Plus, Search, Share2 } from 'lucide-react';
import { supabase } from '../supabase';
import AddLeadModal from '../components/AddLeadModal';
import { useGlobalPopup } from '../components/GlobalPopup';
import { canUseQuotations,chosenOptions,fromRow,money,toLead,validate,quoteLabel,statusOf,groupClients,tallyClients,CLIENT_TABS } from './model';
import { quotationRepository as repo } from './client';
import { PAGE_SIZE } from './repository';
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
// Quotes are listed by client. A client can have several quotes (other sizes or prices);
// "Client picked this one" marks one, which then goes to Add to leads.
const TAB_TEXT = { all:'All', open:'Open', picked:'Picked', converted:'Added to leads', lost:'Lost' };
const STATUS_TEXT = { open:'Open', picked:'Picked', converted:'Added to leads', lost:'Lost' };
const supersededOf = item => item?.superseded_by || item?.quotation_data?.superseded_by || null;
const announceCounts = counts => { if (counts) window.dispatchEvent(new CustomEvent('quotations-changed',{ detail:{ ...counts, open:counts.waiting } })); };
// 2026-10-16 -> 16-10-2026, as printed on the quotation.
const showDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value).split('-').reverse().join('-') : (value || '');
// Only a replaced old revision is read-only.
const isLocked = item => !!supersededOf(item);
// Panel and price of a quote for its line in the list.
const quoteSize = item => item.capacity_kw ? `${item.capacity_kw} kW` : '— kW';
const quotePrice = item => item.starting_price == null ? '—' : money(item.starting_price);
// Older quotes can have three panel options (the list loads them as options).
const optionCount = item => (item.options || item.quotation_data?.form?.options || []).length;
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

function Preview({ row,onGenerate,onEdit,onDone,busy }) {
    const scrollRef = useRef(null);
    const [zoom,setZoom] = useState(() => Math.min(1, Math.max(0.25, (typeof window !== 'undefined' ? window.innerWidth - 64 : 794) / 794)));
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

    return <div style={full ? {position:'fixed',inset:0,zIndex:55,background:'#f6f7f9',padding:12,overflow:'auto'} : undefined}><div className="q-preview-toolbar"><div className="q-tools">{!isLocked(row) && <button onClick={onEdit}><Pencil size={15} /> Edit</button>}<div className="q-zoom" role="group" aria-label="Zoom"><button onClick={() => changeZoom(z => Math.max(.25,z - .1))} aria-label="Zoom out">−</button><span aria-live="polite">{Math.round(zoom * 100)}%</span><button onClick={() => changeZoom(z => Math.min(1.5,z + .1))} aria-label="Zoom in">+</button></div><button onClick={fitToWidth}>Fit width</button><button onClick={() => { manualZoom.current = false; setFull(v => !v); }}>{full ? 'Exit full screen' : 'Full screen'}</button></div><div className="q-send"><button disabled={busy} onClick={onDone}>Done</button><button className="q-primary" disabled={busy} onClick={() => onGenerate(row, 'download')}><Download size={16} /> {busy ? 'Generating…' : 'Download'}</button><button disabled={busy} onClick={() => onGenerate(row, 'share')}><Share2 size={16} /> Share</button>{/* WhatsApp disabled: {onWhatsAppChat && canWhatsAppChat(row) && <button className="q-wa" disabled={busy} onClick={() => onWhatsAppChat(row)}><MessageCircle size={16} /> WhatsApp</button>} */}</div></div><div className="q-preview-scroll" ref={scrollRef}><div style={{width:794 * zoom,height:(1123 + 60) * zoom,margin:'0 auto'}}><div className="q-preview-surface" style={{width:794,transform:`scale(${zoom})`,transformOrigin:'top left'}}><DocumentPages row={row} /></div></div></div></div>;
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
    // New quote for this client: the quote it starts from.
    const [baseRow,setBaseRow] = useState(null);
    const [profile,setProfile] = useState(user);
    const [busy,setBusy] = useState(false);
    const [waChat,setWaChat] = useState(null);
    const busyRef = useRef(false);
    // Lost applies to a client: every one of their quotes.
    const [lost,setLost] = useState(null);
    const [reason,setReason] = useState('');
    const [remark,setRemark] = useState('');
    // Picking an older quote with three options asks which option.
    const [choosing,setChoosing] = useState(null);
    const [conversion,setConversion] = useState(null);
    const [leadPrefill,setLeadPrefill] = useState(null);
    const [online,setOnline] = useState(navigator.onLine);
    const allowed = canUseQuotations(user);
    const open = route.startsWith('/quotations');
    const parts = route.split('/');
    // #/quotations/new/<id> is a new client; #/quotations/new/<id>/<fromId> is a new quote for fromId's client.
    const mode = parts[2] === 'new' ? 'new' : parts[3] || 'list';
    const id = mode === 'new' ? parts[3] : parts[2];
    const fromId = mode === 'new' && uuid.test(parts[4] || '') ? parts[4] : null;
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
            dirty.current = false; acceptedRoute.current = next; setRoute(next); setError(''); setLost(null); setChoosing(null); setConversion(null);
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
            // Old rows linked to a lead that was deleted lose the link.
            let listRows = result;
            const linked = listRows.filter(r => r.converted_lead_id);
            if (linked.length) {
                const { data: alive } = await supabase.from('admin').select('id').in('id',linked.map(r => r.converted_lead_id)).is('deleted_at',null);
                const aliveIds = new Set((alive || []).map(r => r.id));
                const stale = linked.filter(r => !aliveIds.has(r.converted_lead_id));
                if (stale.length) {
                    await Promise.all(stale.map(r => repo.get(r.id).then(full => repo.verifyConversion(full)).catch(() => null)));
                    listRows = await repo.listAll({search});
                }
            }
            if (current) { setAllRows(listRows); setError(''); if (!search) announceCounts(tallyClients(groupClients(listRows))); }
        }).catch(err => { if (current) setError(err.message); }).finally(() => { if (current) setLoading(false); }),search ? 250 : 0);
        return () => { current = false; clearTimeout(timer); };
    },[open,allowed,mode,search,refresh,online]);
    // Tabs, counts and pages come from the loaded rows, so switching tabs needs no reload.
    const clients = useMemo(() => groupClients(allRows),[allRows]);
    const counts = useMemo(() => tallyClients(clients),[clients]);
    const visible = useMemo(() => clients.filter(c => status === 'all' || c.status === status),[clients,status]);
    const count = visible.length;
    const shown = visible.slice(page * PAGE_SIZE,(page + 1) * PAGE_SIZE);
    // Show an action's result on the card at once; the background reload confirms it.
    const patchRow = updated => { if (updated?.id) setAllRows(list => list.map(item => item.id === updated.id ? { ...item, ...updated } : item)); };
    useEffect(() => {
        if (!open || !allowed || !validId) return;
        let current = true; setLoading(true); setRow(null); setLoadedRoute('');
        const quote = repo.get(id).catch(err => { if (mode === 'new' && err.code === 'PGRST116') return null; throw err; });
        Promise.all([quote, fromId ? repo.get(fromId) : null]).then(([result,base]) => { if (current) { setRow(result); setBaseRow(base); setLoadedRoute(route); } })
            .catch(err => { if (current) setError(err.message || 'Quotation not found or not accessible.'); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    },[open,allowed,validId,id,fromId,route,mode,refresh]);
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
            const stored = original;
            const issues = validate(fromRow(stored));
            if (issues.length) { await showAlert(issues.join('\n'),{title:'Complete these fields',type:'warning'}); return; }
            const file = await generateQuotationPdf(stored);
            const updated = await repo.generated(stored,user);
            setRow(updated);
            if (updated.source_lead_id) await saveLeadQuotationPdf(updated,file,user);
            downloadQuotationFile(file);
            showAlert(`Downloaded ${file.name}`, { title: 'Download complete', type: 'success' });
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
                const stored = original;
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
    // Same as Download: the share is recorded on the quotation. Once per popup.
    const issueFromWhatsApp = async () => {
        if (!waChat || waChat.issued) return;
        setWaChat(c => c && { ...c, issued:true });
        try {
            const updated = await repo.generated(waChat.row,user);
            setRow(current => current?.id === updated.id ? updated : current);
            patchRow(updated);
            setRefresh(n => n + 1);
        } catch (err) {
            showAlert(`The PDF went out, but the CRM could not record the share: ${err.message}`,{title:'Share not recorded',type:'warning'});
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
    // Starts from the client's newest quote: same customer, same panel, dated today.
    const startForClient = client => {
        if (busyRef.current) return;
        navigate(`/quotations/new/${crypto.randomUUID()}/${client.latest.id}`);
    };
    // Client picked this one. An older quote with three options asks which option first.
    const pick = item => run(async () => {
        const latest = await repo.get(item.id);
        const choices = chosenOptions(fromRow(latest));
        if (!choices.length) { await showAlert('Enter a price for this quote first.',{type:'warning'}); return; }
        if (choices.length > 1) { setChoosing({ row:latest, choices, picked:latest.selected_option || null }); return; }
        patchPicked(await repo.pick(latest,choices[0].number,user));
    });
    const confirmChoice = () => run(async () => { patchPicked(await repo.pick(await repo.get(choosing.row.id),choosing.picked,user)); setChoosing(null); });
    // Show the pick at once: this quote on, the client's others off. The reload confirms it.
    const patchPicked = picked => {
        const key = clients.find(c => c.quotes.some(q => q.id === picked.id))?.key;
        setAllRows(list => list.map(item => item.id === picked.id ? { ...item, ...picked } : clients.find(c => c.key === key)?.quotes.some(q => q.id === item.id) ? { ...item, selected_option:null } : item));
        setRefresh(n => n + 1);
    };
    const unpick = item => run(async () => { patchRow(await repo.markOpen(await repo.get(item.id),user)); setRefresh(n => n + 1); });
    // Add to leads opens the usual Add Lead form, filled (and locked) from the picked quote.
    const addToLeads = item => run(async () => {
        const latest = await repo.get(item.id);
        const form = fromRow(latest);
        const choices = chosenOptions(form);
        const choice = choices.find(option => option.number === latest.selected_option) || choices[0] || null;
        setLeadPrefill(toLead(form, choice, meta?.module_brand || [])); setConversion(latest); dirty.current = true;
    });
    const reopenClient = client => run(async () => {
        for (const item of client.quotes.filter(q => statusOf(q) === 'lost')) patchRow(await repo.markOpen(await repo.get(item.id),user));
        setRefresh(n => n + 1);
    });
    const markClientLost = () => run(async () => {
        for (const item of lost.quotes.filter(q => statusOf(q) !== 'lost')) patchRow(await repo.markLost(await repo.get(item.id),reason,user,remark));
        setLost(null); setRefresh(n => n + 1);
    });
    const showLead = async leadId => { const lead = await repo.lead(leadId); dirty.current = false; navigate(''); onViewLead(lead); };
    // A saved draft goes straight into the list too, so it is there on Back.
    const saved = useCallback(savedRow => {
        setRow(savedRow);
        if (savedRow?.id) setAllRows(list => list.some(item => item.id === savedRow.id)
            ? list.map(item => item.id === savedRow.id ? { ...item, ...savedRow } : item)
            : [savedRow, ...list]);
    },[]);
    const leaveModule = () => {
        dirty.current = false;
        navigate('');
        onClose?.();
    };
    if (!open) return null;
    if (!allowed) return <div className={`q-module${embedded ? ' q-module-embedded' : ''}`}><div className="q-content q-error">Quotation Maker is unavailable for your role.<button onClick={embedded ? leaveModule : () => navigate('')}>Back to CRM</button></div></div>;
    const localCopies = mode === 'list' ? recoveries(user.id) : [];
    const isPartnerPortal = ['agent','agent2'].includes(user?.userType);
    const heading = validId && row ? `${quoteLabel(row)} · ${STATUS_TEXT[statusOf(row)]}` : mode === 'new' ? (baseRow ? `New quote for ${baseRow.customer_name}` : 'New quote') : 'Quotation';
    const clientCard = client => {
        const added = client.status === 'converted';
        const closed = added || client.status === 'lost';
        return <article className="q-card q-client" key={client.key}>
            <div className="q-card-heading"><span>{client.quotes.length} {client.quotes.length === 1 ? 'quote' : 'quotes'}</span><span className={`q-status q-status-${client.status}`}>{STATUS_TEXT[client.status]}</span></div>
            <h3>{client.name || 'Unnamed client'}</h3>
            {client.phone && <p>{client.phone}</p>}
            <ol className="q-quotes">{client.quotes.map((item,i) => {
                const chosen = client.picked?.id === item.id;
                return <li key={item.id} className={`q-quote${chosen ? ' q-quote-picked' : ''}`}>
                    <div className="q-quote-top"><strong>Quote {i + 1}</strong><span>{quoteSize(item)}</span><strong className="q-quote-price">{quotePrice(item)}</strong></div>
                    <p className="q-quote-meta">{quoteLabel(item)} · {showDate(item.quotation_date)} · {item.owner_name_snapshot || '—'}{statusOf(item) === 'lost' && !closed ? ' · Lost' : ''}{optionCount(item) > 1 ? ` · older quote, ${optionCount(item)} options` : ''}</p>
                    <div className="q-quote-actions">
                        <button onClick={() => navigate(`/quotations/${item.id}/preview`)}><Eye size={15} /> View</button>
                        <button onClick={() => navigate(`/quotations/${item.id}/edit`)}><Pencil size={15} /> Edit</button>
                        <button disabled={busy || !online} onClick={() => generate(item, 'download')}><Download size={15} /> Download</button>
                        <button disabled={busy || !online} onClick={() => generate(item, 'share')}><Share2 size={15} /> Share</button>
                    </div>
                    {added ? chosen && <p className="q-pick-note"><Check size={15} /> Client picked this one · added to leads</p>
                        : !closed && <button className={`q-pick${chosen ? ' q-pick-on' : ''}`} aria-pressed={chosen} disabled={busy || !online} onClick={() => chosen ? unpick(item) : pick(item)}><span className="q-pick-box" aria-hidden="true">{chosen && <Check size={14} />}</span>Client picked this one</button>}
                </li>;
            })}</ol>
            <div className="q-actions q-client-actions">
                {client.status === 'picked' && onCreateLead && <button className="q-primary" disabled={busy || !online} onClick={() => addToLeads(client.picked)}>Add to leads</button>}
                {added && onViewLead && <button disabled={busy || !online} onClick={() => showLead(client.picked.converted_lead_id || client.picked.source_lead_id)}>View lead</button>}
                <button disabled={busy} onClick={() => startForClient(client)}><Plus size={15} /> New quote for this client</button>
                {!closed && <button disabled={busy || !online} onClick={() => {setLost(client);setReason('');setRemark('');}}>Lost</button>}
                {client.status === 'lost' && <button disabled={busy || !online} onClick={() => reopenClient(client)}>Back to open</button>}
            </div>
        </article>;
    };
    return <div className={`q-module${embedded ? ' q-module-embedded' : ''}${isPartnerPortal ? ' q-module-partner' : ''}`}>
        {!embedded && <header className="q-header"><button aria-label={mode === 'list' ? 'Back to CRM' : 'Back to quotations'} onClick={() => navigate(mode === 'list' ? '' : '/quotations')}><ArrowLeft size={18} /></button><div style={{flex:1}}><h1>Quotation Maker</h1><p>{mode === 'list' ? 'WATERSUN · SOLAR ENERGY' : heading}</p></div><FileText size={22} /></header>}
        <main className="q-content">
            {embedded && mode !== 'list' && <div className="q-subnav"><button aria-label="Back to quotations" onClick={() => navigate('/quotations')}><ArrowLeft size={16} /> Back to quotations</button><span>{heading}</span></div>}
            {!online && <div className="q-notice" role="status">You’re offline. Draft edits can be recovered on this device. Downloads and outcomes need a connection.</div>}
            {error && <div className="q-error" role="alert">{error}<div><button onClick={() => setRefresh(n => n + 1)}>Retry / reload</button></div></div>}
            {mode === 'list' && <>
                <section className="q-list-head" aria-label="Quotation actions"><div className="q-list-heading">{embedded && isPartnerPortal && <button className="q-list-back" aria-label="Back to portal" onClick={leaveModule}><ArrowLeft size={17} /></button>}<div><h2>Quotations</h2><p>{loading && !allRows.length ? 'Loading quotations…' : `${count} ${count === 1 ? 'client' : 'clients'}`}</p></div></div><button className="q-create" onClick={start}><Plus size={17} /> New quote</button></section>
                <p className="q-howto">Make one or more quotes per client, tick the one the client picked, then Add to leads.</p>
                {!!localCopies.length && <div className="q-notice"><strong>Draft recovery on this device</strong>{localCopies.map(copy => <div key={copy.id}><button onClick={() => navigate(`/quotations/new/${copy.id}`)}>Recover {copy.form?.customer_name || 'unnamed quotation'}</button></div>)}</div>}
                <div className="q-toolbar"><input className="q-search" aria-label="Search quotations" placeholder="Search client name, phone or quote number" value={search} onChange={e => {setSearch(e.target.value);setPage(0);}} /><button aria-label="Refresh quotations" onClick={() => setRefresh(n => n + 1)}><Search size={17} /> Refresh</button></div>
                <div className="q-filters" role="group" aria-label="Show clients">{CLIENT_TABS.map(tab => <button key={tab} aria-pressed={status === tab} onClick={() => {setStatus(tab);setPage(0);}}>{TAB_TEXT[tab]}<span className="q-count"> {counts[tab]}</span></button>)}</div>
                {loading && !allRows.length ? <div className="q-empty" role="status">Loading quotations…</div> : !shown.length && !error ? <div className="q-empty"><h2>No quotes found</h2><p className="q-muted">Make a new quote or try another search.</p><button onClick={start}><Plus size={16} /> New quote</button></div> : <div className="q-cards">{shown.map(clientCard)}</div>}
                <div className="q-pagination"><button disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>{count} clients · Page {page + 1}</span><button disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>
            </>}
            {validId && (loading || loadedRoute !== route) && !error && <div role="status" className="q-empty">Opening quotation…</div>}
            {validId && loadedRoute === route && mode === 'edit' && row && isLocked(row) && <div className="q-notice" role="status"><strong>{quoteLabel(row)} is an old version.</strong> It was replaced by {supersededOf(row).label}.<div className="q-actions"><button onClick={() => navigate(`/quotations/${row.id}/preview`)}>View</button></div></div>}
            {validId && loadedRoute === route && ['new','edit'].includes(mode) && !(row && isLocked(row)) && <QuotationForm key={id} id={id} initialRow={row} baseRow={row ? null : baseRow} user={profile} meta={meta} onDirty={setDirty} onSaved={saved} onDraftSaved={() => { dirty.current = false; navigate('/quotations'); setRefresh(n => n + 1); }} onPreview={savedRow => {dirty.current = false; navigate(`/quotations/${savedRow.id}/preview`);}} />}
            {validId && loadedRoute === route && mode === 'preview' && row && <Preview row={row} busy={busy} onDone={() => { dirty.current = false; navigate('/quotations'); setRefresh(n => n + 1); }} onGenerate={generate} onEdit={() => navigate(`/quotations/${id}/edit`)} />}
            {route !== '/quotations' && (!validId || !['new','edit','preview'].includes(mode)) && <div className="q-error">Quotation page not found.</div>}
        </main>
        {choosing && <div className="q-dialog" role="dialog" aria-modal="true" aria-labelledby="q-choose-title"><div className="q-panel"><h2 id="q-choose-title">Which option did the client pick?</h2><p className="q-muted">This older quote has more than one option.</p><div className="q-choices">{choosing.choices.map(choice => <button key={choice.number} type="button" aria-pressed={choosing.picked === choice.number} className={choosing.picked === choice.number ? 'q-choice q-choice-on' : 'q-choice'} onClick={() => setChoosing(c => ({ ...c, picked:choice.number }))}><span className="q-choice-name">Option {choice.number}: {choice.brandName}</span><span>{choice.solar_panel_qty} modules × {choice.panel_wattage} Wp · {choice.capacity_kw} kWp</span><span>Net payable {money(choice.netPayableAmount)}</span><span className="q-muted">After subsidy {money(choice.netPriceAfterSubsidy)}</span></button>)}</div><div className="q-actions"><button disabled={busy} onClick={() => setChoosing(null)}>Cancel</button><button className="q-primary" disabled={busy || !choosing.picked} onClick={confirmChoice}>Client picked this one</button></div></div></div>}
        {waChat && <div className="q-dialog" role="dialog" aria-modal="true" aria-labelledby="q-wa-title"><div className="q-panel"><h2 id="q-wa-title">Share quotation PDF</h2><p className="q-muted">{quoteLabel(waChat.row)} · {waChat.row.customer_name}</p>
            <div className="q-notice" role="status" style={{marginTop:12}}>{waChat.preparing ? <strong>Preparing the PDF…</strong> : <><strong>PDF ready: {waChat.file?.name}</strong><div className="q-actions"><button type="button" onClick={() => generate(waChat.row, 'download')}><Download size={15} /> Save PDF</button></div></>}</div>
            {/* WhatsApp phone, message and chat controls are disabled. Complete original JSX is preserved in docs/parked-quotation-whatsapp/QuotationModule.jsx.disabled. */}
            <p className="q-muted" style={{marginTop:8}}>{waChat.preparing ? 'Preparing the PDF…' : canShareFile(waChat.file) ? 'Share the PDF using your device’s share menu.' : 'File sharing is unavailable in this browser. Use Save PDF.'}</p>
            <div className="q-actions"><button disabled={waChat.sharing} onClick={() => setWaChat(null)}>Close</button>{canShareFile(waChat.file) && <button className="q-primary" disabled={waChat.preparing || waChat.sharing} onClick={shareWhatsAppFile}><Share2 size={16} /> {waChat.sharing ? 'Sharing…' : 'Share PDF'}</button>}</div></div></div>}

        {conversion && createPortal(
            <AddLeadModal isOpen initialValues={leadPrefill} user={user} meta={meta} channel_partners={channelPartners} onClose={() => {setConversion(null);dirty.current = false;}} onSave={async (data,files) => { await onCreateLead(data,files,conversion); dirty.current = false; setConversion(null); setRefresh(n => n + 1); }} />,
            document.body
        )}
        {lost && <div className="q-dialog" role="dialog" aria-modal="true" aria-labelledby="q-lost-title"><div className="q-panel"><h2 id="q-lost-title">Mark {lost.name || 'this client'} as lost</h2><p className="q-muted">{lost.quotes.length === 1 ? 'Their quote is' : `All ${lost.quotes.length} quotes are`} marked lost. Back to open undoes it.</p><label className="q-field"><span>Reason (optional)</span><select value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose reason</option>{['Price','Competitor selected','Project postponed','Not interested','Other'].map(r => <option key={r}>{r}</option>)}</select></label><label className="q-field" style={{marginTop:16}}><span>Remark (optional)</span><textarea maxLength={1000} value={remark} onChange={e => setRemark(e.target.value)} /></label><div className="q-actions"><button disabled={busy} onClick={() => setLost(null)}>Cancel</button><button className="q-primary" disabled={busy} onClick={markClientLost}>Mark lost</button></div></div></div>}
    </div>;
}
