import React, { useState, useEffect, useRef } from 'react';
import { Building2, Mail, Zap, Trash2, Plus, Copy, Check, ClipboardPaste, Layers, Printer, Truck, User } from 'lucide-react';
import { supabase } from '../../supabase';
import { SectionHeader, EditableDetailItem } from './shared';

const parsePanelSerials = (raw) => {
    if (!raw) return [''];
    if (Array.isArray(raw)) {
        const serials = raw.map(value => String(value || '').trim()).filter(Boolean);
        return serials.length > 0 ? serials : [''];
    }

    const rawText = String(raw);
    try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
            const serials = parsed.map(value => String(value || '').trim()).filter(Boolean);
            return serials.length > 0 ? serials : [''];
        }
    } catch (e) { }

    if (rawText.includes('\n')) {
        return rawText.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (rawText.includes(',')) {
        return rawText.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [rawText.trim()];
};

export default function MaterialDeliveryTab({
    customer,
    editData,
    setEditData,
    isEditable,
    onUpdate,
    logActivity,
    fetchLogs,
    user,
    meta = {},
    handleChange,
    editingSection,
    setEditingSection
}) {
    const [vendors, setVendors] = useState([]);
    const [sendingInfo, setSendingInfo] = useState(false);
    const [infoSentStatus, setInfoSentStatus] = useState(null);
    const [panelSerials, setPanelSerials] = useState(() => parsePanelSerials(customer?.panel_serial_no));
    const [showBulkPaste, setShowBulkPaste] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [copiedIdx, setCopiedIdx] = useState(null);
    const [copiedAll, setCopiedAll] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [pendingVendor, setPendingVendor] = useState(null);
    const printableDeliveryRef = useRef(null);

    const handleFillTestData = () => {
        const randId = Math.floor(10000 + Math.random() * 90000);
        const today = new Date().toISOString().split('T')[0];
        
        const demoVendor = vendors[0] || 'Om Solar';
        const demoInverter = inverterMakeOptions[0] || 'Solis';
        const demoSerials = ['PANEL-123', 'PANEL-456', 'PANEL-789'];

        setPanelSerials(demoSerials);
        setEditData(prev => ({
            ...prev,
            vendor: prev.vendor || demoVendor,
            inverter_make: prev.inverter_make || demoInverter,
            inverter_serial_no: prev.inverter_serial_no || `INV-SER-${randId}`,
            invoice_no: prev.invoice_no || `INV-${randId}`,
            material_delivery_date: prev.material_delivery_date || today,
            driver_name: prev.driver_name || 'Ramesh Kumar',
            driver_phone_number: prev.driver_phone_number || '9876543210',
            panel_serial_no: prev.panel_serial_no || demoSerials.join('\n')
        }));
    };

    // Inverter Make options from metadata or defaults
    const inverterMakeOptions = (meta['inverter_make'] && meta['inverter_make'].length > 0)
        ? meta['inverter_make']
        : ['test1', 'test2', 'test3'];

    useEffect(() => {
        const fetchVendorsList = async () => {
            try {
                const { data } = await supabase.from('vendors').select('name').order('name');
                if (data) setVendors(data.map(v => v.name));
            } catch (e) {
                console.error('Error fetching vendors in modal:', e);
            }
        };
        fetchVendorsList();
    }, []);

    useEffect(() => {
        setPanelSerials(parsePanelSerials(customer?.panel_serial_no));
    }, [customer?.panel_serial_no]);

    const handlePanelSerialChange = (idx, val) => {
        const next = [...panelSerials];
        next[idx] = val;
        setPanelSerials(next);
        const filtered = next.filter(Boolean);
        const serialized = filtered.length > 0 ? filtered.join('\n') : '';
        setEditData(prev => ({ ...prev, panel_serial_no: serialized }));
    };

    const addPanelSerial = (count = 1) => {
        if (panelSerials.length >= 100) return;
        const toAdd = Math.min(count, 100 - panelSerials.length);
        const newItems = Array(toAdd).fill('');
        setPanelSerials(prev => [...prev, ...newItems]);
    };

    const removePanelSerial = (idx) => {
        const next = panelSerials.filter((_, i) => i !== idx);
        const finalVal = next.length > 0 ? next : [''];
        setPanelSerials(finalVal);
        const filtered = finalVal.filter(Boolean);
        const serialized = filtered.length > 0 ? filtered.join('\n') : '';
        setEditData(prev => ({ ...prev, panel_serial_no: serialized }));
    };

    const handleApplyBulkPaste = () => {
        if (!bulkText.trim()) return;
        const parsed = bulkText
            .split(/[\n,;\t]+/)
            .map(s => s.trim())
            .filter(Boolean);
        
        if (parsed.length > 0) {
            const finalSerials = parsed.slice(0, 100);
            setPanelSerials(finalSerials);
            setEditData(prev => ({ ...prev, panel_serial_no: finalSerials.join('\n') }));
            setBulkText('');
            setShowBulkPaste(false);
        }
    };

    const handleCopySerial = (serial, idx) => {
        if (!serial) return;
        navigator.clipboard.writeText(serial);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 1500);
    };

    const handleCopyAll = () => {
        const valid = panelSerials.filter(Boolean);
        if (valid.length === 0) return;
        navigator.clipboard.writeText(valid.join('\n'));
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
    };

    const handlePrint = () => {
        const documentBody = printableDeliveryRef.current;
        if (!documentBody) return;

        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(element => element.outerHTML)
            .join('');
        const printFrame = document.createElement('iframe');
        printFrame.setAttribute('aria-hidden', 'true');
        printFrame.style.cssText = 'position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0;pointer-events:none;';

        const removeFrame = () => setTimeout(() => printFrame.remove(), 250);
        printFrame.onload = () => {
            const printWindow = printFrame.contentWindow;
            if (!printWindow) return removeFrame();
            printWindow.onafterprint = removeFrame;
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
            }, 100);
        };
        printFrame.srcdoc = `<!doctype html><html><head><title>Delivery Note — ${customer?.customer_name || 'Customer'}</title>${styles}<style>@page { size: A4 portrait; margin: 12mm; } body { margin: 0; color: #1c1917; background: #fff; } #printable-delivery { position: static !important; width: auto !important; border: 1px solid #a8a29e; padding: 12mm !important; overflow: visible !important; }</style></head><body><main id="printable-delivery">${documentBody.innerHTML}</main></body></html>`;
        document.body.appendChild(printFrame);
    };

    const filledCount = panelSerials.filter(Boolean).length;
    const currentSerialized = panelSerials.filter(Boolean).join('\n');
    const originalSerialized = (parsePanelSerials(customer?.panel_serial_no) || []).filter(Boolean).join('\n');
    const isSerialsDirty = currentSerialized !== originalSerialized;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Bar with Print Option */}
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-stone-100 pb-2">
                <div>
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Material Delivery & Dispatch</h4>
                    <p className="text-[11px] text-stone-500 font-medium">Vendor assignment, equipment serial numbers and dispatch note.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowPrintModal(true)}
                        className="bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                        <Printer size={13} /> Print Delivery Note
                    </button>
                </div>
            </div>

            {/* Pick a Vendor Section */}
            <section id="section-pick_vendor">
                <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-1.5">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <Building2 size={12} /> Pick a Vendor <span className="text-red-500">*</span>
                    </h3>
                </div>
                <div className="bg-stone-50 p-4 rounded-[20px] border border-stone-150 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <p className="text-[9px] text-stone-400 tracking-wide mb-1 font-bold">VENDOR ALLOTMENT <span className="text-red-500">*</span></p>
                        <select
                            disabled={!isEditable}
                            value={editData.vendor || ''}
                            onChange={async (e) => {
                                const selectedVal = e.target.value;
                                if (selectedVal) {
                                    setPendingVendor(selectedVal);
                                } else {
                                    setEditData(prev => ({ ...prev, vendor: '' }));
                                    setInfoSentStatus(null);
                                    await onUpdate(customer.id, { vendor: null });
                                    await logActivity(
                                        user.id,
                                        'update',
                                        `${customer.customer_name}: Removed assigned vendor`,
                                        '',
                                        customer.id
                                    );
                                    fetchLogs();
                                }
                            }}
                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        >
                            <option value="">Select Vendor...</option>
                            {vendors.map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </div>
                    {editData.vendor && (
                        <div className="flex flex-col items-start sm:items-end gap-1 flex-shrink-0">
                            <button
                                type="button"
                                disabled={sendingInfo}
                                onClick={async () => {
                                    setSendingInfo(true);
                                    setInfoSentStatus(null);
                                    try {
                                        const { data, error } = await supabase.functions.invoke('send-lead-to-vendor', {
                                            body: { customer_id: customer.id }
                                        });
                                        if (error) {
                                            console.error('Failed to notify vendor:', error);
                                            setInfoSentStatus('failed');
                                        } else {
                                            console.log('Vendor notified:', data);
                                            setInfoSentStatus('sent');
                                            await logActivity(
                                                user.id,
                                                'email',
                                                `Vendor email notification sent to ${editData.vendor}`,
                                                '',
                                                customer.id
                                            );
                                            fetchLogs();
                                        }
                                    } catch (err) {
                                        console.error('Error invoking function:', err);
                                        setInfoSentStatus('failed');
                                    } finally {
                                        setSendingInfo(false);
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-md ${
                                    sendingInfo
                                        ? 'bg-stone-200 text-stone-400 cursor-wait'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/10'
                                }`}
                            >
                                <Mail className="w-3.5 h-3.5" />
                                {sendingInfo ? 'Sending...' : 'Send Info'}
                            </button>
                            {infoSentStatus === 'sent' && (
                                <p className="text-[8px] font-bold text-emerald-600 mt-0.5 animate-in fade-in duration-200">
                                    The info is send
                                </p>
                            )}
                            {infoSentStatus === 'failed' && (
                                <p className="text-[8px] font-bold text-red-500 mt-0.5 animate-in fade-in duration-200">
                                    Failed to send
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {pendingVendor && (
                <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[28px] shadow-2xl p-6 w-full max-w-sm border border-stone-150 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        <div>
                            <h3 className="text-sm font-bold text-stone-850">Assign & Notify Vendor?</h3>
                            <p className="text-xs text-stone-500 mt-2 font-medium">
                                You are assigning this project to <strong className="text-stone-800">{pendingVendor}</strong>. Do you want to notify them and send the project details now?
                            </p>
                        </div>
                        <div className="flex gap-2.5 mt-2">
                            <button
                                onClick={() => setPendingVendor(null)}
                                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-bold transition cursor-pointer text-center"
                            >
                                Cancel / Revert
                            </button>
                            <button
                                onClick={async () => {
                                    const selectedVal = pendingVendor;
                                    setPendingVendor(null);
                                    
                                    setEditData(prev => ({ ...prev, vendor: selectedVal }));
                                    setInfoSentStatus(null);
                                    await onUpdate(customer.id, { vendor: selectedVal });
                                    await logActivity(
                                        user.id,
                                        'update',
                                        `${customer.customer_name}: Assigned vendor to ${selectedVal}`,
                                        '',
                                        customer.id
                                    );
                                    fetchLogs();

                                    setSendingInfo(true);
                                    try {
                                        const { data, error } = await supabase.functions.invoke('send-lead-to-vendor', {
                                            body: { customer_id: customer.id }
                                        });
                                        if (error) {
                                            console.error('Failed to notify vendor:', error);
                                            setInfoSentStatus('failed');
                                        } else {
                                            setInfoSentStatus('sent');
                                            await logActivity(
                                                user.id,
                                                'email',
                                                `Vendor email notification sent to ${selectedVal}`,
                                                '',
                                                customer.id
                                            );
                                            fetchLogs();
                                        }
                                    } catch (err) {
                                        console.error('Error invoking function:', err);
                                        setInfoSentStatus('failed');
                                    } finally {
                                        setSendingInfo(false);
                                    }
                                }}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/10 cursor-pointer text-center"
                            >
                                Send Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Equipment & Delivery Info (Grid) */}
            <section id="section-equip_details" className="space-y-4">
                <SectionHeader 
                    title="Material Delivery Details" 
                    id="equip_details" 
                    icon={Zap} 
                    isEditable={isEditable} 
                    editingSection={editingSection} 
                    setEditingSection={setEditingSection} 
                />
                
                {/* 6 Delivery Metadata Cards with Inverter Make Dropdown & Delivery Date */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <EditableDetailItem 
                        label="INVERTER MAKE *" 
                        field="inverter_make" 
                        value={editData.inverter_make} 
                        options={inverterMakeOptions}
                        category="inverter_make"
                        meta={meta}
                        onChange={handleChange} 
                        isEditing={editingSection === 'equip_details'} 
                    />
                    <EditableDetailItem 
                        label="INVERTER SERIAL NO. *" 
                        field="inverter_serial_no" 
                        value={editData.inverter_serial_no} 
                        onChange={handleChange} 
                        isEditing={editingSection === 'equip_details'} 
                    />
                    <EditableDetailItem 
                        label="INVOICE NO *" 
                        field="invoice_no" 
                        value={editData.invoice_no} 
                        onChange={handleChange} 
                        isEditing={editingSection === 'equip_details'} 
                    />
                    <EditableDetailItem 
                        label="DELIVERY DATE *" 
                        field="material_delivery_date" 
                        type="date"
                        value={editData.material_delivery_date} 
                        onChange={handleChange} 
                        isEditing={editingSection === 'equip_details'} 
                    />
                    <EditableDetailItem 
                        label="DRIVER NAME *" 
                        field="driver_name" 
                        value={editData.driver_name} 
                        onChange={handleChange} 
                        isEditing={editingSection === 'equip_details'} 
                    />
                    <EditableDetailItem 
                        label="DRIVER PHONE NUMBER *" 
                        field="driver_phone_number" 
                        value={editData.driver_phone_number} 
                        onChange={handleChange} 
                        isEditing={editingSection === 'equip_details'} 
                    />
                </div>
            </section>

            {/* Dedicated Standalone Panel Serial Numbers Section — Outside pencil edit with clean 1, 2, 3 numbers */}
            <section id="section-panel_serials" className="space-y-3 pt-2">
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                            <Layers size={14} />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wide flex items-center gap-2">
                                Panel Serial Numbers <span className="text-red-500">*</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-100 text-stone-600 border border-stone-200">
                                    {filledCount} {filledCount === 1 ? 'Panel' : 'Panels'}
                                </span>
                            </h4>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                        {isEditable ? (
                            <>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!isSerialsDirty) return;
                                        const filtered = panelSerials.filter(Boolean);
                                        const serialized = filtered.length > 0 ? filtered.join('\n') : '';
                                        await onUpdate(customer.id, { panel_serial_no: serialized });
                                        await logActivity(
                                            user.id,
                                            'update',
                                            `${customer.customer_name}: Updated Panel Serial Numbers (${filtered.length} panels)`,
                                            '',
                                            customer.id
                                        );
                                        fetchLogs();
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer ${
                                        isSerialsDirty
                                            ? 'bg-stone-900 hover:bg-stone-800 text-white shadow-stone-900/10'
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10'
                                    }`}
                                >
                                    <Check size={12} /> {isSerialsDirty ? 'Save Serials' : 'Saved'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowBulkPaste(prev => !prev)}
                                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                                >
                                    <ClipboardPaste size={13} />
                                    {showBulkPaste ? 'Hide Paste' : 'Bulk Paste'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addPanelSerial(1)}
                                    disabled={panelSerials.length >= 100}
                                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-50 cursor-pointer"
                                >
                                    <Plus size={13} /> Add 1
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addPanelSerial(5)}
                                    disabled={panelSerials.length >= 96}
                                    className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 transition disabled:opacity-50 cursor-pointer"
                                    title="Add 5 serial rows"
                                >
                                    +5
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addPanelSerial(10)}
                                    disabled={panelSerials.length >= 91}
                                    className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 transition disabled:opacity-50 cursor-pointer"
                                    title="Add 10 serial rows"
                                >
                                    +10
                                </button>
                            </>
                        ) : null}

                        {filledCount > 0 && (
                            <button
                                type="button"
                                onClick={handleCopyAll}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer"
                            >
                                {copiedAll ? (
                                    <>
                                        <Check size={13} className="text-emerald-600" />
                                        <span className="text-emerald-600 font-bold">Copied All!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={13} />
                                        <span>Copy All ({filledCount})</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Bulk Paste Box */}
                {isEditable && showBulkPaste && (
                    <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                                Quick Paste (one per line, comma or space separated)
                            </label>
                            <span className="text-[10px] text-stone-500">Supports Excel / WhatsApp lists</span>
                        </div>
                        <textarea
                            rows={4}
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            placeholder="Paste 20+ panel serial numbers here...&#10;e.g.&#10;SN100234&#10;SN100235&#10;SN100236"
                            className="w-full bg-white border border-amber-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-stone-400"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setBulkText(''); setShowBulkPaste(false); }}
                                className="px-3 py-1 text-[11px] font-semibold text-stone-600 hover:text-stone-800 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApplyBulkPaste}
                                className="px-3.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition cursor-pointer"
                            >
                                Apply Numbers
                            </button>
                        </div>
                    </div>
                )}

                {/* Content Section: Simple, clean 1, 2, 3 indexing */}
                {isEditable ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                            {panelSerials.map((serial, idx) => (
                                <div 
                                    key={idx} 
                                    className="flex items-center bg-stone-50/80 hover:bg-stone-50 border border-stone-200/80 rounded-xl p-1.5 focus-within:border-amber-400 focus-within:bg-white transition"
                                >
                                    <span className="w-6 text-center text-xs font-bold text-stone-600 bg-stone-200/60 rounded-md py-1 mr-1.5 flex-shrink-0">
                                        {idx + 1}
                                    </span>
                                    <input
                                        type="text"
                                        value={serial}
                                        onChange={(e) => handlePanelSerialChange(idx, e.target.value)}
                                        className="flex-1 bg-transparent text-xs font-mono font-semibold text-stone-800 focus:outline-none placeholder:text-stone-300 min-w-0"
                                        placeholder={`Serial ${idx + 1}`}
                                    />
                                    {panelSerials.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removePanelSerial(idx)}
                                            className="text-stone-400 hover:text-red-500 p-1 rounded transition flex-shrink-0 cursor-pointer"
                                            title="Delete serial"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-stone-400 font-medium">
                            <span>Showing {panelSerials.length} rows ({filledCount} filled)</span>
                            <button
                                type="button"
                                onClick={() => addPanelSerial(1)}
                                className="text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer"
                            >
                                <Plus size={12} /> Add row
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {filledCount === 0 ? (
                            <div className="text-center py-6 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                                <p className="text-xs text-stone-400 italic">No panel serial numbers entered yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[460px] overflow-y-auto pr-1">
                                {panelSerials.filter(Boolean).map((serial, idx) => (
                                    <div 
                                        key={idx}
                                        onClick={() => handleCopySerial(serial, idx)}
                                        className="group flex items-center justify-between bg-stone-50 hover:bg-amber-50/60 border border-stone-200/70 hover:border-amber-300/80 rounded-xl px-2.5 py-1.5 transition cursor-pointer"
                                        title="Click to copy serial"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs font-bold text-stone-500 group-hover:text-amber-700 bg-stone-200/50 group-hover:bg-amber-100/60 w-6 text-center py-0.5 rounded">
                                                {idx + 1}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-stone-700 group-hover:text-stone-900 truncate">
                                                {serial}
                                            </span>
                                        </div>
                                        <div className="text-stone-300 group-hover:text-amber-600 transition flex-shrink-0 ml-1">
                                            {copiedIdx === idx ? (
                                                <Check size={12} className="text-emerald-600" />
                                            ) : (
                                                <Copy size={11} className="opacity-0 group-hover:opacity-100 transition" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Dedicated Print & PDF Modal */}
            {showPrintModal && (
                <div className="fixed inset-0 z-[999] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
                        {/* Header bar */}
                        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between no-print">
                            <div className="flex items-center gap-2">
                                <Printer size={18} className="text-amber-400" />
                                <h3 className="text-sm font-black uppercase tracking-wider">Print Preview — Material Delivery Note</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                    <Printer size={14} /> Print Document
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPrintModal(false)}
                                    className="text-stone-400 hover:text-white p-1 rounded-lg transition"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Printable Document Body */}
                        <div ref={printableDeliveryRef} className="flex-1 overflow-y-auto p-8 bg-white text-stone-900 print-document" id="printable-delivery">
                            {/* Company Header */}
                            <div className="border-b-2 border-stone-900 pb-4 mb-6 text-center">
                                <h1 className="text-xl font-black uppercase tracking-wider text-stone-950">Watersun Electrical Solutions Pvt Ltd</h1>
                                <p className="text-xs font-semibold text-stone-600 mt-0.5">Material Delivery, Equipment Dispatch & Serial Numbers Note</p>
                                <div className="inline-block mt-2 px-3 py-1 bg-stone-100 border border-stone-300 rounded text-[11px] font-black uppercase tracking-widest text-stone-800">
                                    DISPATCH NOTE — {editData?.invoice_no ? `INVOICE #${editData.invoice_no}` : 'PROJECT DISPATCH'}
                                </div>
                            </div>

                            {/* Section: Customer & Site Details */}
                            <div className="mb-6">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">1. Customer & Site Information</h3>
                                <table className="w-full text-xs border border-stone-300">
                                    <tbody>
                                        <tr className="border-b border-stone-200">
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Customer Name:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{editData?.customer_name || customer?.customer_name || '–'}</td>
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Contact Number:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{editData?.phone_number || customer?.phone_number || '–'}</td>
                                        </tr>
                                        <tr className="border-b border-stone-200">
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Village / Address:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.villages || customer?.villages || '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Consumer No:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.consumer_no || customer?.consumer_no || '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">System Capacity:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.system_capacity_kwp ? `${editData.system_capacity_kwp} kWp` : '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Channel Partner:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.channel_partner || customer?.channel_partner || '–'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section: Delivery & Dispatch Specifications */}
                            <div className="mb-6">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">2. Delivery & Equipment Specifications</h3>
                                <table className="w-full text-xs border border-stone-300">
                                    <tbody>
                                        <tr className="border-b border-stone-200">
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Allotted Vendor:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{editData?.vendor || '–'}</td>
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Invoice Number:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{editData?.invoice_no || '–'}</td>
                                        </tr>
                                        <tr className="border-b border-stone-200">
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Inverter Make:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.inverter_make || '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Inverter Serial No:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.inverter_serial_no || '–'}</td>
                                        </tr>
                                        <tr className="border-b border-stone-200">
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Material Delivery Date:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.material_delivery_date || '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Driver Name:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.driver_name || '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Driver Phone Number:</td>
                                            <td colSpan={3} className="p-2 font-bold text-stone-900">{editData?.driver_phone_number || '–'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section: Panel Serial Numbers Grid */}
                            <div className="mb-8">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2 flex items-center justify-between">
                                    <span>3. Solar Panel Serial Numbers Checklist</span>
                                    <span className="text-[10px] font-bold text-stone-600">Total: {filledCount} Panels</span>
                                </h3>
                                {filledCount > 0 ? (
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        {panelSerials.filter(Boolean).map((serial, idx) => (
                                            <div key={idx} className="border border-stone-300 p-1.5 rounded flex items-center gap-2">
                                                <span className="font-bold text-stone-600 w-6 text-center">{idx + 1}.</span>
                                                <span className="font-mono font-bold text-stone-900">{serial}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-stone-400 italic py-2">No panel serial numbers recorded.</p>
                                )}
                            </div>

                            {/* Signatures Footer */}
                            <div className="grid grid-cols-3 gap-6 pt-12 text-center border-t border-stone-300 text-xs">
                                <div>
                                    <div className="border-b border-stone-400 pb-8 mb-1.5 font-bold text-stone-700">
                                        {user?.name || ''}
                                    </div>
                                    <p className="font-black uppercase text-[10px] text-stone-900">Dispatched By</p>
                                </div>
                                <div>
                                    <div className="border-b border-stone-400 pb-8 mb-1.5 font-bold text-stone-700">
                                        {editData?.driver_name || ''}
                                    </div>
                                    <p className="font-black uppercase text-[10px] text-stone-900">Driver Signature</p>
                                </div>
                                <div>
                                    <div className="border-b border-stone-400 pb-8 mb-1.5 font-bold text-stone-700">
                                        {editData?.customer_name || ''}
                                    </div>
                                    <p className="font-black uppercase text-[10px] text-stone-900">Customer / Site Received By</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Specific CSS */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-delivery, #printable-delivery * {
                        visibility: visible;
                    }
                    #printable-delivery {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 20px;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
