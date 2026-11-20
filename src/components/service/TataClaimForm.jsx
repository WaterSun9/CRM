import { useEffect, useMemo, useState } from 'react';
import { Camera, Check, FileDown, Share2, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { PhotoViewer, saveClaimReadingPhoto } from './ComplaintPhotos';
import { canShareFiles, claimReadingLabel, downloadOemClaimPdf, loadClaimData, shareOemClaimPdf } from './oemClaimPdf';
import { READINGS, READING_LABELS, TATA_FIELDS, mergeTataForm, tataFormProgress, tataFormToSave } from './tataServiceReport';
import { photoError } from './serviceLabels';

// Easy fill screen for a Tata claim (D-045, Mahvish 2026-11-20), phone first:
//   1 every box of Tata's Field Service Report as a plain field, in the form's order, started
//     from the CRM (complaint, customer card, latest visit); every box can be changed and the
//     empty ones say "Missing, fill in";
//   2 the 6 readings as a table, each with its meter photo (from the latest visit, or added here);
//   3 Save (stored on the claim, so the office and the technician see the same values);
//   4 last step: the PDF (Tata's page from these values, the readings table, the other photos).
// The battery section is not asked: on-grid rooftop, left blank (still an open question).
//
// Props: issue, claim, canEdit (office, or the technician on the open job), canAddPhotos (the
// technician on the open job: only they can add complaint photos), office (saves directly; the
// technician saves through service_oem_form), userId, userName, technicianName, onClose, onSaved.

const SECTIONS = ['Customer and system', 'General checks', 'Report'];
const sectionOf = field => field.section || 'Customer and system';
const filled = value => String(value ?? '').trim() !== '';

function Field({ field, value, auto, disabled, onChange }) {
    const empty = !filled(value);
    const id = `tata-${field.key}`;
    const box = `w-full rounded-xl border-2 bg-white px-3 text-base text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:bg-stone-50 disabled:text-stone-600 ${empty ? 'border-red-300' : 'border-stone-200'}`;
    return <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={id} className="text-sm font-bold text-stone-800">{field.label}</label>
            {empty
                ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700">Missing, fill in</span>
                : auto && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-500">From CRM</span>}
        </div>
        {field.type === 'long'
            ? <textarea id={id} rows={3} maxLength={1500} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className={`${box} py-2`} />
            : <input id={id} value={value} disabled={disabled} maxLength={200} onChange={event => onChange(event.target.value)} placeholder={field.hint || ''}
                {...(field.type === 'number' ? { inputMode: 'decimal' } : {})} className={`${box} min-h-12`} />}
    </div>;
}

export default function TataClaimForm({ issue, claim, canEdit = false, canAddPhotos = false, office = false, userId = null, userName = '', technicianName = '', onClose, onSaved }) {
    const [data, setData] = useState(null);
    const [loadFailed, setLoadFailed] = useState('');
    const [form, setForm] = useState(null);
    const [savedValues, setSavedValues] = useState(claim.form_values || null);
    const [dirty, setDirty] = useState(false);
    const [working, setWorking] = useState('');
    const [message, setMessage] = useState(null);
    const [viewing, setViewing] = useState(null);
    const [again, setAgain] = useState(0);

    useEffect(() => {
        let active = true;
        loadClaimData({ issue }).then(next => {
            if (!active) return;
            setData(next); setLoadFailed('');
            // Start once; after a photo is added only the photos are read again.
            setForm(current => current || mergeTataForm({ issue, claim, card: next.card, visit: next.visit, technicianName, saved: claim.form_values || null }));
        }, () => { if (active) setLoadFailed('Could not load the complaint. Check the internet.'); });
        return () => { active = false; };
        // claim and technicianName only start the form: a later refresh must not wipe typing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [issue.id, again]);

    useEffect(() => {
        const key = event => { if (event.key === 'Escape' && !working) onClose(); };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [onClose, working]);

    const progress = useMemo(() => (form ? tataFormProgress(form) : null), [form]);
    const photos = data?.readingPhotos || {};
    const photoCount = Object.keys(READING_LABELS).filter(key => photos[key]).length;

    const setField = (key, value) => { setForm(current => ({ ...current, fields: { ...current.fields, [key]: value }, auto: { ...current.auto, [key]: false } })); setDirty(true); };
    const setReading = (key, value) => { setForm(current => ({ ...current, readings: { ...current.readings, [key]: value } })); setDirty(true); };
    const setFloating = value => { setForm(current => ({ ...current, floating: value })); setDirty(true); };

    // Stores the values on the claim. Returns the stored values, or null when it failed.
    const save = async () => {
        const values = tataFormToSave(form, userName);
        const { error } = office
            ? await supabase.from('service_oem_claims').update({ form_values: values }).eq('id', claim.id)
            : await supabase.rpc('service_oem_form', { p_claim_id: claim.id, p_values: values });
        if (error) {
            const notReady = ['42703', 'PGRST202', '42883'].includes(error.code) || /form_values|could not find the function/i.test(error.message || '');
            throw new Error(notReady ? 'Saving the Tata form is not set up yet (database update not run). Tell the office.' : (error.message || 'The form was not saved. Try again.'));
        }
        setSavedValues(values); setDirty(false);
        onSaved?.();
        return values;
    };
    const doSave = async () => {
        setWorking('save'); setMessage(null);
        try { await save(); setMessage({ ok: true, text: 'Saved. The office sees the same values.' }); } catch (failure) { setMessage({ ok: false, text: failure.message }); } finally { setWorking(''); }
    };

    const addPhoto = async (key, input) => {
        const file = input.files?.[0];
        input.value = '';
        if (!file || working) return;
        setWorking(`photo:${key}`); setMessage(null);
        try {
            const old = photos[key]?.source === 'claim' && photos[key].uploaded_by === userId ? photos[key] : null;
            await saveClaimReadingPhoto({ issueId: issue.id, userId, label: claimReadingLabel(key), file, old });
            setMessage({ ok: true, text: `${READING_LABELS[key]} photo added.` });
            setAgain(n => n + 1);
        } catch (failure) {
            setMessage({ ok: false, text: `${READING_LABELS[key]}: ${photoError(failure)}` });
        } finally { setWorking(''); }
    };

    // Last step: save what was typed (if anything changed), then make the PDF.
    const pdf = async how => {
        setWorking(how); setMessage(null);
        try {
            const values = canEdit && dirty ? await save() : savedValues;
            const withValues = { ...claim, form_values: values || null };
            if (how === 'share') {
                if (!await shareOemClaimPdf({ issue, claim: withValues, technicianName })) return;
                setMessage({ ok: true, text: 'Tata report shared. When Tata has it, the office presses "PDF sent".' });
            } else {
                await downloadOemClaimPdf({ issue, claim: withValues, technicianName });
                setMessage({ ok: true, text: 'Tata report downloaded. Send it to Tata, then the office presses "PDF sent".' });
            }
        } catch (failure) {
            setMessage({ ok: false, text: failure?.message || 'The PDF could not be made. Try again.' });
        } finally { setWorking(''); }
    };

    const busy = Boolean(working);
    const button = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold disabled:opacity-50';
    return <div role="dialog" aria-modal="true" aria-label="Tata service report" className="fixed inset-0 z-[200] flex flex-col bg-stone-50">
        <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
            <div className="min-w-0 flex-1">
                <p className="text-base font-black text-stone-900">Tata service report</p>
                <p className="truncate text-xs text-stone-500">Complaint #{issue.ticket_no} · {claim.part} · {claim.oem}{claim.faulty_serial ? ` · ${claim.faulty_serial}` : ''}</p>
            </div>
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close the Tata form" className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-stone-100 disabled:opacity-40"><X size={20} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl space-y-4 p-4 pb-40">
                {loadFailed && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{loadFailed}
                    <button type="button" onClick={() => setAgain(n => n + 1)} className="min-h-10 rounded-lg border bg-white px-3 font-bold">Try again</button></p>}
                {!form ? (!loadFailed && <p className="text-sm text-stone-500">Loading…</p>) : <>
                    <section aria-label="Progress" className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
                        <p className="text-base font-black text-stone-900">{progress.filled} of {progress.total} boxes filled</p>
                        <p className={`text-xs font-bold ${progress.readings === progress.readingsTotal && photoCount === progress.readingsTotal ? 'text-emerald-700' : 'text-red-700'}`}>
                            Readings {progress.readings} of {progress.readingsTotal} · Photos {photoCount} of {progress.readingsTotal}</p>
                        <div className="h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.filled}>
                            <div className={`h-full rounded-full ${progress.filled === progress.total ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.round(progress.filled / progress.total * 100)}%` }} />
                        </div>
                        {progress.missing.length > 0 && <p className="text-xs text-stone-600"><span className="font-bold text-red-700">Missing:</span> {progress.missing.map(key => TATA_FIELDS.find(field => field.key === key).label).join(', ')}</p>}
                        {!canEdit && <p className="text-xs font-semibold text-stone-500">View only: the claim is closed, or this is not your job.</p>}
                        {savedValues?.saved_at && <p className="text-[11px] text-stone-400">Last saved {new Date(savedValues.saved_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}{savedValues.saved_by_name ? ` by ${savedValues.saved_by_name}` : ''}</p>}
                    </section>

                    {SECTIONS.map(section => <section key={section} aria-label={section} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-stone-500">{section}</h3>
                        {section === 'General checks' && <p className="rounded-lg bg-stone-50 p-2 text-xs text-stone-500">Battery boxes stay blank: on-grid rooftop, no battery.</p>}
                        {TATA_FIELDS.filter(field => sectionOf(field) === section).map(field => <Field key={field.key} field={field} value={form.fields[field.key]} auto={form.auto[field.key]}
                            disabled={!canEdit} onChange={value => setField(field.key, value)} />)}

                        {/* The 6 readings sit before the report boxes, as on the visit. */}
                        {section === 'General checks' && <div className="space-y-2 border-t border-stone-100 pt-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-stone-500">Readings with photos (volts)</h3>
                            <table className="w-full border-separate border-spacing-y-2 text-sm">
                                <thead className="sr-only"><tr><th>Reading</th><th>Volts</th><th>Photo</th></tr></thead>
                                <tbody>
                                    {READINGS.flatMap(([, fields]) => fields).map(([key]) => {
                                        const photo = photos[key];
                                        const value = form.readings[key];
                                        return <tr key={key} className="align-middle">
                                            <th scope="row" className="pr-2 text-left text-sm font-bold text-stone-800">{READING_LABELS[key]}</th>
                                            <td className="w-28 pr-2">
                                                <input value={value} disabled={!canEdit} inputMode="decimal" maxLength={20} aria-label={`${READING_LABELS[key]} volts`} placeholder="Missing"
                                                    onChange={event => setReading(key, event.target.value)}
                                                    className={`min-h-12 w-full rounded-xl border-2 px-3 text-base disabled:bg-stone-50 ${filled(value) ? 'border-stone-200' : 'border-red-300 placeholder:text-red-400'}`} />
                                            </td>
                                            <td className="w-24">
                                                {photo
                                                    ? <div className="flex items-center gap-1">
                                                        <button type="button" onClick={() => setViewing({ url: photo.url, label: `${READING_LABELS[key]} · ${value || '-'} V` })} aria-label={`Open ${READING_LABELS[key]} photo`}
                                                            className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">{photo.url && <img src={photo.url} alt="" className="h-full w-full object-cover" />}</button>
                                                        {canAddPhotos && <label className={`flex min-h-12 min-w-10 cursor-pointer items-center justify-center rounded-lg text-[11px] font-bold text-stone-500 ${busy ? 'pointer-events-none opacity-50' : ''}`}>New
                                                            <input type="file" accept="image/*" disabled={busy} onChange={event => addPhoto(key, event.target)} className="sr-only" aria-label={`Replace the ${READING_LABELS[key]} photo`} /></label>}
                                                    </div>
                                                    : canAddPhotos
                                                        ? <label className={`flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-red-300 text-[11px] font-bold text-red-700 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                                                            {working === `photo:${key}` ? 'Saving…' : <><Camera size={16} aria-hidden="true" />Add photo</>}
                                                            <input type="file" accept="image/*" disabled={busy} onChange={event => addPhoto(key, event.target)} className="sr-only" aria-label={`Add the ${READING_LABELS[key]} photo`} /></label>
                                                        : <span className="text-[11px] font-bold text-red-700">No photo</span>}
                                            </td>
                                        </tr>;
                                    })}
                                </tbody>
                            </table>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-stone-800">Floating voltage</span>
                                <div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1" role="group" aria-label="Floating voltage">
                                    {['Yes', 'No'].map(option => <button key={option} type="button" disabled={!canEdit} aria-pressed={form.floating === option} onClick={() => setFloating(option)}
                                        className={`min-h-10 min-w-14 rounded-lg text-sm font-bold ${form.floating === option ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>{option}</button>)}
                                </div>
                            </div>
                            {!canAddPhotos && photoCount < progress.readingsTotal && <p className="text-xs text-stone-500">Only the technician on the job can add the missing photos.</p>}
                        </div>}
                    </section>)}

                    <section aria-label="PDF" className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-stone-500">Last step: PDF for Tata</h3>
                        <p className="text-xs text-stone-500">Page 1 is Tata's own form with the values above, then the readings table with the 6 photos, then the other photos. Empty boxes and both signatures are left blank.</p>
                        <div className="grid grid-cols-2 gap-2">
                            {canShareFiles() && <button type="button" disabled={busy} onClick={() => pdf('share')} className={`${button} bg-stone-900 text-white`}><Share2 size={16} /> {working === 'share' ? 'Making PDF…' : 'Share (send to Tata)'}</button>}
                            <button type="button" disabled={busy} onClick={() => pdf('download')} className={`${button} border-2 border-stone-200 bg-white text-stone-800 ${canShareFiles() ? '' : 'col-span-2'}`}><FileDown size={16} /> {working === 'download' ? 'Making PDF…' : 'Download PDF'}</button>
                        </div>
                    </section>
                </>}
            </div>
        </div>

        {form && <footer className="border-t border-stone-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-2xl space-y-2">
                {message && <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg p-2 text-xs font-semibold ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}
                {canEdit && <button type="button" disabled={busy || (!dirty && Boolean(savedValues))} onClick={doSave} className={`${button} w-full bg-amber-500 text-white`}>
                    {working === 'save' ? 'Saving…' : !dirty && savedValues ? <><Check size={16} /> Saved</> : 'Save'}</button>}
            </div>
        </footer>}
        {viewing && <PhotoViewer url={viewing.url} label={viewing.label} onClose={() => setViewing(null)} />}
    </div>;
}
