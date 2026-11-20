// Photos are made small on the phone before upload, to keep storage low (Mahvish, 2026-11-20).
// Redrawn at a set long side; WebP where the phone can make it (smaller), else JPEG (iPhones).
// The original is kept only when it is already smaller than the redrawn copy.
//
// Sizes (roughly, for a 12 MP phone photo):
//   reading       800 px, quality 0.5   about 30-60 KB    a meter stays readable
//   technician   1024 px, quality 0.55  about 60-120 KB   complaint Before / After / site photos
//   installation 1280 px, quality 0.6   about 80-180 KB   serial numbers and nut marks readable
//   geo          1600 px, quality 0.7   about 150-300 KB  the geo tag text stays sharp
export const PHOTO_SIZES = {
    reading: { longSide: 800, quality: 0.5 },
    technician: { longSide: 1024, quality: 0.55 },
    installation: { longSide: 1280, quality: 0.6 },
    geo: { longSide: 1600, quality: 0.7 },
};

export async function shrinkPhoto(file, { longSide, quality } = PHOTO_SIZES.technician) {
    if (!file?.type?.startsWith('image/') || file.type === 'image/svg+xml' || typeof createImageBitmap !== 'function') return file;
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch { return file; }
    const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const encode = type => new Promise(resolve => canvas.toBlob(resolve, type, quality));
    let blob = await encode('image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg');
    if (!blob || !['image/webp', 'image/jpeg'].includes(blob.type) || blob.size >= file.size) return file;
    const base = String(file.name || 'photo').replace(/\.[^/.]+$/, '');
    return new File([blob], `${base}${blob.type === 'image/webp' ? '.webp' : '.jpg'}`, { type: blob.type, lastModified: Date.now() });
}
