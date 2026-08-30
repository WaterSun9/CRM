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
 *   LOADTEST_ACCOUNTS=email1:password1,email2:password2,...
 *
 * You do NOT declare each account's role - the script reads user_type from
 * `profiles` after signing in, and then runs the queries that role's portal
 * actually issues (Dashboard, Dealer, Vendor or Stamp). Supply one account per
 * role for full coverage; accounts are round-robined across the virtual users,
 * so 8 accounts happily drive 30 concurrent sessions.
 *
 * Each virtual user gets its OWN client and its own signed-in session, so RLS
 * is exercised exactly as it is in the browser.
 *
 * The report breaks results down BY ROLE as well as by operation. That is the
 * number to look at: admin's RLS is a cheap user_type check, while the CPO,
 * dealer and vendor policies compare lower(trim(column)) against a function -
 * an expression no plain index can serve.
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
    console.error('Missing LOADTEST_ACCOUNTS in .env.\n  LOADTEST_ACCOUNTS=email1:password1,email2:password2,...\n  (one account per role gives the fullest picture; roles are detected automatically)');
    process.exit(1);
}

const TAG = `LOADTEST-${Date.now()}`;

// ── metrics ─────────────────────────────────────────────────────────────────
const samples = [];   // { op, role, ms, ok, err }
const roleOf = new Map();
const record = (op, started, error, role = '-') =>
    samples.push({ op, role, ms: Date.now() - started, ok: !error, err: error?.message });

const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

// ── operations, grouped by the portal each role actually uses ───────────────
const CUSTOMER_COLUMNS = 'id, customer_name, phone_number, consumer_no, stage, channel_partner, sub_channel_partner, payment_type, loan_tag, subsidy_tag, installation_status, system_capacity_kwp, vendor, delivery_status, updated_at';
const STAGES = ['LEADS', 'REGISTRATION', 'MATERIAL ORDER', 'MATERIAL INTEGRATION', 'INSTALLATION STATUS', 'COMPLETED'];
const pick = a => a[Math.floor(Math.random() * a.length)];

// --- Dashboard (admin, sales, channel_partner_office, office2) --------------
async function stageList(sb, role) {
    const t = Date.now();
    const { error } = await sb.from('admin').select(CUSTOMER_COLUMNS)
        .is('deleted_at', null).eq('stage', pick(STAGES))
        .order('created_at', { ascending: false }).range(0, 49);
    record('stage_list', t, error, role);
}

async function globalSearch(sb, role) {
    // The .or(...ilike...) form the app uses. No index can serve this.
    // Mirrors Dashboard.fetchSearch exactly: ilike on the text column, and .eq
    // on the numeric ones (phone_number / consumer_no are numeric, so ilike
    // would fail with "operator does not exist: numeric ~~* unknown").
    const q = pick(['a', 'sh', 'bhai', 'pat', '9876543210']);
    let orString = `customer_name.ilike.%${q}%`;
    if (!isNaN(q) && q.length > 0) orString += `,phone_number.eq.${q},consumer_no.eq.${q}`;
    const t = Date.now();
    const { error } = await sb.from('admin').select('id, customer_name, phone_number, consumer_no, stage')
        .is('deleted_at', null).or(orString).limit(8);
    record('search', t, error, role);
}

async function dashboardCounts(sb, role) {
    const t = Date.now();
    const { error } = await sb.from('admin').select('id', { count: 'exact', head: true }).is('deleted_at', null);
    record('dashboard_count', t, error, role);
}

async function openCustomer(sb, role, scope) {
    const t0 = Date.now();
    let q = sb.from('admin').select('id').is('deleted_at', null).limit(20);
    if (scope) q = scope(q);
    const { data, error } = await q;
    record('pick_customer', t0, error, role);
    if (error || !data?.length) return;

    const id = pick(data).id;
    const t1 = Date.now();
    const { error: fullErr } = await sb.from('admin').select('*').eq('id', id).single();
    record('open_customer', t1, fullErr, role);

    const t2 = Date.now();
    const { error: docErr } = await sb.from('documents').select('*').eq('customer_id', id);
    record('load_documents', t2, docErr, role);
}

async function deliveryBatches(sb, role) {
    const t = Date.now();
    const { error } = await sb.from('delivery_batches').select('*').order('created_at', { ascending: false });
    record('delivery_batches', t, error, role);
}

