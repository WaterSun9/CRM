import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabase';
import { logActivity, logFieldChanges, updateAdminRecord } from '../utils';
import { NO_CHANGE, RULES, SHEET_IMPORT_DAY, cardsSource, changesFor, checkCards, spellingDifference, unusedLogins } from '../utils/cpDealerRules';

// CP / dealer rules (admin only, D-039). Checks every live customer card against the client's
// CP / CPO / dealer rules (src/utils/cpDealerRules.js) and the current logins. Each finding is a
// row with a choice (a sensible default; "No change" is always there); names with no login are
// grouped. Also lists logins with no customers (default keep, or deactivate). One confirm at the
// end applies every choice. Each card is re-read just before saving and skipped if its CP or
// Dealer changed since the check; every change goes into the customer's log.

const COLUMNS = 'id, customer_name, folder_no, stage, channel_partner, sub_channel_partner, deleted_at, created_at';
const shown = value => (value == null || String(value).trim() === '' ? '(empty)' : value);
const csvCell = value => { const s = value == null ? '' : String(value); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const day = iso => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');
// "Set all to" choices per rule (only those every row of the rule has).
const SET_ALL = {
    cp_as_dealer: [['fix', 'Move to the CP only, empty dealer'], [NO_CHANGE, 'No change']],
    dealer_under_cp: [['fix', 'Empty the Dealer box'], [NO_CHANGE, 'No change']],
    dealer_other_cpo: [['empty', 'Different people: stay, empty dealer'], ['move', "Same person: move to the dealer's CPO"], [NO_CHANGE, 'No change']],
    spelling: [['same', 'Same person: use the login spelling'], [NO_CHANGE, 'Different people: no change']],
    cp_no_login: [[NO_CHANGE, 'No change'], ['deboard', 'Move to DEBOARDED']],
    dealer_no_login: [[NO_CHANGE, 'No change'], ['empty', 'Empty the Dealer box'], ['deboard', 'Move to DEBOARDED']],
    unused_login: [[NO_CHANGE, 'Keep'], ['deactivate', 'Deactivate']],
    misc: [[NO_CHANGE, 'No change']],
};

// Take 1 (2026-11-16): only these 4 topics are shown and fixed. The others (CP / CPO with no login,
// dealer with no login, logins with no customers, Miscellaneous) are built but hidden: Task 2,
// later (docs/cp-dealer-rules-2026-11-16/README.md). Add their ids here to switch them on.
// 'dealer_under_cp' hidden 2026-11-20 (D-046): a CP may keep a dealer name for their own records.
// 'spelling' hidden 2026-11-20 (D-049): space differences are fixed when a card is saved
// (trg_snap_partner_names, D-047) and capitals do not matter (D-048).
const SHOWN = ['cp_as_dealer', 'dealer_other_cpo'];
const SHOW_UNUSED_LOGINS = false;
const SHOWN_RULES = RULES.filter(rule => SHOWN.includes(rule.id));
// Local copy only (npm run dev, 2026-11-20): the hidden topics show as view-only tabs, with the
// list of changes and exceptions, so they can be looked at before switching them on. The live
// site shows only SHOWN. Nothing on a local-only tab can be changed or counted.
const LOCAL = import.meta.env.DEV;
const PREVIEW_RULES = LOCAL ? RULES.filter(rule => !SHOWN.includes(rule.id)) : [];
const TAB_COLS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' };

// Short tab names; the full title shows above the list.
const TAB_NAMES = { cp_as_dealer: 'CP as dealer', dealer_under_cp: 'Dealer under a CP', dealer_other_cpo: 'Dealer of another CPO', spelling: 'Spelling',
    cp_no_login: 'CP / CPO no login', dealer_no_login: 'Dealer no login', unused_login: 'Logins with no customers', misc: 'Miscellaneous' };

async function loadAll(build) {
    let rows = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await build().range(from, from + 999);
        if (error) throw error;
        rows = rows.concat(data || []);
        if (!data || data.length < 1000) return rows;
    }
}

