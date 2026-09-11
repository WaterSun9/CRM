import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Eye, FileText, Plus, Search, Share2 } from 'lucide-react';
import { supabase } from '../supabase';
import AddLeadModal from '../components/AddLeadModal';
import { useGlobalPopup } from '../components/GlobalPopup';
import { canUseQuotations,fromRow,money,toLead,validate } from './model';
import { quotationRepository as repo } from './client';
import { PAGE_SIZE } from './repository';
import { recoveries } from './recovery';
import QuotationForm from './QuotationForm';
import DocumentPages from './DocumentPages';
import { downloadQuotationFile, generateQuotationPdf, shareQuotationFile } from './pdf';
import './quotation.css';

export const openQuotations = () => { window.location.hash = '/quotations'; };
const readRoute = () => window.location.hash.replace(/^#/,'');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statusLabels = ['all','draft','issued','converted','lost'];
// Keep the completed lead integration in place for later, but do not expose an
// active entry point until the data/table design is approved.
const LEAD_INTEGRATION_ENABLED = false;

function Preview({ row,onGenerate,onEdit,busy }) {
    const [zoom,setZoom] = useState(() => Math.min(1,(window.innerWidth - 64)/794));
    const [highlights,setHighlights] = useState(false);
    const [full,setFull] = useState(false);
    return <div style={full ? {position:'fixed',inset:0,zIndex:55,background:'#f6f7f9',padding:12,overflow:'auto'} : undefined}><div className="q-preview-toolbar"><button onClick={onEdit}>Edit values</button><button onClick={() => setZoom(z => Math.max(.25,z - .1))} aria-label="Zoom out">−</button><span className="q-muted">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.min(1.5,z + .1))} aria-label="Zoom in">+</button><button aria-pressed={highlights} onClick={() => setHighlights(v => !v)}>Highlights: {highlights ? 'on' : 'off'}</button><button onClick={() => setFull(v => !v)}>{full ? 'Exit full screen' : 'Full screen'}</button><button className="q-primary" disabled={busy} onClick={() => onGenerate(row, 'download')}><Download size={16} /> {busy ? 'Generating…' : 'Download'}</button><button disabled={busy} onClick={() => onGenerate(row, 'share')}><Share2 size={16} /> Share</button></div><div className="q-preview-scroll"><div style={{width:794 * zoom,height:(1123 * 3 + 60) * zoom}}><div className="q-preview-surface" style={{width:794,transform:`scale(${zoom})`}}><DocumentPages row={row} highlights={highlights} /></div></div></div></div>;
}
export default function QuotationModule({ user,meta,channelPartners = [],onCreateLead,onViewLead }) {
    const { showAlert,showConfirm } = useGlobalPopup();
    const [route,setRoute] = useState(readRoute);
    const acceptedRoute = useRef(route);
    const dirty = useRef(false);
    const [rows,setRows] = useState([]);
    const [count,setCount] = useState(0);
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
    const busyRef = useRef(false);
    const [lost,setLost] = useState(null);
    const [reason,setReason] = useState('');
    const [remark,setRemark] = useState('');
    const [conversion,setConversion] = useState(null);
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
        supabase.from('profiles').select('*').eq('id',user.id).single().then(({data}) => { if (current && data) setProfile({...user,name:data.name || user.name,phone:data.phone_number || data.phone || data.mobile || ''}); });
        return () => { current = false; };
    },[open,allowed,user]);
    useEffect(() => {
        if (!open || !allowed || mode !== 'list') return;
        let current = true; setLoading(true);
        const timer = setTimeout(() => repo.list({search,status,page}).then(result => { if (current) { setRows(result.rows); setCount(result.count); setError(''); } }).catch(err => { if (current) setError(err.message); }).finally(() => { if (current) setLoading(false); }),250);
        return () => { current = false; clearTimeout(timer); };
    },[open,allowed,mode,search,status,page,refresh,online]);
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
    const generate = async (quotation, action = 'download') => run(async () => {
        const stored = await repo.get(quotation.id);
        const issues = validate(fromRow(stored));
        if (issues.length) { await showAlert(issues.join('\n'),{title:'Complete these fields',type:'warning'}); return; }
        const file = await generateQuotationPdf(stored);
        const updated = await repo.generated(stored,user);
        setRow(updated);
        if (action === 'share') {
            await shareQuotationFile(file);
        } else {
            downloadQuotationFile(file);
            showAlert(`Downloaded ${file.name}`, { title: 'Download complete', type: 'success' });
        }
        setRefresh(n => n + 1);
    });
    const start = () => {
        if (busyRef.current) return;
        navigate(`/quotations/new/${crypto.randomUUID()}`);
    };
    const convert = quotation => run(async () => {
        if (!LEAD_INTEGRATION_ENABLED) return;
        const current = await repo.get(quotation.id);
        if (current.converted_lead_id) { await showLead(current.converted_lead_id); return; }
        setConversion(current); setLeadPrefill(toLead(fromRow(current))); dirty.current = true;
    });
    const showLead = async leadId => { const lead = await repo.lead(leadId); dirty.current = false; navigate(''); onViewLead(lead); };
    const saved = useCallback(savedRow => { setRow(savedRow); },[]);
    if (!open) return null;
    if (!allowed) return <div className="q-module"><div className="q-content q-error">Quotation Maker is unavailable for your role.<button onClick={() => navigate('')}>Back to CRM</button></div></div>;
    const localCopies = mode === 'list' ? recoveries(user.id) : [];
    const isPartnerPortal = ['agent','agent2'].includes(user?.userType);
    return <div className={`q-module${isPartnerPortal ? ' q-module-partner' : ''}`}>
        <header className="q-header"><button aria-label={mode === 'list' ? 'Back to CRM' : 'Back to quotations'} onClick={() => navigate(mode === 'list' ? '' : '/quotations')}><ArrowLeft size={18} /></button><div style={{flex:1}}><h1>Quotation Maker</h1><p>{validId && row ? `Quote-${row.quotation_no} · ${row.status}` : 'WATERSUN · SOLAR ENERGY'}</p></div><FileText size={22} /></header>
        <main className="q-content">
            {!online && <div className="q-notice" role="status">You’re offline. Draft edits can be recovered on this device. Downloads and outcomes need a connection.</div>}
            {error && <div className="q-error" role="alert">{error}<div><button onClick={() => setRefresh(n => n + 1)}>Retry / reload</button></div></div>}
            {mode === 'list' && <>
                <section className="q-hero"><div><p className="q-eyebrow">FROM A CONVERSATION TO A SOLAR PROPOSAL</p><h2>A brighter start for every customer.</h2><p>Create a quotation, compare three options, and share a Watersun proposal in a few simple steps.</p></div><button onClick={start}><Plus size={18} /> Create Quotation</button></section>
                {!!localCopies.length && <div className="q-notice"><strong>Draft recovery on this device</strong>{localCopies.map(copy => <div key={copy.id}><button onClick={() => navigate(`/quotations/new/${copy.id}`)}>Recover {copy.form?.customer_name || 'unnamed quotation'}</button></div>)}</div>}
                <div className="q-toolbar"><input className="q-search" aria-label="Search quotations" placeholder="Search quote number, customer or phone" value={search} onChange={e => {setSearch(e.target.value);setPage(0);}} /><button aria-label="Refresh quotations" onClick={() => setRefresh(n => n + 1)}><Search size={17} /> Refresh</button></div>
                <div className="q-filters">{statusLabels.map(s => <button key={s} aria-pressed={status === s} onClick={() => {setStatus(s);setPage(0);}}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
                {loading ? <div className="q-empty" role="status">Loading quotations…</div> : !rows.length && !error ? <div className="q-empty"><h2>No quotations found</h2><p className="q-muted">Create your first quotation or try another search.</p><button onClick={start}>Create Quotation</button></div> : <div className="q-cards">{rows.map(item => <article className="q-card" key={item.id}><div className="q-card-heading"><span>Quote-{item.quotation_no} · {item.quotation_date}</span><span className={`q-status q-status-${item.status}`}>{item.status}</span></div><h3>{item.customer_name}</h3><p>{item.customer_phone}</p><p>Created by {item.owner_name_snapshot || '—'}</p><dl><div><dt>System capacity</dt><dd>{item.capacity_kw ? `${item.capacity_kw} kWp` : '—'}</dd></div><div><dt>Starting price</dt><dd>{item.starting_price == null ? '—' : money(item.starting_price)}</dd></div></dl><div className="q-actions"><button onClick={() => navigate(`/quotations/${item.id}/edit`)}>Edit</button><button onClick={() => navigate(`/quotations/${item.id}/preview`)}><Eye size={15} /> Preview</button><button disabled={busy || !online} onClick={() => generate(item, 'download')}><Download size={15} /> Download</button><button disabled={busy || !online} onClick={() => generate(item, 'share')}><Share2 size={15} /> Share</button></div><div className="q-actions"><button disabled={!LEAD_INTEGRATION_ENABLED || busy || !online} title={!LEAD_INTEGRATION_ENABLED ? 'Lead integration will be enabled later' : undefined} onClick={() => convert(item)}>Add to Leads</button>{!item.converted_lead_id && (item.status === 'lost' ? <button disabled={busy || !online} onClick={() => run(async () => { const latest = await repo.get(item.id); await repo.outcome(latest,'reopened',user); setRefresh(n => n + 1); })}>Reopen</button> : <button disabled={busy || !online} onClick={() => {setLost(item);setReason('');setRemark('');}}>Mark Lost</button>)}</div></article>)}</div>}
                <div className="q-pagination"><button disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span>{count} quotations · Page {page + 1}</span><button disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>
            </>}
            {validId && (loading || loadedRoute !== route) && !error && <div role="status" className="q-empty">Opening quotation…</div>}
            {validId && loadedRoute === route && ['new','edit'].includes(mode) && <QuotationForm key={id} id={id} initialRow={row} user={profile} onDirty={setDirty} onSaved={saved} onPreview={savedRow => {dirty.current = false; navigate(`/quotations/${savedRow.id}/preview`);}} />}
            {validId && loadedRoute === route && mode === 'preview' && row && <Preview row={row} busy={busy} onGenerate={generate} onEdit={() => navigate(`/quotations/${id}/edit`)} />}
            {route !== '/quotations' && (!validId || !['new','edit','preview'].includes(mode)) && <div className="q-error">Quotation page not found.</div>}
        </main>
        {lost && <div className="q-dialog" role="dialog" aria-modal="true" aria-labelledby="q-lost-title"><div className="q-panel"><h2 id="q-lost-title">Mark quotation lost</h2><label className="q-field"><span>Reason (required)</span><select value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose reason</option>{['Price','Competitor selected','Project postponed','Not interested','Other'].map(r => <option key={r}>{r}</option>)}</select></label><label className="q-field" style={{marginTop:16}}><span>Remark (optional)</span><textarea maxLength={1000} value={remark} onChange={e => setRemark(e.target.value)} /></label><div className="q-actions"><button disabled={busy} onClick={() => setLost(null)}>Cancel</button><button className="q-primary" disabled={busy || !reason} onClick={() => run(async () => { const latest = await repo.get(lost.id); await repo.outcome(latest,'lost',user,reason,remark); setLost(null); setRefresh(n => n + 1); })}>Mark Lost</button></div></div></div>}
        {LEAD_INTEGRATION_ENABLED && conversion && <AddLeadModal isOpen initialValues={leadPrefill} user={user} meta={meta} channel_partners={channelPartners} onClose={() => {setConversion(null);dirty.current = false;}} onSave={async (data,files) => { await onCreateLead(data,files,conversion); dirty.current = false; setConversion(null); setRefresh(n => n + 1); }} />}
    </div>;
}
