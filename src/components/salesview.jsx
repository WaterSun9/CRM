// import { useState } from 'react';
// import {
//     MapPin, Phone, Zap, IndianRupee, ChevronDown, Send, X,
//     MessageSquare, Edit3, Save, Search, User, Mail, Building2,
//     CreditCard, Gauge, FileText, Clock, CheckCircle2, Users,
//     ShoppingCart, Package, Wrench, Banknote, ClipboardCheck, FolderOpen, Lock
// } from 'lucide-react';
// import { formatINR, toIndianCommas, parseIndianNumber } from '../utils';

// const STAGES = [
//     { id: 'leads', label: 'Leads', icon: Users },
//     { id: 'sales_closed', label: 'Sales Closed', icon: ShoppingCart },
//     { id: 'pending_loans', label: 'Pending Loans', icon: Clock },
//     { id: 'material_procurement', label: 'Material', icon: Package },
//     { id: 'pending_installation', label: 'Installation', icon: Wrench },
//     { id: 'post_installation_docs', label: 'Docs', icon: FileText },
//     { id: 'pending_discom', label: 'DISCOM', icon: Send },
//     { id: 'meter_installation', label: 'Meter', icon: Gauge },
//     { id: 'discom_inspection', label: 'Inspection', icon: ClipboardCheck },
//     { id: 'subsidy_pending', label: 'Subsidy', icon: Banknote },
//     { id: 'second_payment', label: '2nd Payment', icon: CreditCard },
//     { id: 'third_payment', label: '3rd Payment', icon: CreditCard },
//     { id: 'completed', label: 'Completed', icon: CheckCircle2 },
// ];

// const INTENT_COLORS = {
//     High: 'bg-red-100 text-red-700 border-red-200',
//     Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
//     Low: 'bg-gray-100 text-gray-500 border-gray-200',
// };

// const STAGE_COLORS = {
//     leads: 'bg-blue-50 text-blue-700',
//     sales_closed: 'bg-purple-50 text-purple-700',
//     pending_loans: 'bg-orange-50 text-orange-700',
//     material_procurement: 'bg-yellow-50 text-yellow-700',
//     pending_installation: 'bg-pink-50 text-pink-700',
//     post_installation_docs: 'bg-indigo-50 text-indigo-700',
//     pending_discom: 'bg-cyan-50 text-cyan-700',
//     meter_installation: 'bg-teal-50 text-teal-700',
//     discom_inspection: 'bg-lime-50 text-lime-700',
//     subsidy_pending: 'bg-amber-50 text-amber-700',
//     second_payment: 'bg-emerald-50 text-emerald-700',
//     third_payment: 'bg-green-50 text-green-700',
//     completed: 'bg-gray-900 text-white',
// };

// // ─── Field Row ────────────────────────────────────────────────────────────────
// function FieldRow({ label, value, icon: Icon, isMoney, isEnergy }) {
//     if (!value) return null;
//     return (
//         <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
//             {Icon && <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />}
//             <span className="text-[10px] text-gray-400 w-24 flex-shrink-0 mt-0.5">{label}</span>
//             <span className={`text-xs font-medium flex-1 ${isMoney ? 'text-emerald-600' : isEnergy ? 'text-blue-600' : 'text-gray-800'}`}>
//                 {isMoney && value ? formatINR(value) : value}
//             </span>
//         </div>
//     );
// }

// // ─── Editable Input ───────────────────────────────────────────────────────────
// function EditInput({ label, value, onChange, type = 'text', options, textarea, isMoney }) {
//     const isMoneyField = isMoney || (type === 'number' && /₹|amount|quote|cost|price|payment|receivable|discount/i.test(label));
//     return (
//         <div className="mb-3">
//             <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wide">{label}</label>
//             {options ? (
//                 <select value={value || ''} onChange={e => onChange(e.target.value)}
//                     className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-gray-400 focus:outline-none">
//                     <option value="">Select...</option>
//                     {options.map(o => <option key={o.id || o} value={o.id || o}>{o.label || o}</option>)}
//                 </select>
//             ) : textarea ? (
//                 <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={2}
//                     className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-gray-400 focus:outline-none resize-none" />
//             ) : isMoneyField ? (
//                 <input type="text" inputMode="decimal" value={value ? toIndianCommas(value) : ''}
//                     onChange={e => onChange(parseIndianNumber(e.target.value))}
//                     className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-gray-400 focus:outline-none" />
//             ) : (
//                 <input type={type} value={value || ''} onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
//                     className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-gray-400 focus:outline-none" />
//             )}
//         </div>
//     );
// }

