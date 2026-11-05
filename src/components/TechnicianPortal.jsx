// Technician portal (phone only), in the style of the Vendor and Channel Partner portals: top header
// (logo, initials, logout), a slide-out menu (Home, My trip, My jobs, Open jobs), and a Home
// with the dark welcome card, amber stat tiles and the jobs waiting to be claimed.
import { useCallback, useEffect, useState } from 'react';
import { Briefcase, CalendarDays, ChevronLeft, ChevronRight, Home, Inbox, Layers, LogOut, RefreshCw, X } from 'lucide-react';
import { supabase } from '../supabase';
import BrandMark from './BrandMark';
import ServiceIssuesView from './ServiceIssuesView';
import { readDayPlan } from './service/DayPlan';
import { ticketLabel, todayLocal } from './service/serviceLabels';
import { pincodeInText } from './service/tripLabels';

const VIEWS = [
    ['home', 'Home', Home],
    ['open', 'Open jobs', Inbox],
    ['mine', 'My jobs', Briefcase],
    ['plan', 'My trip', CalendarDays],
];
const ACTIVE = ['assigned', 'completion_pending'];
const initials = name => String(name || '').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'T';
const shortDate = day => (day ? new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

// Jobs this technician can see (open + their own) and today's plan; read again every 30 s.
function useTechnicianJobs(userId) {
    const [jobs, setJobs] = useState(null);
    const [plan, setPlan] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const load = useCallback(async () => {
        setRefreshing(true);
        const { data } = await supabase.from('service_issues').select('*').order('required_date', { ascending: true }).limit(500);
        setJobs(data || []);
        try { setPlan(await readDayPlan(userId, todayLocal())); } catch { setPlan([]); }
        setRefreshing(false);
    }, [userId]);
    useEffect(() => {
        load();
        const timer = setInterval(load, 30000);
        return () => clearInterval(timer);
    }, [load]);
    return { jobs, plan, reload: load, refreshing };
}

// Vendor-style stat tile that works as a tab.
function StatTile({ label, value, active, onClick }) {
    return <button type="button" onClick={onClick} aria-pressed={active}
        className={`min-w-[96px] flex-1 rounded-2xl border p-3 text-left transition-all ${active ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'border-stone-100 bg-white shadow-sm'}`}>
        <span className={`block text-[8px] font-bold uppercase tracking-wider ${active ? 'text-amber-100' : 'text-stone-400'}`}>{label}</span>
        <span className={`mt-0.5 block text-lg font-black ${active ? 'text-white' : 'text-stone-800'}`}>{value ?? '–'}</span>
    </button>;
}

// One job, in the Vendor portal's card shape: name + badge, place, chips, chevron.
function JobCard({ job, badge, badgeClass, onOpen }) {
    const chips = [['Ticket', ticketLabel(job)], ['Pin', pincodeInText(job.service_address)], ['Needed', shortDate(job.required_date)]].filter(([, value]) => value);
    return <button type="button" onClick={onOpen}
        className="group w-full space-y-1.5 rounded-2xl border border-stone-150 bg-white p-3.5 text-left shadow-sm transition-all hover:border-amber-400 hover:shadow-md active:scale-[0.99]">
        <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-xs font-bold text-stone-900 group-hover:text-amber-600">{job.customer_name}</span>
                    <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase ${badgeClass}`}>{badge}</span>
                </span>
                <span className="block truncate text-[10px] font-medium text-stone-400">{job.problem_type || 'No problem written'}</span>
                <span className="flex flex-wrap gap-2 pt-0.5 text-[9px] text-stone-500">{chips.map(([label, value]) => <span key={label}>{label}: <b>{value}</b></span>)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-0.5 self-center text-[10px] font-bold text-stone-400 group-hover:text-stone-800">View <ChevronRight className="h-4 w-4" /></span>
        </span>
    </button>;
}

// Home: welcome card, three tiles (tap = that page) and the jobs waiting to be claimed.
function TechnicianHome({ user, jobs, plan, go, openJob }) {
    const open = (jobs || []).filter(job => job.status === 'open');
    const mine = (jobs || []).filter(job => job.assigned_to === user.id && ACTIVE.includes(job.status));
    return <main className="mx-auto w-full max-w-md flex-1 space-y-4 p-4 animate-in fade-in duration-300">
        <section className="relative overflow-hidden rounded-[28px] bg-stone-950 px-5 py-6 text-white shadow-xl shadow-stone-900/10">
            <div className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-amber-400/20 blur-2xl" />
            <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full border-[18px] border-amber-400/10" />
            <div className="relative space-y-5">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Technician workspace</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight">Good to see you, {String(user.name || '').split(' ')[0]}.</h2>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-stone-300">
                        {jobs === null ? 'Loading your jobs…' : `${open.length} new ${open.length === 1 ? 'job' : 'jobs'} to claim · ${mine.length} in hand${plan.length ? ` · ${plan.length} on today's trip` : ''}.`}
                    </p>
                </div>
                <button type="button" onClick={() => go('plan')}
                    className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-xs font-black text-stone-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 active:scale-[0.98]">
                    <Layers size={15} /> {plan.length ? "Open today's trip" : 'Plan today'} <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </button>
            </div>
        </section>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <StatTile label="To claim" value={jobs ? open.length : null} active onClick={() => go('open')} />
            <StatTile label="My jobs" value={jobs ? mine.length : null} onClick={() => go('mine')} />
            <StatTile label="Today's trip" value={jobs ? plan.length : null} onClick={() => go('plan')} />
        </div>

        <section className="space-y-2.5">
            <p className="px-1 text-[10px] font-black uppercase tracking-widest text-stone-400">Waiting to be claimed</p>
            {jobs === null ? <p className="py-10 text-center text-xs font-semibold text-stone-400">Loading jobs…</p>
                : !open.length ? <div className="rounded-2xl border border-stone-100 bg-white p-8 text-center text-xs font-bold text-stone-400 shadow-sm">No new jobs right now.</div>
                    : open.map(job => <JobCard key={job.id} job={job} badge="New" badgeClass="bg-sky-100 text-sky-800" onOpen={() => openJob(job.id, 'open')} />)}
        </section>
    </main>;
}

export default function TechnicianPortal({ user, onLogout, initialView = 'home', initialJobId = null }) {
    const [view, setView] = useState(initialView);
    const [focus, setFocus] = useState(initialJobId ? { id: initialJobId } : null);
    const [menuOpen, setMenuOpen] = useState(false);
    const { jobs, plan, reload, refreshing } = useTechnicianJobs(user.id);
    const go = next => { setView(next); setFocus(null); setMenuOpen(false); reload(); };
    const openJob = (id, where = 'mine') => { setView(where); setFocus({ id }); };
    const counts = jobs ? {
        mine: jobs.filter(job => job.assigned_to === user.id && ACTIVE.includes(job.status)).length,
        open: jobs.filter(job => job.status === 'open').length,
        plan: plan.length,
    } : {};
    const title = VIEWS.find(([key]) => key === view)?.[1] || '';

    return <div className="flex min-h-screen flex-col bg-[#FCFBFA] pb-24 font-sans sm:pb-8">
        {/* Slide-out menu, like the Channel Partner portal's Stages menu. */}
        {menuOpen && <div className="fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <aside className="relative z-10 flex h-full w-[280px] flex-col bg-stone-900 shadow-2xl animate-in slide-in-from-left duration-300">
                <div className="flex items-center justify-between border-b border-white/10 p-5">
                    <BrandMark variant="white" />
                    <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="rounded-lg p-1.5 text-stone-400 hover:text-white"><X size={18} /></button>
                </div>
                <nav className="flex-1 space-y-1 p-3">{VIEWS.map(([key, label, Icon]) =>
                    <button key={key} type="button" onClick={() => go(key)} aria-current={view === key ? 'page' : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold transition-colors ${view === key ? 'bg-amber-500 text-stone-950' : 'text-stone-300 hover:bg-white/10 hover:text-white'}`}>
                        <Icon className="h-4 w-4 shrink-0" /><span className="flex-1 text-left">{label}</span>
                        {counts[key] > 0 && <span className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-black ${view === key ? 'bg-stone-950/15' : 'bg-white/10 text-white'}`}>{counts[key]}</span>}
                    </button>)}
                </nav>
                <button type="button" onClick={onLogout} className="m-3 flex items-center gap-2 rounded-xl px-3 py-3 text-xs font-bold text-red-300 hover:bg-white/10"><LogOut className="h-4 w-4" /> Logout</button>
            </aside>
        </div>}

        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-stone-100 bg-white px-3 py-3 shadow-sm sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <button type="button" onClick={() => setMenuOpen(true)} aria-label="Menu"
                    className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-stone-900 px-2.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition-transform active:scale-95">
                    <Layers size={14} /> <span className="hidden sm:inline">Menu</span>
                </button>
                <BrandMark label="Technician Portal" />
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" onClick={() => reload()} disabled={refreshing} aria-label="Refresh jobs" title="Refresh jobs"
                    className="rounded-xl p-2 text-stone-400 transition-colors hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button>
                <span className="flex min-h-11 items-center gap-2 px-1">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">{initials(user.name)}</span>
                    <span className="hidden text-left leading-tight sm:block"><span className="block max-w-[120px] truncate text-xs font-bold text-stone-700">{user.name}</span><span className="block text-[10px] text-stone-400">Technician</span></span>
                </span>
                <button type="button" onClick={onLogout} title="Logout" aria-label="Logout" className="rounded-xl p-2 text-stone-400 transition-colors hover:bg-stone-50 hover:text-red-500"><LogOut className="h-4 w-4" /></button>
            </div>
        </header>

        {view === 'home'
            ? <TechnicianHome user={user} jobs={jobs} plan={plan} go={go} openJob={openJob} />
            : <main className="mx-auto w-full max-w-md flex-1 space-y-3 p-3 animate-in fade-in duration-300 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => go('home')} className="flex items-center gap-1 py-1 text-xs font-bold text-stone-500 transition-colors hover:text-stone-800">
                        <ChevronLeft className="h-4 w-4" /> Home</button>
                    <h1 className="text-sm font-black uppercase tracking-tight text-stone-900">{title}</h1>
                </div>
                <ServiceIssuesView user={user} embedded view={view} focus={focus} onViewChange={next => { setView(next); reload(); }} />
            </main>}
    </div>;
}
