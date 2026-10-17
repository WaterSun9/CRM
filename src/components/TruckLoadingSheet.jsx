import { useState } from 'react';
import { groupNotesByCustomer, isSolarPanelName } from '../utils/truckLoad';
import { truckLoadedLabel } from '../utils/truckLoadingSave';

const quantities = value => value === undefined ? '' : Number(value.toFixed(3));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BLOCKED = 'Save this customer\'s Bill of Materials in the customer card first.';

// Tick box: empty square, or green with a check mark. Same look as the
// customer card's loading ticks.
function Tick({ checked, mixed = false, disabled, title, onClick }) {
    return <button type="button" role="checkbox" aria-checked={mixed ? 'mixed' : checked} aria-label={title} title={title} disabled={disabled} onClick={onClick}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 text-[11px] font-black leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${checked || mixed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-400 bg-white text-transparent hover:border-emerald-500'}`}>{mixed ? '−' : '✓'}</button>;
}

// Loading ticks are written to the same BOM lines (and panel serials) the
// customer card's Loading switch uses, so ticking here shows there too.
// Ticks save one by one; "Truck loaded" records who loaded it and when.
export default function TruckLoadingSheet({ sheet, onClose, canTick = false, onTick, onMarkLoaded }) {
    const { batch, projects, rows, missing, uncertain, progressByCustomer = {}, panelProgressByCustomer = {}, stopNotes = {}, stale = false } = sheet;
    const loading = canTick && !!onTick;
    const loadedLabel = truckLoadedLabel(batch);
    const [busy, setBusy] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(projects[0]?.id || "");
    const act = async task => {
        if (busy) return;
        setBusy(true);
        try { await task(); } finally { setBusy(false); }
    };
    // What a cell can tick, or why it cannot. Panels with serials can be part
    // loaded (some serials ticked on the card or an earlier truck).
    const cellState = (row, project) => {
        const lines = (row.lines?.[project.id] || []).filter(line => line.quantity);
        if (!lines.length) return null;
        const loaded = lines.every(line => line.loaded);
        const panels = isSolarPanelName(row.name) ? panelProgressByCustomer[project.id] : null;
        const partly = !loaded && !!panels?.loaded;
        if (!lines.every(line => UUID_RE.test(String(line.id || '')))) return { lines, loaded, partly, panels, blocked: BLOCKED };
        return { lines, loaded, partly, panels, blocked: '' };
    };
    const tickCells = (row, targets, value) => act(() => onTick({ row, targets, value }));
    const renderCell = (row, project, interactive = true) => {
        const shown = quantities(row.quantitiesByCustomer[project.id]);
        const state = cellState(row, project);
        if (!state) return shown;
        const panelCount = state.partly ? <span className="text-[10px] font-bold text-emerald-700">{state.panels.loaded}/{state.panels.total}</span> : null;
        if (!loading || !interactive) return <span className="inline-flex items-center justify-center gap-1">{shown}{state.loaded && <span className="font-black text-emerald-700" aria-label="Loaded">✓</span>}{panelCount}</span>;
        const status = state.loaded ? 'loaded (tap to undo)' : state.partly ? `${state.panels.loaded} of ${state.panels.total} panels loaded (tap to load the rest)` : 'tap when loaded';
        return <span className="inline-flex items-center justify-center gap-1.5">
            <span>{shown}</span>
            <Tick checked={state.loaded} mixed={state.partly} disabled={busy || !!state.blocked}
                title={state.blocked || `${row.name} for ${project.customer_name || project.id}: ${status}`}
                onClick={() => tickCells(row, [{ project, lines: state.lines }], !state.loaded)} />
            {panelCount}
        </span>;
    };
    const renderTotal = (row, interactive = true) => {
        const cells = projects.map(project => ({ project, state: cellState(row, project) })).filter(cell => cell.state);
        const tickable = cells.filter(cell => !cell.state.blocked);
        const allLoaded = cells.length > 0 && cells.every(cell => cell.state.loaded);
        const total = quantities(row.total);
        if (!loading || !interactive || !tickable.length) return <span className="inline-flex items-center justify-center gap-1">{total}{(!loading || !interactive) && allLoaded && <span className="text-emerald-700">✓</span>}</span>;
        const value = !tickable.every(cell => cell.state.loaded);
        return <span className="inline-flex items-center justify-center gap-1.5"><span>{total}</span>
            <Tick checked={allLoaded} mixed={!allLoaded && cells.some(cell => cell.state.loaded || cell.state.partly)} disabled={busy} title={`${row.name}: ${value ? 'mark loaded for every customer' : 'undo for every customer'}`}
                onClick={() => tickCells(row, tickable.map(cell => ({ project: cell.project, lines: cell.state.lines })), value)} /></span>;
    };
    // Lines whose quantity is not a plain number ("as required"): not in the
    // totals, but ticked like any other line.
    const renderNoteTick = item => {
        const project = projects.find(entry => entry.id === item.customerId);
        if (!project) return null;
        if (!loading) return item.loaded ? <span className="font-black text-emerald-700" aria-label="Loaded">✓</span> : null;
        const blocked = UUID_RE.test(String(item.id || '')) ? '' : BLOCKED;
        return <Tick checked={item.loaded} disabled={busy || !!blocked}
            title={blocked || `${item.name} for ${project.customer_name || project.id}: ${item.loaded ? 'loaded (tap to undo)' : 'tap when loaded'}`}
            onClick={() => tickCells({ name: item.name }, [{ project, lines: [{ id: item.id }] }], !item.loaded)} />;
    };
    const anyStopNotes = projects.some(project => stopNotes[project.id]?.length);

    return (
        <div role="dialog" aria-modal="true" aria-label="Truck loading checklist" className="fixed inset-0 z-[70] overflow-y-auto bg-stone-100">
            <div className="min-h-full w-full">
                <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 text-stone-900 shadow-sm sm:px-6">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold">Truck loading · {batch.batch_no}</h2>
                        <p className={`mt-0.5 text-xs font-semibold ${loadedLabel ? 'text-emerald-700' : 'text-stone-500'}`}>{loadedLabel ? `✓ ${loadedLabel}` : 'Not marked loaded yet'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span role="status" className={`text-xs ${stale ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>{busy ? 'Saving…' : stale ? 'Could not refresh. Showing the last ticks read from the database.' : loading ? 'Each tick saves at once.' : 'Loading status · view only.'}</span>
                        {loading && onMarkLoaded && !batch.loaded_at && <button type="button" disabled={busy} onClick={() => act(onMarkLoaded)} className="rounded-lg bg-emerald-700 px-5 py-2 font-bold text-white disabled:opacity-50">Truck loaded</button>}
                        <button type="button" disabled={busy} onClick={() => act(onClose)} className="rounded-lg border border-stone-300 bg-white px-5 py-2 font-bold text-stone-800 disabled:opacity-50">Close</button>
                    </div>
                </div>
                <section className="m-2 overflow-hidden rounded-xl border border-stone-200 bg-white text-stone-900 sm:m-4">
                    <div className="border-b border-stone-200 px-4 py-3">
                        <p className="text-xs text-stone-500">{batch.dispatch_date || 'Date pending'}{batch.vehicle_number ? ` · ${batch.vehicle_number}` : ''}{batch.driver_name ? ` · ${batch.driver_name}` : ''}</p>
                        <div className="mt-3 hidden flex-wrap gap-2 md:flex">{projects.map((project, index) => {
                            const progress = progressByCustomer[project.id] || { loaded: 0, total: 0 };
                            return <div key={project.id} className="min-w-0 flex-1 basis-48 rounded-lg border border-stone-200 px-3 py-2">
                                <p className="text-xs font-bold text-stone-500">Stop {index + 1} · {progress.loaded}/{progress.total} items loaded</p>
                                <p className="mt-1 break-words text-sm font-semibold">{project.customer_name || project.id}</p>
                                <p className={`mt-1 text-xs font-semibold ${progress.loaded > 0 ? 'text-emerald-700' : 'text-stone-500'}`}>{progress.total && progress.loaded === progress.total ? 'Fully loaded' : progress.loaded ? 'Partially loaded' : 'Not loaded'}</p>
                                {stopNotes[project.id]?.length > 0 && <p className="mt-1 text-xs font-semibold text-orange-700">{stopNotes[project.id].join(' · ')}</p>}
                            </div>;
                        })}</div>
                        {anyStopNotes && <p className="mt-2 text-xs text-stone-500">Ticks belong to the customer, so items loaded on another truck stay ticked here.</p>}
                        {missing.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">BOM missing or unreadable: {missing.join(', ')}. Excluded from totals.</p>}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full border-collapse text-sm">
                            <thead className=" bg-stone-100 text-xs uppercase text-stone-600"><tr>
                                <th className="min-w-[180px] px-4 py-3 text-left">Material</th><th className="min-w-[130px] bg-amber-50 px-3 py-3">Whole truck</th><th className="px-3 py-3">Unit</th>
                                {projects.map((project, index) => <th key={project.id} className="min-w-[150px] max-w-[220px] px-3 py-3"><span className="block">Stop {index + 1}</span><span className="mt-1 block text-xs font-medium normal-case">{project.customer_name || project.id}</span></th>)}
                            </tr></thead>
                            <tbody>{rows.map(row => <tr key={`${row.name}|${row.uom}`} className="border-t border-stone-200 hover:bg-stone-50">
                                <th className="px-4 py-3 text-left font-semibold">{row.name}</th><td className="bg-amber-50/50 px-3 py-2 text-center font-bold">{renderTotal(row)}</td><td className="px-3 py-2 text-center text-xs text-stone-500">{row.uom}</td>
                                {projects.map(project => <td key={project.id} className="px-3 py-2 text-center tabular-nums">{renderCell(row, project)}</td>)}
                            </tr>)}</tbody>
                        </table>
                    </div>
                    <div className="md:hidden">
                        <div className="border-b bg-stone-50 p-3"><label className="block text-xs font-bold text-stone-600" htmlFor="truck-customer">Customer loading checklist · {projects.length} stops</label><select id="truck-customer" className="mt-2 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm" value={selectedCustomer} onChange={event => setSelectedCustomer(event.target.value)}>{projects.map((project, index) => <option key={project.id} value={project.id}>{index + 1}. {project.customer_name || project.id}</option>)}</select><p className="mt-2 text-xs text-stone-500">{progressByCustomer[selectedCustomer]?.loaded || 0}/{progressByCustomer[selectedCustomer]?.total || 0} items loaded · Tick the customer column or whole truck.</p>{stopNotes[selectedCustomer]?.length > 0 && <p className="mt-1 text-xs font-semibold text-orange-700">{stopNotes[selectedCustomer].join(' · ')} · ticks from the other truck stay ticked</p>}</div>
                        {rows.map(row => <div key={`${row.name}|${row.uom}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-stone-100 px-4 py-3">
                            <div><p className="text-sm font-semibold">{row.name}</p><p className="text-xs text-stone-500">{row.uom}</p></div>
                            <div className="text-center"><p className="mb-1 text-[10px] text-stone-500">Customer</p>{projects.find(project => project.id === selectedCustomer) && renderCell(row, projects.find(project => project.id === selectedCustomer))}</div>
                            <div className="text-center"><p className="mb-1 text-[10px] text-stone-500">Whole truck</p>{renderTotal(row)}</div>
                        </div>)}
                    </div>
                    {!rows.length && <p className="p-4 text-sm text-stone-500">No numbered BOM quantities found.</p>}
                    {uncertain.length > 0 && <div className="border-t bg-amber-50/50 p-4"><h3 className="text-sm font-bold">Check these quantities before loading</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{groupNotesByCustomer(uncertain).map(group => <div key={group.customer} className="rounded-lg border border-amber-200 bg-white p-3 text-xs"><p className="mb-2 font-bold">{group.customer}</p>{group.items.map((item, index) => <p key={index} className="flex items-center justify-between gap-3 py-1"><span>{item.name}</span><span className="inline-flex items-center gap-2"><strong>{item.quantity} {item.uom}</strong>{renderNoteTick(item)}</span></p>)}</div>)}</div></div>}
                </section>
            </div>
        </div>
    );
}
