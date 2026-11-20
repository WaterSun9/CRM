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
// Each finding is a row with choices; one choice is the default. "No change" is always a
// choice. Rows of the same name with no login are grouped (one choice for all their customers).
// Each customer is in at most one row per check (the first rule that applies). Deleted and
// DEBOARDED customers are left alone (rule 9). Moving to DEBOARDED puts DEBOARDED in the CP
// box and keeps the old name in the Dealer box, for history.

export const nameKey = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
// What differs between two spellings of the same name, in words, e.g. "extra space" or
// "capitals" (Spelling tab, 2026-11-20: a double space looks the same on screen). '' when they
// are not the same name, or not different at all.
export function spellingDifference(from, to) {
    const a = String(from ?? ''), b = String(to ?? '');
    if (!a || !b || a === b || nameKey(a) !== nameKey(b)) return '';
    const spaces = value => (value.match(/\s/g) || []).length;
    const words = [];
    if (spaces(a) > spaces(b)) words.push('extra space');
    else if (spaces(a) < spaces(b)) words.push('missing space');
    else {
        const spacing = value => value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s/g, ' ');
        if (spacing(a) !== spacing(b)) words.push('spaces');
    }
    const bare = value => value.replace(/[^A-Za-z0-9]/g, '');
    if (bare(a) !== bare(b)) words.push('capitals');
    const marks = value => value.replace(/[A-Za-z0-9\s]/g, '');
    if (marks(a) !== marks(b)) words.push(/^\.*$/.test(marks(a) + marks(b)) ? 'dots' : 'punctuation');
    return words.join(', ');
}

// Where a line's cards came from, in words. The client's sheet was imported on 1 Sep 2026
// (D-006); cards added after that were typed in the CRM (2026-11-20: "say from sheet").
export const SHEET_IMPORT_DAY = '2026-09-01';
const istDay = iso => (iso ? new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 10) : '');
const monthName = day => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export function cardsSource(cards) {
    const days = (cards || []).map(c => istDay(c.created_at)).filter(Boolean);
    if (!days.length) return '';
    const sheet = days.filter(d => d === SHEET_IMPORT_DAY).length, later = days.length - sheet;
    const laterDays = days.filter(d => d !== SHEET_IMPORT_DAY).sort();
    const span = laterDays.length ? (monthName(laterDays[0]) === monthName(laterDays.at(-1)) ? monthName(laterDays[0]) : `${monthName(laterDays[0])} to ${monthName(laterDays.at(-1))}`) : '';
    if (!later) return sheet === 1 ? 'This card came from the client\'s sheet (imported 1 Sep 2026).' : `All ${sheet} cards came from the client's sheet (imported 1 Sep 2026).`;
    if (!sheet) return `${later === 1 ? 'This card was' : `All ${later} cards were`} added in the CRM (${span}).`;
    return `${sheet} card${sheet === 1 ? '' : 's'} from the client's sheet (1 Sep 2026), ${later} added in the CRM (${span}).`;
}

export const DEBOARDED = 'DEBOARDED';
export const NO_CHANGE = 'none';

