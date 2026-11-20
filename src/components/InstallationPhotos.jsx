import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, ChevronRight, RotateCcw } from 'lucide-react';
import { installPhotoStatus } from '../utils/installPhotos';
import GeoTagConfirm from './GeoTagConfirm';

// The 17 installation photos (client list, 2026-11-19) as big tappable slots, one per name,
// with a count (12/17) and the missing names. Used on the customer card (Installation Status)
// and in the vendor portal (Installation tab). Each photo is a customer document whose
// doc_type is the slot (src/utils/installPhotos.js); a retake replaces the slot's photo.
// D-041: the 17 are optional and never move the stage; only the geo tag photo does.
// D-043: #17 (Inverter serial number photo) is required: shown with a red * and "Required", and
// the Installation stage cannot be left without it (checked where the stage is moved).
//
// 2026-11-20 (Mahvish): made for the phone (one big row per photo) and every photo is shown big
// with "Is this the <name> photo, and is it clear?" before it is saved (same screen as the geo tag
// check). Yes saves it and points to the next missing photo; No picks another; X saves nothing.
//
// Props:
//   documents   the customer's documents
//   canUpload   whether this person may add photos here
//   onUpload    async (file, docType) => true when stored
//   onPreview   (doc) => opens the photo
//   getUrl      async (doc) => a link for the small preview (optional)

const LONG_SIDE = 1600; // serial numbers and nut marks stay readable
const QUALITY = 0.8;

// Shrinks a phone photo before upload: about 1600 px on the long side, WebP where the phone
// can make it, else JPEG. Anything that cannot be redrawn is sent as it is.
async function shrinkPhoto(file) {
    if (!file?.type?.startsWith('image/') || typeof createImageBitmap !== 'function') return file;
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch { return file; }
    const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const encode = type => new Promise(resolve => canvas.toBlob(resolve, type, QUALITY));
    let blob = await encode('image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg');
    if (!blob || blob.size >= file.size) return file;
    const base = String(file.name || 'photo').replace(/\.[^/.]+$/, '');
    return new File([blob], `${base}${blob.type === 'image/webp' ? '.webp' : '.jpg'}`, { type: blob.type, lastModified: Date.now() });
}

