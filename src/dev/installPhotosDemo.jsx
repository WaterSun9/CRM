// Local-only demo of the 17 installation photos (client list, 2026-11-19) for screenshots.
// Fake customer, fake photos drawn in the browser, no login and no network.
// ?done=0 | 12 | 17 (how many photos are already taken), ?view=vendor | office (read only)
// | geo (the geo tag photo on the customer card, with the D-042 "is the geo tag clear?" check).
import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import InstallationPhotos from '../components/InstallationPhotos';
import { INSTALL_PHOTOS } from '../utils/installPhotos';
import { CheckboxRemarkItem } from '../components/modal-tabs/shared';
import { GlobalPopupProvider } from '../components/GlobalPopup';

const params = new URLSearchParams(location.search);
const done = Math.min(17, Math.max(0, Number(params.get('done') ?? 12)));
const readOnly = params.get('view') === 'office';
// Taken photos: a spread so the missing ones are not all at the end.
const order = [0, 1, 2, 3, 5, 6, 7, 9, 10, 12, 14, 16, 4, 8, 11, 13, 15];
const taken = new Set(order.slice(0, done));

// A made-up "photo": a coloured tile with the slot number.
function fakePhoto(n) {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    const ctx = canvas.getContext('2d');
    const hue = (n * 47) % 360;
    const g = ctx.createLinearGradient(0, 0, 320, 240);
    g.addColorStop(0, `hsl(${hue} 45% 62%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360} 40% 38%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(n), 160, 140);
    ctx.font = '14px sans-serif'; ctx.fillText('demo photo', 160, 175);
    return canvas.toDataURL('image/jpeg', 0.8);
}

function Demo() {
    const [docs, setDocs] = useState(() => INSTALL_PHOTOS.flatMap((p, i) => taken.has(i)
        ? [{ id: `d${i}`, doc_type: p.docType, storage_path: `demo/${i + 1}`, file_name: `photo-${i + 1}.jpg`, uploaded_at: new Date(Date.now() - (20 - i) * 60000).toISOString() }]
        : []));
    const [open, setOpen] = useState(null);
    const getUrl = useCallback(doc => fakePhoto(Number(String(doc.storage_path).split('/').pop())), []);
    const upload = async (file, docType) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        const n = INSTALL_PHOTOS.findIndex(p => p.docType === docType) + 1;
        setDocs(current => [{ id: `n${Date.now()}`, doc_type: docType, storage_path: `demo/${n}`, file_name: file.name, uploaded_at: new Date().toISOString() }, ...current.filter(d => d.doc_type !== docType)]);
        return true;
    };
    return <div className="min-h-screen bg-stone-50 p-3 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-3">
            <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{readOnly ? 'Customer card · Installation Status' : 'Vendor portal · Installation'}</p>
                <p className="text-base font-black text-stone-900">Demo Customer (fake)</p>
                <p className="text-xs text-stone-500">3.27 kW · Demo Village · Installation Status</p>
            </div>
            <InstallationPhotos documents={docs} canUpload={!readOnly} onUpload={upload} onPreview={doc => setOpen(doc)} getUrl={getUrl} />
        </div>
        {open && <button type="button" onClick={() => setOpen(null)} className="fixed inset-0 flex items-center justify-center bg-black/80 p-4" aria-label="Close photo">
            <img src={getUrl(open)} alt="" className="max-h-full max-w-full rounded-xl" />
        </button>}
    </div>;
}

// The geo tag photo on the customer card: the real checklist row, a fake upload that moves the
// stage the way the card does (Geo Tag Photo -> Discom Submission).
function GeoDemo() {
    const [stage, setStage] = useState('Geo Tag Photo');
    const [docs, setDocs] = useState([]);
    const upload = async event => {
        const file = event.target.files[0];
        await new Promise(resolve => setTimeout(resolve, 500));
        setDocs([{ id: `g${Date.now()}`, doc_type: 'geo_tag_image', file_name: file.name, storage_path: 'demo/geo', uploaded_at: new Date().toISOString() }]);
        setStage('Discom Submission');
        return true;
    };
    return <div className="min-h-screen bg-stone-50 p-3 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-3">
            <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Customer card</p>
                <p className="text-base font-black text-stone-900">Demo Customer (fake)</p>
                <p className="text-xs text-stone-500">Stage: <span className={`font-bold ${stage === 'Discom Submission' ? 'text-emerald-700' : 'text-stone-800'}`}>{stage}</span></p>
            </div>
            <div className="rounded-[24px] border border-stone-100 bg-white p-4 shadow-sm">
                <CheckboxRemarkItem label="Geo Tag Photograph" field="geo_tag_image" value={docs.length > 0} onChange={() => {}} isEditing documents={docs} onUpload={upload} onPreview={() => {}} canDelete />
            </div>
        </div>
    </div>;
}

createRoot(document.getElementById('root')).render(params.get('view') === 'geo' ? <GlobalPopupProvider><GeoDemo /></GlobalPopupProvider> : <Demo />);
