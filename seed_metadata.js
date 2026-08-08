// seed_metadata.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
    const match = envContent.match(new RegExp(`${name}=(.*)`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not found in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const brands = [
  'TATA', 'ADANI', 'GOLDI', 'WAAREE', 'AATMNIRBHAR', 'APS', 'SUNORA', 'GOLDI/ADANI', '620'
];

const partners = [
  'AASHISH', 'ANAND', 'BHAGVAN', 'BHARAT', 'BHARAT AHIR', 'BHARAT MALI', 'BHAVESH JOSHI', 
  'CHETAN', 'CHIRAG', 'DHANERA', 'DHAVALSINH', 'DILIP', 'DINESH', 'DINESH DEV', 'FIROJBHAI', 
  'GIRISH', 'GURUDEV SOLAR', 'J D VYASH', 'JATRUEH', 'JIGAR THARA', 'JUNED', 'KALPESH', 
  'KALUBHAI', 'KAMLESH', 'KARTIK', 'KISHORBHAI', 'LAKHAN', 'MAHESHBHAI', 'MALAY', 'MANOJ', 
  'MEHUL', 'NARESH', 'NILESH', 'PARESH', 'PARTH', 'PATAN', 'PRAKASH', 'PRAVINBHAI', 'RADHE', 
  'RAGNATH', 'RAM', 'RAMJI', 'RATNABHAI', 'RAVI', 'RAVI KADI', 'SAILESH', 'SANDIP', 
  'SHAILESH TRIVEDI', 'SURESHBHAI', 'VADNAGAR', 'VIPUL', 'VISHAL', 'VISHVAS'
];

async function seed() {
    console.log('Upserting brands into metadata table...');
    const brandPayloads = brands.map(label => ({ category: 'module_brand', label }));
    const { error: brandErr } = await supabase.from('metadata').upsert(brandPayloads, { onConflict: 'category,label' });
    if (brandErr) {
        console.error('Error seeding brands:', brandErr.message);
    } else {
        console.log(`Successfully upserted ${brands.length} brands!`);
    }

    console.log('Upserting channel partners into metadata table...');
    const partnerPayloads = partners.map(label => ({ category: 'channel_partner', label }));
    const { error: partnerErr } = await supabase.from('metadata').upsert(partnerPayloads, { onConflict: 'category,label' });
    if (partnerErr) {
        console.error('Error seeding channel partners:', partnerErr.message);
    } else {
        console.log(`Successfully upserted ${partners.length} channel partners!`);
    }
}

seed();
