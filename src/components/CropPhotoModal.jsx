import { useEffect, useRef, useState } from 'react';
import { RotateCw, RefreshCcw, X } from 'lucide-react';
import { getViewUrl } from '../utils';

// Crop a stored photo and save it as a replacement.
//
// The photo is downloaded as a blob and shown from a local blob: URL. Drawing
// a remote <img> onto a canvas fails ("tainted canvas") whenever the browser
// reuses a cached copy that was fetched without CORS, which is how the old
// version could fail at Save with nothing ever reaching storage. A local blob
// can always be exported.
//
// Drag on the photo to draw the crop box, drag inside the box to move it.
const MIN = 0.03;
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const FULL = { x: 0, y: 0, w: 1, h: 1 };

// doc: a stored document (downloaded first). file: a photo picked on this
// device and not uploaded yet (Add Lead) - used directly.
export default function CropPhotoModal({ doc, file, onSave, onClose }) {
    const frameRef = useRef(null);
    const imageRef = useRef(null);
    const dragRef = useRef(null);
    const objectUrlRef = useRef(null);
    const [src, setSrc] = useState('');
    const [rect, setRect] = useState(FULL);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rotated, setRotated] = useState(false);

    const showBlob = (blob) => {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(blob);
        setSrc(objectUrlRef.current);
    };

    useEffect(() => {
        let live = true;
        (async () => {
            try {
                if (file) { if (live) showBlob(file); return; }
                const url = await getViewUrl(doc.storage_path);
                if (!url) throw new Error('The photo could not be opened.');
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) throw new Error(`The photo could not be downloaded (${response.status}).`);
                const blob = await response.blob();
                if (live) showBlob(blob);
            } catch (err) {
                if (live) setError(err.message || 'The photo could not be opened.');
            } finally {
                if (live) setLoading(false);
            }
        })();
        return () => {
            live = false;
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        };
    }, [doc?.storage_path, file]);

    const pointAt = (event) => {
        const box = frameRef.current.getBoundingClientRect();
        return {
            x: clamp((event.clientX - box.left) / box.width, 0, 1),
            y: clamp((event.clientY - box.top) / box.height, 0, 1)
        };
    };

    const onPointerDown = (event) => {
        if (!frameRef.current || saving) return;
        event.preventDefault();
        frameRef.current.setPointerCapture?.(event.pointerId);
        const p = pointAt(event);
        const inside = p.x > rect.x && p.x < rect.x + rect.w && p.y > rect.y && p.y < rect.y + rect.h;
        const isFull = rect.w > 0.99 && rect.h > 0.99;
        dragRef.current = inside && !isFull
            ? { mode: 'move', start: p, startRect: rect }
            : { mode: 'draw', start: p };
        if (!(inside && !isFull)) setRect({ x: p.x, y: p.y, w: 0, h: 0 });
    };

    const onPointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const p = pointAt(event);
        if (drag.mode === 'move') {
            const { startRect, start } = drag;
            setRect({
                ...startRect,
                x: clamp(startRect.x + p.x - start.x, 0, 1 - startRect.w),
                y: clamp(startRect.y + p.y - start.y, 0, 1 - startRect.h)
            });
        } else {
            setRect({
                x: Math.min(drag.start.x, p.x),
                y: Math.min(drag.start.y, p.y),
                w: Math.abs(p.x - drag.start.x),
                h: Math.abs(p.y - drag.start.y)
            });
        }
    };

    const onPointerUp = () => {
        if (!dragRef.current) return;
        dragRef.current = null;
        // A tap (or a box too small to use) goes back to the whole photo.
        setRect(prev => (prev.w < MIN || prev.h < MIN ? FULL : prev));
    };

    const rotate = async () => {
        const image = imageRef.current;
        if (!image?.naturalWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalHeight;
        canvas.height = image.naturalWidth;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(image, 0, 0);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
        if (blob) { showBlob(blob); setRect(FULL); setRotated(true); }
    };

    const save = async () => {
        const image = imageRef.current;
        if (!image?.naturalWidth || !image?.naturalHeight) return;
        setSaving(true);
        setError('');
        try {
            const sx = Math.round(image.naturalWidth * rect.x);
            const sy = Math.round(image.naturalHeight * rect.y);
            const sw = Math.max(1, Math.round(image.naturalWidth * rect.w));
            const sh = Math.max(1, Math.round(image.naturalHeight * rect.h));
            const canvas = document.createElement('canvas');
            canvas.width = sw;
            canvas.height = sh;
            canvas.getContext('2d').drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
            if (!blob) throw new Error('Could not create the cropped photo.');
            const name = (doc?.file_name || file?.name || 'photo').replace(/\.[^.]+$/, '') + '-crop.jpg';
            const saved = await onSave(new File([blob], name, { type: 'image/jpeg' }));
            if (saved) onClose();
            else setError('The cropped photo was not saved. The original is unchanged.');
        } catch (err) {
            setError(err.message || 'Crop failed. The original is unchanged.');
        } finally {
            setSaving(false);
        }
    };

    const isFull = rect.w > 0.99 && rect.h > 0.99;

    return (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Crop photo">
            <div className="bg-white rounded-2xl p-4 sm:p-5 w-full max-w-3xl max-h-[92vh] overflow-y-auto space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="font-bold text-stone-900">Crop photo</h2>
                    <button type="button" onClick={onClose} aria-label="Close crop editor" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"><X size={18} /></button>
                </div>
                <p className="text-xs text-stone-500">Drag on the photo to choose the area to keep. Drag inside the box to move it. Saving replaces this photo.</p>
                {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <div className="flex justify-center rounded-xl bg-stone-100 p-2">
                    {loading && <p className="py-16 text-sm text-stone-500">Loading photo…</p>}
                    {src && (
                        <div
                            ref={frameRef}
                            className="relative inline-block max-w-full select-none overflow-hidden"
                            style={{ touchAction: 'none', cursor: 'crosshair' }}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerUp}
                        >
                            <img ref={imageRef} src={src} alt="Photo to crop" draggable={false} className="block max-h-[60vh] max-w-full" />
                            {!isFull && (
                                <div
                                    className="pointer-events-none absolute border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                                    style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
                                />
                            )}
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                        <button type="button" onClick={rotate} disabled={!src || saving} className="flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50"><RotateCw size={14} /> Rotate</button>
                        <button type="button" onClick={() => setRect(FULL)} disabled={!src || saving || isFull} className="flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50"><RefreshCcw size={14} /> Reset</button>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border px-4 text-sm">Cancel</button>
                        <button type="button" disabled={!src || saving || (isFull && !rotated)} onClick={save} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold text-stone-900 disabled:opacity-50">{saving ? 'Saving…' : 'Save crop'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
