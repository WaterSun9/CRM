// Check bytes before creating a destination file or reporting success.
export async function validateDocumentBlob(blob, fileName = '') {
    if (!blob?.size) throw new Error('This file is empty. Please upload the original document again.');
    const isImage = blob.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|svg)$/i.test(fileName);
    if (isImage) {
        const url = URL.createObjectURL(blob);
        try {
            await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => image.naturalWidth && image.naturalHeight
                    ? resolve() : reject(new Error('The image has no pixels.'));
                image.onerror = () => reject(new Error('This image is damaged or its format is unsupported. Please upload a JPG or PNG copy.'));
                image.src = url;
            });
        } finally {
            URL.revokeObjectURL(url);
        }
    }
    return blob;
}

export async function fetchDocumentBlob(url, fileName) {
    let blob;
    for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
                const error = new Error(`The file could not be downloaded (HTTP ${response.status}). Please reopen the preview and retry.`);
                error.retryable = response.status >= 500 || response.status === 429;
                throw error;
            }
            blob = await response.blob();
            break;
        } catch (error) {
            if (attempt === 1 || error.retryable === false) throw error;
        } finally {
            clearTimeout(timeout);
        }
    }
    return validateDocumentBlob(blob, fileName);
}

export async function saveDocumentDownload(url, fileName = 'document', options = {}) {
    if (!url) throw new Error('No download link is available. Please reopen the document and retry.');
    // Open the picker during the click gesture, before waiting for the network.
    let handle;
    if (typeof window.showSaveFilePicker === 'function') {
        try {
            handle = await window.showSaveFilePicker({ suggestedName: fileName });
        } catch (error) {
            if (error.name === 'AbortError') return { cancelled: true };
            if (!['SecurityError', 'NotAllowedError', 'NotSupportedError', 'TypeError'].includes(error.name)) throw error;
        }
    }
    const blob = await fetchDocumentBlob(url, fileName);
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
    if (handle) {
        const stream = await handle.createWritable();
        try {
            await stream.write(blob);
            await stream.close();
        } catch (error) {
            try { await stream.abort(); } catch { /* Preserve the write error. */ }
            throw error;
        }
    } else {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        try { anchor.click(); } finally {
            anchor.remove();
            // Give the browser time to consume the bytes, including on slow devices.
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        }
    }
    window.dispatchEvent(new CustomEvent('watersun:download-complete', {
        detail: { ...options, file, fileName, saved: Boolean(handle) }
    }));
    return { cancelled: false, saved: Boolean(handle) };
}
