#!/usr/bin/env node
// Read-only audit: summarizes rows whose customer name is absent/blank or is
// literally "Unnamed Customer". It never inserts, updates, or deletes data.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
    readFileSync(new URL('../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter(line => line.includes('=') && !line.trim().startsWith('#'))
        .map(line => {
            const index = line.indexOf('=');
            return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, '')];
        })
);

const accounts = (env.LOADTEST_ACCOUNTS || '').split(',').map(value => value.trim()).filter(Boolean);
const adminPair = accounts.find(value => value.toLowerCase().startsWith('admin@'));
if (!adminPair) throw new Error('No admin load-test account is configured.');
const separator = adminPair.indexOf(':');
const email = adminPair.slice(0, separator);
const password = adminPair.slice(separator + 1);
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
if (loginError) throw loginError;

const rows = [];
for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
        .from('admin')
        .select('*')
        .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
}

const affected = rows.filter(row => {
    const name = String(row.customer_name ?? '').trim();
    return name === '' || name.toLowerCase() === 'unnamed customer';
});
const byDate = new Map();
const byKind = { missing_or_blank: 0, literal_unnamed_customer: 0 };
for (const row of affected) {
    const name = String(row.customer_name ?? '').trim();
    byKind[name ? 'literal_unnamed_customer' : 'missing_or_blank'] += 1;
    const date = row.created_at ? new Date(row.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : 'unknown';
    byDate.set(date, (byDate.get(date) || 0) + 1);
}
const times = affected.map(row => row.created_at).filter(Boolean).sort();
const ignoredCoverageFields = new Set(['id', 'customer_name', 'created_at', 'updated_at', 'deleted_at']);
const fieldCoverage = {};
for (const key of Object.keys(affected[0] || {})) {
    if (ignoredCoverageFields.has(key)) continue;
    const populated = affected.filter(row => {
        const value = row[key];
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim() !== '';
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return true;
    });
    if (populated.length > 0) {
        fieldCoverage[key] = {
            populated_rows: populated.length,
            distinct_values: new Set(populated.map(row => JSON.stringify(row[key]))).size
        };
    }
}

console.log(JSON.stringify({
    total: affected.length,
    active: affected.filter(row => !row.deleted_at).length,
    trashed: affected.filter(row => row.deleted_at).length,
    ...byKind,
    earliest_created_at: times[0] || null,
    latest_created_at: times.at(-1) || null,
    created_by_date_ist: Object.fromEntries([...byDate.entries()].sort()),
    folder_numbers: affected.map(row => row.folder_no).filter(value => String(value ?? '').trim()),
    populated_field_coverage: fieldCoverage
}, null, 2));

await supabase.auth.signOut();
