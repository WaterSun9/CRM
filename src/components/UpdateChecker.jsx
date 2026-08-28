// ─── UpdateChecker.jsx ──────────────────────────────────────────────────────
// GitHub Pages can't set real Cache-Control headers, so a client's browser
// can keep serving a stale index.html pointing at JS/CSS chunk filenames
// that no longer exist after the next deploy - the app silently fails to
// load or update. This polls public/version.json (written fresh on every
// build, fetched with cache disabled) and prompts a reload when the
// deployed build id no longer matches the one this tab loaded with.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function UpdateChecker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const initialBuildIdRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        const fetchVersion = async () => {
            try {
                const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) return null;
                const data = await res.json();
                return data?.buildId || null;
            } catch {
                return null;
            }
        };

        const checkForUpdate = async () => {
            const buildId = await fetchVersion();
            if (cancelled || !buildId) return;

            if (initialBuildIdRef.current === null) {
                initialBuildIdRef.current = buildId;
                return;
            }

            if (buildId !== initialBuildIdRef.current) {
                setUpdateAvailable(true);
            }
        };

        checkForUpdate();
        const interval = setInterval(checkForUpdate, CHECK_INTERVAL_MS);

        const onVisible = () => {
            if (document.visibilityState === 'visible') checkForUpdate();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            cancelled = true;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    if (!updateAvailable) return null;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] bg-stone-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-300">
            <span className="text-xs font-semibold">A new version of this app is available.</span>
            <button
                onClick={() => window.location.reload()}
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
            >
                Refresh Now
            </button>
        </div>
    );
}
