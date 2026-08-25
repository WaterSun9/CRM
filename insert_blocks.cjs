const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `                            {displayedStage === 'LEADS' && (`;

const insertion = `                            {displayedStage === 'CUSTOMER_CARD' && (
                                <div className="space-y-4">
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <User size={11} /> Customer Profile
                                        </h5>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Customer Name</span><span className="font-semibold text-stone-900">{selectedCust.customer_name || '–'}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Phone Number</span><span className="font-semibold text-stone-900">{selectedCust.phone_number || '–'}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Email</span><span className="font-semibold text-stone-900">{selectedCust.email || selectedCust.email_address || '–'}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Consumer No</span><span className="font-semibold text-stone-900">{selectedCust.consumer_no || '–'}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Location</span><span className="font-semibold text-stone-900">{selectedCust.villages || '–'} {selectedCust.sub_divisions ? \`(\${selectedCust.sub_divisions})\` : ''}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Channel Partner</span><span className="font-semibold text-stone-900">{selectedCust.channel_partner || '–'}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">System Capacity</span><span className="font-semibold text-stone-900">{selectedCust.system_capacity_kwp ? \`\${selectedCust.system_capacity_kwp} kWp\` : '–'}</span></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {displayedStage === 'DOCUMENTS' && (
                                <div className="space-y-3">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                                        <FolderOpen size={11} /> Uploaded Documents ({custDocs?.length || 0})
                                    </h5>
                                    {(!custDocs || custDocs.length === 0) ? (
                                        <div className="p-8 text-center bg-stone-50 border border-dashed border-stone-200 rounded-xl">
                                            <p className="text-xs font-bold text-stone-500">No documents found</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-2">
                                            {custDocs.map(doc => (
                                                <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-stone-200 rounded-xl shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                                                            <FileText size={14} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-stone-800 truncate">{doc.file_name || doc.doc_type}</p>
                                                            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mt-0.5">{doc.doc_type.replace(/_/g, ' ')}</p>
                                                        </div>
                                                    </div>
                                                    <a href={getViewUrl(doc.storage_path)} target="_blank" rel="noreferrer" className="shrink-0 w-full sm:w-auto bg-stone-100 hover:bg-blue-50 text-stone-600 hover:text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5">
                                                        <Eye size={12} /> View File
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {displayedStage === 'LEADS' && (`;

content = content.replace(target, insertion);
fs.writeFileSync(file, content, 'utf8');
console.log('Inserted blocks');
