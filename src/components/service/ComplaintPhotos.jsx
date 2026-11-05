import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { compressImage } from '../../utils';
import {
    PHOTO_KINDS, PHOTO_KIND_LABELS, PHOTO_LIMIT, SITE_PHOTO_LABELS, PHOTO_LONG_SIDE, PHOTO_MAX_BYTES,
    canDeletePhoto, canUploadPhotos, formatDateTime, groupIssueFiles, isPhotoType, missingTable,
    photoCounts, photoError, photoPath, pickPhotos, plainError
} from './serviceLabels';

const BUCKET = 'service-issues';
const LINK_SECONDS = 600;
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

// Signed links (10 min) by storage path, reused until 2 minutes before they run
// out, so the 15-second complaint reload does not download every photo again.
const links = new Map();
async function signedLinks(paths) {
    const now = Date.now();
    const stale = paths.filter(path => !(links.get(path)?.until > now + 120000));
    if (stale.length) {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(stale, LINK_SECONDS);
        if (error) throw error;
        for (const row of data || []) if (row?.signedUrl && !row.error) links.set(row.path, { url: row.signedUrl, until: now + LINK_SECONDS * 1000 });
    }
    return Object.fromEntries(paths.map(path => [path, links.get(path)?.url || '']));
}

// Shrinks a phone photo (about 1600 px, JPEG) before it is sent.
async function shrink(file) {
    const small = await compressImage(file, { maxWidth: PHOTO_LONG_SIDE, maxHeight: PHOTO_LONG_SIDE, quality: 0.8 });
    if (!isPhotoType(small?.type)) throw plainError('Only JPG, PNG or WebP photos can be added. Use Take photo instead.');
    if (small.size > PHOTO_MAX_BYTES) throw plainError('The photo is too large.');
    return small;
}

// One photo: into storage at {issue}/{me}/{kind}-{id}.jpg, then its row. A row
// that cannot be saved takes its file back out of storage.
async function addPhoto(issueId, userId, kind, file, label = null) {
    const small = await shrink(file);
    const path = photoPath(issueId, userId, kind, newId(), small.type);
    const uploaded = await supabase.storage.from(BUCKET).upload(path, small, { upsert: false, contentType: small.type, cacheControl: '3600' });
    if (uploaded.error) throw uploaded.error;
    const saved = await supabase.from('service_issue_files').insert({
        issue_id: issueId, storage_path: path, file_name: String(file.name || `${kind}.jpg`).slice(0, 200),
        mime_type: small.type, uploaded_by: userId, kind, ...(label ? { label } : {})
    });
    if (saved.error) {
        await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
        throw saved.error;
    }
}

