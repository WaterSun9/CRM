import { useMemo, useState } from 'react';
import { Camera, CheckCircle2 } from 'lucide-react';
import { installPhotoStatus } from '../utils/installPhotos';
import { CheckboxRemarkItem } from './modal-tabs/shared';

// The 17 installation photos (client list, 2026-11-19), with a count (12/17) and the missing names.
// Used on the customer card (Installation Status) and in the vendor portal (Installation tab).
// Each photo is a customer document whose doc_type is the slot (src/utils/installPhotos.js).
// D-041: the 17 are optional and never move the stage; only the geo tag photo does.
// D-043: #17 (Inverter serial number photo) is required to leave Installation.
//
// 2026-11-20 (Mahvish): each photo is the site's own upload row (CheckboxRemarkItem), so it works
// like every other uploaded photo: the Check photo screen before upload ("Check photo 9 of 17 -
// Is this ..., and is it clear?"), View, a remark, and for the office (canDelete) Change, Delete and
// Send Back. A partner or vendor cannot change an uploaded photo until the office sends it back; a
// sent-back photo counts as missing until it is replaced.
//
// Props:
//   documents       the customer's documents
//   canUpload       whether this person may add photos here
//   onUpload        (event, docType, replacingDocId) => truthy when stored (same as other uploads)
//   onDelete        (doc) => office only
//   onPreview       (doc) => opens the photo
//   onUpdateRemark  (docId, remark) => true when saved (Send Back, remarks, replaced copies)
//   canDelete       office (admin / office staff): Change, Delete and Send Back

// Phone photos are shrunk before upload (about 1600 px, WebP or JPEG) so they go up fast on site.
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

export default function InstallationPhotos({ documents = [], canUpload = false, onUpload, onDelete, onPreview, onUpdateRemark, canDelete = false, className = '' }) {
    const status = useMemo(() => installPhotoStatus(documents), [documents]);
    const [lastSaved, setLastSaved] = useState('');

    const jump = docType => document.getElementById(`install-photo-${docType}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // After a photo is stored, point to the next one still missing.
    const saved = slot => {
        setLastSaved(slot.docType);
        const next = status.missing.find(m => m.docType !== slot.docType && m.number > slot.number) || status.missing.find(m => m.docType !== slot.docType);
        if (next) setTimeout(() => jump(next.docType), 150);
    };
    const upload = async (event, docType, replacingDocId) => {
        const file = event?.target?.files?.[0];
        if (!file || !onUpload) return false;
        const small = await shrinkPhoto(file);
        return onUpload({ target: { files: [small], value: '' } }, docType, replacingDocId);
    };
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
        </div>

        <ol className="flex flex-col divide-y divide-stone-100">
            {status.slots.map(slot => <li key={slot.docType} id={`install-photo-${slot.docType}`} className={`py-1 ${lastSaved === slot.docType ? 'rounded-lg bg-emerald-50/60 px-2' : ''}`}>
                <CheckboxRemarkItem
                    label={`${slot.number}. ${slot.name}${slot.required ? ' *' : ''}`}
                    field={slot.docType}
                    value={Boolean(slot.doc)}
                    onChange={(field, uploaded) => { if (uploaded) saved(slot); }}
                    isEditing={canUpload}
                    documents={documents}
                    onUpload={upload}
                    onDelete={onDelete}
                    onPreview={onPreview}
                    onUpdateRemark={onUpdateRemark}
                    canDelete={canDelete}
                    reviewTitle={`Check photo ${slot.number} of ${status.total}`}
                    reviewQuestion={`Is this "${slot.name}", and is it clear?`}
                />
            </li>)}
        </ol>
    </section>;
}