// A name with its spaces made visible where they are wrong: each extra, leading or trailing
// space shows as a small "␣" (a double space looks like one space on screen).
function Spelled({ value }) {
    const text = String(value ?? '');
    const parts = text.split(/(\s+)/);
    return <>{parts.map((part, i) => {
        if (!/^\s+$/.test(part)) return part;
        const edge = i === 0 || i === parts.length - 1;
        if (!edge && part === ' ') return part;
        return <span key={i} className="mx-px rounded bg-amber-200 px-0.5 font-bold text-amber-900" title={`${part.length} space${part.length === 1 ? '' : 's'}`}>{'␣'.repeat(edge ? part.length : part.length)}</span>;
    })}</>;
}

function Change({ from, to }) {
    const empty = value => value == null || String(value).trim() === '';
    if (to === undefined || (from ?? '') === (to ?? '')) return <span className="text-stone-600">{empty(from) ? '(empty)' : <Spelled value={from} />}</span>;
    const differs = spellingDifference(from, to);
    return <span><span className="text-stone-500 line-through decoration-stone-400">{empty(from) ? '(empty)' : <Spelled value={from} />}</span> <span className="font-bold text-emerald-700">→ {shown(to)}</span>
        {differs && <span className="ml-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800" title="Only this differs: the letters are the same">{differs}</span>}</span>;
}

const addedOn = card => {
    if (!card.created_at) return '';
    const day = new Date(new Date(card.created_at).getTime() + 330 * 60000).toISOString().slice(0, 10);
    return day === SHEET_IMPORT_DAY ? 'From the sheet (1 Sep)' : `Added in the CRM, ${new Date(card.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}`;
};

// Every customer of a line, full width: who they are, where the card came from, and what
// its CP and Dealer boxes are now and become under the line's choice.
function CustomerTable({ row, choice, onSelectCustomer }) {
    return <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">{row.cards.map(c => {
        const after = changesFor(row, c, choice);
        const name = String(c.customer_name ?? '').trim();
        return <li key={c.id} className="space-y-2 px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {c.folder_no && <span className="font-mono text-sm text-stone-500">#{c.folder_no}</span>}
                {!name ? <span className="text-sm italic text-stone-400">No name on the card</span>
                    : onSelectCustomer ? <button type="button" onClick={() => onSelectCustomer(c)} className="text-left text-sm font-bold text-stone-900 underline-offset-2 hover:underline">{name}</button>
                        : <span className="text-sm font-bold text-stone-900">{name}</span>}
                {c.stage && <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">{c.stage}</span>}
                {addedOn(c) && <span className="text-xs text-stone-500">{addedOn(c)}</span>}
            </div>
            <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><span className="mr-2 text-[11px] font-bold uppercase tracking-wider text-stone-400">CP</span><Change from={c.channel_partner} to={after.channel_partner} /></div>
                <div><span className="mr-2 text-[11px] font-bold uppercase tracking-wider text-stone-400">Dealer</span><Change from={c.sub_channel_partner} to={'sub_channel_partner' in after ? after.sub_channel_partner : undefined} /></div>
            </div>
        </li>;
    })}</ul>;
}