// "Take photo" (camera) or "Add from gallery" (several at once): a label around a hidden file input.
function PickButton({ camera = false, strong = camera, label, disabled, onFiles }) {
    const Icon = camera ? Camera : ImagePlus;
    return <label aria-disabled={disabled || undefined}
        className={`inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold ${strong ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-700'} ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <Icon size={16} aria-hidden="true" />{label}
        <input type="file" accept="image/*" {...(camera ? { capture: 'environment' } : { multiple: true })} disabled={disabled}
            onChange={event => onFiles(event.target)} className="sr-only" />
    </label>;
}

// Delete with an inline "are you sure".
function DeleteButton({ asking, busy, onAsk, onCancel, onDelete }) {
    if (!asking) return <button type="button" disabled={busy} onClick={onAsk} className="min-h-9 w-full rounded-lg text-[11px] font-bold text-stone-400 hover:text-red-700 disabled:opacity-50">Delete</button>;
    return <div className="space-y-1">
        <button type="button" disabled={busy} onClick={onDelete} className="min-h-11 w-full rounded-lg bg-red-600 px-2 text-xs font-bold text-white disabled:opacity-50">Yes, delete</button>
        <button type="button" onClick={onCancel} className="min-h-11 w-full rounded-lg border px-2 text-xs font-bold">Keep</button>
    </div>;
}

function PhotoViewer({ url, label, onClose }) {
    useEffect(() => {
        const key = event => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [onClose]);
    return <div role="dialog" aria-modal="true" aria-label={label} onClick={onClose} className="fixed inset-0 z-[70] flex flex-col bg-black/90 p-3">
        <div className="flex items-center justify-between gap-2 text-white">
            <p className="min-w-0 text-sm font-semibold break-words">{label}</p>
            <button type="button" onClick={onClose} aria-label="Close photo" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/15"><X size={22} /></button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center pt-2">
            {url ? <img src={url} alt={label} onClick={event => event.stopPropagation()} className="max-h-full max-w-full object-contain" />
                : <p className="text-sm text-white">The photo is loading. Try again in a moment.</p>}
        </div>
    </div>;
}

// Before / After photos of one complaint, and older files from the raise form.
// Only the technician on an open job adds photos (up to 10 of each kind); office
// (admin / sales) can delete a wrong one, the technician their own while the job
// is open; everyone else who can see the complaint only views them. The database
// rules check all of this again. Reloads whenever `issue` changes (the complaint
// list reloads every 15 seconds) and tells the parent the counts (onCounts).
export default function ComplaintPhotos({ issue, userId, userType, busy, run, onCounts, reloadKey = 0 }) {
    const [files, setFiles] = useState(null);
    const [urls, setUrls] = useState({});
    // '' or why the photo list could not be read.
    const [loadFailed, setLoadFailed] = useState('');
    const [reload, setReload] = useState(0);
    const [progress, setProgress] = useState(null);
    const [problems, setProblems] = useState({});
    const [confirmId, setConfirmId] = useState(null);
    const [viewing, setViewing] = useState(null);
    const issueId = issue.id;
    const canUpload = canUploadPhotos(issue, userId, userType);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data, error } = await supabase.from('service_issue_files')
                .select('id, file_name, storage_path, mime_type, uploaded_by, kind, label, created_at')
                .eq('issue_id', issueId).order('created_at');
            if (!active) return;
            // A missing table or kind / label column: the 23 Oct or 5 Nov SQL has not been run yet.
            if (error) { setLoadFailed(missingTable(error) ? 'Photos are not set up yet. Ask the office.' : 'Could not load the photos. Check the internet.'); return; }
            setFiles(data || []); setLoadFailed('');
            try {
                const next = await signedLinks((data || []).map(file => file.storage_path));
                if (active) setUrls(next);
            } catch { /* thumbnails are tried again at the next reload */ }
        })();
        return () => { active = false; };
    }, [issueId, issue, reload, reloadKey]);

    const countsTo = useRef(onCounts);
    useEffect(() => { countsTo.current = onCounts; });
    useEffect(() => { countsTo.current?.(files ? photoCounts(files) : null); }, [files]);

    const groups = files ? groupIssueFiles(files) : null;

    const addPhotos = (kind, input) => {
        const chosen = [...(input?.files || [])];
        if (input) input.value = '';
        if (!chosen.length || !groups || !run) return;
        const label = PHOTO_KIND_LABELS[kind];
        const { take, skipped } = pickPhotos(chosen, groups[kind].length);
        const skippedRows = skipped.map(file => ({ name: file.name || 'Photo', reason: `Only ${PHOTO_LIMIT} ${label} photos are allowed.` }));
        if (!take.length) { setProblems(current => ({ ...current, [kind]: skippedRows })); return; }
        setProblems(current => ({ ...current, [kind]: [] }));
        run(async () => {
            const failures = [];
            let added = 0;
            try {
                for (const [index, file] of take.entries()) {
                    setProgress({ kind, done: index, total: take.length });
                    try { await addPhoto(issueId, userId, kind, file); added += 1; }
                    catch (failure) { failures.push({ name: file.name || `Photo ${index + 1}`, reason: photoError(failure) }); }
                }
            } finally {
                setProgress(null);
                setReload(n => n + 1);
            }
            failures.push(...skippedRows);
            setProblems(current => ({ ...current, [kind]: failures }));
            if (!added) throw new Error(`No ${label} photo was added. ${failures[0]?.reason || ''}`.trim());
            return failures.length
                ? `${plural(added, `${label} photo`)} added. ${failures.length} not added: see the list under ${label} photos.`
                : `${plural(added, `${label} photo`)} added.`;
        }, '', 'issue');
    };

    // One named site photo (Panels, Inverter, ...): replaces nothing, one per name.
    const addSitePhoto = (label, input) => {
        const file = input?.files?.[0];
        if (input) input.value = '';
        if (!file || !run) return;
        run(async () => {
            setProgress({ kind: 'site', label, done: 0, total: 1 });
            try { await addPhoto(issueId, userId, 'site', file, label); }
            catch (failure) { throw new Error(photoError(failure)); }
            finally { setProgress(null); setReload(n => n + 1); }
            return `${label} photo added.`;
        }, '', 'issue');
    };

    const remove = file => run?.(async () => {
        const { data, error } = await supabase.from('service_issue_files').delete().eq('id', file.id).select('id');
        if (error) throw new Error(photoError(error));
        if (!data?.length) throw new Error('This photo could not be deleted. The job may be closed, or the photo is already gone.');
        // The row is gone; a file left in storage is only wasted space.
        await supabase.storage.from(BUCKET).remove([file.storage_path]).catch(() => {});
        links.delete(file.storage_path);
        setConfirmId(null);
        setReload(n => n + 1);
        return 'Photo deleted.';
    }, '', 'issue');

    const deleteFor = file => canDeletePhoto(file, issue, userId, userType) && run
        ? <DeleteButton asking={confirmId === file.id} busy={busy} onAsk={() => setConfirmId(file.id)} onCancel={() => setConfirmId(null)} onDelete={() => remove(file)} />
        : null;

    const label = 'text-xs font-bold uppercase tracking-wider text-stone-500';
    return <section aria-label="Photos" className={canUpload ? 'space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm' : 'space-y-3 border-t pt-3'}>
        <h3 className={label}>Photos</h3>
        {loadFailed && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-900">
            {loadFailed}
            <button type="button" onClick={() => setReload(n => n + 1)} className="min-h-10 rounded-lg border bg-white px-3 font-bold">Try again</button>
        </p>}
        {!groups ? (!loadFailed && <p className="text-xs text-stone-400">Loading photos…</p>) : <>
            {PHOTO_KINDS.map(kind => {
                const kindLabel = PHOTO_KIND_LABELS[kind];
                const photos = groups[kind];
                const full = photos.length >= PHOTO_LIMIT;
                const uploading = progress?.kind === kind;
                if (!canUpload && !photos.length) return null;
                return <div key={kind} className="space-y-2">
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold">{kindLabel}</h4>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${kind === 'after' ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-500'}`}>{kind === 'after' ? 'Required' : 'Optional'}</span>
                        <span className="ml-auto text-xs text-stone-400">{photos.length}/{PHOTO_LIMIT}</span>
                    </div>
                    {canUpload && kind === 'before' && !photos.length && <p className="text-xs text-stone-400">Only if something was damaged when you arrived.</p>}
                    {photos.length > 0 && <ul className="grid grid-cols-4 gap-2">{photos.map((photo, index) => {
                        const name = `${kindLabel} photo ${index + 1} of ${photos.length}`;
                        return <li key={photo.id} className="min-w-0 space-y-1">
                            <button type="button" aria-label={`Open ${name}`} onClick={() => setViewing({ path: photo.storage_path, label: [name, formatDateTime(photo.created_at)].filter(Boolean).join(' · ') })}
                                className="block w-full overflow-hidden rounded-xl bg-stone-100">
                                {urls[photo.storage_path]
                                    ? <img src={urls[photo.storage_path]} alt={name} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                                    : <span className="flex aspect-square w-full items-center justify-center text-[11px] text-stone-400">…</span>}
                            </button>
                            {deleteFor(photo)}
                        </li>;
                    })}</ul>}
                    {canUpload && !full && <div className="grid grid-cols-2 gap-2">
                        <PickButton camera strong={kind === 'after'} label="Camera" disabled={busy} onFiles={input => addPhotos(kind, input)} />
                        <PickButton label="Gallery" disabled={busy} onFiles={input => addPhotos(kind, input)} />
                    </div>}
                    {uploading && <p role="status" className="text-xs font-semibold text-stone-500">Adding {progress.done + 1} of {progress.total}…</p>}
                    {problems[kind]?.length > 0 && <ul role="alert" className="space-y-1 rounded-xl bg-red-50 p-2 text-xs text-red-800">
                        {problems[kind].map((problem, index) => <li key={index} className="break-words"><strong>{problem.name}:</strong> {problem.reason}</li>)}
                    </ul>}
                </div>;
            })}
            <SitePhotos photos={groups.site} urls={urls} canUpload={canUpload} busy={busy} progress={progress}
                onView={setViewing} deleteFor={deleteFor} onAdd={(siteLabel, input) => addSitePhoto(siteLabel, input)} />
            {groups.problem.length > 0 && <div className="space-y-1">
                <h4 className="text-xs font-bold text-stone-600">Files added when the complaint was raised ({groups.problem.length})</h4>
                <ul className="space-y-1">{groups.problem.map(file => {
                    const remover = deleteFor(file);
                    return <li key={file.id} className="flex flex-wrap items-center gap-x-3">
                        <a href={urls[file.storage_path] || undefined} target="_blank" rel="noopener noreferrer"
                            className="inline-flex min-h-11 min-w-0 items-center text-sm font-semibold text-blue-700 underline break-all">{file.file_name}</a>
                        {remover && <span className="w-28">{remover}</span>}
                    </li>;
                })}</ul>
            </div>}
        </>}
        {viewing && <PhotoViewer url={urls[viewing.path] || ''} label={viewing.label} onClose={() => setViewing(null)} />}
    </section>;
}

