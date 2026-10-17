export function canShareQuotationFile(file, navigatorApi = globalThis.navigator) {
    if (!file || !navigatorApi?.share || !navigatorApi?.canShare) return false;
    try { return navigatorApi.canShare({ files: [file] }); }
    catch { return false; }
}

// Call directly from a fresh user tap after the PDF is prepared. Send the
// document alone: some receiving apps prefer text when both are supplied.
export async function shareQuotationFile(file, navigatorApi = globalThis.navigator) {
    if (!canShareQuotationFile(file, navigatorApi)) return 'download-required';
    try {
        await navigatorApi.share({ files: [file] });
        return 'shared';
    } catch (error) {
        if (error?.name === 'AbortError') return 'cancelled';
        return 'download-required';
    }
}
