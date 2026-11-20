import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, Eye, Paperclip, Upload } from 'lucide-react';
import { installPhotoStatus } from '../utils/installPhotos';
import CropPhotoModal from './CropPhotoModal';

// The 17 installation photos (client list, 2026-11-19) as big tappable slots, one per name,
// with a count (12/17) and the missing names. Used on the customer card (Installation Status)
// and in the vendor portal (Installation tab). Each photo is a customer document whose
// doc_type is the slot (src/utils/installPhotos.js); a retake replaces the slot's photo.
// D-041: the 17 are optional and never move the stage; only the geo tag photo does.
// D-043: #17 (Inverter serial number photo) is required: shown with a red * and "Required", and
// the Installation stage cannot be left without it (checked where the stage is moved).
//
// 2026-11-20 (Mahvish): every photo is checked before it is saved, and the page uses the site's
// own look: rows like the other document checklists (tick box, name, Uploaded / Not Uploaded,
// "Attach File / Photo", a file line with View and Change) and the site's "Check photo" screen
// (CropPhotoModal review) asking "Is this <name>, and is it clear?". After a photo is saved the
// list scrolls to the next missing one.
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
    // Called by the Check photo screen; true closes it, false keeps it open with its own message.
    const save = async file => {
        const slot = checking?.slot;
        if (!slot) return false;
        setAdding(slot.docType);
        try {
            const small = await shrinkPhoto(file);
            const stored = await onUpload(small, slot.docType);
            if (stored === false) return false;
            setLastSaved(slot.docType);
            // Point to the next photo still missing.
            const next = status.missing.find(m => m.docType !== slot.docType && m.number > slot.number) || status.missing.find(m => m.docType !== slot.docType);
            if (next) setTimeout(() => jump(next.docType), 150);
            return true;
        } catch (failure) {
            setProblem(`${slot.number}. ${slot.name}: ${failure?.message || 'the photo was not saved. Try again.'}`);
            return false;
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
                    <p className="mt-0.5 text-[11px] font-medium text-stone-500">{canUpload ? 'Attach each photo; you check it before it uploads.' : 'Photos taken by the installer.'} <span className="text-red-600">*</span> = required to finish installation.</p>
                </div>
                <p className={`text-lg font-bold tabular-nums ${allDone ? 'text-emerald-600' : 'text-stone-900'}`} aria-label={`${status.done} of ${status.total} photos taken`}>
                    {status.done}<span className="text-sm font-bold text-stone-400">/{status.total}</span>
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

        <ol className="flex flex-col divide-y divide-stone-100">
            {status.slots.map(slot => {
                const busy = adding === slot.docType;
                const url = slot.doc ? urls[slot.doc.storage_path] : '';
                const justSaved = lastSaved === slot.docType;
                const picker = <input type="file" accept="image/*" disabled={Boolean(adding) || Boolean(checking)} onChange={event => take(slot, event.target)} className="hidden"
                    aria-label={`${slot.doc ? 'Change' : 'Attach'} photo: ${slot.number}. ${slot.name}${slot.required ? ' (required)' : ''}`} />;
                return <li key={slot.docType} id={`install-photo-${slot.docType}`} className={`py-2 ${justSaved ? 'rounded-lg bg-emerald-50/60 px-2' : ''}`}>
                    <div className="flex items-center gap-2.5">
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${slot.doc ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-300 bg-stone-100 text-transparent'}`} aria-hidden="true">
                            {slot.doc && <svg className="h-2.5 w-2.5 stroke-current stroke-[3]" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                        </span>
                        <span className={`min-w-0 flex-1 break-words text-xs ${slot.doc ? 'font-bold text-stone-900' : 'font-medium text-stone-600'}`}>
                            {slot.number}. {slot.name}{slot.required && <span className="text-red-500"> *</span>}
                        </span>
                        {slot.doc
                            ? <span className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-1.5 text-[9px] font-bold text-emerald-700">Uploaded</span>
                            : <span className={`shrink-0 rounded px-1.5 text-[9px] font-bold ${slot.required ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-400'}`}>{slot.required ? 'Required' : 'Not Uploaded'}</span>}
                    </div>
                    <div className="ml-6.5 mt-1.5">
                        {slot.doc
                            ? <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-1.5">
                                <button type="button" onClick={() => onPreview?.(slot.doc)} className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-stone-100" aria-label={`Open photo: ${slot.number}. ${slot.name}`}>
                                    {url ? <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <Paperclip size={12} className="text-stone-400" aria-hidden="true" />}
                                    {busy && <span className="absolute inset-0 bg-white/70" />}
                                </button>
                                <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-stone-600">{busy ? 'Saving…' : slot.doc.file_name || 'Photo'}</span>
                                {onPreview && <button type="button" onClick={() => onPreview(slot.doc)} className="flex min-h-8 cursor-pointer items-center gap-0.5 rounded px-1.5 text-[10px] font-bold text-amber-600 hover:bg-amber-50 hover:text-amber-700"><Eye size={11} /> View</button>}
                                {canUpload && <label className={`flex min-h-8 cursor-pointer items-center gap-0.5 rounded px-1.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700 ${adding || checking ? 'pointer-events-none opacity-50' : ''}`}>
                                    <Upload size={11} /> Change{picker}
                                </label>}
                            </div>
                            : canUpload
                                ? <label className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-[11px] font-bold transition-all hover:border-amber-300 hover:bg-amber-50/30 hover:text-amber-600 ${slot.required ? 'border-red-300 text-red-600' : 'border-stone-200 text-stone-500'} ${adding || checking ? 'pointer-events-none opacity-50' : ''}`}>
                                    {busy ? 'Saving…' : <><Paperclip size={12} /> Attach File / Photo</>}{picker}
                                </label>
                                : <span className="text-[10px] italic text-stone-400">Not taken yet</span>}
                    </div>
                </li>;
            })}
        </ol>
        {checking && <CropPhotoModal review file={checking.file} useLabel="Upload"
            title={`Check photo ${checking.slot.number} of ${status.total}`}
            question={`Is this "${checking.slot.name}", and is it clear?`}
            onSave={save} onClose={() => { if (!adding) setChecking(null); }} />}
    </section>;
}