// The installation's named photos: one slot per name (SITE_PHOTO_LABELS), all optional.
function SitePhotos({ photos, urls, canUpload, busy, progress, onView, deleteFor, onAdd }) {
    const byLabel = new Map(photos.map(photo => [photo.label || 'Other', photo]));
    const extra = photos.filter(photo => !SITE_PHOTO_LABELS.includes(photo.label));
    if (!canUpload && !photos.length) return null;
    return <div className="space-y-2">
        <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold">Installation</h4>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">Optional</span>
            <span className="ml-auto text-xs text-stone-400">{photos.length}/{SITE_PHOTO_LABELS.length}</span>
        </div>
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">{[...SITE_PHOTO_LABELS.filter(name => canUpload || byLabel.has(name)), ...extra.map(photo => photo.label || 'Other')].map(name => {
            const photo = byLabel.get(name);
            const adding = progress?.kind === 'site' && progress.label === name;
            return <li key={name} className="min-w-0">
                {photo
                    ? <button type="button" aria-label={`Open ${name} photo`} onClick={() => onView({ path: photo.storage_path, label: [name, formatDateTime(photo.created_at)].filter(Boolean).join(' · ') })}
                        className="block w-full overflow-hidden rounded-xl bg-stone-100">
                        {urls[photo.storage_path]
                            ? <img src={urls[photo.storage_path]} alt={name} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                            : <span className="flex aspect-square w-full items-center justify-center text-[11px] text-stone-400">…</span>}
                    </button>
                    : <label aria-label={`Take ${name} photo`} aria-disabled={busy || undefined} className={`flex aspect-square w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-stone-300 text-stone-400 hover:border-amber-400 hover:text-amber-600 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                        {adding ? <span className="text-[10px] font-bold">…</span> : <Camera size={18} aria-hidden="true" />}
                        <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={event => onAdd(name, event.target)} className="sr-only" />
                    </label>}
                <p className="mt-1 text-center text-[10px] font-semibold leading-tight text-stone-500 break-words">{name}</p>
                {photo && deleteFor(photo)}
            </li>;
        })}</ul>
    </div>;
}
