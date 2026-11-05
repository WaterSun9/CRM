// Technician portal: sidebar (Home, My trip, My jobs, Open jobs) like the admin dashboard,
// and a Home page listing the jobs waiting to be claimed.
import { useCallback, useEffect, useState } from 'react';
import { Briefcase, CalendarDays, Home, Inbox, LogOut, Menu, X } from 'lucide-react';
import { supabase } from '../supabase';
import BrandMark from './BrandMark';
import ServiceIssuesView from './ServiceIssuesView';
import { readDayPlan } from './service/DayPlan';
import { ticketLabel, todayLocal } from './service/serviceLabels';
import { pincodeInText } from './service/tripLabels';

const VIEWS = [
    ['home', 'Home', Home],
    ['plan', 'My trip', CalendarDays],
    ['mine', 'My jobs', Briefcase],
    ['open', 'Open jobs', Inbox],
];
const ACTIVE = ['assigned', 'completion_pending'];
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; };

// Jobs this technician can see (open + their own) and today's plan; read again every 30 s.
function useTechnicianJobs(userId) {
    const [jobs, setJobs] = useState(null);
    const [plan, setPlan] = useState([]);
    const load = useCallback(async () => {
        const { data } = await supabase.from('service_issues').select('*').order('required_date', { ascending: true }).limit(500);
        setJobs(data || []);
        try { setPlan(await readDayPlan(userId, todayLocal())); } catch { setPlan([]); }
    }, [userId]);
    useEffect(() => {
        load();
        const timer = setInterval(load, 30000);
        return () => clearInterval(timer);
    }, [load]);
    return { jobs, plan, reload: load };
}

// Home: the jobs waiting to be claimed. View opens one (its info, then Claim at the bottom);
// My trip and My jobs are in the sidebar.
function TechnicianHome({ user, jobs, openJob }) {
    const open = (jobs || []).filter(job => job.status === 'open');
    return <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-8">
        <div>
            <p className="text-sm text-stone-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="text-2xl font-bold text-stone-800">{greeting()}, {String(user.name || '').split(' ')[0] || 'there'}</h1>
        </div>
        <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">Waiting to be claimed{jobs ? ` · ${open.length}` : ''}</h2>
            {jobs === null ? <p className="text-sm text-stone-400">Loading…</p>
                : !open.length ? <p className="rounded-2xl border border-dashed border-stone-200 bg-white p-6 text-center text-sm text-stone-400">No new jobs right now</p>
                    : <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white shadow-sm">{open.map(job => <li key={job.id} className="flex items-center gap-3 p-3">
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-stone-800">{job.customer_name}</span>
                            <span className="block truncate text-xs text-stone-400">{[ticketLabel(job), pincodeInText(job.service_address), job.problem_type].filter(Boolean).join(' · ')}</span>
                            {job.required_date && <span className="mt-0.5 block text-[11px] text-stone-400">Needed by {new Date(`${job.required_date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                        </span>
                        <button type="button" onClick={() => openJob(job.id, 'open')} className="min-h-10 shrink-0 rounded-xl bg-stone-900 px-4 text-xs font-bold text-white">View</button>
                    </li>)}</ul>}
        </section>
    </div>;
}

export default function TechnicianPortal({ user, onLogout }) {
    const [view, setView] = useState('home');
    const [focus, setFocus] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const { jobs, plan, reload } = useTechnicianJobs(user.id);
    const go = next => { setView(next); setMenuOpen(false); if (next === 'home') reload(); };
    const openJob = (id, where = 'mine') => { setView(where); setFocus({ id }); };
    const counts = jobs ? {
        mine: jobs.filter(job => job.assigned_to === user.id && ACTIVE.includes(job.status)).length,
        open: jobs.filter(job => job.status === 'open').length,
        plan: plan.length,
    } : {};
    const title = VIEWS.find(([key]) => key === view)?.[1] || '';

    return <div className="flex min-h-screen bg-[#FCFBFA]">
        {menuOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)} />}
        <aside className={`fixed bottom-0 left-0 top-0 z-50 w-64 flex-col border-r border-stone-100 bg-white ${menuOpen ? 'flex' : 'hidden'} md:flex`}>
            <div className="flex items-center justify-between border-b border-stone-100 p-5">
                <BrandMark size="md" />
                <button type="button" aria-label="Close menu" className="text-stone-400 md:hidden" onClick={() => setMenuOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 space-y-0.5 p-3">{VIEWS.map(([key, label, Icon]) =>
                <button key={key} type="button" onClick={() => go(key)} aria-current={view === key ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${view === key ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
                    <Icon className="h-4 w-4 shrink-0" /><span className="flex-1 text-left">{label}</span>
                    {counts[key] > 0 && <span className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${view === key ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'}`}>{counts[key]}</span>}
                </button>)}
            </nav>
            <div className="border-t border-stone-100 p-3">
                <p className="truncate px-3 pb-2 text-xs font-semibold text-stone-700">{user.name}<span className="block text-[10px] font-normal text-stone-400">Technician</span></p>
                <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50"><LogOut className="h-4 w-4" /> Logout</button>
            </div>
        </aside>

        <main className="flex min-h-screen min-w-0 flex-1 flex-col md:ml-64">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-stone-100 bg-white/90 px-4 backdrop-blur-md lg:px-6">
                <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)} className="text-stone-500 md:hidden"><Menu className="h-6 w-6" /></button>
                <h2 className="font-bold text-stone-800">{title}</h2>
            </header>
            {view === 'home'
                ? <TechnicianHome user={user} jobs={jobs} openJob={openJob} />
                : <div className="mx-auto w-full max-w-6xl p-3 sm:p-4 lg:p-6"><ServiceIssuesView user={user} embedded view={view} focus={focus} onViewChange={next => { setView(next); reload(); }} /></div>}
        </main>
    </div>;
}
