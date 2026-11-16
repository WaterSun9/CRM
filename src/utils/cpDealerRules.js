// CP / CPO / dealer rules (the client's rules of Aug–Sep 2026, written down in
// docs/import-issues-2026-11-05/SUMMARY.md, rules 1–11) checked against the live customer
// cards and logins. Pure functions: no database here, so they can be tested.
//
// Logins (public.profiles), active only:
//   CPO     user_type 'channel_partner_office'  branch name = channel_partner
//   CP      user_type 'agent'                   an independent channel partner, name = name
//   Dealer  user_type 'agent2'                  name = name, works under the CPO branch channel_partner
// A customer card: channel_partner (the "CP" box) and sub_channel_partner (the "Dealer" box).
//
// Each customer gets at most one fix per check: the first rule (in RULES order) that applies.
// Customers that are deleted, or DEBOARDED (rule 9), are left alone.

// Same name if letters and digits match, ignoring capitals, spaces and dots ("Sun Energy." = "SUN ENERGY").
export const nameKey = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

export const RULES = [
    {
        id: 'cp_as_dealer',
        title: 'CP written as dealer',
        rule: 'The name in the Dealer box is an independent CP with its own CP login. Put them in the CP box and empty the Dealer box (rules 2 and 6).',
    },
    {
        id: 'dealer_under_cp',
        title: 'Dealer filled in under an independent CP',
        rule: 'An independent CP works alone, so the Dealer box stays empty (rule 6).',
    },
    {
        id: 'dealer_other_cpo',
        title: 'Dealer belongs to another CPO',
        rule: 'The dealer has a login under a different CPO. Empty the Dealer box; the customer stays under its own CPO (rule 7).',
    },
    {
        id: 'spelling',
        title: 'Name spelled differently from the login',
        rule: 'Same name, but capitals, spaces or dots differ from the login. Use the login\'s spelling (rule 10).',
    },
];

// The most used spelling of each name, by key.
function spellings(names) {
    const counts = new Map();
    for (const raw of names) {
        const name = clean(raw);
        const key = nameKey(name);
        if (!key) continue;
        const byName = counts.get(key) || new Map();
        byName.set(name, (byName.get(name) || 0) + 1);
        counts.set(key, byName);
    }
    const best = new Map();
    for (const [key, byName] of counts) best.set(key, [...byName.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
    return best;
}

// Logins in the shape the rules need.
export function loginIndex(profiles) {
    const active = (profiles || []).filter(p => String(p?.status || 'active').toLowerCase() !== 'inactive');
    const cps = spellings(active.filter(p => p.user_type === 'agent').map(p => p.name));
    const branches = spellings(active.filter(p => p.user_type === 'channel_partner_office').map(p => p.channel_partner));
    // dealer key -> Map(branch key -> exact dealer name)
    const dealers = new Map();
    for (const p of active.filter(p => p.user_type === 'agent2')) {
        const dKey = nameKey(p.name), bKey = nameKey(p.channel_partner);
        if (!dKey) continue;
        const under = dealers.get(dKey) || new Map();
        if (!under.has(bKey)) under.set(bKey, clean(p.name));
        dealers.set(dKey, under);
    }
    return { cps, branches, dealers };
}

const deboarded = card => /deboard/i.test(`${card.channel_partner || ''} ${card.sub_channel_partner || ''} ${card.stage || ''}`);

// The one fix for a card, or null. Returns { rule, to: { channel_partner, sub_channel_partner } }.
export function fixFor(card, index) {
    if (!card || card.deleted_at || deboarded(card)) return null;
    const cp = clean(card.channel_partner), dealer = clean(card.sub_channel_partner);
    const cpKey = nameKey(cp), dealerKey = nameKey(dealer);
    const cpIsIndependent = index.cps.has(cpKey);
    const cpIsBranch = index.branches.has(cpKey);
    const dealerUnder = dealerKey ? index.dealers.get(dealerKey) : null;

    // 1. The Dealer box holds an independent CP (and not also a dealer of this CPO).
    if (dealerKey && index.cps.has(dealerKey) && !(dealerUnder && dealerUnder.has(cpKey))) {
        return { rule: 'cp_as_dealer', to: { channel_partner: index.cps.get(dealerKey), sub_channel_partner: null } };
    }
    // 2. An independent CP with something in the Dealer box.
    if (cpIsIndependent && !cpIsBranch && dealerKey) {
        return { rule: 'dealer_under_cp', to: { channel_partner: cp, sub_channel_partner: null } };
    }
    // 3. A CPO customer whose dealer is a login under another CPO only.
    if (cpIsBranch && dealerUnder && !dealerUnder.has(cpKey)) {
        return { rule: 'dealer_other_cpo', to: { channel_partner: cp, sub_channel_partner: null } };
    }
    // 4. Spelling: the CP box and / or the Dealer box differ only in capitals, spaces or dots.
    const exactCp = cpIsBranch ? index.branches.get(cpKey) : cpIsIndependent ? index.cps.get(cpKey) : null;
    const exactDealer = cpIsBranch && dealerUnder?.has(cpKey) ? dealerUnder.get(cpKey) : null;
    const newCp = exactCp && exactCp !== String(card.channel_partner ?? '') ? exactCp : null;
    const newDealer = exactDealer && exactDealer !== String(card.sub_channel_partner ?? '') ? exactDealer : null;
    if (newCp || newDealer) {
        return { rule: 'spelling', to: { channel_partner: newCp || card.channel_partner, sub_channel_partner: newDealer || card.sub_channel_partner } };
    }
    return null;
}

// Every card that breaks a rule, grouped by rule: { [ruleId]: [{ card, to, changes }] }.
// changes = only the fields that change, ready to save.
export function checkCards(cards, profiles) {
    const index = loginIndex(profiles);
    const byRule = Object.fromEntries(RULES.map(r => [r.id, []]));
    for (const card of cards || []) {
        const fix = fixFor(card, index);
        if (!fix) continue;
        const changes = {};
        if ((fix.to.channel_partner ?? null) !== (card.channel_partner ?? null)) changes.channel_partner = fix.to.channel_partner ?? null;
        if ((fix.to.sub_channel_partner || null) !== (card.sub_channel_partner || null)) changes.sub_channel_partner = fix.to.sub_channel_partner || null;
        if (Object.keys(changes).length) byRule[fix.rule].push({ card, to: fix.to, changes });
    }
    return byRule;
}