export const RULES = [
    { id: 'cp_as_dealer', title: 'CP written as dealer', grouped: true,
        rule: 'The name in the Dealer box is an independent CP with its own CP login. A CP is never a dealer: put them in the CP box and empty the Dealer box (rules 2 and 6). One line per CP / CPO and dealer pair; the choice applies to all its customers.' },
    { id: 'dealer_under_cp', title: 'Dealer filled in under an independent CP', grouped: true,
        rule: 'An independent CP works alone and has no dealers, so the Dealer box stays empty (rule 6). One line per CP and dealer pair; the choice applies to all its customers.' },
    { id: 'dealer_other_cpo', title: 'Dealer belongs to another CPO', grouped: true,
        rule: 'The dealer name has a login under a different CPO. Same person: move the customers to that CPO and keep the dealer. Different people: the customers stay with their CPO and the Dealer box is emptied (rule 7). One line per CPO and dealer pair.' },
    { id: 'spelling', title: 'Name spelled differently from the login', grouped: true,
        rule: 'Same letters, but capitals, spaces or dots differ from the login. Same person: use the login\'s spelling (rule 10). Different people: leave it. One line per spelling.' },
    { id: 'cp_no_login', title: 'CP / CPO with no login', grouped: true,
        rule: 'Nobody has a CP or CPO login with this name. Leave it, change it to an existing login, or move these customers to DEBOARDED.' },
    { id: 'dealer_no_login', title: 'Dealer with no login', grouped: true,
        rule: 'No dealer login with this name under the CPO. Leave it, change it to one of the CPO\'s dealers, empty the Dealer box, or move these customers to DEBOARDED.' },
    { id: 'misc', title: 'Miscellaneous',
        rule: 'Other cases that need a person to decide: an empty CP box, an office staff name in the Dealer box, a CPO\'s name in the Dealer box. Nothing changes unless you pick.' },
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

const isActive = p => String(p?.status || 'active').toLowerCase() !== 'inactive';

// Logins in the shape the rules need.
export function loginIndex(profiles) {
    const active = (profiles || []).filter(isActive);
    const cps = spellings(active.filter(p => p.user_type === 'agent').map(p => p.name));
    const branches = spellings(active.filter(p => p.user_type === 'channel_partner_office').map(p => p.channel_partner));
    // dealer key -> Map(branch key -> exact dealer name)
    const dealers = new Map();
    // branch key -> [exact dealer names]
    const dealersOf = new Map();
    for (const p of active.filter(p => p.user_type === 'agent2')) {
        const dKey = nameKey(p.name), bKey = nameKey(p.channel_partner);
        if (!dKey) continue;
        const under = dealers.get(dKey) || new Map();
        if (!under.has(bKey)) {
            under.set(bKey, clean(p.name));
            dealersOf.set(bKey, [...(dealersOf.get(bKey) || []), clean(p.name)]);
        }
        dealers.set(dKey, under);
    }
    // Office staff (admin, office) names, and CPO login names: never a dealer.
    const staff = spellings(active.filter(p => ['admin', 'sales'].includes(p.user_type)).map(p => p.name));
    const cpoNames = spellings(active.filter(p => p.user_type === 'channel_partner_office').map(p => p.name));
    return { cps, branches, dealers, dealersOf, staff, cpoNames };
}

const isDeboarded = card => /deboard/i.test(`${card.channel_partner || ''} ${card.sub_channel_partner || ''} ${card.stage || ''}`);
const patch = (card, to) => {
    const changes = {};
    if ('channel_partner' in to && (to.channel_partner ?? null) !== (card.channel_partner ?? null)) changes.channel_partner = to.channel_partner ?? null;
    if ('sub_channel_partner' in to && (to.sub_channel_partner || null) !== (card.sub_channel_partner || null)) changes.sub_channel_partner = to.sub_channel_partner || null;
    return changes;
};

// What is wrong with one card: { rule, key (group), ... } or null.
export function findingFor(card, index) {
    if (!card || card.deleted_at || isDeboarded(card)) return null;
    const cp = clean(card.channel_partner), dealer = clean(card.sub_channel_partner);
    const cpKey = nameKey(cp), dealerKey = nameKey(dealer);
    const cpIsIndependent = index.cps.has(cpKey);
    const cpIsBranch = index.branches.has(cpKey);
    const dealerUnder = dealerKey ? index.dealers.get(dealerKey) : null;

    // 1. The Dealer box holds an independent CP (and not also a dealer of this CPO).
    if (dealerKey && index.cps.has(dealerKey) && !(dealerUnder && dealerUnder.has(cpKey))) return { rule: 'cp_as_dealer', cpName: index.cps.get(dealerKey) };
    // Misc: an empty CP box.
    if (!cpKey) return { rule: 'misc', kind: 'empty_cp', problem: 'Empty CP box' };
    // 2. A CP name nobody has a login for.
    if (cpKey && !cpIsIndependent && !cpIsBranch) return { rule: 'cp_no_login', key: cpKey, name: cp };
    // 3. An independent CP with something in the Dealer box.
    if (cpIsIndependent && !cpIsBranch && dealerKey) return { rule: 'dealer_under_cp' };
    // Misc: an office staff name, or a CPO's own name, in the Dealer box (and not also a dealer login here).
    if (cpIsBranch && dealerKey && !(dealerUnder && dealerUnder.has(cpKey))) {
        if (index.staff.has(dealerKey)) return { rule: 'misc', kind: 'staff_as_dealer', problem: `Office staff ${index.staff.get(dealerKey)} as dealer` };
        if (index.branches.has(dealerKey) || index.cpoNames.has(dealerKey)) return { rule: 'misc', kind: 'cpo_as_dealer', problem: 'A CPO\'s name as dealer' };
    }
    // 4. A CPO customer whose dealer is a login under another CPO only.
    if (cpIsBranch && dealerUnder && !dealerUnder.has(cpKey)) {
        const otherKey = [...dealerUnder.keys()][0];
        return { rule: 'dealer_other_cpo', otherBranch: index.branches.get(otherKey) || null, otherDealer: dealerUnder.get(otherKey) };
    }
    // 5. Spelling: the CP box and / or the Dealer box differ only in capitals, spaces or dots.
    const exactCp = cpIsBranch ? index.branches.get(cpKey) : cpIsIndependent ? index.cps.get(cpKey) : null;
    const exactDealer = cpIsBranch && dealerUnder?.has(cpKey) ? dealerUnder.get(cpKey) : null;
    const newCp = exactCp && exactCp !== String(card.channel_partner ?? '') ? exactCp : null;
    const newDealer = exactDealer && exactDealer !== String(card.sub_channel_partner ?? '') ? exactDealer : null;
    if (newCp || newDealer) return { rule: 'spelling', to: { channel_partner: newCp || card.channel_partner, sub_channel_partner: newDealer || card.sub_channel_partner } };
    // 6. A CPO customer whose dealer has no login anywhere.
    if (cpIsBranch && dealerKey && !dealerUnder) return { rule: 'dealer_no_login', key: `${cpKey}|${dealerKey}`, name: dealer, branch: exactCp };
    return null;
}

const option = (id, label, to) => ({ id, label, to });
const noChange = (label = 'No change') => option(NO_CHANGE, label, null);

// Every finding as rows with choices: { [ruleId]: [row] }.
// row = { id, rule, title, cards: [card], options: [{ id, label, to }], choice }
// Use changesFor(row, card, choice) to get what to save for one card.
export function checkCards(cards, profiles) {
    const index = loginIndex(profiles);
    const loginNames = [...new Set([...index.branches.values(), ...index.cps.values()])].sort((a, b) => a.localeCompare(b));
    const byRule = Object.fromEntries(RULES.map(r => [r.id, []]));
    const groups = new Map();
    for (const card of cards || []) {
        const f = findingFor(card, index);
        if (!f) continue;
        const cp = clean(card.channel_partner), dealer = clean(card.sub_channel_partner);
        const cpKind = index.branches.has(nameKey(cp)) ? 'CPO' : 'CP';
        // One line per CP / dealer pair (exact spelling): the choice applies to all its customers.
        const pair = (title, detail, options, choice) => {
            const id = `${f.rule}:${String(card.channel_partner ?? '')}|${String(card.sub_channel_partner ?? '')}`;
            const group = groups.get(id);
            if (group) { group.cards.push(card); return; }
            const row = { id, rule: f.rule, title, detail, cards: [card], options, choice };
            groups.set(id, row);
            byRule[f.rule].push(row);
        };
        if (f.rule === 'cp_as_dealer') {
            const same = nameKey(cp) === nameKey(f.cpName);
            pair(same ? `CP ${f.cpName} is also written as their own dealer`
                : `CP ${f.cpName} is written as a dealer under ${cpKind} ${cp}`,
            same ? `${f.cpName} has a CP login. A CP is never a dealer, so the Dealer box should be empty.`
                : `${f.cpName} has their own CP login, so they are not ${cp}'s dealer. Moving makes these customers ${f.cpName}'s own (${cp} no longer sees them).`,
            [option('fix', same ? `Keep CP ${f.cpName}, empty the Dealer box` : `Move to CP ${f.cpName} only, empty dealer`, { channel_partner: f.cpName, sub_channel_partner: null }), noChange()], 'fix');
        } else if (f.rule === 'dealer_under_cp') {
            const under = index.dealers.get(nameKey(dealer));
            const where = under ? [...under.keys()].map(k => index.branches.get(k)).filter(Boolean) : [];
            pair(`${dealer} is written as a dealer under independent CP ${cp}`,
                `An independent CP has no dealers.${where.length ? ` ${dealer} is a dealer login under CPO ${where.join(', ')}.` : ` ${dealer} has no dealer login.`}`,
                [option('fix', `Keep CP ${cp}, empty the Dealer box`, { sub_channel_partner: null }), noChange()], 'fix');
        } else if (f.rule === 'dealer_other_cpo') {
            const options = [option('empty', `Different people: stay with ${cp}, empty dealer`, { sub_channel_partner: null })];
            if (f.otherBranch) options.push(option('move', `Same person: move to CPO ${f.otherBranch}, keep dealer ${f.otherDealer}`, { channel_partner: f.otherBranch, sub_channel_partner: f.otherDealer }));
            options.push(noChange());
            pair(`Cards say CPO ${cp}, dealer ${dealer}. There is no ${dealer} login under ${cp}; the only ${f.otherDealer} login is a dealer under ${f.otherBranch ? `CPO ${f.otherBranch}` : 'another CPO'}`,
                `Same name under two CPOs. Is the ${dealer} on ${cp}'s cards the same person as the ${f.otherDealer} login under ${f.otherBranch || 'the other CPO'}?`,
                options, 'empty');
        } else if (f.rule === 'spelling') {
            // Words, not the two names side by side: a double space looks the same on screen.
            const how = what => ({ 'extra space': 'with an extra space', 'missing space': 'without a space', spaces: 'with the spaces in a different place', capitals: 'in different capitals', dots: 'with different dots', punctuation: 'with different punctuation' }[what] || `with ${what}`);
            const parts = [];
            for (const [label, from, to] of [[cpKind, card.channel_partner, f.to.channel_partner], ['Dealer', card.sub_channel_partner, f.to.sub_channel_partner]]) {
                if (to === from) continue;
                const what = spellingDifference(from, to);
                parts.push(`${label} ${to} is written ${what ? what.split(', ').map(how).join(' and ') : 'differently'} on these cards`);
            }
            pair(parts.join('; '),
                'The letters are the same as the login. Same person: use the login\'s spelling, so the name matches in every list and filter.',
                [option('same', `Same person: use the login spelling`, f.to), noChange('Different people: no change')], 'same');
        } else if (f.rule === 'misc') {
            const options = [noChange()];
            if (f.kind === 'empty_cp') options.push(...loginNames.map(name => option(`login:${name}`, `Set CP to ${name}`, { channel_partner: name })));
            else options.push(option('empty', 'Empty the Dealer box', { sub_channel_partner: null }));
            byRule.misc.push({ id: `misc:${card.id}`, rule: 'misc', title: card.customer_name, problem: f.problem, cards: [card], options, choice: NO_CHANGE });
        } else {
            const group = groups.get(`${f.rule}:${f.key}`);
            if (group) { group.cards.push(card); continue; }
            let options;
            if (f.rule === 'cp_no_login') {
                options = [noChange(),
                    option('deboard', `Move to ${DEBOARDED}, keep ${f.name} as dealer`, { channel_partner: DEBOARDED, sub_channel_partner: f.name }),
                    ...loginNames.map(name => option(`login:${name}`, `Change CP to ${name}`, { channel_partner: name }))];
            } else {
                const dealersHere = (index.dealersOf.get(nameKey(f.branch)) || []).slice().sort((a, b) => a.localeCompare(b));
                options = [noChange(),
                    option('empty', 'Empty the Dealer box', { sub_channel_partner: null }),
                    option('deboard', `Move to ${DEBOARDED}, keep ${f.name} as dealer`, { channel_partner: DEBOARDED, sub_channel_partner: f.name }),
                    ...dealersHere.map(name => option(`login:${name}`, `Change dealer to ${name}`, { sub_channel_partner: name }))];
            }
            const row = { id: `${f.rule}:${f.key}`, rule: f.rule, title: f.rule === 'cp_no_login' ? f.name : `${f.name} (under ${f.branch})`, cards: [card], options, choice: NO_CHANGE };
            groups.set(row.id, row);
            byRule[f.rule].push(row);
        }
    }
    for (const rule of RULES.filter(r => r.grouped)) byRule[rule.id].sort((a, b) => b.cards.length - a.cards.length || a.title.localeCompare(b.title));
    return byRule;
}

// What to save for one card of a row under a choice ({} = nothing).
export function changesFor(row, card, choice = row.choice) {
    const picked = row.options.find(o => o.id === choice);
    return picked?.to ? patch(card, picked.to) : {};
}

// Active CP, CPO and dealer logins with no live customer: [{ login, kind }], oldest first.
export function unusedLogins(cards, profiles) {
    const live = (cards || []).filter(c => !c.deleted_at);
    const cpKeys = new Set(live.map(c => nameKey(c.channel_partner)));
    const dealerPairs = new Set(live.map(c => `${nameKey(c.channel_partner)}|${nameKey(c.sub_channel_partner)}`));
    const kinds = { channel_partner_office: 'CPO', agent: 'CP', agent2: 'Dealer' };
    return (profiles || []).filter(p => isActive(p) && kinds[p.user_type]).filter(p => {
        if (p.user_type === 'channel_partner_office') return !cpKeys.has(nameKey(p.channel_partner));
        if (p.user_type === 'agent') return !cpKeys.has(nameKey(p.name));
        return !dealerPairs.has(`${nameKey(p.channel_partner)}|${nameKey(p.name)}`);
    }).map(p => ({ login: p, kind: kinds[p.user_type] }))
        .sort((a, b) => String(a.login.created_at || '').localeCompare(String(b.login.created_at || '')));
}