// // ─── Customer Detail Sheet (bottom sheet modal) ───────────────────────────────
// function CustomerSheet({ customer, onClose, onUpdate, userName }) {
//     const [tab, setTab] = useState('details');
//     const [isEditing, setIsEditing] = useState(false);
//     const [editData, setEditData] = useState({ ...customer });
//     const [saving, setSaving] = useState(false);
//     const [followUpText, setFollowUpText] = useState('');

//     const set = (field, val) => setEditData(prev => ({ ...prev, [field]: val }));

//     const handleSave = async () => {
//         setSaving(true);
//         const updates = { ...editData };
//         delete updates.id; delete updates.created_at; delete updates.follow_ups;
//         updates.total_cost = Number(updates.total_cost) || 0;
//         updates.quoted_price_bank = Number(updates.quoted_price_bank) || 0;
//         updates.capacity_kwp = Number(updates.capacity_kwp) || 0;
//         await onUpdate(customer.id, updates);
//         setIsEditing(false);
//         setSaving(false);
//     };

//     const handleAddFollowUp = async () => {
//         if (!followUpText.trim()) return;
//         const newNote = { text: followUpText, date: new Date().toISOString(), authorId: userName };
//         const updated = [...(customer.follow_ups || []), newNote];
//         await onUpdate(customer.id, { follow_ups: updated });
//         setFollowUpText('');
//     };

//     const stageLabel = STAGES.find(s => s.id === customer.stage)?.label || customer.stage;
//     const isFrozen = customer.stage === 'completed';

//     return (
//         <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
//             <div className="bg-white rounded-t-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
//                 {/* Handle */}
//                 <div className="flex justify-center pt-2 pb-1">
//                     <div className="w-10 h-1 bg-gray-300 rounded-full" />
//                 </div>

//                 {/* Header */}
//                 <div className="px-4 pb-3 border-b border-gray-100">
//                     <div className="flex items-start justify-between">
//                         <div className="min-w-0">
//                             <h2 className="font-bold text-gray-900 text-base leading-tight truncate">{customer.customer_name}</h2>
//                             <p className="text-xs text-gray-400 mt-0.5">{customer.quotation_number}</p>
//                         </div>
//                         <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2">
//                             <X className="w-5 h-5" />
//                         </button>
//                     </div>

//                     {/* Stage selector */}
//                     <div className="mt-3 flex items-center gap-2">
//                         <span className="text-[10px] text-gray-400 uppercase tracking-wide">Stage</span>
//                         {isFrozen ? (
//                             <div className="flex-1 flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700">
//                                 <Lock className="w-3 h-3" /> {stageLabel} · Frozen
//                             </div>
//                         ) : (
//                             <select
//                                 value={editData.stage}
//                                 onChange={e => { set('stage', e.target.value); onUpdate(customer.id, { stage: e.target.value }); }}
//                                 className={`flex-1 px-2 py-1 rounded-lg text-xs font-semibold border focus:outline-none ${STAGE_COLORS[editData.stage] || 'bg-gray-100 text-gray-700'}`}
//                             >
//                                 {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
//                             </select>
//                         )}
//                     </div>
//                 </div>

//                 {/* Tabs */}
//                 <div className="flex border-b border-gray-100 px-4">
//                     {['details', 'financial', 'notes'].map(t => (
//                         <button key={t} onClick={() => setTab(t)}
//                             className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${tab === t ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400'}`}>
//                             {t}
//                         </button>
//                     ))}
//                 </div>

