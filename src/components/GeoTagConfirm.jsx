import { useEffect, useState } from 'react';
import { Check, FileText, Upload, X } from 'lucide-react';

// Geo tag photo check before anything is saved (D-042, 2026-11-19). The picked photo is shown
// big with one question. Yes = upload it; the caller then moves the stage as before (D-034).
// No, upload another = the photo is thrown away (never uploaded) and the gallery / file picker
// opens again (staff pick a photo already taken with a geo tag camera app; no capture attribute).
// Cancel = thrown away, nothing changes. So an unconfirmed photo never reaches the database
// and can never move the stage.
//
// Props: file (picked, not uploaded), onYes(file) -> Promise, onPickAnother(newFile), onCancel(),
// accept (file types for the picker, default images). Also used for each installation photo
// (2026-11-20): title, question and note then describe that photo.

export const GEO_TAG_QUESTION = 'Can you see the geo tag (location, date, time) clearly on this photo?';

export default function GeoTagConfirm({ file, onYes, onPickAnother, onCancel, accept = 'image/*',
    title = 'Check the geo tag photo', question = GEO_TAG_QUESTION,
    note = 'Yes saves the photo. At the Geo Tag Photo stage the customer then moves to Discom Submission.' }) {
    const [src, setSrc] = useState('');
    const [saving, setSaving] = useState(false);
    const isImage = /^image\//i.test(file?.type || '');

    useEffect(() => {
        if (!file || !isImage) { setSrc(''); return undefined; }
        const url = URL.createObjectURL(file);
        setSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [file, isImage]);

    useEffect(() => {
        const key = event => { if (event.key === 'Escape' && !saving) onCancel(); };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [onCancel, saving]);

    const yes = async () => {
        if (saving) return;
        setSaving(true);
        try { await onYes(file); } finally { setSaving(false); }
    };
    const pickAnother = input => {
        const next = input.files?.[0];
        input.value = '';
        if (next) onPickAnother(next);
    };

    return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[300] flex flex-col bg-stone-950">
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
            <p className="text-sm font-bold">{title}</p>
            <button type="button" onClick={onCancel} disabled={saving} aria-label="Cancel, do not save this photo"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-40"><X size={20} /></button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-2">
            {isImage
                ? (src && <img src={src} alt="The photo you picked" className="max-h-full max-w-full rounded-lg object-contain" />)
                : <div className="flex flex-col items-center gap-2 text-white/80"><FileText size={48} aria-hidden="true" /><p className="max-w-xs break-words text-center text-sm">{file?.name}</p><p className="text-xs text-white/60">Open the file to check it before you say Yes.</p></div>}
        </div>
        <div className="space-y-3 rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:mx-auto sm:mb-4 sm:w-full sm:max-w-md sm:rounded-3xl">
            <p className="text-base font-black leading-snug text-stone-900">{question}</p>
            {note && <p className="text-xs text-stone-500">{note}</p>}
            <div className="grid grid-cols-2 gap-2">
                <label aria-disabled={saving || undefined}
                    className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-stone-300 bg-white text-sm font-bold text-stone-800 ${saving ? 'pointer-events-none opacity-40' : ''}`}>
                    <Upload size={18} aria-hidden="true" /> No, upload another
                    <input type="file" accept={accept} disabled={saving} onChange={event => pickAnother(event.target)} className="sr-only" aria-label="No, upload another photo" />
                </label>
                <button type="button" onClick={yes} disabled={saving}
                    className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-60">
                    <Check size={18} aria-hidden="true" /> {saving ? 'Saving…' : 'Yes, save'}
                </button>
            </div>
        </div>
    </div>;
}
