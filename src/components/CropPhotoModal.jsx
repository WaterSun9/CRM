import { useEffect, useRef, useState } from 'react';
import { getViewUrl } from '../utils';

export default function CropPhotoModal({ doc, onSave, onClose }) {
    const imageRef = useRef(null);
    const [url, setUrl] = useState('');
    const [rect, setRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let live = true;
        getViewUrl(doc.storage_path).then(value => { if (live) setUrl(value || ''); })
            .catch(err => { if (live) setError(err.message); });
        return () => { live = false; };
    }, [doc.storage_path]);

    const setField = (field, value) => setRect(prev => {
        const next = { ...prev, [field]: Number(value) };
        if (field === 'x') next.width = Math.min(next.width, 100 - next.x);
        if (field === 'y') next.height = Math.min(next.height, 100 - next.y);
        if (field === 'width') next.width = Math.min(next.width, 100 - next.x);
        if (field === 'height') next.height = Math.min(next.height, 100 - next.y);
        return next;
    });

    const save = async () => {
        const image = imageRef.current;
        if (!image?.naturalWidth || !image?.naturalHeight) return;
        setSaving(true);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * rect.width / 100));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * rect.height / 100));
            canvas.getContext('2d').drawImage(image,
                image.naturalWidth * rect.x / 100, image.naturalHeight * rect.y / 100,
                image.naturalWidth * rect.width / 100, image.naturalHeight * rect.height / 100,
                0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
            if (!blob) throw new Error('Could not create cropped photo.');
            const name = (doc.file_name || 'photo').replace(/\.[^.]+$/, '') + '-crop.jpg';
            const saved = await onSave(new File([blob], name, { type: 'image/jpeg' }));
            if (saved) onClose();
        } catch (err) {
            setError(err.message || 'Crop failed. Please try again.');
        } finally { setSaving(false); }
    };

    return <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Crop photo">
        <div className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between"><h2 className="font-bold">Crop photo</h2><button onClick={onClose} aria-label="Close crop editor">✕</button></div>
            <p className="text-xs text-stone-500">Adjust the crop area, then save. The cropped photo replaces this document.</p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {url && <div className="relative inline-block max-w-full bg-stone-100"><img ref={imageRef} crossOrigin="anonymous" src={url} alt="Original photo to crop" className="max-h-[50vh] max-w-full block" /><div className="absolute border-2 border-amber-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none" style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.width}%`, height: `${rect.height}%` }} /></div>}
            <div className="grid grid-cols-2 gap-3">{[['x', 'Left'], ['y', 'Top'], ['width', 'Width'], ['height', 'Height']].map(([field, label]) => <label key={field} className="text-xs font-semibold">{label}: {rect[field]}%<input type="range" className="block w-full" min={field === 'x' || field === 'y' ? 0 : 1} max={field === 'x' ? 99 : field === 'y' ? 99 : field === 'width' ? 100 - rect.x : 100 - rect.y} value={rect[field]} onChange={event => setField(field, event.target.value)} /></label>)}</div>
            <div className="flex justify-end gap-2"><button onClick={onClose} className="border rounded-lg px-4 py-2 text-sm">Cancel</button><button disabled={!url || saving} onClick={save} className="bg-amber-500 disabled:opacity-50 rounded-lg px-4 py-2 text-sm font-bold">{saving ? 'Saving…' : 'Save crop'}</button></div>
        </div>
    </div>;
}