async function payoutLedger(sb, role) {
    const t = Date.now();
    const { error } = await sb.from('admin').select('*').is('deleted_at', null)
        .or('installation_status.ilike.%yes%,installation_status.ilike.%installed%');
    record('payout_ledger', t, error, role);
}

// --- Dealer / Channel Partner portal (agent, agent2) ------------------------
async function agentLeads(sb, role, myName) {
    const t = Date.now();
    const { error } = await sb.from('admin').select('*')
        .is('deleted_at', null).ilike('sub_channel_partner', myName)
        .order('created_at', { ascending: false });
    record('agent_my_leads', t, error, role);
}

// --- Vendor portal ---------------------------------------------------------
async function vendorJobs(sb, role, myName) {
    const t = Date.now();
    const { data, error } = await sb.from('admin').select('*')
        .is('deleted_at', null).ilike('vendor', myName);
    record('vendor_my_jobs', t, error, role);
    if (error || !data?.length) return;

    const id = pick(data).id;
    const t1 = Date.now();
    const { error: bomErr } = await sb.from('bom').select('*').eq('admin_id', id);
    record('vendor_bom', t1, bomErr, role);
}

// --- Stamp portal ----------------------------------------------------------
async function stampQueue(sb, role) {
    const t = Date.now();
    const { error } = await sb.from('admin').select('*')
        .eq('discom_submission->>sent_to_stamp_maker', 'true')
        .is('deleted_at', null).order('created_at', { ascending: false });
    record('stamp_queue', t, error, role);
}

async function stampRecord(sb, role) {
    const t = Date.now();
    const { error } = await sb.from('admin')
        .select('id, customer_name, consumer_no, villages, discom_submission')
        .eq('discom_submission->>sent_to_stamp_maker', 'true')
        .eq('discom_submission->>stamp_sent', 'true')
        .is('deleted_at', null);
    record('stamp_record', t, error, role);
}

// One "session" of realistic activity for whichever role this account has.
async function runProfile(sb, profile) {
    const role = profile.user_type || 'unknown';
    const myName = (profile.name || '').trim();
    const roll = Math.random();

    switch (role) {
        case 'admin':
        case 'sales':
            if (roll < 0.35)      await stageList(sb, role);
            else if (roll < 0.55) await globalSearch(sb, role);
            else if (roll < 0.75) await openCustomer(sb, role);
            else if (roll < 0.88) await dashboardCounts(sb, role);
            else if (roll < 0.95) await deliveryBatches(sb, role);
            else                  await payoutLedger(sb, role);
            break;

        // Branch-scoped: the RLS predicate is lower(trim(col)) = lower(trim(fn())),
        // which no plain index can serve. This is the comparison worth watching.
        case 'channel_partner_office':
        case 'office2':
            if (roll < 0.45)      await stageList(sb, role);
            else if (roll < 0.70) await globalSearch(sb, role);
            else if (roll < 0.90) await openCustomer(sb, role);
            else                  await dashboardCounts(sb, role);
            break;

        case 'agent':
        case 'agent2':
            if (roll < 0.55)      await agentLeads(sb, role, myName);
            else                  await openCustomer(sb, role, q => q.ilike('sub_channel_partner', myName));
            break;

        case 'vendor':
            await vendorJobs(sb, role, myName);
            break;

        case 'stamp':
            if (roll < 0.70) await stampQueue(sb, role);
            else             await stampRecord(sb, role);
            break;

        default:
            await dashboardCounts(sb, role);
    }
}

// ── one virtual user ────────────────────────────────────────────────────────
async function virtualUser(n, endAt) {
    const acct = ACCOUNTS[n % ACCOUNTS.length];
    const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    const t = Date.now();
    const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email: acct.email, password: acct.password });
    record('login', t, authErr, 'auth');
    if (authErr) { console.error(`  login failed for ${acct.email}: ${authErr.message}`); return; }

    // Role is read from the database, not configured - so you only supply
    // email:password and the script runs the right portal's queries.
    const tp = Date.now();
    const { data: profile, error: profErr } = await sb.from('profiles')
        .select('user_type, name, channel_partner').eq('id', auth.user.id).single();
    record('load_profile', tp, profErr, 'auth');
    if (profErr || !profile) { console.error(`  no profile for ${acct.email}`); return; }

    roleOf.set(acct.email, profile.user_type);

    while (Date.now() < endAt) {
        await runProfile(sb, profile);
        if (DO_WRITES && ['admin', 'sales'].includes(profile.user_type) && Math.random() < 0.15) {
            await writeCycle(sb, profile.user_type);
        }
        await new Promise(r => setTimeout(r, 300 + Math.random() * 900)); // think time
    }
    await sb.auth.signOut();
}

