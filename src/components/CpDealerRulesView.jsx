import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabase';
import { logActivity, logFieldChanges, updateAdminRecord } from '../utils';
import { RULES, checkCards } from '../utils/cpDealerRules';

// CP / dealer rules (admin only). Checks every live customer card against the client's
// CP / CPO / dealer rules (src/utils/cpDealerRules.js) and the current logins, lists the
// customers each rule would fix (all ticked), and fixes the ticked ones after one confirm.
// Each card is re-read just before it is saved: if someone changed its CP or Dealer since the
// check, it is skipped. Every change goes into the customer's log (who, before, after).

const COLUMNS = 'id, customer_name, folder_no, stage, channel_partner, sub_channel_partner, deleted_at';
const shown = value => (value == null || String(value).trim() === '' ? '(empty)' : value);
const csvCell = value => { const s = value == null ? '' : String(value); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

async function loadAll(build) {
    let rows = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await build().range(from, from + 999);
        if (error) throw error;
        rows = rows.concat(data || []);
        if (!data || data.length < 1000) return rows;
    }
}

function Change({ from, to }) {
    if ((from ?? '') === (to ?? '')) return <span className="text-stone-500">{shown(from)}</span>;
    return <span><span className="text-stone-400 line-through">{shown(from)}</span> <span className="font-bold text-emerald-700">→ {shown(to)}</span></span>;
}

