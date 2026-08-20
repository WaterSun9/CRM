import React, { useState } from 'react';
import { ShoppingBag, Zap, Ruler, IndianRupee, Layers, CheckCircle2, ShieldAlert, AlertCircle, User, Edit3, X } from 'lucide-react';
import { SectionHeader, EditableDetailItem } from './shared';
import { toIndianCommas, parseIndianNumber, formatInputValue } from '../../utils';

export default function MaterialOrderTab({
    customer,
    editData,
    setEditData,
    handleChange,
    editingSection,
    setEditingSection,
    isEditable,
    onUpdate,
    logActivity,
    fetchLogs,
    user,
    meta = {},
    saving,
    setSaving
}) {
    // Channel Partner / Agent / Channel Partner Office can edit; Office has view-only access
    const isAgent = user?.userType === 'agent' || user?.role === 'Channel Partners' || user?.userType === 'dealer' || user?.role === 'Dealers';
    const isAdmin = user?.userType === 'admin' || user?.role === 'Super Admin' || user?.role === 'Admin';
    const isChannelPartnerOffice = user?.userType === 'channel_partner_office' || user?.role === 'Channel Partner Office';
    const canEdit = isAgent || isChannelPartnerOffice || (isAdmin && isEditable);

    const [validationError, setValidationError] = useState('');
    const [savedSuccess, setSavedSuccess] = useState(false);

    const roofShedOptions = ['Roof', 'Shed'];

    const handleLocalChange = (field, val) => {
        setValidationError('');
        if (handleChange) {
            handleChange(field, val);
        } else {
            setEditData(prev => ({ ...prev, [field]: val }));
        }
    };

    const handleFillTestData = () => {
        handleLocalChange('roof_shed', editData.roof_shed || 'Roof');
        handleLocalChange('dc_cable', editData.dc_cable || '30');
        handleLocalChange('ac_cable', editData.ac_cable || '25');
        handleLocalChange('structure_front_leg_height', editData.structure_front_leg_height || '5');
        handleLocalChange('structure_rear_leg_height', editData.structure_rear_leg_height || '8');
        handleLocalChange('invoice_value', editData.invoice_value || '1,25,000');
        if (!editingSection && setEditingSection) {
            setEditingSection('mat_order');
        }
    };

    const frontLegVal = editData.structure_front_leg_height || '';
    const rearLegVal = editData.structure_rear_leg_height || '';

    const isAllMandatoryFilled = Boolean(
        editData.roof_shed &&
        editData.dc_cable && Number(parseIndianNumber(editData.dc_cable)) > 0 &&
        editData.ac_cable && Number(parseIndianNumber(editData.ac_cable)) > 0 &&
        frontLegVal.toString().trim() &&
        rearLegVal.toString().trim() &&
        editData.invoice_value && Number(parseIndianNumber(editData.invoice_value)) > 0
    );

    const validateFields = () => {
        if (!editData.roof_shed) return 'Roof / Shed is mandatory.';
        if (!editData.dc_cable || Number(parseIndianNumber(editData.dc_cable)) <= 0) return 'DC Cable length (meters) is mandatory.';
        if (!editData.ac_cable || Number(parseIndianNumber(editData.ac_cable)) <= 0) return 'AC Cable length (meters) is mandatory.';
        if (!frontLegVal.toString().trim()) return 'Structure Front Leg Height (ft) is mandatory.';
        if (!rearLegVal.toString().trim()) return 'Structure Rear Leg Height (ft) is mandatory.';
        if (!editData.invoice_value || Number(parseIndianNumber(editData.invoice_value)) <= 0) return 'Invoice Value (₹) is mandatory.';
        return null;
    };

    const handleSaveOrder = async (nextStage = null) => {
        const error = validateFields();
        if (error) {
            setValidationError(error);
            return;
        }

        setSaving(true);
        const frontLeg = editData.structure_front_leg_height || '';
        const rearLeg = editData.structure_rear_leg_height || '';
        const updates = {
            roof_shed: editData.roof_shed,
            dc_cable: Number(parseIndianNumber(editData.dc_cable)),
            ac_cable: Number(parseIndianNumber(editData.ac_cable)),
            structure_front_leg_height: frontLeg,
            structure_rear_leg_height: rearLeg,
            material_order_notes: editData.material_order_notes || '',
            invoice_value: Number(parseIndianNumber(editData.invoice_value))
        };

        if (nextStage) {
            updates.stage = nextStage;
        }

        await onUpdate(customer.id, updates);

        let logMsg = `${customer.customer_name}: Updated Material Order details (Roof/Shed: ${updates.roof_shed}, DC: ${updates.dc_cable}m, AC: ${updates.ac_cable}m, Front Leg: ${updates.structure_front_leg_height} ft, Rear Leg: ${updates.structure_rear_leg_height} ft, Notes: ${updates.material_order_notes || 'None'}, Invoice: ₹${updates.invoice_value})`;
        if (nextStage) {
            logMsg += ` and moved stage to ${nextStage}`;
        }
        if (logActivity && user?.id) {
            await logActivity(user.id, 'update', logMsg, '', customer.id);
        }

        if (setEditingSection) setEditingSection(null);
        setSaving(false);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        if (fetchLogs) fetchLogs();
    };

    const isEditingOrder = editingSection === 'mat_order';

    return (
        <div className="space-y-3.5 animate-in fade-in duration-300">
            {/* Role permission info banner if not agent or channel partner office */}
            {!isAgent && !isChannelPartnerOffice && (
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-amber-900 leading-tight">Channel Partner Controlled Stage</p>
                        <p className="text-[10px] text-amber-700 font-medium leading-tight">
                            Material Order specifications can also be modified with admin unlock. Channel partners configure these in their portal.
                        </p>
                    </div>
                </div>
            )}

            {/* 1. Material Order Specifications Card (Placed ABOVE Customer Details) */}
            <section id="section-mat_order">
                <div className="flex items-center justify-between mb-2 border-b border-stone-100 pb-1">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                        <ShoppingBag size={12} className="text-amber-500" /> Material Order Specifications
                    </h3>
                    <div className="flex items-center gap-2">
                        {canEdit && (
                            <button
                                onClick={() => setEditingSection(isEditingOrder ? null : 'mat_order')}
                                className="text-stone-400 hover:text-amber-600 transition-colors p-0.5"
                                title={isEditingOrder ? 'Close edit' : 'Edit details'}
                            >
                                {isEditingOrder ? <X size={14} /> : <Edit3 size={14} />}
                            </button>
                        )}
                    </div>
                </div>

                {/* Validation Alert */}
                {validationError && (
                    <div className="mb-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                        <AlertCircle size={14} className="flex-shrink-0 text-red-500" />
                        <span>{validationError}</span>
                    </div>
                )}

                {savedSuccess && (
                    <div className="mb-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                        <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-600" />
                        <span>Material Order details saved successfully!</span>
                    </div>
                )}

                {/* Grid of Specifications with Front Leg, Rear Leg, and Notes */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <EditableDetailItem
                        label="Roof / Shed *"
                        field="roof_shed"
                        value={editData.roof_shed}
                        onChange={handleLocalChange}
                        options={roofShedOptions}
                        isEditing={isEditingOrder}
                    />
                    <EditableDetailItem
                        label="DC Cable (Meters) *"
                        field="dc_cable"
                        value={editData.dc_cable}
                        onChange={handleLocalChange}
                        type="number"
                        isEditing={isEditingOrder}
                    />
                    <EditableDetailItem
                        label="AC Cable (Meters) *"
                        field="ac_cable"
                        value={editData.ac_cable}
                        onChange={handleLocalChange}
                        type="number"
                        isEditing={isEditingOrder}
                    />
                    <EditableDetailItem
                        label="Structure Front Leg Height (ft) *"
                        field="structure_front_leg_height"
                        value={editData.structure_front_leg_height}
                        onChange={handleLocalChange}
                        type="number"
                        isEditing={isEditingOrder}
                    />
                    <EditableDetailItem
                        label="Structure Rear Leg Height (ft) *"
                        field="structure_rear_leg_height"
                        value={editData.structure_rear_leg_height}
                        onChange={handleLocalChange}
                        type="number"
                        isEditing={isEditingOrder}
                    />
                    <EditableDetailItem
                        label="Invoice Value (₹) *"
                        field="invoice_value"
                        value={editData.invoice_value}
                        onChange={handleLocalChange}
                        isMoney={true}
                        isEditing={isEditingOrder}
                    />
                    <div className="col-span-2 md:col-span-3">
                        <EditableDetailItem
                            label="Notes / Special Instructions (Optional)"
                            field="material_order_notes"
                            value={editData.material_order_notes}
                            onChange={handleLocalChange}
                            isEditing={isEditingOrder}
                        />
                    </div>
                </div>
            </section>

            {/* 2. Non-Editable Customer Lead Details (Reference below specifications) */}
            <section id="section-lead_details" className="pt-1.5 border-t border-stone-100">
                <div className="flex items-center justify-between mb-2 border-b border-stone-100 pb-1">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                        <User size={12} className="text-amber-500" /> Customer Lead Details (Reference)
                    </h3>
                    <span className="text-[9px] font-semibold text-stone-400 uppercase">View Only</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <EditableDetailItem label="Customer Name" field="customer_name" value={customer.customer_name} isEditing={false} />
                    <EditableDetailItem label="Phone Number" field="phone_number" value={customer.phone_number} isEditing={false} />
                    <EditableDetailItem label="Email Address" field="email" value={customer.email_address || customer.email} isEditing={false} />
                    <EditableDetailItem label="Consumer No" field="consumer_no" value={customer.consumer_no} isEditing={false} />
                    <EditableDetailItem label="Villages" field="villages" value={customer.villages} isEditing={false} />
                    <EditableDetailItem label="Sub Division" field="sub_divisions" value={customer.sub_divisions} isEditing={false} />
                    <EditableDetailItem label="Channel Partner Name" field="channel_partner" value={customer.channel_partner} isEditing={false} />
                    <EditableDetailItem label="Sub Channel Partner Name" field="sub_channel_partner" value={customer.sub_channel_partner} isEditing={false} />
                    <EditableDetailItem label="MODULE BRAND" field="module_brand" value={customer.module_brand} isEditing={false} />
                    <EditableDetailItem label="MODULE WP" field="module_wp" value={customer.module_wp} isEditing={false} />
                    <EditableDetailItem label="No of Modules" field="no_of_modules" value={customer.no_of_modules} isEditing={false} />
                    <EditableDetailItem label="System Capacity (kWp)" field="system_capacity_kwp" value={customer.system_capacity_kwp} isEditing={false} />
                </div>
            </section>
        </div>
    );
}