async function writeCycle(sb, role) {
    const t0 = Date.now();
    const { data, error } = await sb.from('admin').insert({
        customer_name: `${TAG} ${Math.random().toString(36).slice(2, 8)}`,
        stage: 'LEADS',
        internal_remarks: TAG,
    }).select('id').single();
    record('insert', t0, error, role);
    if (error || !data?.id) return;

    const t1 = Date.now();
    const { error: upErr } = await sb.from('admin')
        .update({ internal_remarks: `${TAG} updated`, villages: 'LoadTest' }).eq('id', data.id);
    record('update', t1, upErr, role);

    const t2 = Date.now();
    const { error: delErr } = await sb.from('admin').delete().eq('id', data.id);
    record('cleanup_delete', t2, delErr, role);
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
const line = (label, rows) => {
    const good = rows.filter(r => r.ok).map(r => r.ms);
    const bad = rows.length - good.length;
    return `${label.padEnd(22)} ${String(rows.length).padStart(6)} ${String(good.length).padStart(6)} ${String(bad).padStart(5)}`
         + ` ${String(pct(good, 0.5) + 'ms').padStart(8)} ${String(pct(good, 0.95) + 'ms').padStart(8)}`
         + ` ${String(pct(good, 0.99) + 'ms').padStart(8)} ${String(Math.max(0, ...good) + 'ms').padStart(8)}`;
};
const header = `${'operation'.padEnd(22)} ${'n'.padStart(6)} ${'ok'.padStart(6)} ${'fail'.padStart(5)} ${'p50'.padStart(8)} ${'p95'.padStart(8)} ${'p99'.padStart(8)} ${'max'.padStart(8)}`;

console.log(`\nBY OPERATION`);
console.log(header);
console.log('-'.repeat(header.length));
for (const op of [...new Set(samples.map(s => s.op))]) {
    console.log(line(op, samples.filter(s => s.op === op)));
}

// The interesting comparison: admin's RLS is a plain user_type check, while
// CPO / dealer / vendor policies compare lower(trim(col)) against a function -
// which no plain index can serve. If a role's p95 is far worse, that is why.
console.log(`\nBY ROLE`);
console.log(header.replace('operation'.padEnd(22), 'role'.padEnd(22)));
console.log('-'.repeat(header.length));
for (const role of [...new Set(samples.map(s => s.role))].sort()) {
    console.log(line(role, samples.filter(s => s.role === role)));
}

console.log(`\nBY ROLE x OPERATION`);
console.log(header.replace('operation'.padEnd(22), 'role / operation'.padEnd(22)));
console.log('-'.repeat(header.length));
for (const role of [...new Set(samples.map(s => s.role))].sort()) {
    for (const op of [...new Set(samples.filter(s => s.role === role).map(s => s.op))]) {
        console.log(line(`${role}/${op}`, samples.filter(s => s.role === role && s.op === op)));
    }
}

const failures = samples.filter(s => !s.ok);
console.log('-'.repeat(header.length));
console.log(`total ${samples.length} requests in ${elapsed.toFixed(1)}s  ·  ${(samples.length / elapsed).toFixed(1)} req/s  ·  ${failures.length} failed (${((failures.length / samples.length) * 100).toFixed(2)}%)`);
console.log(`roles exercised: ${[...new Set(roleOf.values())].join(', ') || 'none'}`);

if (failures.length) {
    console.log('\nfailure breakdown:');
    const byMsg = {};
    failures.forEach(f => { const k = `${f.role}/${f.op}: ${f.err}`; byMsg[k] = (byMsg[k] || 0) + 1; });
    Object.entries(byMsg).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));
}

if (DO_WRITES) {
    console.log(`\nIf the run was interrupted, remove any leftovers with:`);
    console.log(`  delete from public.admin where internal_remarks like '${TAG}%';`);
}
console.log('');
