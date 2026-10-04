import { groupNotesByCustomer, planTruckSheetPages } from '../utils/truckLoad';

const quantities = value => value === undefined ? '' : Number(value.toFixed(3));

export default function TruckLoadingSheet({ sheet, onPrint, onClose }) {
    const { batch, projects, rows, missing, uncertain } = sheet;
    const pages = planTruckSheetPages(rows, uncertain, projects.length);

    return (
        <div className="truck-sheet-print print-container fixed inset-0 z-[70] overflow-auto bg-stone-900/70 p-4 backdrop-blur-sm">
            <div className="mx-auto w-fit max-w-full">
                <div className="no-print mb-4 flex min-w-[min(1122px,100%)] flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-5 py-3 text-stone-900 shadow-lg">
                    <h2 className="text-base font-bold">Truck loading sheet · {batch.batch_no}</h2>
                    <div className="flex gap-2">
                        <button type="button" onClick={onPrint} className="rounded-lg bg-amber-500 px-4 py-2 font-bold">Print truck sheet</button>
                        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Close</button>
                    </div>
                </div>
                <div className="truck-sheet-preview flex flex-col items-start gap-5 overflow-x-auto pb-5">
                    {pages.map((page, pageIndex) => {
                        const isLast = pageIndex === pages.length - 1;
                        return (
                            <article key={pageIndex} className="truck-sheet-page box-border flex h-[793px] w-[1122px] shrink-0 flex-col overflow-hidden bg-white px-[45px] py-[40px] text-stone-900 shadow-xl">
                                <header className="mb-4 flex items-start justify-between gap-6 border-b-2 border-stone-900 pb-3">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Watersun Electrical Solutions Pvt Ltd</p>
                                        <h1 className="text-lg font-black uppercase">Combined truck loading sheet</h1>
                                        <p className="mt-1 text-[10px]">Batch {batch.batch_no} · {batch.dispatch_date || 'Dispatch date pending'}{batch.vehicle_number ? ` · Vehicle ${batch.vehicle_number}` : ''}{batch.driver_name ? ` · Driver ${batch.driver_name}` : ''}</p>
                                    </div>
                                    <div className="shrink-0 text-right text-[10px] font-bold uppercase text-stone-600">
                                        <p>{pageIndex === 0 ? 'Loading quantities' : page.kind === 'notes' ? 'Quantity checks' : 'Loading quantities · continued'}</p>
                                        <p className="mt-1 text-stone-900">Page {pageIndex + 1} of {pages.length}</p>
                                    </div>
                                </header>

                                <div className="min-h-0 flex-1">
                                    {pageIndex === 0 && <>
                                        <h2 className="mb-1 text-[10px] font-black uppercase tracking-wide">Route order</h2>
                                        <p className="mb-3 text-[10px] leading-snug">{projects.map((project, index) => `${index + 1}. ${project.customer_name || project.id}`).join('  →  ')}</p>
                                        {missing.length > 0 && <p className="mb-3 border border-amber-400 bg-amber-50 p-2 text-[10px] font-semibold">BOM missing or unreadable: {missing.join(', ')}. These customers are excluded from the totals.</p>}
                                    </>}

                                    {page.kind === 'materials' && <>
                                        <h2 className="mb-2 text-[10px] font-black uppercase tracking-wide">{pageIndex === 0 ? 'Material loading quantities' : 'Material loading quantities · continued'}</h2>
                                        <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
                                            <colgroup>
                                                <col style={{ width: '19%' }} />
                                                <col style={{ width: '10%' }} />
                                                <col style={{ width: '7%' }} />
                                                {projects.map(project => <col key={project.id} style={{ width: `${64 / Math.max(projects.length, 1)}%` }} />)}
                                            </colgroup>
                                            <thead><tr className="bg-stone-100 text-left">
                                                <th scope="col" className="border px-1.5 py-1.5 text-left">Material</th>
                                                <th scope="col" className="border bg-amber-50 px-1.5 py-1.5 text-center">Total to load</th>
                                                <th scope="col" className="border px-1.5 py-1.5 text-center">Unit</th>
                                                {projects.map((project, index) => <th scope="col" key={project.id} className="border px-1.5 py-1.5 text-center align-top" title={project.customer_name || project.id}><span className="block font-bold">Customer {index + 1}</span><span className="block break-words text-[9px] font-normal leading-tight overflow-hidden" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{project.customer_name || project.id}</span></th>)}
                                            </tr></thead>
                                            <tbody>{page.rows.map(row => <tr key={`${row.name}|${row.uom}`}>
                                                <th scope="row" className="border px-1.5 py-0.5 text-left font-semibold break-words">{row.name}</th>
                                                <td className="border bg-amber-50 px-1.5 py-0.5 text-center font-bold tabular-nums">{quantities(row.total)}</td>
                                                <td className="border px-1.5 py-0.5 text-center">{row.uom}</td>
                                                {projects.map(project => <td key={project.id} className="border px-1.5 py-0.5 text-center tabular-nums">{quantities(row.quantitiesByCustomer[project.id])}</td>)}
                                            </tr>)}</tbody>
                                        </table>
                                        {rows.length === 0 && <p className="p-3 text-stone-500">No numbered BOM quantities found for this batch.</p>}
                                    </>}

                                    {page.notes.length > 0 && <section className="mt-4">
                                        <h2 className="text-[11px] font-black uppercase tracking-wide">Check these quantities before loading</h2>
                                        <p className="mb-3 mt-1 text-[10px] leading-snug text-stone-600">These entries could not be added to the loading totals. Confirm the quantities against each customer’s BOM.</p>
                                        <div className="grid grid-cols-2 items-start gap-3">
                                            {groupNotesByCustomer(page.notes).map(group => <div key={group.customer} className="min-w-0 break-inside-avoid border border-stone-300">
                                                <h3 className="border-b border-stone-300 bg-stone-100 px-2 py-1.5 text-[10px] font-black break-words">{group.customer}</h3>
                                                <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
                                                    <thead><tr className="text-left text-stone-600"><th scope="col" className="w-[65%] border-b border-stone-200 px-2 py-1 font-semibold">Material</th><th scope="col" className="border-b border-stone-200 px-2 py-1 font-semibold">Entered quantity</th></tr></thead>
                                                    <tbody>{group.items.map((item, index) => <tr key={`${item.name}|${index}`}>
                                                        <td className="border-t border-stone-100 px-2 py-1 align-top break-words">{item.name}</td>
                                                        <td className="border-t border-stone-100 px-2 py-1 align-top break-words font-semibold">{item.quantity} {item.uom}</td>
                                                    </tr>)}</tbody>
                                                </table>
                                            </div>)}
                                        </div>
                                    </section>}
                                </div>

                                {isLast && <div className="mb-3 grid grid-cols-2 gap-8 text-[10px] font-semibold">
                                    <p className="border-t border-stone-500 pt-2">Warehouse loaded by / date</p>
                                    <p className="border-t border-stone-500 pt-2">Driver received / date</p>
                                </div>}
                                <footer className="flex justify-between border-t border-stone-300 pt-2 text-[9px] text-stone-500">
                                    <span>Watersun · Truck loading sheet · Batch {batch.batch_no}</span>
                                    <span>Page {pageIndex + 1} of {pages.length}</span>
                                </footer>
                            </article>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
