import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cjskyhxameobcqlfiuav.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqc2t5aHhhbWVvYmNxbGZpdWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDgwODQsImV4cCI6MjEwMTU4NDA4NH0.jkVoak3KLW4He49fBnXnozWZZy6AXjk0AyEscv7Dx8g'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const { data: profiles } = await supabase.from('profiles').select('name, channel_partner, user_type').or('name.ilike.%om solar%,channel_partner.ilike.%om solar%,name.ilike.%rahul%');
    console.log("PROFILES:", profiles);
    
    const { data: admins } = await supabase.from('admin').select('customer_name, channel_partner, sub_channel_partner').or('channel_partner.ilike.%om solar%,sub_channel_partner.ilike.%rahul%');
    console.log("CUSTOMERS:", admins);
}

test().catch(console.error);