//                 {/* Content */}
//                 <div className="flex-1 overflow-y-auto px-4 py-3">
//                     {tab === 'details' && (
//                         isEditing ? (
//                             <div>
//                                 <EditInput label="Customer Name" value={editData.customer_name} onChange={v => set('customer_name', v)} />
//                                 <EditInput label="Phone" value={editData.phone} onChange={v => set('phone', v)} type="tel" />
//                                 <EditInput label="Email" value={editData.email} onChange={v => set('email', v)} type="email" />
//                                 <EditInput label="Location" value={editData.location} onChange={v => set('location', v)} />
//                                 <EditInput label="Branch" value={editData.branch} onChange={v => set('branch', v)}
//                                     options={['Srikalahasti', 'Tirupati', 'Tada', 'Puttur', 'Nagari', 'Pichatur']} />
//                                 <EditInput label="Capacity (kWp)" value={editData.capacity_kwp} onChange={v => set('capacity_kwp', v)} type="number" />
//                                 <EditInput label="System Type" value={editData.project_type} onChange={v => set('project_type', v)}
//                                     options={['On-Grid', 'Off-Grid', 'Hybrid']} />
//                                 <EditInput label="Intent" value={editData.intent_level} onChange={v => set('intent_level', v)}
//                                     options={['Low', 'Medium', 'High']} />
//                                 <EditInput label="Site Remarks" value={editData.site_remarks} onChange={v => set('site_remarks', v)} textarea />
//                                 <EditInput label="Specific Requirements" value={editData.specific_requirements} onChange={v => set('specific_requirements', v)} textarea />
//                             </div>
//                         ) : (
//                             <div>
//                                 <FieldRow label="Phone" value={customer.phone} icon={Phone} />
//                                 <FieldRow label="Email" value={customer.email} icon={Mail} />
//                                 <FieldRow label="Location" value={customer.location} icon={MapPin} />
//                                 <FieldRow label="Branch" value={customer.branch} icon={Building2} />
//                                 <FieldRow label="Capacity" value={customer.capacity_kwp ? `${customer.capacity_kwp} kWp` : null} icon={Zap} isEnergy />
//                                 <FieldRow label="System Type" value={customer.project_type} />
//                                 <FieldRow label="Intent" value={customer.intent_level} />
//                                 <FieldRow label="Site Remarks" value={customer.site_remarks} icon={FileText} />
//                                 <FieldRow label="Requirements" value={customer.specific_requirements} icon={FileText} />
//                                 {customer.location_link && (
//                                     <a href={customer.location_link} target="_blank" rel="noopener noreferrer"
//                                         className="flex items-center gap-2 mt-2 text-xs text-blue-600">
//                                         <MapPin className="w-3.5 h-3.5" /> View on Google Maps
//                                     </a>
//                                 )}
//                                 {customer.google_drive_link && (
//                                     <a href={customer.google_drive_link} target="_blank" rel="noopener noreferrer"
//                                         className="flex items-center gap-2 mt-1.5 text-xs text-blue-600">
//                                         <FolderOpen className="w-3.5 h-3.5" /> Customer Documents
//                                     </a>
//                                 )}
//                             </div>
//                         )
//                     )}

//                     {tab === 'financial' && (
//                         isEditing ? (
//                             <div>
//                                 <EditInput label="Quoted Amount (₹)" value={editData.total_cost} onChange={v => set('total_cost', v)} type="number" />
//                                 <EditInput label="Bank Quote (₹)" value={editData.quoted_price_bank} onChange={v => set('quoted_price_bank', v)} type="number" />
//                                 <EditInput label="Payment Mode" value={editData.payment_mode} onChange={v => set('payment_mode', v)} options={['Cash', 'Loan']} />
//                                 <EditInput label="Bank Branch" value={editData.bank_branch} onChange={v => set('bank_branch', v)} />
//                                 <EditInput label="Account Number" value={editData.account_number} onChange={v => set('account_number', v)} />
//                                 <EditInput label="IFSC Code" value={editData.ifsc_code} onChange={v => set('ifsc_code', v)} />
//                                 <EditInput label="Aadhar Number" value={editData.aadhar_number} onChange={v => set('aadhar_number', v)} />
//                                 <EditInput label="Meter Category" value={editData.meter_category} onChange={v => set('meter_category', v)} />
//                                 <EditInput label="EB Number" value={editData.eb_number} onChange={v => set('eb_number', v)} />
//                                 <EditInput label="DTR Code" value={editData.dtr_code} onChange={v => set('dtr_code', v)} />
//                                 <EditInput label="Sanctioned Load" value={editData.sanctioned_load} onChange={v => set('sanctioned_load', v)} />
//                                 <EditInput label="DISCOM Ref" value={editData.discom_ref} onChange={v => set('discom_ref', v)} />
//                                 <EditInput label="Location Link" value={editData.location_link} onChange={v => set('location_link', v)} />
//                                 <EditInput label="Google Drive Link" value={editData.google_drive_link} onChange={v => set('google_drive_link', v)} />
//                                 <EditInput label="General Notes" value={editData.notes} onChange={v => set('notes', v)} textarea />
//                             </div>
//                         ) : (
//                             <div>
//                                 <FieldRow label="Quoted Amount" value={customer.total_cost} icon={IndianRupee} isMoney />
//                                 <FieldRow label="Bank Quote" value={customer.quoted_price_bank} icon={IndianRupee} isMoney />
//                                 <FieldRow label="Payment Mode" value={customer.payment_mode} icon={CreditCard} />
//                                 <FieldRow label="Bank Branch" value={customer.bank_branch} icon={Building2} />
//                                 <FieldRow label="Account No." value={customer.account_number} />
//                                 <FieldRow label="IFSC" value={customer.ifsc_code} />
//                                 <FieldRow label="Aadhar" value={customer.aadhar_number} icon={User} />
//                                 <FieldRow label="Meter Cat." value={customer.meter_category} icon={Gauge} />
//                                 <FieldRow label="EB Number" value={customer.eb_number} />
//                                 <FieldRow label="DTR Code" value={customer.dtr_code} />
//                                 <FieldRow label="Load" value={customer.sanctioned_load} />
//                                 <FieldRow label="DISCOM Ref" value={customer.discom_ref} />
//                                 <FieldRow label="Notes" value={customer.notes} />
//                             </div>
//                         )
//                     )}

