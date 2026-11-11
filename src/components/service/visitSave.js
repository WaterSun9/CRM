// Guards against paying one trip twice.
//
// 1. A repeat Save: on a slow network the first insert can succeed while the phone
//    never hears back, so Save is tapped again. Each form opening carries one
//    save key (combined trips: one trip_group); the database keeps one row per
//    key and complaint, so the repeat is refused and we treat it as saved.
// 2. Two office people paying the same visit: before saving we look for a visit
//    already saved on these complaints for that date and ask for a second Save.

// The repeat of a save that already went through.
export function isRepeatSave(failure) {
    const message = failure?.message || '';
    return failure?.code === '23505' && /service_visits_save_key|service_visits_group_issue/.test(message);
}

// The database update that adds save_key has not been run yet.
export function saveKeyMissing(failure) {
    const message = failure?.message || '';
    return /save_key/.test(message) && (failure?.code === 'PGRST204' || failure?.code === '42703' || /column/i.test(message));
}

// "Already saved" text for visits found on the same date, or '' when there are none.
export function sameDayWarning(existing, { ticketOf = () => '', dateText = '' } = {}) {
    if (!existing?.length) return '';
    const parts = existing.map(row => {
        const ticket = ticketOf(row.issue_id);
        const money = Number(row.amount_inr) ? `₹${Number(row.amount_inr)}` : '₹0';
        return `${ticket ? `${ticket}: ` : ''}${Number(row.kilometers) || 0} km, ${money}`;
    });
    return `A visit is already saved for ${dateText || 'this date'} (${parts.join('; ')}). `
        + 'Check it is not the same trip. If this really is another visit, tap Save again.';
}

// The same-date check is answered once per set of complaints and date.
export const sameDayKey = (issueIds, date) => `${[...issueIds].sort().join(',')}|${date}`;

// Visits already saved on these complaints for this date. Rows carrying our own
// save key are this form's earlier Save that did go through (mine: true).
export async function readSameDayVisits(client, issueIds, date, saveKey) {
    const read = columns => client.from('service_visits').select(columns).in('issue_id', issueIds).eq('visit_date', date);
    let { data, error } = await read('id, issue_id, kilometers, amount_inr, save_key');
    if (error && saveKeyMissing(error)) ({ data, error } = await read('id, issue_id, kilometers, amount_inr'));
    if (error) throw error;
    const rows = data || [];
    return { mine: Boolean(saveKey) && rows.some(row => row.save_key === saveKey), others: rows.filter(row => !saveKey || row.save_key !== saveKey) };
}

// Picks what to do before inserting: 'saved' (our earlier Save went through),
// 'ask' (someone else's visit on that date, not yet confirmed) or 'save'.
export function beforeSave({ mine, others }, confirmed) {
    if (mine) return 'saved';
    if (others.length && !confirmed) return 'ask';
    return 'save';
}
