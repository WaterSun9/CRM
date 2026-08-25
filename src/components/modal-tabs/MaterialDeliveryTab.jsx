import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Building2, Mail, Zap, Trash2, Plus, Copy, Check, ClipboardPaste, Layers, Printer, Truck, User } from 'lucide-react';
import { supabase } from '../../supabase';
import { SectionHeader, EditableDetailItem } from './shared';
import { sendVendorLeadNotification } from '../../utils/vendorNotification';

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
    const [showPrintModal, setShowPrintModal] = useState(false);
    const printableDeliveryRef = useRef(null);

    const panelSerials = useMemo(() => {
        return parsePanelSerials(editData?.panel_serial_no || customer?.panel_serial_no);
    }, [editData?.panel_serial_no, customer?.panel_serial_no]);

    const filledCount = panelSerials.filter(Boolean).length;

    const handleFillTestData = () => {
        const randId = Math.floor(10000 + Math.random() * 90000);
        const today = new Date().toISOString().split('T')[0];
        
        const demoVendor = vendors[0] || '';

        setEditData(prev => ({
            ...prev,
            vendor: prev.vendor || demoVendor,
            invoice_no: prev.invoice_no || `INV-${randId}`,
            material_delivery_date: prev.material_delivery_date || today,
            vehicle_number: prev.vehicle_number || 'GJ-01-AB-1234',
            driver_name: prev.driver_name || 'Ramesh Kumar',
            driver_phone_number: prev.driver_phone_number || '9876543210'
        }));
    };

    useEffect(() => {
        const fetchVendorsList = async () => {
            try {
                const { data } = await supabase.from('vendors').select('name').order('name');
                const dbVendors = (data || []).map(v => v.name).filter(Boolean);
                setVendors(dbVendors);
            } catch (e) {
                console.error('Error fetching vendors in modal:', e);
                setVendors([]);
            }
        };
        fetchVendorsList();
    }, []);

    const handlePrint = () => {
        const documentBody = printableDeliveryRef.current;
        if (!documentBody) return;

        const cleanName = String(customer?.customer_name || editData?.customer_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanInv = String(editData?.invoice_no || customer?.folder_no || customer?.consumer_no || 'Challan').replace(/[^a-zA-Z0-9_-]/g, '_');
        const docTitle = `Material_Delivery_Note_${cleanName}_${cleanInv}`;
        const prevDocTitle = document.title;

        // Remove any old print portal
        const existing = document.getElementById('native-print-portal');
        if (existing) existing.remove();

        // Create top-level print portal directly on document.body
        const printPortal = document.createElement('div');
        printPortal.id = 'native-print-portal';
        printPortal.innerHTML = documentBody.innerHTML;
        document.body.appendChild(printPortal);

        document.body.classList.add('is-printing-document');
        document.title = docTitle;

        const cleanup = () => {
            document.body.classList.remove('is-printing-document');
            document.title = prevDocTitle;
            if (document.body.contains(printPortal)) {
                document.body.removeChild(printPortal);
            }
            window.removeEventListener('afterprint', cleanup);
        };

        window.addEventListener('afterprint', cleanup);

        setTimeout(() => {
            window.print();
            setTimeout(cleanup, 2000);
        }, 100);
    };

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
                                setEditData(prev => ({ ...prev, vendor: selectedVal }));
                                setInfoSentStatus(null);
                                if (selectedVal) {
                                    await onUpdate(customer.id, { vendor: selectedVal });
                                    await logActivity(
                                        user.id,
                                        'update',
                                        `${customer.customer_name}: Assigned vendor to ${selectedVal}`,
                                        '',
                                        customer.id
                                    );
                                } else {
                                    await onUpdate(customer.id, { vendor: null });
                                    await logActivity(
                                        user.id,
                                        'update',
                                        `${customer.customer_name}: Removed assigned vendor`,
                                        '',
                                        customer.id
                                    );
                                }
                                fetchLogs();
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
                                        const res = await sendVendorLeadNotification({
                                            customerId: customer.id,
                                            customer: { ...customer, ...editData },
                                            vendorName: editData.vendor,
                                            vendorEmail: 'deeproot120@gmail.com'
                                        });

                                        setInfoSentStatus('sent');
                                        await logActivity(
                                            user.id,
                                            'email',
                                            `Vendor notification triggered for ${editData.vendor} (deeproot120@gmail.com)`,
                                            '',
                                            customer.id
                                        );
                                        fetchLogs();
                                    } catch (err) {
                                        console.error('Error sending vendor notification:', err);
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
                                    Email sent to deeproot120@gmail.com
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
            </section>            {/* Equipment & Delivery Info (Grid) */}
            <section id="section-equip_details" className="space-y-4">
                <SectionHeader 
                    title="Material Delivery Details" 
                    id="equip_details" 
                    icon={Zap} 
                    isEditable={isEditable} 
                    editingSection={editingSection} 
                    setEditingSection={setEditingSection} 
                />
                
                {/* 5 Delivery Metadata Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
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
                        label="VEHICLE / TRUCK NO" 
                        field="vehicle_number" 
                        value={editData.vehicle_number} 
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
                        <div ref={printableDeliveryRef} className="flex-1 overflow-y-auto p-6 bg-white text-stone-900 print-document" id="printable-delivery">
                            {/* Company Header */}
                            <div className="header-box text-center">
                                <h1 className="text-base font-black uppercase tracking-wider text-stone-950">Watersun Electrical Solutions Pvt Ltd</h1>
                                <p className="text-[11px] font-semibold text-stone-600">Material Delivery, Equipment Dispatch & Serial Numbers Note</p>
                                <div className="tag">
                                    DISPATCH NOTE — {editData?.invoice_no ? `INVOICE #${editData.invoice_no}` : 'PROJECT DISPATCH'}
                                </div>
                            </div>

                            {/* Section: Customer & Site Details */}
                            <div className="section-block">
                                <h3>1. Customer & Site Information</h3>
                                <table>
                                    <tbody>
                                        <tr>
                                            <td className="w-1/4 bg-stone-50 font-bold text-stone-600">Customer Name:</td>
                                            <td className="w-1/4 font-bold text-stone-900">{editData?.customer_name || customer?.customer_name || '–'}</td>
                                            <td className="w-1/4 bg-stone-50 font-bold text-stone-600">Contact Number:</td>
                                            <td className="w-1/4 font-bold text-stone-900">{editData?.phone_number || customer?.phone_number || '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="bg-stone-50 font-bold text-stone-600">Village / Address:</td>
                                            <td className="font-bold text-stone-900">{editData?.villages || customer?.villages || '–'}</td>
                                            <td className="bg-stone-50 font-bold text-stone-600">Consumer No:</td>
                                            <td className="font-bold text-stone-900">{editData?.consumer_no || customer?.consumer_no || '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="bg-stone-50 font-bold text-stone-600">System Capacity:</td>
                                            <td className="font-bold text-stone-900">{editData?.system_capacity_kwp ? `${editData.system_capacity_kwp} kWp` : '–'}</td>
                                            <td className="bg-stone-50 font-bold text-stone-600">Channel Partner:</td>
                                            <td className="font-bold text-stone-900">{editData?.channel_partner || customer?.channel_partner || '–'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section: Delivery & Dispatch Logistics */}
                            <div className="section-block">
                                <h3>2. Delivery & Logistics Details</h3>
                                <table>
                                    <tbody>
                                        <tr>
                                            <td className="w-1/4 bg-stone-50 font-bold text-stone-600">Allotted Vendor:</td>
                                            <td className="w-1/4 font-bold text-stone-900">{editData?.vendor || '–'}</td>
                                            <td className="w-1/4 bg-stone-50 font-bold text-stone-600">Invoice Number:</td>
                                            <td className="w-1/4 font-bold text-stone-900">{editData?.invoice_no || '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="bg-stone-50 font-bold text-stone-600">Material Delivery Date:</td>
                                            <td className="font-bold text-stone-900">{editData?.material_delivery_date || '–'}</td>
                                            <td className="bg-stone-50 font-bold text-stone-600">Vehicle / Truck No:</td>
                                            <td className="font-bold text-stone-900">{editData?.vehicle_number || '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="bg-stone-50 font-bold text-stone-600">Driver Name:</td>
                                            <td className="font-bold text-stone-900">{editData?.driver_name || '–'}</td>
                                            <td className="bg-stone-50 font-bold text-stone-600">Driver Phone Number:</td>
                                            <td className="font-bold text-stone-900">{editData?.driver_phone_number || '–'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Signatures Footer */}
                            <div className="sig-grid">
                                <div>
                                    <div className="sig-line">
                                        {user?.name || ''}
                                    </div>
                                    <p className="font-black uppercase text-[10px] text-stone-900">Dispatched By</p>
                                </div>
                                <div>
                                    <div className="sig-line">
                                        {editData?.driver_name || ''}
                                    </div>
                                    <p className="font-black uppercase text-[10px] text-stone-900">Driver Signature</p>
                                </div>
                                <div>
                                    <div className="sig-line">
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
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                    *, *::before, *::after {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body.is-printing-document > *:not(#native-print-portal) {
                        display: none !important;
                    }
                    body.is-printing-document {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        height: auto !important;
                    }
                    #native-print-portal {
                        display: block !important;
                        width: 100% !important;
                        max-width: 180mm !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        font-size: 11px !important;
                        line-height: 1.4 !important;
                        color: #000000 !important;
                        background: #ffffff !important;
                    }
                    #native-print-portal .section-block { margin-bottom: 14px !important; }
                    #native-print-portal table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        border: 1px solid #a8a29e !important;
                        font-size: 11px !important;
                        margin-bottom: 2px !important;
                    }
                    #native-print-portal th, #native-print-portal td {
                        border: 1px solid #d6d3d1 !important;
                        padding: 5px 8px !important;
                        vertical-align: middle !important;
                    }
                    #native-print-portal .sig-grid {
                        display: grid !important;
                        grid-template-columns: repeat(3, 1fr) !important;
                        gap: 20px !important;
                        text-align: center !important;
                        padding-top: 30px !important;
                    }
                    #native-print-portal .sig-line {
                        border-bottom: 1px solid #78716c !important;
                        height: 35px !important;
                        margin-bottom: 5px !important;
                        font-weight: 700 !important;
                        font-size: 10px !important;
                        display: flex !important;
                        align-items: flex-end !important;
                        justify-content: center !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