// One line of a grouped tab: what we found in plain words, its choice, then its customers.
function LineCard({ row, choice, setChoice, expanded, toggle, onSelectCustomer, readOnly = false }) {
    const first = row.cards[0];
    const after = changesFor(row, first, choice);
    const n = row.cards.length;
    return <article className={`rounded-2xl border p-4 sm:p-5 ${choice === NO_CHANGE ? 'border-stone-200 bg-white' : 'border-emerald-200 bg-emerald-50/40'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1 space-y-1.5">
                <h3 className="text-base font-bold leading-snug text-stone-900">{row.title}</h3>
                {row.detail && <p className="text-sm leading-relaxed text-stone-600">{row.detail}</p>}
                {cardsSource(row.cards) && <p className="text-sm font-semibold text-stone-700">{cardsSource(row.cards)}</p>}
            </div>
            <label className="w-full shrink-0 text-[11px] font-bold uppercase tracking-wider text-stone-500 lg:w-80">What to do with all {n} customer{n === 1 ? '' : 's'}
                <select value={choice} disabled={readOnly} onChange={e => setChoice(e.target.value)} aria-label={`Choice for ${row.title}`}
                    className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300">
                    {row.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select></label>
        </div>
        <div className="mt-4 grid gap-2 rounded-xl bg-stone-50 p-3 text-sm sm:grid-cols-2">
            <div><span className="block text-[11px] font-bold uppercase tracking-wider text-stone-400">CP box</span><Change from={first.channel_partner} to={after.channel_partner} /></div>
            <div><span className="block text-[11px] font-bold uppercase tracking-wider text-stone-400">Dealer box</span><Change from={first.sub_channel_partner} to={'sub_channel_partner' in after ? after.sub_channel_partner : undefined} /></div>
        </div>
        <button type="button" onClick={toggle} aria-expanded={expanded}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 hover:bg-stone-50">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {expanded ? 'Hide' : 'Show'} the {n} customer{n === 1 ? '' : 's'}</button>
        {expanded && <div className="mt-3"><CustomerTable row={row} choice={choice} onSelectCustomer={onSelectCustomer} /></div>}
    </article>;
}

const selectClass = 'min-h-10 w-full rounded-lg border border-stone-300 bg-white px-2 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300';

export default function CpDealerRulesView({ user, onSelectCustomer }) {
    const [state, setState] = useState({ loading: true, error: '', byRule: null, unused: [], cards: 0, logins: 0, at: null });
    const [choices, setChoices] = useState({});
    const [tab, setTab] = useState(RULES[0].id);
    const [openRow, setOpenRow] = useState({});
    const [confirming, setConfirming] = useState(false);
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);

    const check = useCallback(async () => {
        setState(current => ({ ...current, loading: true, error: '' }));
        try {
            const [cards, profiles, fixes] = await Promise.all([
                loadAll(() => supabase.from('admin').select(COLUMNS).is('deleted_at', null).order('id')),
                loadAll(() => supabase.from('profiles').select('id, name, email, user_type, channel_partner, status, created_at').order('id')),
                // Cards already fixed on this page (every fix is in the activity log): for the progress bar.
                loadAll(() => supabase.from('activity_log').select('id, customer_id, new_value').ilike('new_value', 'Saved from: CP/dealer rules:%').order('id'))
                    .catch(() => []),
            ]);
            const doneByRule = {};
            for (const rule of SHOWN_RULES) {
                const ids = new Set(fixes.filter(f => f.customer_id && String(f.new_value || '').startsWith(`Saved from: CP/dealer rules: ${rule.title} (`)).map(f => f.customer_id));
                doneByRule[rule.id] = ids;
            }
            const byRule = checkCards(cards, profiles);
            // A card fixed once but found again counts as still to do.
            for (const rule of SHOWN_RULES) for (const row of byRule[rule.id] || []) for (const card of row.cards) doneByRule[rule.id]?.delete(card.id);
            setState({ loading: false, error: '', byRule, done: doneByRule, unused: unusedLogins(cards, profiles), cards: cards.length, logins: profiles.length, at: new Date() });
            setChoices({});
        } catch (error) {
            setState(current => ({ ...current, loading: false, error: error.message || String(error) }));
        }
    }, []);
    useEffect(() => { check(); }, [check]);

    const choiceOf = row => choices[row.id] ?? row.choice;
    const loginRow = u => ({ id: `login:${u.login.id}`, choice: NO_CHANGE });
    const setAll = (ruleId, value) => setChoices(current => {
        const next = { ...current };
        const rows = ruleId === 'unused_login' ? state.unused.map(loginRow) : state.byRule[ruleId];
        for (const row of rows) if (ruleId === 'unused_login' || row.options.some(o => o.id === value)) next[row.id] = value;
        return next;
    });

    // Everything that will change: card edits and login deactivations.
    const plan = useMemo(() => {
        if (!state.byRule) return { edits: [], logins: [] };
        const edits = [];
        for (const rule of SHOWN_RULES) for (const row of state.byRule[rule.id]) {
            const choice = choiceOf(row);
            if (choice === NO_CHANGE) continue;
            const option = row.options.find(o => o.id === choice);
            for (const card of row.cards) {
                const changes = changesFor(row, card, choice);
                if (Object.keys(changes).length) edits.push({ rule, row, option, card, changes });
            }
        }
        const logins = !SHOW_UNUSED_LOGINS ? [] : state.unused.filter(u => (choices[`login:${u.login.id}`] ?? NO_CHANGE) === 'deactivate');
        return { edits, logins };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.byRule, state.unused, choices]);
    const total = plan.edits.length + plan.logins.length;

    const download = () => {
        const header = ['Rule', 'Choice', 'File no', 'Customer', 'Stage', 'CP now', 'Dealer now', 'CP after', 'Dealer after'];
        const lines = plan.edits.map(({ rule, option, card, changes }) => [rule.title, option?.label, card.folder_no, card.customer_name, card.stage, card.channel_partner, card.sub_channel_partner,
            'channel_partner' in changes ? changes.channel_partner : card.channel_partner, 'sub_channel_partner' in changes ? changes.sub_channel_partner : card.sub_channel_partner]);
        const loginLines = plan.logins.map(({ login, kind }) => ['Login with no customers', 'Deactivate', '', login.name, kind, login.channel_partner || '', '', '', '']);
        const blob = new Blob(['﻿' + [header, ...lines, ...loginLines].map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `CP dealer fixes ${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    };

    const apply = async () => {
        const { edits, logins } = plan;
        setConfirming(false); setResult(null);
        const done = { fixed: [], changed: [], failed: [], deactivated: [] };
        setProgress({ done: 0, total: edits.length + logins.length });
        const tick = () => setProgress(current => ({ ...current, done: current.done + 1 }));
        let next = 0;
        const worker = async () => {
            while (next < edits.length) {
                const item = edits[next++];
                try {
                    const { data: live, error } = await supabase.from('admin').select('channel_partner, sub_channel_partner, deleted_at').eq('id', item.card.id).maybeSingle();
                    if (error) throw error;
                    if (!live || live.deleted_at || (live.channel_partner ?? null) !== (item.card.channel_partner ?? null) || (live.sub_channel_partner ?? null) !== (item.card.sub_channel_partner ?? null)) {
                        done.changed.push(item);
                    } else {
                        const { ok, error: saveError } = await updateAdminRecord(item.card.id, item.changes);
                        if (!ok) throw saveError || new Error('Not saved');
                        void logFieldChanges(user?.id, item.card.id, item.card.customer_name,
                            { channel_partner: item.card.channel_partner, sub_channel_partner: item.card.sub_channel_partner }, item.changes, `CP/dealer rules: ${item.rule.title} (${item.option?.label || ''})`);
                        done.fixed.push(item);
                    }
                } catch (failure) {
                    done.failed.push({ name: item.card.customer_name, why: failure?.message || String(failure) });
                }
                tick();
            }
        };
        await Promise.all([worker(), worker(), worker(), worker()]);
        // Deactivate the same way User Management does: profile status, then the login itself.
        for (const { login, kind } of logins) {
            try {
                const { data, error } = await supabase.from('profiles').update({ status: 'inactive' }).eq('id', login.id).select('id');
                if (error) throw error;
                if (!data?.length) throw new Error('Not allowed or not found');
                const { data: fnData, error: fnErr } = await supabase.functions.invoke('add_user', { body: { action: 'deactivate', user_id: login.id } });
                if (fnErr || fnData?.error) console.warn('Auth deactivate did not apply:', fnData?.error || fnErr?.message);
                if (user?.id) void logActivity(user.id, 'update', `Deactivated user: ${login.name} (${kind}, no customers; CP/dealer rules)`, '', null);
                done.deactivated.push(login);
            } catch (failure) {
                done.failed.push({ name: `${login.name} (login)`, why: failure?.message || String(failure) });
            }
            tick();
        }
        if (user?.id && done.fixed.length) {
            const perRule = SHOWN_RULES.map(rule => [rule.title, done.fixed.filter(i => i.rule.id === rule.id).length]).filter(([, count]) => count).map(([t, count]) => `${t}: ${count}`).join(' · ');
            void logActivity(user.id, 'update', `CP/dealer rules: fixed ${done.fixed.length} customer card${done.fixed.length === 1 ? '' : 's'}`, perRule, null);
        }
        setProgress(null);
        setResult(done);
        await check();
    };

    const busy = state.loading || Boolean(progress);
    const unusedRule = { id: 'unused_login', title: 'Logins with no customers', rule: 'Active CP, CPO and dealer logins that no customer card uses. Keep them (new partners start with none), or deactivate them; a deactivated login can be switched on again in User Management.' };
    return <div className="mx-auto max-w-6xl space-y-4 p-4 pb-32 sm:p-6 sm:pb-32">
        <div className="flex items-start justify-between gap-3">
            <div>
                <h1 className="flex items-center gap-2 text-xl font-bold text-stone-900"><ShieldCheck size={20} /> CP / dealer rules</h1>
                <p className="mt-1 max-w-3xl text-sm text-stone-500">Checks every customer card against the CP / CPO / dealer rules and today's logins. Each line is one CP / CPO and dealer pair, with all its customers; its choice is already set to the usual fix and applies to all of them. Change it or pick No change. Press Review and fix; nothing changes until you confirm.</p>
                {state.at && <p className="mt-1 text-xs text-stone-400">Checked {state.cards.toLocaleString('en-IN')} customers and {state.logins} logins at {state.at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.</p>}
            </div>
            <button type="button" disabled={busy} onClick={check} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 disabled:opacity-50">
                <RefreshCw size={15} className={state.loading ? 'animate-spin' : ''} /> Check again</button>
        </div>
        {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Could not check: {state.error}</p>}
        {result && <div role="status" className="space-y-1 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle2 size={18} /> Fixed {result.fixed.length} customer card{result.fixed.length === 1 ? '' : 's'}{result.deactivated.length ? `, deactivated ${result.deactivated.length} login${result.deactivated.length === 1 ? '' : 's'}` : ''}.</p>
            {result.changed.length > 0 && <p className="text-amber-900">{result.changed.length} skipped: someone changed their CP or Dealer since the check. They are checked again below.</p>}
            {result.failed.length > 0 && <details className="text-red-700"><summary className="cursor-pointer font-semibold">{result.failed.length} could not be saved</summary>
                <ul className="mt-1 list-disc pl-5 text-xs">{result.failed.map((f, i) => <li key={i}>{f.name}: {f.why}</li>)}</ul></details>}
        </div>}

        {state.loading && !state.byRule ? <p className="flex items-center gap-2 text-sm text-stone-400"><Loader2 size={16} className="animate-spin" /> Checking every customer…</p>
            : state.byRule && (() => {
                // One tab per topic; logins with no customers, then Miscellaneous last.
                const topics = [...SHOWN_RULES.filter(r => r.id !== 'misc'), ...(SHOW_UNUSED_LOGINS ? [unusedRule] : []), ...SHOWN_RULES.filter(r => r.id === 'misc'),
                    ...(LOCAL ? [...PREVIEW_RULES.filter(r => r.id !== 'misc'), ...(SHOW_UNUSED_LOGINS ? [] : [unusedRule]), ...PREVIEW_RULES.filter(r => r.id === 'misc')].map(r => ({ ...r, preview: true })) : [])];
                const rowsOf = id => (id === 'unused_login' ? state.unused : state.byRule[id]);
                const changingOf = id => (id === 'unused_login' ? plan.logins.length : plan.edits.filter(e => e.rule.id === id).length);
                const current = topics.find(t => t.id === tab) || topics[0];
                const preview = Boolean(current.preview);
                const rows = rowsOf(current.id);
                const toDoOf = id => (rowsOf(id) || []).reduce((n, r) => n + (r.cards ? r.cards.length : 1), 0);
                const doneOf = id => state.done?.[id]?.size || 0;
                const left = SHOWN_RULES.reduce((n, r) => n + toDoOf(r.id), 0);
                const doneAll = SHOWN_RULES.reduce((n, r) => n + doneOf(r.id), 0);
                const totalAll = left + doneAll;
                const pct = totalAll ? Math.round((doneAll / totalAll) * 100) : 100;
                return <div className="space-y-3">
                    <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5" role="group" aria-label="Progress">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-base font-bold text-stone-900">{left ? `${left} customer card${left === 1 ? '' : 's'} left to complete` : 'All complete'}</p>
                            <p className="text-sm font-semibold text-stone-600">{doneAll} of {totalAll} done · {pct}%</p>
                        </div>
                        <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={totalAll} aria-valuenow={doneAll} aria-label={`${doneAll} of ${totalAll} done`}>
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-stone-500">Done = fixed on this page by any admin (from the activity log). Cards left on "No change" still count as left.</p>
                    </div>
                    <div role="tablist" aria-label="Topics" className={`grid grid-cols-2 gap-1.5 ${TAB_COLS[topics.length] || 'sm:grid-cols-4'}`}>{topics.map(t => {
                        const count = rowsOf(t.id).length, changing = changingOf(t.id);
                        return <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                            className={`rounded-xl px-3 py-2 text-left text-xs font-bold ${tab === t.id ? 'bg-stone-900 text-white' : t.preview ? 'border border-dashed border-violet-300 bg-violet-50/60 text-stone-700 hover:bg-violet-50' : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}>
                            <span className="block">{TAB_NAMES[t.id] || t.title}</span>
                            {t.preview && <span className={`block text-[10px] font-bold uppercase tracking-wider ${tab === t.id ? 'text-violet-200' : 'text-violet-700'}`}>Local only · view</span>}
                            <span className={`block text-[10px] font-semibold ${tab === t.id ? 'text-white/70' : count ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {t.preview ? (count ? `${t.grouped ? `${toDoOf(t.id)} cards` : `${count} found`}` : 'None')
                                    : <>{count ? `${t.grouped ? `${toDoOf(t.id)} left` : `${count} found`} · ${doneOf(t.id)} done` : doneOf(t.id) ? `All done · ${doneOf(t.id)} fixed` : 'All fine'}{count && changing !== toDoOf(t.id) ? ` · ${changing} set to change` : ''}</>}</span>
                        </button>;
                    })}</div>

                    <section role="tabpanel" aria-label={current.title} className="rounded-2xl border border-stone-200 bg-white">
                        <div className="space-y-3 border-b border-stone-100 p-4 sm:p-5">
                            <div>
                                <h2 className="text-lg font-bold text-stone-900">{current.title}</h2>
                                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-stone-600">{current.rule}</p>
                            </div>
                            {preview && <p className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm font-semibold text-violet-900">Hidden on the live site. You see this only on the local copy. View only: nothing here can be changed, and it is not counted in the bar above.</p>}
                            {!preview && rows.length > 0 && SET_ALL[current.id].length > 1 && <label className="block w-full max-w-sm text-[11px] font-bold uppercase tracking-wider text-stone-500">Set every line to
                                <select value="" onChange={e => e.target.value && setAll(current.id, e.target.value)} className={`${selectClass} mt-1 normal-case tracking-normal`}>
                                    <option value="">Choose…</option>
                                    {SET_ALL[current.id].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                                </select></label>}
                        </div>
                        {!rows.length ? <p className="flex items-center gap-2 p-6 text-sm font-semibold text-emerald-700"><CheckCircle2 size={18} /> Nothing to fix here.</p>
                            : current.grouped ? <div className="space-y-4 bg-stone-50/60 p-3 sm:p-4">{rows.map(row => <LineCard key={row.id} row={row} choice={choiceOf(row)}
                                setChoice={value => setChoices(cur => ({ ...cur, [row.id]: value }))} expanded={Boolean(openRow[row.id])}
                                toggle={() => setOpenRow(cur => ({ ...cur, [row.id]: !cur[row.id] }))} onSelectCustomer={onSelectCustomer} readOnly={preview} />)}</div>
                            : <div className="max-h-[60vh] overflow-auto">{current.id === 'unused_login'
                                ? <table className="w-full text-left text-xs">
                                    <thead className="sticky top-0 z-10 bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500"><tr>
                                        <th className="p-2">Login</th><th className="p-2">Type</th><th className="p-2">CPO branch</th><th className="p-2">Created</th><th className="w-44 p-2">Choice</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-stone-100">{state.unused.map(({ login, kind }) => {
                                        const id = `login:${login.id}`;
                                        const choice = choices[id] ?? NO_CHANGE;
                                        return <tr key={id} className={choice === NO_CHANGE ? '' : 'bg-red-50/50'}>
                                            <td className="p-2"><span className="font-semibold text-stone-900">{login.name}</span><span className="block text-[10px] text-stone-400">{login.email}</span></td>
                                            <td className="p-2">{kind}</td>
                                            <td className="p-2">{login.user_type === 'agent' ? '–' : login.channel_partner || '–'}</td>
                                            <td className="whitespace-nowrap p-2">{day(login.created_at)}</td>
                                            <td className="p-2"><select value={choice} disabled={preview} onChange={e => setChoices(cur => ({ ...cur, [id]: e.target.value }))} aria-label={`Choice for login ${login.name}`} className={selectClass}>
                                                <option value={NO_CHANGE}>Keep</option><option value="deactivate">Deactivate</option>
                                            </select></td>
                                        </tr>;
                                    })}</tbody>
                                </table>
                                : <table className="w-full text-left text-xs">
                                    <thead className="sticky top-0 z-10 bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500"><tr>
                                        <th className="p-2">{current.grouped ? 'What we found' : 'Customer'}</th>{current.id === 'misc' && <th className="p-2">Problem</th>}{!current.grouped && <><th className="p-2">CP</th><th className="p-2">Dealer</th></>}<th className="w-72 p-2">Choice</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-stone-100">{rows.map(row => {
                                        const choice = choiceOf(row);
                                        const first = row.cards[0];
                                        const after = changesFor(row, first, choice);
                                        const expanded = openRow[row.id];
                                        return <tr key={row.id} className={`align-top ${choice === NO_CHANGE ? 'bg-white' : 'bg-emerald-50/40'}`}>
                                            <td className="p-2">
                                                {current.grouped
                                                    ? <><span className="block font-bold text-stone-900">{row.title}</span>
                                                        {row.detail && <span className="mt-0.5 block text-[11px] leading-snug text-stone-500">{row.detail}</span>}
                                                        {cardsSource(row.cards) && <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-stone-600">{cardsSource(row.cards)}</span>}
                                                        <span className="mt-1.5 grid grid-cols-[3.5rem_1fr] gap-x-2 gap-y-0.5 text-[11px]">
                                                            <span className="font-bold uppercase tracking-wider text-stone-400">CP</span><Change from={first.channel_partner} to={after.channel_partner} />
                                                            <span className="font-bold uppercase tracking-wider text-stone-400">Dealer</span><Change from={first.sub_channel_partner} to={'sub_channel_partner' in after ? after.sub_channel_partner : undefined} />
                                                        </span>
                                                        <button type="button" onClick={() => setOpenRow(cur => ({ ...cur, [row.id]: !expanded }))} className="text-[11px] font-semibold text-stone-500 underline-offset-2 hover:underline">
                                                            {expanded ? 'Hide' : 'Show'} the {row.cards.length} customer{row.cards.length === 1 ? '' : 's'} {expanded ? '▲' : '▼'}</button>
                                                        {expanded && <CustomerTable row={row} choice={choice} onSelectCustomer={onSelectCustomer} />}</>
                                                    : <>{onSelectCustomer ? <button type="button" onClick={() => onSelectCustomer(first)} className="text-left font-semibold text-stone-900 underline-offset-2 hover:underline">{first.customer_name}</button> : <span className="font-semibold">{first.customer_name}</span>}
                                                        <span className="block text-[10px] text-stone-400">{[first.folder_no, first.stage].filter(Boolean).join(' · ')}</span></>}
                                            </td>
                                            {current.id === 'misc' && <td className="p-2 font-semibold text-stone-700">{row.problem}</td>}
                                            {!current.grouped && <>
                                                <td className="p-2"><Change from={first.channel_partner} to={after.channel_partner} /></td>
                                                <td className="p-2"><Change from={first.sub_channel_partner} to={'sub_channel_partner' in after ? after.sub_channel_partner : undefined} /></td></>}
                                            <td className="p-2"><select value={choice} disabled={preview} onChange={e => setChoices(cur => ({ ...cur, [row.id]: e.target.value }))} aria-label={`Choice for ${row.title}`} className={selectClass}>
                                                {row.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                            </select></td>
                                        </tr>;
                                    })}</tbody>
                                </table>}</div>}
                    </section>
                    {LOCAL && <div className="space-y-3 rounded-xl border border-dashed border-violet-300 bg-violet-50/40 p-4 text-xs text-stone-700">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Local copy only, not on the live site</p>
                        <div>
                            <p className="font-bold text-stone-800">Changes made to this page</p>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5">
                                <li>16 Nov: page built with a choice per row; 4 topics shown, the rest hidden for later (D-039, D-040).</li>
                                <li>20 Nov: one line per CP / CPO and dealer pair in plain words, one choice for all its customers; where the cards came from (sheet or CRM).</li>
                                <li>20 Nov: logins compared exactly as stored (a double space in a login name is kept); each customer listed with now → after.</li>
                                <li>20 Nov: every fix goes into the activity log under the admin; progress bar of cards left and done.</li>
                                <li>20 Nov: names typed with different spaces or capitals are saved with the login's spelling (D-047, database).</li>
                            </ul>
                        </div>
                        <div>
                            <p className="font-bold text-stone-800">Left alone on purpose (not counted in the bar)</p>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5">
                                <li>A CP also written as their own dealer, e.g. CP BHARAT UNJA, Dealer BHARAT UNJA (D-048).</li>
                                <li>Spelling tab removed: capitals do not matter, spaces are fixed when a card is saved (D-048, D-049).</li>
                                <li>A dealer written under an independent CP: may be the CP's own record (D-046).</li>
                                <li>Hidden for later, view-only tabs above: CP / CPO with no login, dealer with no login, logins with no customers, Miscellaneous.</li>
                            </ul>
                        </div>
                    </div>}
                </div>;
            })()}

        {state.byRule && <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 p-3 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-sm text-stone-700">{progress ? `Saving ${progress.done} of ${progress.total}…`
                    : <><b>{plan.edits.length}</b> customer card{plan.edits.length === 1 ? '' : 's'} to change{plan.logins.length ? <>, <b>{plan.logins.length}</b> login{plan.logins.length === 1 ? '' : 's'} to deactivate</> : ''}.</>}</p>
                <button type="button" disabled={busy || !total} onClick={download} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 disabled:opacity-40"><Download size={15} /> Download list</button>
                <button type="button" disabled={busy || !total} onClick={() => setConfirming(true)} className="min-h-11 rounded-xl bg-stone-900 px-5 text-sm font-bold text-white disabled:opacity-40">Review and fix {total || ''}</button>
            </div>
        </div>}

        {confirming && <div role="dialog" aria-modal="true" aria-label="Confirm the fixes" className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
            <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
                <h2 className="text-lg font-bold text-stone-900">Make these {total} change{total === 1 ? '' : 's'}?</h2>
                <ul className="space-y-1 text-sm">
                    {SHOWN_RULES.map(rule => [rule, plan.edits.filter(e => e.rule.id === rule.id).length]).filter(([, count]) => count).map(([rule, count]) =>
                        <li key={rule.id} className="flex justify-between gap-3"><span className="text-stone-600">{rule.title}</span><b>{count} customer{count === 1 ? '' : 's'}</b></li>)}
                    {plan.logins.length > 0 && <li className="flex justify-between gap-3 text-red-700"><span>Deactivate logins with no customers</span><b>{plan.logins.length}</b></li>}
                </ul>
                <p className="text-xs text-stone-500">Only the CP and Dealer boxes change. Each change goes into that customer's log, so it can be put back by hand. A card someone changed since the check is skipped. Deactivated logins can be switched on again in User Management. Download the list first if you want a copy.</p>
                <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={download} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-bold text-stone-700"><Download size={15} /> Download list</button>
                    <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700">Cancel</button>
                    <button type="button" onClick={apply} className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white">Yes, make {total} change{total === 1 ? '' : 's'}</button>
                </div>
            </div>
        </div>}
    </div>;
}
