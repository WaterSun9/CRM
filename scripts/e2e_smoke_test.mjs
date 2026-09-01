// ─── End-to-end smoke test ───────────────────────────────────────────────────
// Creates ONE test customer, walks it through every stage, and checks what each
// of the 8 roles can see and do. Deletes everything it created at the end.
//
//   node scripts/e2e_smoke_test.mjs
//
// Reads credentials from .env (LOADTEST_ACCOUNTS). Writes only to rows it
// created itself - it never touches existing customers.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('.env','utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));

const accounts = (env.LOADTEST_ACCOUNTS||'').split(',').map(s=>s.trim()).filter(Boolean)
  .map(p=>{const i=p.indexOf(':');return {email:p.slice(0,i),password:p.slice(i+1)};});

const pass=[], fail=[];
const check=(name, ok, detail='')=>{ (ok?pass:fail).push(name);
  console.log(`   ${ok?'PASS':'FAIL'}  ${name}${detail?'   '+detail:''}`); };

const login = async (acct) => {
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {auth:{persistSession:false}});
  const { data, error } = await sb.auth.signInWithPassword(acct);
  if (error) return null;
  const { data: me } = await sb.from('profiles').select('id,name,user_type,channel_partner,status').eq('id', data.user.id).single();
  return { sb, me };
};

// every stage the pipeline moves through, in order
const STAGES = ['LEADS','REGISTRATION','CASH','MATERIAL ORDER','MATERIAL INTEGRATION',
  'MATERIAL DELIVERY','INSTALLATION STATUS','GEO TAG PHOTO','DISCOM SUBMISSION',
  'METER INSTALLATION','DISCOM INSPECTION','SUBSIDY STATUS','FINAL REVIEW','COMPLETED'];

let custId=null, admin=null;
const sessions={};

