import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabase";
import {
    LogOut, Search, Upload, Trash2, Eye, Loader2, CheckCircle2,
    RefreshCw, X, MessageSquare, ChevronDown, ChevronUp, Save, FileText,
    SendHorizonal, User, Sun, AlertTriangle, Check, AlertCircle, FileCheck
} from "lucide-react";
import {
    uploadDocument, getCustomerDocuments, getViewUrl, deleteDocument, logActivity,
} from "../utils.jsx";
import { FilePreviewModal } from "./modal-tabs/shared";

const uploaderCache = {};
async function fetchUploaderName(userId) {
    if (!userId) return null;
    if (uploaderCache[userId] !== undefined) return uploaderCache[userId];
    try {
        const { data } = await supabase.from("profiles").select("name").eq("id", userId).single();
        uploaderCache[userId] = data?.name || "Unknown";
        return uploaderCache[userId];
    } catch {
        return "Unknown";
    }
}

function RemarkRow({ customerId, initialRemark, userId, customerName }) {
    const [open, setOpen] = useState(false);
    const [remark, setRemark] = useState(initialRemark || "");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: existing } = await supabase.from("admin")
                .select("discom_submission").eq("id", customerId).single();
            const merged = { ...(existing?.discom_submission || {}), stamp_remark: remark };
            const { error } = await supabase.from("admin").update({ discom_submission: merged }).eq("id", customerId);
            if (error) throw error;
            await logActivity(userId, "update", customerName + ": Updated stamp remark", "", customerId);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Save remark failed:", err);
            alert("Failed to save stamp remark: " + (err.message || "Unknown error"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="border-t border-stone-100 pt-2.5">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 text-stone-500 hover:text-stone-800 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
            >
                <MessageSquare size={12} className="text-amber-500" />
                <span>Stamp Remark</span>
                {remark && !open && (
                    <span className="bg-amber-100 text-amber-800 rounded-md text-[9px] px-1.5 py-0.2 font-extrabold">
                        saved
                    </span>
                )}
                {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {open && (
                <div className="mt-2 space-y-2 animate-in slide-in-from-top-1 duration-150">
                    <textarea
                        value={remark}
                        onChange={e => setRemark(e.target.value)}
                        placeholder="Add notes or remarks about this stamp..."
                        rows={2}
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    />
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 ${
                            saved
                                ? 'bg-emerald-500 text-white'
                                : 'bg-stone-900 hover:bg-stone-800 text-white'
                        }`}
                    >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : <Save size={13} />}
                        {saving ? "Saving..." : saved ? "Saved!" : "Save Remark"}
                    </button>
                </div>
            )}
        </div>
    );
}

function CustomerCard({ cust, docs, user, onDocsChange, onCustomerRemoved, onPreviewDoc, setCustomAlert }) {
    const fileInputRef = useRef(null);
    const stampDoc = docs.find(d => d.doc_type === "pm_surya_ghar_stamp");
    const isUploaded = !!stampDoc;
    const [uploading, setUploading] = useState(false);
    const [uploaderName, setUploaderName] = useState(null);
    const [sending, setSending] = useState(false);
    const [showConfirmSend, setShowConfirmSend] = useState(false);
    const subDetails = cust.discom_submission || {};
    const initialRemark = subDetails.stamp_remark || "";

    useEffect(() => {
        if (stampDoc?.uploaded_by) fetchUploaderName(stampDoc.uploaded_by).then(setUploaderName);
        else setUploaderName(null);
    }, [stampDoc?.uploaded_by]);

    const handleSend = async () => {
        setSending(true);
        setShowConfirmSend(false);
        try {
            const { data: existing } = await supabase
                .from("admin").select("discom_submission").eq("id", cust.id).single();
            const merged = {
                ...(existing?.discom_submission || {}),
                stamp_sent: true,
                stamp_completed_at: new Date().toISOString(),
                stamp_completed_by: user?.name || "Stamp Maker",
                stamp_sendback_remark: null,
            };
            await supabase.from("admin")
                .update({ discom_submission: merged })
                .eq("id", cust.id);
            await logActivity(user.id, "update",
                cust.customer_name + ": Stamp sent to Document Making", "", cust.id);
            onCustomerRemoved(cust.id);
        } catch (err) {
            setCustomAlert({
                title: "Action Failed",
                message: err.message,
                type: "error"
            });
        } finally {
            setSending(false);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        setUploading(true);
        try {
            if (stampDoc) await deleteDocument(stampDoc.id, stampDoc.storage_path);
            await uploadDocument(file, cust.id, "pm_surya_ghar_stamp", user.id);
            await supabase.from("admin").update({ pm_surya_ghar_stamp: true }).eq("id", cust.id);
            await logActivity(user.id, "update",
                cust.customer_name + ": " + (stampDoc ? "Changed" : "Uploaded") + " PM Surya Ghar Stamp", "", cust.id);
            const updatedDocs = await getCustomerDocuments(cust.id);
            onDocsChange(cust.id, updatedDocs || []);
        } catch (err) {
            setCustomAlert({
                title: "Upload Failed",
                message: err.message || "Failed to upload stamp document.",
                type: "error"
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteStamp = async () => {
        if (!stampDoc) return;
        setUploading(true);
        try {
            await deleteDocument(stampDoc.id, stampDoc.storage_path);
            await supabase.from("admin").update({ pm_surya_ghar_stamp: false }).eq("id", cust.id);
            await logActivity(user.id, "update", cust.customer_name + ": Removed PM Surya Ghar Stamp", "", cust.id);
            const updatedDocs = await getCustomerDocuments(cust.id);
            onDocsChange(cust.id, updatedDocs || []);
        } catch (err) {
            setCustomAlert({
                title: "Delete Failed",
                message: err.message,
                type: "error"
            });
        } finally {
            setUploading(false);
        }
    };

    const partyRows = [
        ["First Party", subDetails.first_party],
        ["Second Party", subDetails.second_party],
        ["Purchased By", subDetails.purchased_party],
        ["Stamp Value", subDetails.stamp_value ? `₹${subDetails.stamp_value}` : ''],
        ["Description", subDetails.stamp_description],
    ].filter(([, v]) => v);

    const sendbackRemark = subDetails.stamp_sendback_remark || null;
    const sendbackBy = subDetails.stamp_sendback_by || null;

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
            />

            <div className={`bg-white rounded-[24px] border p-4 shadow-sm transition-all space-y-3.5 ${
                sendbackRemark
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : isUploaded
                        ? 'border-emerald-200/80 hover:border-emerald-300'
                        : 'border-stone-150 hover:border-amber-300'
            }`}>
                {sendbackRemark ? (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                                Returned by Office
                            </p>
                            <p className="text-xs font-semibold text-rose-900 mt-0.5">
                                "{sendbackRemark}"
                            </p>
                            {sendbackBy && (
                                <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                                    — {sendbackBy}
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                            <FileCheck size={13} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-emerald-800">
                                Details received from Office
                            </p>
                            <p className="text-[9px] text-emerald-600 font-medium">
                                Prepare the stamp with the details below and upload.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-extrabold text-stone-900 truncate">
                            {cust.customer_name}
                        </h3>
                        <p className="text-[10px] text-stone-400 font-medium mt-0.5 truncate">
                            {cust.consumer_no && `Cons: ${cust.consumer_no}`}
                            {cust.villages && ` • ${cust.villages}`}
                            {cust.phone_number && ` • Ph: ${cust.phone_number}`}
                        </p>
                    </div>
                    <span className={`text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-full border flex-shrink-0 ${
                        isUploaded
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                        {isUploaded ? 'Stamp Ready' : 'Pending'}
                    </span>
                </div>

                {partyRows.length > 0 && (
                    <div className="bg-stone-50/80 rounded-xl border border-stone-150/70 p-3 grid grid-cols-2 gap-2 text-xs">
                        {partyRows.map(([label, val]) => (
                            <div key={label} className="min-w-0">
                                <span className="text-[9px] font-extrabold uppercase tracking-wider text-stone-400 block">
                                    {label}
                                </span>
                                <span className="font-semibold text-stone-800 text-[11px] truncate block mt-0.5">
                                    {val}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Upload / File State */}
                {isUploaded ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5">
                            <div 
                                onClick={() => onPreviewDoc(stampDoc)}
                                className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer group"
                            >
                                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                                <span className="text-xs font-bold text-emerald-900 truncate group-hover:underline">
                                    {stampDoc.file_name}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => onPreviewDoc(stampDoc)}
                                    className="p-1.5 text-emerald-700 hover:bg-emerald-100/60 rounded-lg transition cursor-pointer"
                                    title="View Stamp Document"
                                >
                                    <Eye size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                    title="Change Stamp Document"
                                >
                                    <Upload size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteStamp}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title="Delete Stamp"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        {uploaderName && (
                            <p className="text-[10px] text-stone-400 font-medium pl-1 flex items-center gap-1">
                                <User size={10} />
                                <span>Uploaded by <b className="text-stone-600">{uploaderName}</b></span>
                            </p>
                        )}
                    </div>
                ) : (
                    <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 bg-stone-900 hover:bg-stone-850 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                        {uploading ? (
                            <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                        ) : (
                            <><Upload size={14} /> Upload PM Surya Ghar Stamp</>
                        )}
                    </button>
                )}

                {/* Remark Accordion */}
                <RemarkRow
                    customerId={cust.id}
                    initialRemark={initialRemark}
                    userId={user.id}
                    customerName={cust.customer_name}
                />

                {/* Send to Document Making Primary Action */}
                {isUploaded && (
                    <button
                        type="button"
                        disabled={sending}
                        onClick={() => setShowConfirmSend(true)}
                        className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-sky-600/15 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                    >
                        {sending ? (
                            <><Loader2 size={14} className="animate-spin" /> Sending to Office...</>
                        ) : (
                            <><SendHorizonal size={14} /> Send to Document Making</>
                        )}
                    </button>
                )}
            </div>

            {/* Confirmation Dialog */}
            {showConfirmSend && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={() => setShowConfirmSend(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl border border-stone-150 animate-in zoom-in-95 duration-200 space-y-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 mx-auto flex items-center justify-center">
                            <SendHorizonal size={22} />
                        </div>
                        <div className="text-center">
                            <h4 className="text-sm font-extrabold text-stone-900">Send to Document Making?</h4>
                            <p className="text-xs text-stone-500 font-medium mt-1 leading-relaxed">
                                Confirm that the PM Surya Ghar stamp is completed for <b>{cust.customer_name}</b>. It will be sent to the office for review and document preparation.
                            </p>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowConfirmSend(false)}
                                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs hover:bg-stone-50 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSend}
                                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                            >
                                Yes, Send Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function StampPortal({ user, onLogout }) {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [custDocs, setCustDocs] = useState({});
    const [previewDoc, setPreviewDoc] = useState(null);
    const [customAlert, setCustomAlert] = useState(null);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("admin")
                .select("*")
                // Remove strict stage eq to allow records that were sent to stamp maker but might not be formally in DISCOM SUBMISSION stage
                .is("deleted_at", null)
                .order("created_at", { ascending: false });

            if (error) throw error;
            // Only show customers sent to stamp maker and not yet finished
            const active = (data || []).filter(c =>
                c.discom_submission?.sent_to_stamp_maker === true &&
                !c.discom_submission?.stamp_sent
            );
            setCustomers(active);
            if (active.length > 0) {
                const results = await Promise.all(
                    active.map(async c => ({ id: c.id, docs: (await getCustomerDocuments(c.id)) || [] }))
                );
                const docMap = {};
                results.forEach(({ id, docs }) => { docMap[id] = docs; });
                setCustDocs(docMap);
            }
        } catch (err) {
            console.error("Stamp fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCustomers();

        const channel = supabase.channel(`stamp_customers_${user?.id || 'global'}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin' }, payload => {
                const record = payload.new;

                if (payload.eventType === 'DELETE') {
                    setCustomers(prev => prev.filter(c => c.id !== payload.old.id));
                    return;
                }

                const isStampActive = record && !record.deleted_at &&
                    record.discom_submission?.sent_to_stamp_maker === true &&
                    !record.discom_submission?.stamp_sent;

                setCustomers(prev => {
                    const exists = prev.some(c => c.id === record.id);
                    if (exists && isStampActive) {
                        return prev.map(c => c.id === record.id ? record : c);
                    } else if (exists && !isStampActive) {
                        return prev.filter(c => c.id !== record.id);
                    } else if (!exists && isStampActive) {
                        getCustomerDocuments(record.id).then(docs => {
                            setCustDocs(d => ({ ...d, [record.id]: docs || [] }));
                        });
                        return [record, ...prev];
                    }
                    return prev;
                });
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [user?.id, fetchCustomers]);

    const handleDocsChange = useCallback((customerId, updatedDocs) => {
        setCustDocs(prev => ({ ...prev, [customerId]: updatedDocs }));
        const hasStamp = updatedDocs.some(d => d.doc_type === "pm_surya_ghar_stamp");
        setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, pm_surya_ghar_stamp: hasStamp } : c));
    }, []);

    const handleCustomerRemoved = useCallback((customerId) => {
        setCustomers(prev => prev.filter(c => c.id !== customerId));
        setCustDocs(prev => { const n = { ...prev }; delete n[customerId]; return n; });
    }, []);

    const handleOpenPreview = async (doc) => {
        try {
            const url = await getViewUrl(doc.storage_path);
            if (url) {
                setPreviewDoc({ doc, url });
            } else {
                setCustomAlert({
                    title: "Preview Unavailable",
                    message: "Unable to retrieve preview URL for this stamp.",
                    type: "error"
                });
            }
        } catch (err) {
            console.error("Preview error:", err);
            setCustomAlert({
                title: "Preview Error",
                message: err.message || "Failed to load document preview.",
                type: "error"
            });
        }
    };

    const filteredCustomers = customers.filter(c => {
        const rawQ = (searchQuery || "").trim().toLowerCase();
        if (!rawQ) return true;
        
        // Clean query for number matching (remove spaces, dashes, plus signs)
        const cleanNumberQ = rawQ.replace(/[\s\-\+]/g, '');

        const name = String(c.customer_name || "").toLowerCase();
        const phone = String(c.phone_number || "").toLowerCase();
        const cleanPhone = String(c.phone_number || "").replace(/[\s\-\+]/g, '');
        const consumerNo = String(c.consumer_no || "").toLowerCase();
        const cleanConsumerNo = String(c.consumer_no || "").replace(/[\s\-\+]/g, '').toLowerCase();
        const folderNo = String(c.folder_no || "").toLowerCase();
        const village = String(c.villages || "").toLowerCase();
        
        const sub = c.discom_submission || {};
        const firstParty = String(sub.first_party || "").toLowerCase();
        const secondParty = String(sub.second_party || "").toLowerCase();
        const purchasedParty = String(sub.purchased_party || "").toLowerCase();

        return (
            name.includes(rawQ) ||
            consumerNo.includes(rawQ) ||
            (cleanNumberQ && cleanConsumerNo.includes(cleanNumberQ)) ||
            phone.includes(rawQ) ||
            (cleanNumberQ && cleanPhone.includes(cleanNumberQ)) ||
            folderNo.includes(rawQ) ||
            village.includes(rawQ) ||
            firstParty.includes(rawQ) ||
            secondParty.includes(rawQ) ||
            purchasedParty.includes(rawQ)
        );
    });

    const totalCount = customers.length;
    const completedCount = customers.filter(c => c.pm_surya_ghar_stamp).length;
    const pendingCount = totalCount - completedCount;

    return (
        <div className="min-h-screen bg-[#FCFBFA] text-stone-850 font-sans flex flex-col pb-8">
            {/* Sticky Header matching Vendor / Agent Portal */}
            <header className="bg-white border-b border-stone-100 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-amber-500/10">
                        <Sun className="w-4 h-4 fill-white" />
                    </div>
                    <div>
                        <h1 className="text-xs font-black tracking-widest text-stone-900 uppercase">Watersun</h1>
                        <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest -mt-0.5">Stamp Portal</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-stone-600 truncate max-w-[120px]">{user?.name || "Stamp Maker"}</span>
                    <button
                        type="button"
                        onClick={fetchCustomers}
                        disabled={loading}
                        className="p-2 text-stone-400 hover:text-amber-600 transition-colors rounded-xl hover:bg-amber-50 disabled:opacity-50 cursor-pointer"
                        title="Refresh list"
                        aria-label="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        type="button"
                        onClick={onLogout}
                        className="p-2 text-stone-400 hover:text-red-500 transition-colors rounded-xl hover:bg-stone-50 cursor-pointer"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4 animate-in fade-in duration-300">
                {/* Hero / Welcome Banner */}
                <div className="bg-gradient-to-br from-stone-900 to-stone-850 text-white p-5 rounded-[24px] shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                        <Sun className="w-32 h-32" />
                    </div>
                    <p className="text-[9px] uppercase tracking-widest text-amber-400 font-bold">PM Surya Ghar</p>
                    <h2 className="text-lg font-bold mt-0.5">{user?.name || "Stamp Maker"}</h2>
                    <p className="text-[11px] text-stone-300 mt-2 font-medium">
                        Prepare and upload official PM Surya Ghar stamps for Discom submissions.
                    </p>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 bg-white rounded-2xl border border-stone-100 shadow-sm text-center">
                        <p className="text-[8px] font-bold uppercase tracking-wider text-stone-400">Total</p>
                        <p className="text-base sm:text-lg font-black mt-0.5 text-stone-850">{totalCount}</p>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-stone-100 shadow-sm text-center">
                        <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-600">Done</p>
                        <p className="text-base sm:text-lg font-black mt-0.5 text-emerald-600">{completedCount}</p>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-stone-100 shadow-sm text-center">
                        <p className="text-[8px] font-bold uppercase tracking-wider text-amber-500">Pending</p>
                        <p className="text-base sm:text-lg font-black mt-0.5 text-amber-600">{pendingCount}</p>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="pt-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-stone-400 w-4.5 h-4.5" />
                        <input
                            type="text"
                            placeholder="Search by Consumer No, Name, or Phone..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 pr-8 py-2.5 bg-white border border-stone-200 rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium shadow-xs"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 p-0.5 rounded-full cursor-pointer"
                                title="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Customer List */}
                <div className="space-y-3 pt-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-16 text-stone-400">
                            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                            <span className="text-xs font-bold">Loading stamp requests...</span>
                        </div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="bg-white p-8 rounded-2xl border border-stone-100 text-center text-stone-400 shadow-sm space-y-2">
                            <FileCheck className="w-8 h-8 mx-auto text-stone-300" />
                            <p className="text-xs font-bold text-stone-600">
                                {customers.length === 0 ? "No stamp requests in queue." : "No matching clients found."}
                            </p>
                            <p className="text-[10px] text-stone-400">
                                When office staff sends customer details for stamping, they will appear here.
                            </p>
                        </div>
                    ) : (
                        filteredCustomers.map(cust => (
                            <CustomerCard
                                key={cust.id}
                                cust={cust}
                                docs={custDocs[cust.id] || []}
                                user={user}
                                onDocsChange={handleDocsChange}
                                onCustomerRemoved={handleCustomerRemoved}
                                onPreviewDoc={handleOpenPreview}
                                setCustomAlert={setCustomAlert}
                            />
                        ))
                    )}
                </div>
            </main>

            {/* Document Preview Modal */}
            {previewDoc && (
                <FilePreviewModal
                    file={previewDoc.doc}
                    fileUrl={previewDoc.url}
                    onClose={() => setPreviewDoc(null)}
                    onDownload={() => window.open(previewDoc.url, '_blank')}
                />
            )}

            {customAlert && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={() => setCustomAlert(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl border border-stone-150 animate-in zoom-in-95 duration-200 text-center space-y-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
                            customAlert.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                        }`}>
                            {customAlert.type === 'error' ? <AlertCircle size={24} /> : <AlertTriangle size={24} />}
                        </div>
                        <div>
                            <h4 className="text-sm font-extrabold text-stone-850">{customAlert.title || 'Attention'}</h4>
                            <p className="text-xs text-stone-500 font-medium mt-1.5 leading-relaxed">{customAlert.message}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCustomAlert(null)}
                            className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer active:scale-[0.98]"
                        >
                            Understood
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
