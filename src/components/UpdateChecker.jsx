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

// Show the deploy time in the user's own timezone, e.g. "1 Sep 2026, 10:20 am".
function formatBuiltAt(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
}

export default function UpdateChecker() {
    const [updateAvailable, setUpdateAvailable] = useState(null); // null | { builtAt }
    const loadedRef = useRef(null); // { buildId, builtAt }

    useEffect(() => {
        let cancelled = false;

        const fetchVersion = async () => {
            try {
                const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) return null;
                const data = await res.json();
                if (!data?.buildId) return null;
                return { buildId: String(data.buildId), builtAt: data.builtAt || null };
            } catch {
                return null;
            }
        };

        const checkForUpdate = async () => {
            const remote = await fetchVersion();
            if (cancelled || !remote) return;

            // First successful poll records what THIS tab is running.
            if (loadedRef.current === null) {
                loadedRef.current = remote;
                return;
            }

            const loaded = loadedRef.current;
            if (remote.buildId === loaded.buildId) return;

            // A different id is not enough. Require the deployed build to be
            // strictly NEWER than the one this tab loaded - otherwise a stale
            // cached copy, a rollback, or two builds of the same commit prompt
            // a "new version" that is not new, and the banner cries wolf until
            // people stop trusting it.
            const remoteTime = remote.builtAt ? Date.parse(remote.builtAt) : NaN;
            const loadedTime = loaded.builtAt ? Date.parse(loaded.builtAt) : NaN;

            if (!Number.isNaN(remoteTime) && !Number.isNaN(loadedTime)) {
                if (remoteTime <= loadedTime) return;   // same age or older: ignore
            }
            // If either timestamp is missing/unparseable we fall through on the
            // id difference alone rather than suppress a genuine update.

            setUpdateAvailable({ builtAt: remote.builtAt });
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

    const releasedAt = formatBuiltAt(updateAvailable.builtAt);

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] bg-stone-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-300">
            <span className="text-xs font-semibold">
                Update released{releasedAt ? ` ${releasedAt}` : ''}.
                <span className="block text-[10px] font-medium text-stone-400 mt-0.5">
                    Refresh to load it.
                </span>
            </span>
            <button
                onClick={() => window.location.reload()}
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
            >
                Refresh Now
            </button>
        </div>
    );
}
