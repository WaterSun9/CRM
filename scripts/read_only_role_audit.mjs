import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1)];
  })
);

const accounts = (env.LOADTEST_ACCOUNTS || '').split(',').map(item => {
  const i = item.indexOf(':');
  return { email: item.slice(0, i), password: item.slice(i + 1) };
}).filter(a => a.email && a.password);

if (!accounts.length) throw new Error('No diagnostic account configured');

let adminClient;
let signedInAs;
const accessChecks = [];
for (const account of accounts) {
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authError } = await client.auth.signInWithPassword(account);
  if (authError) continue;
  const { data: ownProfile } = await client.from('profiles').select('name,email,user_type,role,status,channel_partner').eq('email', account.email).maybeSingle();
  console.log('DIAGNOSTIC_LOGIN', JSON.stringify({ email: account.email, profile: ownProfile }));
  const { count: visibleLeadCount, error: countError } = await client.from('admin').select('id', { count: 'exact', head: true }).is('deleted_at', null);
  accessChecks.push({
    name: ownProfile?.name,
    user_type: ownProfile?.user_type,
    channel_partner: ownProfile?.channel_partner,
    visible_active_leads: visibleLeadCount,
    error: countError?.message || null,
  });
  if (ownProfile?.user_type === 'admin') {
    adminClient = client;
    signedInAs = account.email;
    continue;
  }
  await client.auth.signOut();
}

if (!adminClient) throw new Error('Configured accounts contain no working admin login');

const getAll = async (table, columns, order) => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = adminClient.from(table).select(columns).range(from, from + 999);
    if (order) q = q.order(order);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
};

const profiles = await getAll('profiles', 'id,name,email,user_type,role,status,channel_partner', 'name');
const leads = await getAll('admin', 'id,channel_partner,sub_channel_partner,deleted_at');
const metadata = await getAll('metadata', 'category,label');

const norm = value => String(value || '').trim().toLowerCase();
const activeLeads = leads.filter(l => !l.deleted_at);
const leadCount = (field, value) => activeLeads.filter(l => norm(l[field]) === norm(value)).length;

const roleRows = profiles
  .filter(p => ['channel_partner_office', 'office2', 'agent', 'agent2'].includes(p.user_type))
  .map(p => ({
    name: p.name,
    email: p.email,
    user_type: p.user_type,
    display_role: p.role,
    status: p.status,
    channel_partner: p.channel_partner,
    leads_by_profile_name_as_cp: leadCount('channel_partner', p.name),
    leads_by_profile_name_as_dealer: leadCount('sub_channel_partner', p.name),
    leads_by_profile_branch: leadCount('channel_partner', p.channel_partner),
  }));

const duplicateNames = Object.entries(Object.groupBy(profiles, p => norm(p.name)))
  .filter(([key, rows]) => key && rows.length > 1)
  .map(([name_key, rows]) => ({ name_key, accounts: rows.map(p => ({ name: p.name, email: p.email, user_type: p.user_type, role: p.role, channel_partner: p.channel_partner })) }));

const cpValues = Object.entries(Object.groupBy(activeLeads, l => String(l.channel_partner || '').trim()))
  .map(([name, rows]) => ({ name, leads: rows.length })).filter(x => x.name).sort((a, b) => b.leads - a.leads);
const dealerValues = Object.entries(Object.groupBy(activeLeads, l => String(l.sub_channel_partner || '').trim()))
  .map(([name, rows]) => ({ name, leads: rows.length })).filter(x => x.name).sort((a, b) => b.leads - a.leads);

console.log('SUMMARY', JSON.stringify({ signedInAs, profiles: profiles.length, activeLeads: activeLeads.length, roleRows: roleRows.length }));
console.log('ACCESS_CHECKS', JSON.stringify(accessChecks));
console.log('ROLE_ROWS', JSON.stringify(roleRows));
console.log('DUPLICATE_NAMES', JSON.stringify(duplicateNames));
console.log('LEAD_CHANNEL_PARTNER_VALUES', JSON.stringify(cpValues));
console.log('LEAD_DEALER_VALUES', JSON.stringify(dealerValues));
console.log('METADATA_PARTNERS', JSON.stringify(metadata.filter(m => m.category === 'channel_partner')));

// Simulate the confirmed import/access precedence without modifying data.
const activeProfiles = profiles.filter(p => p.status !== 'inactive');
const cpNames = new Set(activeProfiles.filter(p => p.user_type === 'agent').map(p => norm(p.name)));
const cpoBranches = new Map(activeProfiles
  .filter(p => ['channel_partner_office', 'office2'].includes(p.user_type))
  .map(p => [norm(p.channel_partner), p]));
const dealers = new Map(activeProfiles.filter(p => p.user_type === 'agent2').map(p => [norm(p.name), p]));

const ruleSummary = { deboarded_ignore_dealer: 0, cp_ignore_dealer: 0, cpo_valid_dealer: 0, cpo_invalid_dealer_fallback: 0, cpo_blank_dealer: 0, unknown_partner: 0 };
const ruleExamples = [];
for (const lead of activeLeads) {
  const cp = norm(lead.channel_partner);
  const dealerName = norm(lead.sub_channel_partner);
  let result;
  if (cp === 'deboarded' || cp === 'deborded') {
    result = 'deboarded_ignore_dealer';
  } else if (cpNames.has(cp)) {
    result = 'cp_ignore_dealer';
  } else if (cpoBranches.has(cp)) {
    if (!dealerName) {
      result = 'cpo_blank_dealer';
    } else {
      const dealer = dealers.get(dealerName);
      result = dealer && norm(dealer.channel_partner) === cp
        ? 'cpo_valid_dealer'
        : 'cpo_invalid_dealer_fallback';
    }
  } else {
    result = 'unknown_partner';
  }
  ruleSummary[result] += 1;
  if (result.endsWith('fallback') || result === 'unknown_partner') {
    if (ruleExamples.length < 30) ruleExamples.push({ id: lead.id, channel_partner: lead.channel_partner, sub_channel_partner: lead.sub_channel_partner, result });
  }
}
console.log('RULE_SIMULATION', JSON.stringify(ruleSummary));
console.log('RULE_EXAMPLES', JSON.stringify(ruleExamples));

await adminClient.auth.signOut();
