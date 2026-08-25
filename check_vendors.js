import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://cjskyhxameobcqlfiuav.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqc2t5aHhhbWVvYmNxbGZpdWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDgwODQsImV4cCI6MjEwMTU4NDA4NH0.jkVoak3KLW4He49fBnXnozWZZy6AXjk0AyEscv7Dx8g'
)

async function check() {
  console.log('Querying admin table for vendor values...');
  
  // Get all unique vendor names
  const { data, error } = await supabase
    .from('admin')
    .select('vendor')
    .not('vendor', 'is', null)
    .neq('vendor', '');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const distinctVendors = [...new Set((data || []).map(r => r.vendor))];
  console.log('\n--- ALL DISTINCT VENDOR VALUES IN DB ---');
  console.log(distinctVendors.length > 0 ? distinctVendors : 'NONE (Every single vendor field is empty or null)');
  
  // Specifically look for V2 (case insensitive)
  const v2Matches = (data || []).filter(r => r.vendor && r.vendor.toLowerCase().includes('v2'));
  console.log(`\n--- RECORDS CONTAINING "v2" ---`);
  console.log(`Found ${v2Matches.length} records.`);
  
  if (v2Matches.length > 0) {
     console.log('Exact values:', [...new Set(v2Matches.map(r => r.vendor))]);
  }
  
}
check();
