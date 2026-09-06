#!/usr/bin/env node
// Creates or cleans up ONE uniquely tagged Vendor test lead.
// Usage:
//   node scripts/vendor_stage_test_fixture.mjs create
//   node scripts/vendor_stage_test_fixture.mjs cleanup <uuid>

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(line => line.includes('=') && !line.trim().startsWith('#'))
    .map(line => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const accounts = new Map((env.LOADTEST_ACCOUNTS || '').split(',').map(pair => {
  const i = pair.indexOf(':');
  return [pair.slice(0, i).trim().toLowerCase(), pair.slice(i + 1)];
}));

const adminEmail = 'admin@crm.com';
const vendorEmail = 'vendor@crm.com';
const adminPassword = accounts.get(adminEmail);
const vendorPassword = accounts.get(vendorEmail);
if (!adminPassword || !vendorPassword) throw new Error('Fake Admin/Vendor credentials are not configured in LOADTEST_ACCOUNTS');

const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const signIn = async (email, password) => {
  const sb = client();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data?.user) throw error || new Error(`Login failed: ${email}`);
  return { sb, user: data.user };
};

const mode = process.argv[2];
if (mode === 'create') {
  const admin = await signIn(adminEmail, adminPassword);
  const vendor = await signIn(vendorEmail, vendorPassword);
  const { data: vendorProfile, error: profileError } = await vendor.sb
    .from('profiles').select('id,name,email,user_type,status').eq('id', vendor.user.id).single();
  if (profileError) throw profileError;
  if (vendorProfile.user_type !== 'vendor' || vendorProfile.status === 'inactive') {
    throw new Error(`Fake Vendor profile is not an active vendor: ${JSON.stringify(vendorProfile)}`);
  }

  const tag = `ZZ_VENDOR_STAGE_TEST_${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;
  const { data: created, error: insertError } = await admin.sb.from('admin').insert({
    customer_name: tag,
    stage: 'INSTALLATION STATUS',
    vendor: vendorProfile.name,
    installation_status: 'Pending',
    villages: 'TEST VILLAGE - DELETE ME',
    sub_divisions: 'TEST TEHSIL - DELETE ME',
    internal_remarks: `${tag} synthetic diagnostic row; safe to delete`,
    created_at: new Date().toISOString(),
  }).select('id,customer_name,stage,vendor,installation_status').single();
  if (insertError) throw insertError;

  const { data: visible, error: visibleError } = await vendor.sb.from('admin')
    .select('id,customer_name,stage,vendor,installation_status')
    .eq('id', created.id).single();
  if (visibleError) throw new Error(`Created row is not visible to fake Vendor: ${visibleError.message}`);

  console.log(JSON.stringify({ tag, id: created.id, vendorProfile, created, vendorVisible: visible }));
  await Promise.all([admin.sb.auth.signOut(), vendor.sb.auth.signOut()]);
} else if (mode === 'cleanup') {
  const id = process.argv[3];
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('Cleanup requires the exact test UUID');
  const admin = await signIn(adminEmail, adminPassword);
  const { data: row, error: lookupError } = await admin.sb.from('admin')
    .select('id,customer_name,internal_remarks').eq('id', id).single();
  if (lookupError) throw lookupError;
  if (!String(row.customer_name || '').startsWith('ZZ_VENDOR_STAGE_TEST_') ||
      !String(row.internal_remarks || '').includes('synthetic diagnostic row')) {
    throw new Error('Refusing cleanup: row does not carry both synthetic test markers');
  }
  const { error: deleteError } = await admin.sb.from('admin').delete().eq('id', id);
  if (deleteError) throw deleteError;
  console.log(JSON.stringify({ cleaned: true, id }));
  await admin.sb.auth.signOut();
} else {
  throw new Error('Use create or cleanup <uuid>');
}
