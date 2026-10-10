// Public live counter (live-installs.html), meant to be embedded in an iframe.
// Reads only the aggregate numbers from the public_install_stats() function.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const REFRESH_MS = 60000;

const params = new URLSearchParams(window.location.search);
if (params.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
if (params.get('bg') === 'transparent') document.documentElement.dataset.bg = 'transparent';

const format = (value, digits = 0) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });
const shown = { installs: null, kwp: null };

// Count up from the last shown value so a change is visible.
const animate = (id, target, digits) => {
    const element = document.getElementById(id);
    const from = shown[id] ?? 0;
    shown[id] = target;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === target) {
        element.textContent = format(target, digits);
        return;
    }
    const start = performance.now();
    const step = now => {
        const progress = Math.min(1, (now - start) / 1200);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = format(from + (target - from) * eased, progress < 1 ? 0 : digits);
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
};

async function load() {
    try {
        const response = await fetch(`${url}/rest/v1/rpc/public_install_stats`, {
            method: 'POST',
            headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: '{}'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const stats = await response.json();
        animate('installs', Number(stats.installations) || 0, 0);
        animate('kwp', Number(stats.kwp) || 0, 1);
        document.getElementById('card').classList.remove('error');
        document.getElementById('updated').textContent = `Updated ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · refreshes every minute`;
    } catch (error) {
        console.warn('Live counter could not refresh:', error);
        document.getElementById('card').classList.add('error');
        document.getElementById('updated').textContent = shown.installs === null ? 'Live count unavailable right now' : 'Reconnecting…';
    }
}

load();
setInterval(load, REFRESH_MS);
