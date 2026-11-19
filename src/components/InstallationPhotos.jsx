import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, RotateCcw } from 'lucide-react';
import { installPhotoStatus } from '../utils/installPhotos';

// The 17 installation photos (client list, 2026-11-19) as big tappable slots, one per name,
// with a count (12/17) and the missing names. Used on the customer card (Installation Status)
// and in the vendor portal (Installation tab). Each photo is a customer document whose
// doc_type is the slot (src/utils/installPhotos.js); a retake replaces the slot's photo.
// Nothing is blocked yet: whether all 17 are needed before the stage moves is still open.
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

    const take = async (slot, input) => {
        const file = input.files?.[0];
        input.value = '';
        if (!file || adding || !onUpload) return;
        setAdding(slot.docType);
        setProblem('');
        try {
            const small = await shrinkPhoto(file);
            const stored = await onUpload(small, slot.docType);
            if (stored === false) setProblem(`${slot.number}. ${slot.name}: the photo was not saved. Try again.`);
        } catch (failure) {
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
                    <p className="mt-0.5 text-[11px] font-medium text-stone-500">{canUpload ? 'Tap a box to take that photo.' : 'Photos taken by the installer.'}</p>
                </div>
                <p className={`text-2xl font-black tabular-nums ${allDone ? 'text-emerald-600' : 'text-stone-900'}`} aria-label={`${status.done} of ${status.total} photos taken`}>
                    {status.done}<span className="text-base font-bold text-stone-400">/{status.total}</span>
                </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={status.total} aria-valuenow={status.done}>
                <div className={`h-full rounded-full ${allDone ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${percent}%` }} />
            </div>
            {status.done === 0
                ? <p className="text-xs font-bold text-stone-600">No photos yet: {status.total} to take.</p>
                : allDone
                ? <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} aria-hidden="true" /> All {status.total} photos taken</p>
                : <div>
                    <p className="mb-1.5 text-[11px] font-bold text-stone-600">Missing ({status.missing.length}):</p>
                    <ul className="flex flex-wrap gap-1.5">
                        {status.missing.map(slot => <li key={slot.docType}>
                            <button type="button" onClick={() => jump(slot.docType)} className="min-h-8 rounded-full border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-bold text-amber-900">{slot.number}. {slot.name}</button>
                        </li>)}
                    </ul>
                </div>}
            {problem && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{problem}</p>}
        </div>

        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {status.slots.map(slot => {
                const busy = adding === slot.docType;
                const url = slot.doc ? urls[slot.doc.storage_path] : '';
                const picker = <input type="file" accept="image/*" disabled={Boolean(adding)} onChange={event => take(slot, event.target)} className="sr-only"
                    aria-label={`${slot.doc ? 'Retake' : 'Take'} photo: ${slot.number}. ${slot.name}`} />;
                const caption = <div className="flex items-start gap-1.5 p-2">
                    <span className={`mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-black ${slot.doc ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-700'}`}>{slot.number}</span>
                    <span className="text-[13px] font-bold leading-snug text-stone-900 break-words">{slot.name}</span>
                </div>;
                const frame = 'flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-stone-100';
                return <li key={slot.docType} id={`install-photo-${slot.docType}`}
                    className={`flex flex-col overflow-hidden rounded-2xl border-2 ${slot.doc ? 'border-emerald-300 bg-emerald-50/40' : 'border-dashed border-stone-300 bg-white'} ${adding && !busy ? 'opacity-60' : ''}`}>
                    {slot.doc
                        ? <button type="button" onClick={() => onPreview?.(slot.doc)} className={`${frame} relative`} aria-label={`Open photo: ${slot.number}. ${slot.name}`}>
                            {url ? <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <CheckCircle2 size={32} className="text-emerald-500" aria-hidden="true" />}
                            {busy && <span className="absolute inset-0 flex items-center justify-center bg-white/80 text-xs font-bold text-stone-700">Saving…</span>}
                        </button>
                        : canUpload
                            ? <label className={`${frame} cursor-pointer flex-col gap-1 text-stone-700 active:bg-amber-50`}>
                                {busy ? <span className="text-xs font-bold">Saving…</span> : <><Camera size={30} aria-hidden="true" /><span className="text-xs font-bold">Take photo</span></>}
                                {picker}
                            </label>
                            : <div className={`${frame} flex-col gap-1 text-stone-400`}><Camera size={26} aria-hidden="true" /><span className="text-[11px] font-bold">Not taken</span></div>}
                    {caption}
                    {slot.doc && canUpload && <label className={`mx-2 mb-2 mt-auto flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-700 ${adding ? 'pointer-events-none' : ''}`}>
                        <RotateCcw size={14} aria-hidden="true" /> Retake{picker}
                    </label>}
                </li>;
            })}
        </ol>
    </section>;
}
