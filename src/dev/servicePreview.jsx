// Local-only fixture: no customer records, authentication, storage or API writes.
import { createRoot } from 'react-dom/client';
import '../index.css';
import ServiceIssuesView from '../components/ServiceIssuesView';
import { GlobalPopupProvider } from '../components/GlobalPopup';
import { supabase } from '../supabase';
import { memoryClient } from '../../tests/quotations/memoryClient.mjs';

if (import.meta.env.DEV) {
    const user = {id:'11111111-1111-4111-8111-111111111111',name:'Demo Office',userType:'admin'};
    const technician = {id:'33333333-3333-4333-8333-333333333333',name:'Demo Technician'};
    const issue = {id:'22222222-2222-4222-8222-222222222222',customer_id:'44444444-4444-4444-8444-444444444444',ticket_no:1001,customer_name:'Demo Solar Customer',consumer_no:'DEMO-1001',customer_phone:'9876543210',service_address:'Demo address, Patan 384265',channel_partner_name:'Demo Partner',system_company_name:'WAAREE',system_kw:5.22,problem_type:'Inverter inspection',comment:'Preview record for layout testing only.',status:'assigned',assigned_to:technician.id,required_date:'2026-10-22',warranty_status:'in_warranty',warranty_start:'2026-09-12',warranty_end:'2031-09-11'};
    const multiple = new URLSearchParams(location.search).has('multiple');
    const seed = {service_issues:[issue,...(multiple ? [{...issue,id:'55555555-5555-4555-8555-555555555555',ticket_no:1002,customer_name:'Second Demo Customer',status:'open',assigned_to:null}] : [])],service_visits:[{id:'visit-1',issue_id:issue.id,visit_date:'2026-10-21',kilometers:40,km_estimate:37,km_note:'Road diversion',amount_inr:200,rate_per_km:5,round_trip:false}],admin:[{id:issue.customer_id,full_address:issue.service_address,pincode:'384265'}],service_km_settings:[{id:true,rate_per_km:5,grace_km:5,round_trip:true}]};
    const client = memoryClient(seed);
    supabase.from = table => { const query = client.from(table); query.limit = size => query.range(0,size - 1); return query; };
    supabase.rpc = async name => ({data:name === 'service_technicians' ? [technician] : [],error:null});
    supabase.auth.getUser = async () => ({data:{user:{id:user.id}},error:null});
    createRoot(document.getElementById('root')).render(<GlobalPopupProvider><div className="min-h-screen bg-[#FCFBFA] md:pl-64"><aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-white p-6 md:block"><strong>Watersun CRM</strong><p className="mt-8 text-sm text-stone-500">Warranty</p><p className="mt-3 rounded-xl bg-stone-900 p-3 text-sm font-semibold text-white">Complaints</p></aside><main className="p-4 lg:p-8"><h1 className="mb-4 text-2xl font-bold">Complaints</h1><ServiceIssuesView user={user} embedded initialIssueId={issue.id} /></main></div></GlobalPopupProvider>);
} else document.getElementById('root').textContent = 'Development fixture only.';