export default function InstallationPhotos({ documents = [], canUpload = false, onUpload, onPreview, getUrl, className = '' }) {
    const status = useMemo(() => installPhotoStatus(documents), [documents]);
    const [adding, setAdding] = useState('');
    const [problem, setProblem] = useState('');
    const [urls, setUrls] = useState({});
    const [checking, setChecking] = useState(null); // { slot, file } picked, not saved yet
    const [lastSaved, setLastSaved] = useState('');

    // Small previews of the photos already taken.
    const pathsKey = status.slots.map(slot => slot.doc?.storage_path || '').join('|');
    useEffect(() => {
        if (!getUrl) return undefined;
        let active = true;
        const wanted = status.slots.map(slot => slot.doc).filter(doc => doc?.storage_path && !urls[doc.storage_path]);
        if (!wanted.length) return undefined;
        Promise.all(wanted.map(doc => Promise.resolve(getUrl(doc)).then(url => [doc.storage_path, url || ''], () => [doc.storage_path, ''])))
            .then(pairs => { if (active) setUrls(current => ({ ...current, ...Object.fromEntries(pairs) })); });
        return () => { active = false; };
        // urls is left out on purpose: a found link is never fetched again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathsKey, getUrl]);

    // Picking a photo only opens the check; nothing is saved until Yes.
    const take = (slot, input) => {
        const file = input.files?.[0];
        input.value = '';
        if (!file || adding || !onUpload) return;
        setProblem('');
        setChecking({ slot, file });
    };
    const save = async file => {
        const slot = checking?.slot;
        if (!slot) return;
        setAdding(slot.docType);
        try {
            const small = await shrinkPhoto(file);
            const stored = await onUpload(small, slot.docType);
            if (stored === false) { setChecking(null); setProblem(`${slot.number}. ${slot.name}: the photo was not saved. Try again.`); return; }
            setChecking(null);
            setLastSaved(slot.docType);
            // Point to the next photo still missing.
            const next = status.missing.find(m => m.docType !== slot.docType && m.number > slot.number) || status.missing.find(m => m.docType !== slot.docType);
            if (next) setTimeout(() => jump(next.docType), 150);
        } catch (failure) {
            setChecking(null);
            setProblem(`${slot.number}. ${slot.name}: ${failure?.message || 'the photo was not saved. Try again.'}`);
        } finally {
            setAdding('');
        }
    };

    const jump = docType => document.getElementById(`install-photo-${docType}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const allDone = status.done === status.total;
    const percent = Math.round((status.done / status.total) * 100);

    return <section aria-label="Installation photos" className={`space-y-4 rounded-[24px] border border-stone-100 bg-white p-4 shadow-sm sm:p-6 ${className}`}>
        <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-700"><Camera className="h-4 w-4 text-amber-500" aria-hidden="true" /> Installation photos</h4>
                    <p className="mt-0.5 text-[11px] font-medium text-stone-500">{canUpload ? 'Add each photo; you check it before it saves.' : 'Photos taken by the installer.'} <span className="text-red-600">*</span> = required to finish installation.</p>
                </div>
                <p className={`text-2xl font-black tabular-nums ${allDone ? 'text-emerald-600' : 'text-stone-900'}`} aria-label={`${status.done} of ${status.total} photos taken`}>
                    {status.done}<span className="text-base font-bold text-stone-400">/{status.total}</span>
                </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={status.total} aria-valuenow={status.done}>
                <div className={`h-full rounded-full ${allDone ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${percent}%` }} />
            </div>
            {status.requiredMissing.length > 0 && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-bold text-red-700">
                Required: {status.requiredMissing.map(slot => `${slot.number}. ${slot.name}`).join(', ')}. The customer cannot leave Installation without it.
            </p>}
            {status.done === 0
                ? <p className="text-xs font-bold text-stone-600">No photos yet: {status.total} to take.</p>
                : allDone
                ? <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} aria-hidden="true" /> All {status.total} photos taken</p>
                : <div>
                    <p className="mb-1.5 text-[11px] font-bold text-stone-600">Missing ({status.missing.length}):</p>
                    <ul className="flex flex-wrap gap-1.5">
                        {status.missing.map(slot => <li key={slot.docType}>
                            <button type="button" onClick={() => jump(slot.docType)} className={`min-h-8 rounded-full border px-2.5 text-[11px] font-bold ${slot.required ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{slot.number}. {slot.name}{slot.required && <><span aria-hidden="true"> *</span><span className="sr-only"> (required)</span></>}</button>
                        </li>)}
                    </ul>
                </div>}
            {problem && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{problem}</p>}
        </div>

        <ol className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {status.slots.map(slot => {
                const busy = adding === slot.docType;
                const url = slot.doc ? urls[slot.doc.storage_path] : '';
                const picker = <input type="file" accept="image/*" disabled={Boolean(adding) || Boolean(checking)} onChange={event => take(slot, event.target)} className="sr-only"
                    aria-label={`${slot.doc ? 'Change' : 'Add'} photo: ${slot.number}. ${slot.name}${slot.required ? ' (required)' : ''}`} />;
                const justSaved = lastSaved === slot.docType;
                return <li key={slot.docType} id={`install-photo-${slot.docType}`}
                    className={`flex items-start gap-3 rounded-2xl border-2 p-3 ${slot.doc ? 'border-emerald-300 bg-emerald-50/50' : slot.required ? 'border-dashed border-red-400 bg-white' : 'border-dashed border-stone-300 bg-white'} ${justSaved ? 'ring-2 ring-emerald-400' : ''} ${adding && !busy ? 'opacity-60' : ''}`}>
                    {slot.doc
                        ? <button type="button" onClick={() => onPreview?.(slot.doc)} className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100" aria-label={`Open photo: ${slot.number}. ${slot.name}`}>
                            {url ? <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <CheckCircle2 size={28} className="text-emerald-500" aria-hidden="true" />}
                            {busy && <span className="absolute inset-0 flex items-center justify-center bg-white/80 text-[11px] font-bold text-stone-700">Saving…</span>}
                        </button>
                        : <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl ${slot.required ? 'bg-red-50 text-red-500' : 'bg-stone-100 text-stone-400'}`}>
                            {busy ? <span className="text-[11px] font-bold text-stone-700">Saving…</span> : <Camera size={28} aria-hidden="true" />}
                        </span>}
                    <div className="min-w-0 flex-1">
                        <p className="flex items-start gap-1.5 text-[15px] font-bold leading-snug text-stone-900">
                            <span className={`mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-black ${slot.doc ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-700'}`}>{slot.number}</span>
                            <span className="break-words">{slot.name}{slot.required && <span className="text-red-600" aria-hidden="true"> *</span>}</span>
                        </p>
                        <p className={`mt-1 text-xs font-semibold ${slot.doc ? 'text-emerald-700' : slot.required ? 'text-red-700' : 'text-stone-500'}`}>
                            {slot.doc ? (justSaved ? 'Saved just now ✓' : 'Saved ✓') : slot.required ? 'Required: not added yet' : 'Not added yet'}
                        </p>
                        {canUpload && <label className={`mt-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-4 text-sm font-bold ${slot.doc ? 'border border-stone-200 bg-white text-stone-700' : 'bg-stone-900 text-white'} ${adding || checking ? 'pointer-events-none opacity-50' : ''}`}>
                            {slot.doc ? <><RotateCcw size={15} aria-hidden="true" /> Change photo</> : <>Add photo <ChevronRight size={16} aria-hidden="true" /></>}
                            {picker}
                        </label>}
                    </div>
                </li>;
            })}
        </ol>
        {checking && <GeoTagConfirm file={checking.file} title={`Photo ${checking.slot.number} of ${status.total}`}
            question={`Is this "${checking.slot.name}", and is it clear?`}
            note={`Yes saves it as photo ${checking.slot.number}. ${checking.slot.name}.`}
            onYes={save} onPickAnother={file => setChecking(current => current && { ...current, file })} onCancel={() => { if (!adding) setChecking(null); }} />}
    </section>;
}
