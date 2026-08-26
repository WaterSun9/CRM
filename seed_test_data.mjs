import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cjskyhxameobcqlfiuav.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqc2t5aHhhbWVvYmNxbGZpdWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMDgwODQsImV4cCI6MjEwMTU4NDA4NH0.jkVoak3KLW4He49fBnXnozWZZy6AXjk0AyEscv7Dx8g'

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
    // 1. Add om solar to channel partner meta
    const { data: existingCp } = await supabase.from('meta').select('*').eq('category', 'channel_partner').ilike('label', 'om solar').single();
    if (!existingCp) {
        await supabase.from('meta').insert([{ category: 'channel_partner', label: 'om solar' }]);
        console.log("Added 'om solar' to channel partners");
    } else {
        console.log("'om solar' already exists");
    }

    // 2. Add Rahul Sharma as agent2
    const { data: existingAgent } = await supabase.from('profiles').select('*').ilike('name', 'rahul sharma').single();
    if (!existingAgent) {
        // We can't easily create an auth user without the admin API, but we can insert into profiles.
        // Usually auth.users needs to be created. 
        // But the user can just type 'rahul sharma' as sub channel partner.
        console.log("To fully test, a user account for Rahul Sharma should be created via User Management.");
    }
}

seed().catch(console.error);
