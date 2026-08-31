#!/usr/bin/env node
/**
 * Proves whether a non-admin can change their own user_type.
 *
 *   node scripts/test_profiles_escalation.mjs
 *
 * This attempts a REAL escalation to 'admin' and reverts immediately if it
 * succeeds. Writing the value back to itself proves nothing - the column guard
 * only fires on an actual CHANGE, so a no-op update passes either way.
 *
 * Uses LOADTEST_ACCOUNTS from .env (same as the load test).
 * BEFORE the fix: every role PERMITTED.
 * AFTER  the fix: only admin PERMITTED, everyone else BLOCKED.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
    readFileSync(new URL('../.env', import.meta.url), 'utf8')
        .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const accounts = (env.LOADTEST_ACCOUNTS || '').split(',').map(s => s.trim()).filter(Boolean)
    .map(p => { const i = p.indexOf(':'); return { email: p.slice(0, i), password: p.slice(i + 1) }; });

if (!accounts.length) { console.error('Set LOADTEST_ACCOUNTS in .env first.'); process.exit(1); }

let escalatable = 0;
console.log('\nCan each role rewrite its own user_type?\n');
for (const a of accounts) {
    const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: auth, error: loginErr } = await sb.auth.signInWithPassword(a);
    if (loginErr) { console.log(`  ${a.email.padEnd(30)} login failed`); continue; }

    const { data: me } = await sb.from('profiles').select('user_type').eq('id', auth.user.id).single();
    if (!me) { console.log(`  ${a.email.padEnd(30)} no profile row`); await sb.auth.signOut(); continue; }

    if (me.user_type === 'admin') {
        console.log(`  ${me.user_type.padEnd(24)} skipped (already admin)`);
        await sb.auth.signOut(); continue;
    }

    // Attempt a REAL escalation. Writing the value back to itself proves
    // nothing: the guard only fires when the column actually CHANGES, so a
    // no-op update passes whether the fix is installed or not.
    const { data: rows, error } = await sb.from('profiles')
        .update({ user_type: 'admin' }).eq('id', auth.user.id).select('id, user_type');

    const escalated = !error && rows && rows.length > 0 && rows[0].user_type === 'admin';
    if (escalated) {
        escalatable++;
        // Put it straight back so the account is left exactly as found.
        const { error: revertErr } = await sb.from('profiles')
            .update({ user_type: me.user_type }).eq('id', auth.user.id);
        console.log(`  ${me.user_type.padEnd(24)} *** ESCALATED TO ADMIN ***${revertErr ? '  REVERT FAILED: ' + revertErr.message : '  (reverted)'}`);
    } else {
        console.log(`  ${me.user_type.padEnd(24)} blocked${error ? '  (' + error.message.slice(0, 70) + ')' : ''}`);
    }
    await sb.auth.signOut();
}
console.log(`\nnon-admin roles that can escalate: ${escalatable}` + (escalatable ? '   <-- FIX NOT APPLIED' : '   <-- fixed'));
