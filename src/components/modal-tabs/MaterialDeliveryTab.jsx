import React, { useState, useEffect } from 'react';
import { Building2, Mail, Zap, Trash2, Plus } from 'lucide-react';
import { supabase } from '../../supabase';
import { SectionHeader, EditableDetailItem } from './shared';

const parsePanelSerials = (raw) => {
    if (!raw) return [''];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [''];
    } catch (e) { }

    if (raw.includes('\n')) {
        return raw.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (raw.includes(',')) {
        return raw.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [raw.trim()];
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
    handleChange,
    editingSection,
    setEditingSection
}) {
    const [vendors, setVendors] = useState([]);
    const [sendingInfo, setSendingInfo] = useState(false);
    const [infoSentStatus, setInfoSentStatus] = useState(null);
    const [panelSerials, setPanelSerials] = useState(() => parsePanelSerials(customer?.panel_serial_no));

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

    const addPanelSerial = () => {
        const next = [...panelSerials, ''];
        setPanelSerials(next);
    };

    const removePanelSerial = (idx) => {
        const next = panelSerials.filter((_, i) => i !== idx);
        const finalVal = next.length > 0 ? next : [''];
        setPanelSerials(finalVal);
        const filtered = finalVal.filter(Boolean);
        const serialized = filtered.length > 0 ? filtered.join('\n') : '';
        setEditData(prev => ({ ...prev, panel_serial_no: serialized }));
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Pick a Vendor Section */}
            <section id="section-pick_vendor">
                <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-1.5 mt-4">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <Building2 size={12} /> Pick a Vendor
                    </h3>
                </div>
                <div className="bg-stone-50 p-4 rounded-[20px] border border-stone-150 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">Vendor Allotment</p>
                        <select
                            disabled={!isEditable}
                            value={editData.vendor || ''}
                            onChange={async (e) => {
                                const selectedVal = e.target.value;
                                setEditData(prev => ({ ...prev, vendor: selectedVal }));
                                setInfoSentStatus(null);
                                await onUpdate(customer.id, { vendor: selectedVal });
                                await logActivity(
                                    user.id,
                                    'update',
                                    `${customer.customer_name}: Assigned vendor to ${selectedVal || 'None'}`,
                                    '',
                                    customer.id
                                );
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

            {/* Material Delivery Fields */}
            <section id="section-equip_details">
                <SectionHeader title="Material Delivery Details" id="equip_details" icon={Zap} isEditable={isEditable} editingSection={editingSection} setEditingSection={setEditingSection} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {editingSection === 'equip_details' ? (
                        <div className="bg-stone-50 p-3 rounded-xl col-span-2 md:col-span-1 space-y-2">
                            <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">PANEL SERIAL NO.</p>
                            <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                                {panelSerials.map((serial, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                        <input
                                            type="text"
                                            value={serial}
                                            onChange={(e) => handlePanelSerialChange(idx, e.target.value)}
                                            className="flex-1 bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300"
                                            placeholder={`Serial No #${idx + 1}`}
                                        />
                                        {panelSerials.length > 1 && (
                                            <button
                                                onClick={() => removePanelSerial(idx)}
                                                className="text-red-400 hover:text-red-600 p-1"
                                                type="button"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={addPanelSerial}
                                className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-[10px] font-bold mt-1"
                                type="button"
                            >
                                <Plus size={12} /> Add Serial No
                            </button>
                        </div>
                    ) : (
                        <div className="bg-stone-50 p-3 rounded-xl col-span-2 md:col-span-1">
                            <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">PANEL SERIAL NO.</p>
                            <div className="flex flex-col gap-1 mt-1">
                                {panelSerials.filter(Boolean).length === 0 ? (
                                    <span className="text-xs text-stone-400 italic">No serials entered</span>
                                ) : (
                                    panelSerials.filter(Boolean).map((serial, idx) => (
                                        <div key={idx} className="text-xs text-stone-700 font-semibold">
                                            {serial}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                    <EditableDetailItem label="INVERTER SERIAL NO." field="inverter_serial_no" value={editData.inverter_serial_no} onChange={handleChange} isEditing={editingSection === 'equip_details'} />
                    <EditableDetailItem label="INVOICE NO" field="invoice_no" value={editData.invoice_no} onChange={handleChange} isEditing={editingSection === 'equip_details'} />
                    <EditableDetailItem label="DRIVER NAME" field="driver_name" value={editData.driver_name} onChange={handleChange} isEditing={editingSection === 'equip_details'} />
                    <EditableDetailItem label="DRIVER PHONE NUMBER" field="driver_phone_number" value={editData.driver_phone_number} onChange={handleChange} isEditing={editingSection === 'equip_details'} />
                </div>
            </section>
        </div>
    );
}
