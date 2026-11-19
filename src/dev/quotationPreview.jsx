// Development-only fixture. No production API calls or real customer records.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { GlobalPopupProvider } from '../components/GlobalPopup';
import QuotationModule from '../quotations/QuotationModule';
import CustomerDetailModal from '../components/CustomerDetailModal';
import { supabase } from '../supabase';
import { memoryClient } from '../../tests/quotations/memoryClient.mjs';
import { newForm,payload } from '../quotations/model';
import { brandedTemplate } from '../quotations/branding';
import { quotationRepository } from '../quotations/client';
import { generateQuotationPdf } from '../quotations/pdf';

if (import.meta.env.DEV) {
    const user={id:'11111111-1111-4111-8111-111111111111',name:'Test Agent',phone:'9876543210',userType:new URLSearchParams(location.search).get('role') || 'agent'};
    const id='22222222-2222-4222-8222-222222222222';
    const lead={id:'33333333-3333-4333-8333-333333333333',customer_name:'Existing Test Customer',phone_number:'9876543211',email_address:'test@example.com',full_address:'12 Test Street',villages:'Radhanpur',sub_divisions:'Radhanpur',district:'Patan',pincode:'385340',system_capacity_kwp:3.48,module_brand:'Waaree',no_of_modules:6,module_wp:580,stage:'LEADS'};
    const form={...newForm(user),customer_name:'Test Customer A',customer_phone:'9876543211',customer_email:'testcustomer@example.com',full_address:'12 Test Society, Radhanpur',village:'Radhanpur',taluka:'Radhanpur',district:'Patan',pincode:'385340',capacity_kw:3.48,solar_panel_make:'Waaree 580',solar_panel_qty:6,panel_wattage:580,inverter_option:'Option 1',inverter_brand:'Solaryan',geb_geda_charge:'Including',options:['Waaree Solar','Tata Power Solar','Adani Solar'].map((brandName,i)=>({brandName,panel_wattage:[580,600,550][i],solar_panel_qty:[6,7,8][i],capacity_kw:[3.48,4.2,4.4][i],baseValue:189000+i*8000,discount:0,subsidy:78000}))};
    // Test Customer A has one quote; Old Customer B has an older quote with three options.
    const row={...payload({...form,options:[form.options[0]]},brandedTemplate()),id,owner_id:user.id,quotation_no:3255,status:'draft',created_at:'2026-09-10T12:00:00Z',updated_at:'seed'};
    row.quotation_data.client_id=id; row.quotation_data.client_seq=1;
    const older={...payload({...form,customer_name:'Old Customer B',customer_phone:'9876543212'},brandedTemplate()),id:'44444444-4444-4444-8444-444444444444',owner_id:user.id,quotation_no:3200,status:'issued',issued_at:'2026-09-01T10:00:00Z',created_at:'2026-09-01T10:00:00Z',updated_at:'seed-old'};
    if(new URLSearchParams(location.search).has('issued')) { row.status='issued'; row.issued_at=new Date().toISOString(); }
    // ?fresh starts from the seed again instead of the last run.
    const seed=(!new URLSearchParams(location.search).has('fresh') && JSON.parse(sessionStorage.getItem('q-fixture') || 'null')) || {quotations:[older,row],admin:[lead],profiles:[{...user,phone_number:user.phone}]};
    const client=memoryClient(seed);
    supabase.from=client.from;
    // All fixture writes, including PDF storage, stay in memory.
    // ?slow=3000 makes each stored file take that long, like a phone on a weak signal.
    const slow=Number(new URLSearchParams(location.search).get('slow')) || 0;
    supabase.storage.from = () => ({upload:async () => { if(slow) await new Promise(r=>setTimeout(r,slow)); return {data:{path:'fixture-only'},error:null}; },remove:async () => ({error:null}),createSignedUrl:async () => ({data:{signedUrl:'about:blank'},error:null})});
    supabase.rpc = async () => ({data:null,error:null});
    supabase.auth.getSession = async () => ({data:{session:{user:{id:user.id}}},error:null});
    window.addEventListener('beforeunload',()=>sessionStorage.setItem('q-fixture',JSON.stringify(client.state.tables)));
    window.quotationFixture={client,row,user,repo:quotationRepository,generateQuotationPdf};
    if(!location.hash) location.hash='/quotations';
    const meta={module_brand:['WAAREE','TATA','ADANI'],module_wp:['580','600','610'],inverter_make:['Solaryan','Growatt','Sungrow']};
    // ?card opens the real customer card on View lead (19 Nov 2026 quote-to-lead check).
    const withCard=new URLSearchParams(location.search).has('card');
    const Demo=()=>{
        const [lead,setLead]=React.useState(null);
        return <><QuotationModule embedded user={user} meta={meta} onViewLead={selected=>withCard ? setLead(selected) : window.alert(`View Lead: ${selected.customer_name}`)} onCreateLead={async(data,files,quote)=>quotationRepository.insertConversionLead(quote,data,user)} />
            {lead && <CustomerDetailModal customer={lead} user={user} meta={meta} defaultTab="LEADS" onClose={()=>setLead(null)} onUpdate={async()=>true} onDelete={()=>{}} />}</>;
    };
    createRoot(document.getElementById('root')).render(<GlobalPopupProvider><Demo /></GlobalPopupProvider>);
} else { document.getElementById('root').textContent='This test fixture is available only in development.'; }