export default function CpDealerRulesView({ user, onSelectCustomer }) {
    const [state, setState] = useState({ loading: true, error: '', byRule: null, cards: 0, logins: 0, at: null });
    const [skipped, setSkipped] = useState(new Set());
    const [open, setOpen] = useState({});
    const [confirming, setConfirming] = useState(false);
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);

    const check = useCallback(async () => {
        setState(current => ({ ...current, loading: true, error: '' }));
        try {
            const [cards, profiles] = await Promise.all([
                loadAll(() => supabase.from('admin').select(COLUMNS).is('deleted_at', null).order('id')),
                loadAll(() => supabase.from('profiles').select('id, name, user_type, channel_partner, status').order('id')),
            ]);
            setState({ loading: false, error: '', byRule: checkCards(cards, profiles), cards: cards.length, logins: profiles.length, at: new Date() });
            setSkipped(new Set());
        } catch (error) {
            setState(current => ({ ...current, loading: false, error: error.message || String(error) }));
        }
    }, []);
    useEffect(() => { check(); }, [check]);

    const all = useMemo(() => (state.byRule ? RULES.flatMap(rule => state.byRule[rule.id].map(item => ({ ...item, rule }))) : []), [state.byRule]);
    const chosen = all.filter(item => !skipped.has(item.card.id));
    const toggle = id => setSkipped(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    const setRule = (rule, on) => setSkipped(current => {
        const next = new Set(current);
        for (const item of state.byRule[rule.id]) { if (on) next.delete(item.card.id); else next.add(item.card.id); }
        return next;
    });

    const download = items => {
        const header = ['Rule', 'File no', 'Customer', 'Stage', 'CP now', 'Dealer now', 'CP after', 'Dealer after'];
        const lines = items.map(({ rule, card, to }) => [rule.title, card.folder_no, card.customer_name, card.stage, card.channel_partner, card.sub_channel_partner, to.channel_partner, to.sub_channel_partner]);
        const blob = new Blob(['﻿' + [header, ...lines].map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `CP dealer fixes ${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    };

    // Fix the ticked cards, 4 at a time. A card whose CP or Dealer changed since the check is skipped.
    const apply = async () => {
        const items = chosen;
        setConfirming(false); setResult(null);
        const done = { fixed: [], changed: [], failed: [] };
        setProgress({ done: 0, total: items.length });
        let next = 0;
        const worker = async () => {
            while (next < items.length) {
                const item = items[next++];
                try {
                    const { data: live, error } = await supabase.from('admin').select('channel_partner, sub_channel_partner, deleted_at').eq('id', item.card.id).maybeSingle();
                    if (error) throw error;
                    if (!live || live.deleted_at || (live.channel_partner ?? null) !== (item.card.channel_partner ?? null) || (live.sub_channel_partner ?? null) !== (item.card.sub_channel_partner ?? null)) {
                        done.changed.push(item);
                    } else {
                        const { ok, error: saveError } = await updateAdminRecord(item.card.id, item.changes);
                        if (!ok) throw saveError || new Error('Not saved');
                        void logFieldChanges(user?.id, item.card.id, item.card.customer_name,
                            { channel_partner: item.card.channel_partner, sub_channel_partner: item.card.sub_channel_partner }, item.changes, `CP/dealer rules: ${item.rule.title}`);
                        done.fixed.push(item);
                    }
                } catch (failure) {
                    done.failed.push({ ...item, why: failure?.message || String(failure) });
                }
                setProgress(current => ({ ...current, done: current.done + 1 }));
            }
        };
        await Promise.all([worker(), worker(), worker(), worker()]);
        if (user?.id && done.fixed.length) {
            const perRule = RULES.map(rule => [rule.title, done.fixed.filter(i => i.rule.id === rule.id).length]).filter(([, n]) => n).map(([t, n]) => `${t}: ${n}`).join(' · ');
            void logActivity(user.id, 'update', `CP/dealer rules: fixed ${done.fixed.length} customer card${done.fixed.length === 1 ? '' : 's'}`, perRule, null);
        }
        setProgress(null);
        setResult(done);
        await check();
    };

    const counts = Object.fromEntries(RULES.map(rule => [rule.id, (state.byRule?.[rule.id] || []).length]));
    const busy = state.loading || Boolean(progress);
    return <div className="mx-auto max-w-6xl space-y-4 p-4 pb-32 sm:p-6 sm:pb-32">
        <div className="flex items-start justify-between gap-3">
            <div>
                <h1 className="flex items-center gap-2 text-xl font-bold text-stone-900"><ShieldCheck size={20} /> CP / dealer rules</h1>
                <p className="mt-1 max-w-3xl text-sm text-stone-500">Checks every customer card against the CP / CPO / dealer rules and today's logins. Untick anyone you don't want changed, then press Review and fix. Nothing changes until you confirm.</p>
                {state.at && <p className="mt-1 text-xs text-stone-400">Checked {state.cards.toLocaleString('en-IN')} customers and {state.logins} logins at {state.at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.</p>}
            </div>
            <button type="button" disabled={busy} onClick={check} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 disabled:opacity-50">
                <RefreshCw size={15} className={state.loading ? 'animate-spin' : ''} /> Check again</button>
        </div>
        {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Could not check: {state.error}</p>}
        {result && <div role="status" className="space-y-1 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle2 size={18} /> Fixed {result.fixed.length} customer card{result.fixed.length === 1 ? '' : 's'}.</p>
            {result.changed.length > 0 && <p className="text-amber-900">{result.changed.length} skipped: someone changed their CP or Dealer since the check. They are checked again below.</p>}
            {result.failed.length > 0 && <details className="text-red-700"><summary className="cursor-pointer font-semibold">{result.failed.length} could not be saved</summary>
                <ul className="mt-1 list-disc pl-5 text-xs">{result.failed.map(item => <li key={item.card.id}>{item.card.customer_name}: {item.why}</li>)}</ul></details>}
        </div>}

        {state.loading && !state.byRule ? <p className="flex items-center gap-2 text-sm text-stone-400"><Loader2 size={16} className="animate-spin" /> Checking every customer…</p>
            : state.byRule && <div className="space-y-3">{RULES.map(rule => {
                const items = state.byRule[rule.id];
                const ticked = items.filter(item => !skipped.has(item.card.id)).length;
                const isOpen = open[rule.id] ?? false;
                return <section key={rule.id} className="rounded-2xl border border-stone-200 bg-white">
                    <div className="flex flex-wrap items-center gap-3 p-4">
                        <button type="button" onClick={() => setOpen(current => ({ ...current, [rule.id]: !isOpen }))} disabled={!items.length} aria-expanded={isOpen}
                            className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:cursor-default">
                            {items.length ? (isOpen ? <ChevronDown size={18} className="mt-0.5 shrink-0" /> : <ChevronRight size={18} className="mt-0.5 shrink-0" />) : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />}
                            <span className="min-w-0">
                                <span className="block text-sm font-bold text-stone-900">{rule.title} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${items.length ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>{items.length ? `${ticked} of ${items.length} ticked` : 'All fine'}</span></span>
                                <span className="block text-xs text-stone-500">{rule.rule}</span>
                            </span>
                        </button>
                        {items.length > 0 && <div className="flex gap-2 text-xs font-bold">
                            <button type="button" onClick={() => setRule(rule, true)} className="min-h-9 rounded-lg border border-stone-200 px-2 text-stone-600">Tick all</button>
                            <button type="button" onClick={() => setRule(rule, false)} className="min-h-9 rounded-lg border border-stone-200 px-2 text-stone-600">Untick all</button>
                        </div>}
                    </div>
                    {isOpen && items.length > 0 && <div className="max-h-[28rem] overflow-auto border-t border-stone-100">
                        <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500"><tr>
                                <th className="w-10 p-2"><span className="sr-only">Fix</span></th><th className="p-2">File</th><th className="p-2">Customer</th><th className="p-2">CP</th><th className="p-2">Dealer</th>
                            </tr></thead>
                            <tbody className="divide-y divide-stone-100">{items.map(({ card, to }) => <tr key={card.id} className={skipped.has(card.id) ? 'opacity-50' : ''}>
                                <td className="p-2"><input type="checkbox" checked={!skipped.has(card.id)} onChange={() => toggle(card.id)} aria-label={`Fix ${card.customer_name}`} className="h-5 w-5 accent-stone-900" /></td>
                                <td className="whitespace-nowrap p-2 font-semibold">{card.folder_no || '–'}</td>
                                <td className="p-2">{onSelectCustomer ? <button type="button" onClick={() => onSelectCustomer(card)} className="text-left font-semibold text-stone-900 underline-offset-2 hover:underline">{card.customer_name}</button> : <span className="font-semibold">{card.customer_name}</span>}
                                    <span className="block text-[10px] text-stone-400">{card.stage}</span></td>
                                <td className="p-2"><Change from={card.channel_partner} to={to.channel_partner} /></td>
                                <td className="p-2"><Change from={card.sub_channel_partner} to={to.sub_channel_partner} /></td>
                            </tr>)}</tbody>
                        </table>
                    </div>}
                </section>;
            })}
            <p className="text-xs text-stone-500">Not fixed here (they need someone to decide): dealer names with no login, or names that only look alike (e.g. DASHRATH and DASHRATH MALI). Those stay for the Data Review page or by hand.</p>
        </div>}

        {state.byRule && <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 p-3 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-sm text-stone-700">{progress ? `Fixing ${progress.done} of ${progress.total}…` : <><b>{chosen.length}</b> customer card{chosen.length === 1 ? '' : 's'} ticked across {RULES.filter(r => counts[r.id]).length} rule{RULES.filter(r => counts[r.id]).length === 1 ? '' : 's'}.</>}</p>
                <button type="button" disabled={busy || !chosen.length} onClick={() => download(chosen)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 disabled:opacity-40"><Download size={15} /> Download list</button>
                <button type="button" disabled={busy || !chosen.length} onClick={() => setConfirming(true)} className="min-h-11 rounded-xl bg-stone-900 px-5 text-sm font-bold text-white disabled:opacity-40">Review and fix {chosen.length || ''}</button>
            </div>
        </div>}

        {confirming && <div role="dialog" aria-modal="true" aria-label="Confirm the fixes" className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
            <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
                <h2 className="text-lg font-bold text-stone-900">Fix {chosen.length} customer card{chosen.length === 1 ? '' : 's'}?</h2>
                <ul className="space-y-1 text-sm">{RULES.map(rule => [rule, chosen.filter(i => i.rule.id === rule.id).length]).filter(([, n]) => n).map(([rule, n]) =>
                    <li key={rule.id} className="flex justify-between gap-3"><span className="text-stone-600">{rule.title}</span><b>{n}</b></li>)}</ul>
                <p className="text-xs text-stone-500">Only the CP and Dealer boxes change. Each change goes into that customer's log, so it can be put back by hand. A card someone changed since the check is skipped. Download the list first if you want a copy.</p>
                <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => download(chosen)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-bold text-stone-700"><Download size={15} /> Download list</button>
                    <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700">Cancel</button>
                    <button type="button" onClick={apply} className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white">Yes, fix {chosen.length}</button>
                </div>
            </div>
        </div>}
    </div>;
}