//                     {tab === 'notes' && (
//                         <div>
//                             <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
//                                 {customer.follow_ups?.length > 0 ? (
//                                     [...customer.follow_ups].reverse().map((f, i) => (
//                                         <div key={i} className="bg-gray-50 rounded-lg p-3">
//                                             <p className="text-sm text-gray-700">{f.text}</p>
//                                             <div className="flex justify-between mt-1.5 text-[10px] text-gray-400">
//                                                 <span>{f.authorId}</span>
//                                                 <span>{new Date(f.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
//                                             </div>
//                                         </div>
//                                     ))
//                                 ) : (
//                                     <p className="text-center text-gray-400 text-sm py-6">No notes yet</p>
//                                 )}
//                             </div>
//                             <div className="flex gap-2 sticky bottom-0 bg-white pt-2">
//                                 <input type="text" value={followUpText} onChange={e => setFollowUpText(e.target.value)}
//                                     onKeyPress={e => e.key === 'Enter' && handleAddFollowUp()}
//                                     placeholder="Add a note..."
//                                     className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none" />
//                                 <button onClick={handleAddFollowUp} disabled={!followUpText.trim()}
//                                     className="px-3 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-40">
//                                     <Send className="w-4 h-4" />
//                                 </button>
//                             </div>
//                         </div>
//                     )}
//                 </div>

//                 {/* Edit / Save bar — shown on details and financial tabs */}
//                 {tab !== 'notes' && (
//                     <div className="px-4 py-3 border-t border-gray-100 bg-white">
//                         {isEditing ? (
//                             <div className="flex gap-2">
//                                 <button onClick={() => { setIsEditing(false); setEditData({ ...customer }); }}
//                                     className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">
//                                     Cancel
//                                 </button>
//                                 <button onClick={handleSave} disabled={saving}
//                                     className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
//                                     {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
//                                 </button>
//                             </div>
//                         ) : (
//                             <button onClick={() => !isFrozen && setIsEditing(true)} disabled={isFrozen}
//                                 className="w-full py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
//                                 <Edit3 className="w-4 h-4" /> Edit Details
//                             </button>
//                         )}
//                     </div>
//                 )}
//             </div>
//         </div>
//     );
// }

// // ─── Sales Card ───────────────────────────────────────────────────────────────
// function SalesCard({ customer, onSelect }) {
//     const stageLabel = STAGES.find(s => s.id === customer.stage)?.label || customer.stage;
//     const intentColor = INTENT_COLORS[customer.intent_level] || INTENT_COLORS.Low;

//     return (
//         <div onClick={() => onSelect(customer)}
//             className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:scale-[0.98] transition-transform cursor-pointer">
//             <div className="flex items-start justify-between mb-2">
//                 <div className="min-w-0">
//                     <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{customer.customer_name}</h3>
//                     <p className="text-[10px] text-gray-400 mt-0.5">{customer.quotation_number}</p>
//                 </div>
//                 {customer.intent_level && (
//                     <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ml-2 ${intentColor}`}>
//                         {customer.intent_level}
//                     </span>
//                 )}
//             </div>

//             <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
//                 <span className="flex items-center gap-1">
//                     <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
//                     <span className="truncate">{customer.location || '–'}</span>
//                 </span>
//                 <span className="flex items-center gap-1 flex-shrink-0">
//                     <Zap className="w-3.5 h-3.5 text-blue-500" />
//                     <span className="text-blue-600 font-medium">{customer.capacity_kwp || '–'} kWp</span>
//                 </span>
//             </div>