try {
  // ── sign every role in ────────────────────────────────────────────────────
  console.log('\n1. SIGN-IN  (all 8 roles)');
  for (const a of accounts) {
    const s = await login(a);
    check(`sign in ${a.email}`, !!s, s?`-> ${s.me.user_type}`:'');
    if (s) { sessions[s.me.user_type] = s; if (s.me.user_type==='admin') admin = s; }
  }
  if (!admin) throw new Error('no admin session - cannot continue');

  // ── create the test customer, visible to every role ───────────────────────
  console.log('\n2. CREATE a test customer wired to every role');
  const payload = {
    customer_name:'ZZ E2E TEST', stage:'LEADS',
    phone_number:'9999900001', consumer_no:'99999900001', folder_no:'99999999',
    villages:'TESTVILLAGE', sub_divisions:'TESTDIV',
    channel_partner: sessions.channel_partner_office?.me.channel_partner || 'admin',
    sub_channel_partner: sessions.agent2?.me.name || 'AGENT3',
    vendor: sessions.vendor?.me.name || 'V2',
    module_brand:'TESTBRAND', module_wp:'540', no_of_modules:'6', system_capacity_kwp:'3.24',
    payment_type:'Cash',
  };
  const { data:created, error:cErr } = await admin.sb.from('admin').insert(payload).select().single();
  check('insert customer', !cErr && !!created, cErr?cErr.message:'');
  if (!created) throw new Error('cannot continue without the test row');
  custId = created.id;

  // ── who can see it ────────────────────────────────────────────────────────
  console.log('\n3. VISIBILITY  (RLS - who can read this customer)');
  const expectSee = { admin:true, sales:true, channel_partner_office:true, office2:true,
                      agent2:true, agent:false, vendor:true, stamp:false };
  for (const [type, s] of Object.entries(sessions)) {
    const { data } = await s.sb.from('admin').select('id').eq('id', custId);
    const sees = !!(data && data.length);
    const want = expectSee[type];
    check(`${type} can ${want?'see':'NOT see'} it`, sees===want, `(sees=${sees})`);
  }

  // ── walk every stage ──────────────────────────────────────────────────────
  console.log('\n4. STAGE WALK  (admin, via the move_stage RPC)');
  let from='LEADS';
  for (const to of STAGES.slice(1)) {
    const { error } = await admin.sb.rpc('move_stage',
      { p_customer_id:custId, p_new_stage:to, p_old_stage:from, p_remark:`e2e ${from}->${to}` });
    const { data:row } = await admin.sb.from('admin').select('stage').eq('id',custId).single();
    check(`${from} -> ${to}`, !error && row?.stage===to, error?error.message.slice(0,50):`stage=${row?.stage}`);
    from = to;
  }

  // ── writes actually land, per column type ─────────────────────────────────
  console.log('\n5. WRITES LAND  (one column of each type, read back)');
  const cases = [
    ['text',    {module_brand:'E2E-BRAND'},            r=>r.module_brand==='E2E-BRAND'],
    ['numeric', {invoice_value:'54321'},               r=>Number(r.invoice_value)===54321],
    ['date',    {installation_date:'2026-09-01'},      r=>String(r.installation_date).startsWith('2026-09-01')],
    ['boolean', {stamp:true},                          r=>r.stamp===true],
    ['jsonb',   {hold_procurement:{previous_stage:'LEADS'}}, r=>{const v=typeof r.hold_procurement==='string'?JSON.parse(r.hold_procurement):r.hold_procurement; return v?.previous_stage==='LEADS';}],
    ['new cols',{sfdc_photo_text:'S1',warranty_card_text:'W1',file_status:'READY'},
                                                       r=>r.sfdc_photo_text==='S1'&&r.warranty_card_text==='W1'&&r.file_status==='READY'],
  ];
  for (const [label, patch, verify] of cases) {
    const { data:rows, error } = await admin.sb.from('admin').update(patch).eq('id',custId).select('id');
    if (error || !rows?.length) { check(`${label} write`, false, error?error.message.slice(0,50):'0 rows matched'); continue; }
    const { data:back } = await admin.sb.from('admin').select('*').eq('id',custId).single();
    check(`${label} round-trip`, verify(back));
  }

  // ── the phone CHECK constraint ────────────────────────────────────────────
  console.log('\n6. PHONE CONSTRAINT');
  for (const [label,val,shouldPass] of [['+91 number','+919876543210',true],['letters','abc123',false],['bare +','+',false]]) {
    const { error } = await admin.sb.from('admin').update({phone_number:val}).eq('id',custId).select('id');
    check(`${label} ${shouldPass?'accepted':'rejected'}`, shouldPass ? !error : !!error, error?`(${error.code})`:'');
  }
  await admin.sb.from('admin').update({phone_number:'9999900001'}).eq('id',custId).select('id');

  // ── role write permissions ────────────────────────────────────────────────
  console.log('\n7. WRITE PERMISSIONS  (can each role edit this customer?)');
  for (const [type, s] of Object.entries(sessions)) {
    if (type==='admin') continue;
    const { data, error } = await s.sb.from('admin').update({villages:`EDIT-${type}`}).eq('id',custId).select('id');
    const wrote = !error && !!(data && data.length);
    console.log(`   ${type.padEnd(24)} ${wrote?'CAN write':'cannot write'}${error?'  ('+error.code+')':''}`);
  }
  await admin.sb.from('admin').update({villages:'TESTVILLAGE'}).eq('id',custId).select('id');

  // ── move_stage is admin-only ──────────────────────────────────────────────
  console.log('\n8. move_stage RPC is admin-only');
  for (const [type,s] of Object.entries(sessions)) {
    const { error } = await s.sb.rpc('move_stage',{p_customer_id:custId,p_new_stage:'LEADS',p_old_stage:'COMPLETED',p_remark:''});
    const blocked = !!error && /Not permitted/i.test(error.message);
    check(`${type} ${type==='admin'?'allowed':'blocked'}`, type==='admin' ? !error : blocked);
  }

} catch (e) {
  console.log('\nABORTED: '+e.message);
} finally {
  console.log('\n9. CLEANUP');
  if (custId && admin) {
    await admin.sb.from('documents').delete().eq('customer_id',custId).select('id');
    await admin.sb.from('activity_log').update({customer_id:null}).eq('customer_id',custId).select('id');
    const { data } = await admin.sb.from('admin').delete().eq('id',custId).select('id');
    check('test customer deleted', !!(data && data.length));
  }
  const { count } = admin ? await admin.sb.from('admin').select('id',{count:'exact',head:true}) : {count:'?'};
  console.log(`   admin table now holds ${count} rows`);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass.length} passed, ${fail.length} failed`);
  if (fail.length) { console.log('FAILED:'); fail.forEach(f=>console.log('   '+f)); }
}
