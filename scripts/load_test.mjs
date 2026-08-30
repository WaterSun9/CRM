#!/usr/bin/env node
/**
 * Watersun CRM — concurrent load test.
 *
 *   node scripts/load_test.mjs --users 30 --duration 60
 *
 * READ-ONLY BY DEFAULT. It never writes unless you pass --writes, and even then
 * it only touches rows it created itself and deletes them afterwards.
 *
 * Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.
 * Test accounts are supplied via LOADTEST_ACCOUNTS in .env:
 *
 *   LOADTEST_ACCOUNTS=email1:password1,email2:password2
 *
 * Each virtual user gets its OWN client and its own signed-in session, so RLS
 * is exercised exactly as it is in the browser. Accounts are round-robined, so
 * 2 accounts can drive 30 concurrent sessions.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// ── config ──────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
    process.argv.slice(2).reduce((acc, a, i, arr) => {
        if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1] ?? true]);
        return acc;
    }, [])
);
const USERS    = Number(args.users ?? 30);
const DURATION = Number(args.duration ?? 60);   // seconds
const DO_WRITES = args.writes === true || args.writes === 'true';

const env = Object.fromEntries(
    readFileSync(new URL('../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter(l => l.includes('=') && !l.trim().startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);

const URL_ = env.VITE_SUPABASE_URL;
const KEY  = env.VITE_SUPABASE_ANON_KEY;
const ACCOUNTS = (env.LOADTEST_ACCOUNTS || '')
    .split(',').map(s => s.trim()).filter(Boolean)
    .map(pair => { const i = pair.indexOf(':'); return { email: pair.slice(0, i), password: pair.slice(i + 1) }; });

if (!URL_ || !KEY) { console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env'); process.exit(1); }
if (ACCOUNTS.length === 0) {
    console.error('Missing LOADTEST_ACCOUNTS in .env.\n  LOADTEST_ACCOUNTS=email1:password1,email2:password2');
    process.exit(1);
}

const TAG = `LOADTEST-${Date.now()}`;

// ── metrics ─────────────────────────────────────────────────────────────────
const samples = [];   // { op, ms, ok, err }
const record = (op, started, error) => samples.push({ op, ms: Date.now() - started, ok: !error, err: error?.message });

const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

// ── the operations a real session performs ──────────────────────────────────
const CUSTOMER_COLUMNS = 'id, customer_name, phone_number, consumer_no, stage, channel_partner, sub_channel_partner, payment_type, loan_tag, subsidy_tag, installation_status, system_capacity_kwp, vendor, delivery_status, updated_at';
const STAGES = ['LEADS', 'REGISTRATION', 'MATERIAL ORDER', 'MATERIAL INTEGRATION', 'INSTALLATION STATUS', 'COMPLETED'];

async function stageList(sb) {
    const stage = STAGES[Math.floor(Math.random() * STAGES.length)];
    const t = Date.now();
    const { error } = await sb.from('admin').select(CUSTOMER_COLUMNS)
        .is('deleted_at', null).eq('stage', stage)
        .order('created_at', { ascending: false }).range(0, 49);
    record('stage_list', t, error);
}

async function globalSearch(sb) {
    const q = ['a', 'sh', 'bhai', 'pat', '98'][Math.floor(Math.random() * 5)];
    const t = Date.now();
    const { error } = await sb.from('admin').select(CUSTOMER_COLUMNS)
        .is('deleted_at', null)
        .or(`customer_name.ilike.%${q}%,phone_number.ilike.%${q}%,consumer_no.ilike.%${q}%`)
        .limit(25);
    record('search', t, error);
}

async function openCustomer(sb) {
    const t0 = Date.now();
    const { data, error } = await sb.from('admin').select('id')
        .is('deleted_at', null).limit(20);
    record('pick_customer', t0, error);
    if (error || !data?.length) return null;

    const id = data[Math.floor(Math.random() * data.length)].id;
    const t1 = Date.now();
    const { error: fullErr } = await sb.from('admin').select('*').eq('id', id).single();
    record('open_customer', t1, fullErr);

    const t2 = Date.now();
    const { error: docErr } = await sb.from('documents').select('*').eq('admin_id', id);
    record('load_documents', t2, docErr);
    return id;
}

async function dashboardCounts(sb) {
    const t = Date.now();
    const { error } = await sb.from('admin').select('id', { count: 'exact', head: true }).is('deleted_at', null);
    record('dashboard_count', t, error);
}

async function writeCycle(sb) {
    // Creates a clearly-tagged row, updates it, then deletes it. Nothing
    // pre-existing is ever touched.
    const t0 = Date.now();
    const { data, error } = await sb.from('admin').insert({
        customer_name: `${TAG} ${Math.random().toString(36).slice(2, 8)}`,
        stage: 'LEADS',
        internal_remarks: TAG,
    }).select('id').single();
    record('insert', t0, error);
    if (error || !data?.id) return;

    const t1 = Date.now();
    const { error: upErr } = await sb.from('admin')
        .update({ internal_remarks: `${TAG} updated`, villages: 'LoadTest' })
        .eq('id', data.id);
    record('update', t1, upErr);

    const t2 = Date.now();
    const { error: delErr } = await sb.from('admin').delete().eq('id', data.id);
    record('cleanup_delete', t2, delErr);
}

// ── one virtual user ────────────────────────────────────────────────────────
async function virtualUser(n, endAt) {
    const acct = ACCOUNTS[n % ACCOUNTS.length];
    const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    const t = Date.now();
    const { error: authErr } = await sb.auth.signInWithPassword({ email: acct.email, password: acct.password });
    record('login', t, authErr);
    if (authErr) return;

    while (Date.now() < endAt) {
        const roll = Math.random();
        if (roll < 0.40)      await stageList(sb);
        else if (roll < 0.60) await globalSearch(sb);
        else if (roll < 0.85) await openCustomer(sb);
        else                  await dashboardCounts(sb);

        if (DO_WRITES && Math.random() < 0.15) await writeCycle(sb);

        await new Promise(r => setTimeout(r, 300 + Math.random() * 900)); // think time
    }
    await sb.auth.signOut();
}

// ── run ─────────────────────────────────────────────────────────────────────
console.log(`\nWatersun CRM load test`);
console.log(`  target      ${URL_}`);
console.log(`  users       ${USERS} concurrent`);
console.log(`  duration    ${DURATION}s`);
console.log(`  accounts    ${ACCOUNTS.length} (round-robined)`);
console.log(`  mode        ${DO_WRITES ? 'READ + WRITE (tagged rows, self-cleaning)' : 'READ ONLY'}`);
if (DO_WRITES) console.log(`  tag         ${TAG}`);
console.log('');

const started = Date.now();
const endAt = started + DURATION * 1000;
await Promise.all(Array.from({ length: USERS }, (_, i) =>
    // stagger the ramp so all 30 do not hit the auth endpoint in the same millisecond
    new Promise(r => setTimeout(r, i * 120)).then(() => virtualUser(i, endAt))
));

// ── report ──────────────────────────────────────────────────────────────────
const elapsed = (Date.now() - started) / 1000;
const ops = [...new Set(samples.map(s => s.op))];

console.log(`\n${'operation'.padEnd(18)} ${'n'.padStart(6)} ${'ok'.padStart(6)} ${'fail'.padStart(5)} ${'p50'.padStart(7)} ${'p95'.padStart(7)} ${'p99'.padStart(7)} ${'max'.padStart(7)}`);
console.log('-'.repeat(72));
for (const op of ops) {
    const rows = samples.filter(s => s.op === op);
    const good = rows.filter(s => s.ok).map(s => s.ms);
    const bad  = rows.length - good.length;
    console.log(
        `${op.padEnd(18)} ${String(rows.length).padStart(6)} ${String(good.length).padStart(6)} ${String(bad).padStart(5)}` +
        ` ${String(pct(good, 0.5) + 'ms').padStart(7)} ${String(pct(good, 0.95) + 'ms').padStart(7)}` +
        ` ${String(pct(good, 0.99) + 'ms').padStart(7)} ${String(Math.max(0, ...good) + 'ms').padStart(7)}`
    );
}

const failures = samples.filter(s => !s.ok);
console.log('-'.repeat(72));
console.log(`total ${samples.length} requests in ${elapsed.toFixed(1)}s  ·  ${(samples.length / elapsed).toFixed(1)} req/s  ·  ${failures.length} failed (${((failures.length / samples.length) * 100).toFixed(2)}%)`);

if (failures.length) {
    console.log('\nfailure breakdown:');
    const byMsg = {};
    failures.forEach(f => { const k = `${f.op}: ${f.err}`; byMsg[k] = (byMsg[k] || 0) + 1; });
    Object.entries(byMsg).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));
}

if (DO_WRITES) {
    console.log(`\nIf the run was interrupted, remove any leftovers with:`);
    console.log(`  delete from public.admin where internal_remarks like '${TAG}%';`);
}
console.log('');