//             <div className="flex items-center justify-between">
//                 <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${STAGE_COLORS[customer.stage] || 'bg-gray-100 text-gray-600'}`}>
//                     {stageLabel}
//                 </span>
//                 <span className="text-sm font-bold text-emerald-600 flex items-center gap-0.5">
//                     <IndianRupee className="w-3.5 h-3.5" />
//                     {customer.total_cost ? toIndianCommas(customer.total_cost) : '–'}
//                 </span>
//             </div>

//             {customer.phone && (
//                 <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()}
//                     className="mt-3 flex items-center gap-2 text-xs text-gray-500 border-t border-gray-50 pt-2.5">
//                     <Phone className="w-3.5 h-3.5 text-gray-400" />
//                     {customer.phone}
//                 </a>
//             )}
//         </div>
//     );
// }

// // ─── Main SalesView ───────────────────────────────────────────────────────────
// export default function SalesView({ customers, loading, onUpdate, user }) {
//     const [selectedCustomer, setSelectedCustomer] = useState(null);
//     const [searchQuery, setSearchQuery] = useState('');
//     const [stageFilter, setStageFilter] = useState('');

//     const filtered = customers.filter(c => {
//         const q = searchQuery.toLowerCase();
//         const matchesSearch = !q ||
//             (c.customer_name && String(c.customer_name).toLowerCase().includes(q)) ||
//             (c.phone && String(c.phone).includes(q)) ||
//             (c.location && String(c.location).toLowerCase().includes(q));
//         const matchesStage = !stageFilter || c.stage === stageFilter;
//         return matchesSearch && matchesStage;
//     });

//     const stageCounts = STAGES.reduce((acc, s) => {
//         acc[s.id] = customers.filter(c => c.stage === s.id).length;
//         return acc;
//     }, {});

//     if (loading) {
//         return (
//             <div className="flex items-center justify-center h-64">
//                 <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
//             </div>
//         );
//     }

//     return (
//         <div className="min-h-screen bg-gray-50">
//             {/* Header */}
//             <div className="bg-white sticky top-0 z-30 shadow-sm px-4 pt-4 pb-3">
//                 <div className="flex items-center justify-between mb-3">
//                     <div>
//                         <h1 className="font-bold text-gray-900 text-lg">My Leads</h1>
//                         <p className="text-xs text-gray-400">{customers.length} assigned • {filtered.length} shown</p>
//                     </div>
//                     <div className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
//                         {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
//                     </div>
//                 </div>

//                 {/* Search */}
//                 <div className="relative mb-2">
//                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
//                     <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
//                         placeholder="Search name, phone, location..."
//                         className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none" />
//                 </div>

//                 {/* Stage filter pills */}
//                 <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
//                     <button onClick={() => setStageFilter('')}
//                         className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${!stageFilter ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
//                         All ({customers.length})
//                     </button>
//                     {STAGES.filter(s => stageCounts[s.id] > 0).map(s => (
//                         <button key={s.id} onClick={() => setStageFilter(stageFilter === s.id ? '' : s.id)}
//                             className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${stageFilter === s.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
//                             {s.label} ({stageCounts[s.id]})
//                         </button>
//                     ))}
//                 </div>
//             </div>

//             {/* Cards */}
//             <div className="p-4 space-y-3">
//                 {filtered.length > 0 ? (
//                     filtered.map(c => (
//                         <SalesCard key={c.id} customer={c} onSelect={setSelectedCustomer} />
//                     ))
//                 ) : (
//                     <div className="flex flex-col items-center justify-center py-16 text-gray-400">
//                         <Search className="w-10 h-10 mb-3 text-gray-300" />
//                         <p className="font-medium text-gray-500">No leads found</p>
//                         <p className="text-sm mt-1">{searchQuery ? 'Try a different search' : 'No leads assigned yet'}</p>
//                     </div>
//                 )}
//             </div>

//             {/* Detail Sheet */}
//             {selectedCustomer && (
//                 <CustomerSheet
//                     customer={selectedCustomer}
//                     onClose={() => setSelectedCustomer(null)}
//                     onUpdate={async (id, updates) => {
//                         await onUpdate(id, updates);
//                         setSelectedCustomer(prev => ({ ...prev, ...updates }));
//                     }}
//                     userName={user.name}
//                 />
//             )}
//         </div>
//     );
// }