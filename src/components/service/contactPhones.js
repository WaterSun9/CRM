import { supabase } from '../../supabase';

const missingFunction = failure => failure?.code === 'PGRST202' || /could not find the function/i.test(failure?.message || '');

// Partner and dealer phone numbers for a customer card (channel_partner /
// sub_channel_partner), via contact_phones (20261027120000_partner_profile_phone.sql).
// On a database without it yet: the partner's number from the directory, no dealer number.
// -> { partner: '9876543210' | '', dealer: '' }
export async function contactPhones(partner, dealer) {
    const name = String(partner || '').trim();
    const { data, error } = await supabase.rpc('contact_phones', { p_partner: name || null, p_dealer: String(dealer || '').trim() || null });
    if (!error) return { partner: data?.[0]?.partner_phone || '', dealer: data?.[0]?.dealer_phone || '' };
    if (!missingFunction(error) || !name) return { partner: '', dealer: '' };
    const { data: rows } = await supabase.from('metadata').select('phone').eq('category', 'channel_partner').ilike('label', name);
    return { partner: (rows || []).map(row => row.phone).find(Boolean) || '', dealer: '' };
}
