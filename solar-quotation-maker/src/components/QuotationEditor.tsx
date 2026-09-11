import React, { useState } from 'react';
import {
  FileText,
  DollarSign,
  Plus,
  Trash2,
  HelpCircle,
  Building,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import { QuotationData, BrandQuoteOption } from '../types';
import { INVERTER_PRESETS } from '../data/initialData';
import { formatINR } from '../utils/formatters';

interface QuotationEditorProps {
  data: QuotationData;
  onChange: (updated: QuotationData) => void;
  onOpenLogoModal: () => void;
}

export const QuotationEditor: React.FC<QuotationEditorProps> = ({
  data,
  onChange,
  onOpenLogoModal,
}) => {
  const [activeTab, setActiveTab] = useState<'page1' | 'page2' | 'page3' | 'company'>('page1');
  const [newNoteInput, setNewNoteInput] = useState('');

  // Update helper for nested state
  const updatePage1 = (field: keyof QuotationData['page1'], value: string) => {
    onChange({
      ...data,
      page1: {
        ...data.page1,
        [field]: value,
      },
    });
  };

  const updatePage2Field = <K extends keyof QuotationData['page2']>(
    field: K,
    value: QuotationData['page2'][K]
  ) => {
    onChange({
      ...data,
      page2: {
        ...data.page2,
        [field]: value,
      },
    });
  };

  // Safe accessor for 3 brand options
  const currentBrands: [BrandQuoteOption, BrandQuoteOption, BrandQuoteOption] =
    data.page2.brandOptions && data.page2.brandOptions.length === 3
      ? data.page2.brandOptions
      : [
          {
            brandName: 'Waaree Solar',
            baseValue: data.page2.baseValue || 189000,
            discount: data.page2.discount || 0,
            netPayableAmount: data.page2.netPayableAmount || 189000,
            subsidy: data.page2.subsidy || 78000,
            netPriceAfterSubsidy: data.page2.netPriceAfterSubsidy || 111000,
          },
          {
            brandName: 'Tata Power Solar',
            baseValue: 198000,
            discount: 0,
            netPayableAmount: 198000,
            subsidy: 78000,
            netPriceAfterSubsidy: 120000,
          },
          {
            brandName: 'Adani Solar',
            baseValue: 205000,
            discount: 0,
            netPayableAmount: 205000,
            subsidy: 78000,
            netPriceAfterSubsidy: 127000,
          },
        ];

  const updateBrandOption = (
    index: 0 | 1 | 2,
    field: 'brandName' | 'baseValue' | 'discount' | 'subsidy',
    value: string | number
  ) => {
    const updated = [
      { ...currentBrands[0] },
      { ...currentBrands[1] },
      { ...currentBrands[2] },
    ] as [BrandQuoteOption, BrandQuoteOption, BrandQuoteOption];

    const target = updated[index];

    if (field === 'brandName') {
      target.brandName = String(value);
    } else if (field === 'baseValue') {
      target.baseValue = Number(value) || 0;
      target.netPayableAmount = Math.max(0, target.baseValue - target.discount);
      target.netPriceAfterSubsidy = Math.max(0, target.netPayableAmount - target.subsidy);
    } else if (field === 'discount') {
      target.discount = Number(value) || 0;
      target.netPayableAmount = Math.max(0, target.baseValue - target.discount);
      target.netPriceAfterSubsidy = Math.max(0, target.netPayableAmount - target.subsidy);
    } else if (field === 'subsidy') {
      target.subsidy = Number(value) || 0;
      target.netPriceAfterSubsidy = Math.max(0, target.netPayableAmount - target.subsidy);
    }

    onChange({
      ...data,
      page2: {
        ...data.page2,
        brandOptions: updated,
        baseValue: updated[0].baseValue,
        discount: updated[0].discount,
        netPayableAmount: updated[0].netPayableAmount,
        subsidy: updated[0].subsidy,
        netPriceAfterSubsidy: updated[0].netPriceAfterSubsidy,
      },
    });
  };

  const applySubsidyToAll = (subsidyVal: number) => {
    const updated = currentBrands.map((b) => {
      const net = b.netPayableAmount;
      return {
        ...b,
        subsidy: subsidyVal,
        netPriceAfterSubsidy: Math.max(0, net - subsidyVal),
      };
    }) as [BrandQuoteOption, BrandQuoteOption, BrandQuoteOption];

    onChange({
      ...data,
      page2: {
        ...data.page2,
        brandOptions: updated,
        subsidy: subsidyVal,
        netPriceAfterSubsidy: Math.max(0, updated[0].netPayableAmount - subsidyVal),
      },
    });
  };

  const applyDiscountToAll = (discountVal: number) => {
    const updated = currentBrands.map((b) => {
      const net = Math.max(0, b.baseValue - discountVal);
      return {
        ...b,
        discount: discountVal,
        netPayableAmount: net,
        netPriceAfterSubsidy: Math.max(0, net - b.subsidy),
      };
    }) as [BrandQuoteOption, BrandQuoteOption, BrandQuoteOption];

    onChange({
      ...data,
      page2: {
        ...data.page2,
        brandOptions: updated,
        discount: discountVal,
        netPayableAmount: updated[0].netPayableAmount,
        netPriceAfterSubsidy: updated[0].netPriceAfterSubsidy,
      },
    });
  };

  // Financial calculations (legacy)
  const handleBaseValueChange = (val: number) => {
    updateBrandOption(0, 'baseValue', val);
  };

  const handleDiscountChange = (val: number) => {
    updateBrandOption(0, 'discount', val);
  };

  const handleSubsidyChange = (val: number) => {
    updateBrandOption(0, 'subsidy', val);
  };

  // Notes management (User requirement: custom note points get appended at end of note)
  const handleAddNotePoint = () => {
    if (!newNoteInput.trim()) return;
    const updatedNotes = [...data.page2.notes, newNoteInput.trim()];
    updatePage2Field('notes', updatedNotes);
    setNewNoteInput('');
  };

  const handleRemoveNotePoint = (index: number) => {
    const updatedNotes = data.page2.notes.filter((_, idx) => idx !== index);
    updatePage2Field('notes', updatedNotes);
  };

  const handleResetNotesToDefault = () => {
    updatePage2Field('notes', [
      'All GST is inclusive',
      '70% Solar Power System-(HSN CODE-8541)-5% @GST',
      '30% Solar Power System-(HSN CODE-9954)-18% @GST',
      'Owner Name:-Sandipkumar Jayantilal Trivedi',
      'National Portal Empanelment Number -NPUG-002',
      'Electrical Contractor Number -GJ/PTN/C-03368',
    ]);
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Editor Header with Tabs */}
      <div className="border-b border-gray-200 bg-gray-50/80 px-4 pt-3 pb-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Quotation Form Controls
          </span>
          <button
            type="button"
            onClick={onOpenLogoModal}
            className="text-xs text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1 hover:underline"
          >
            <Building className="w-3.5 h-3.5" />
            {data.company.logoUrl ? 'Change Custom Logo' : 'Upload Company Logo'}
          </button>
        </div>

        <nav className="flex space-x-1" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('page1')}
            className={`py-2 px-3 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'page1'
                ? 'border-sky-600 text-sky-700 bg-white shadow-xs'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Page 1: Customer &amp; kW
          </button>

          <button
            onClick={() => setActiveTab('page2')}
            className={`py-2 px-3 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'page2'
                ? 'border-sky-600 text-sky-700 bg-white shadow-xs'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Page 2: Pricing &amp; Specs
          </button>

          <button
            onClick={() => setActiveTab('page3')}
            className={`py-2 px-3 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'page3'
                ? 'border-sky-600 text-sky-700 bg-white shadow-xs'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Page 3: Terms &amp; BOM
          </button>

          <button
            onClick={() => setActiveTab('company')}
            className={`py-2 px-3 text-xs font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'company'
                ? 'border-sky-600 text-sky-700 bg-white shadow-xs'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            Company &amp; Tax
          </button>
        </nav>
      </div>

      {/* Tab Contents */}
      <div className="p-4 md:p-5 overflow-y-auto flex-1 space-y-5 text-gray-800 text-xs">
        {/* ================= PAGE 1 EDIT CONTROLS ================= */}
        {activeTab === 'page1' && (
          <div className="space-y-4">
            <div className="bg-sky-50/60 border border-sky-200 rounded-lg p-3">
              <h4 className="font-bold text-sky-900 text-xs flex items-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-sky-600" />
                Page 1 Key Editable Parameters
              </h4>
              <p className="text-[11px] text-sky-800">
                Update customer contact info, quote number, date, solar capacity (kW), and Yours Truly details.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Customer Name */}
              <div className="col-span-2 md:col-span-1">
                <label className="block font-bold text-gray-700 mb-1">
                  Customer Name (To) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.page1.customerName}
                  onChange={(e) => updatePage1('customerName', e.target.value)}
                  placeholder="e.g. DARAJI CHANDUBHAI PARSOTTAMBHAI"
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 uppercase"
                />
              </div>

              {/* Customer Phone */}
              <div className="col-span-2 md:col-span-1">
                <label className="block font-bold text-gray-700 mb-1">
                  Customer Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.page1.customerPhone}
                  onChange={(e) => updatePage1('customerPhone', e.target.value)}
                  placeholder="e.g. 8200774492"
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Quotation No */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Quotation Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.page1.quotationNo}
                  onChange={(e) => updatePage1('quotationNo', e.target.value)}
                  placeholder="e.g. Quote-3255"
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Quotation Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.page1.date}
                  onChange={(e) => updatePage1('date', e.target.value)}
                  placeholder="DD-MM-YYYY (e.g. 05-09-2026)"
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Capacity KW */}
              <div className="col-span-2 bg-amber-50/70 border border-amber-200 rounded-lg p-3">
                <label className="block font-bold text-amber-950 mb-1">
                  Subject / Capacity (How much kW) <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={data.page1.capacityKw}
                    onChange={(e) => updatePage1('capacityKw', e.target.value)}
                    placeholder="e.g. 3.48 kw"
                    className="flex-1 px-3 py-1.5 text-xs rounded border border-amber-300 bg-white font-bold text-amber-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex gap-1">
                    {['3.48 kw', '5.00 kw', '10.00 kw', '20.00 kw'].map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => updatePage1('capacityKw', kw)}
                        className="px-2 py-1 text-[11px] font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10.5px] text-amber-800 mt-1">
                  Synchronizes with Page 1 Subject line (&ldquo;Subject: {data.page1.capacityKw}&rdquo;) and Page 2 title.
                </p>
              </div>

              {/* Yours Truly Name */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Yours Truly - Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.page1.yoursTrulyName}
                  onChange={(e) => updatePage1('yoursTrulyName', e.target.value)}
                  placeholder="e.g. Mr. Watersun office"
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Yours Truly Phone */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Yours Truly - Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.page1.yoursTrulyPhone}
                  onChange={(e) => updatePage1('yoursTrulyPhone', e.target.value)}
                  placeholder="e.g. +91 70165 89864"
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Quick Access for 3 Screenshots */}
            <div className="mt-4 p-3 bg-sky-50/70 border border-sky-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h5 className="font-bold text-sky-950 text-xs flex items-center gap-1.5">
                  <span>Quotation Screenshots &amp; Branding</span>
                  {data.assets?.screenshot2MiddleBannerUrl && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">
                      Screenshot 2 Active
                    </span>
                  )}
                </h5>
                <p className="text-[11px] text-sky-800 mt-0.5">
                  Attach your 3 screenshots directly: Watersun Logo (Top), GEDA &amp; Modi Banner (Middle), and Tata Solaroof (Footer).
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenLogoModal}
                className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
              >
                <span>Use My 3 Screenshots</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= PAGE 2 EDIT CONTROLS ================= */}
        {activeTab === 'page2' && (
          <div className="space-y-5">
            {/* 1. Equipment & Project Configuration */}
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-3">
              <h4 className="font-bold text-gray-900 text-xs border-b border-gray-200 pb-1.5">
                1. System Specifications
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Solar Panel Make & Qty */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Solar Panel Make
                  </label>
                  <input
                    type="text"
                    value={data.page2.solarPanelMake}
                    onChange={(e) => updatePage2Field('solarPanelMake', e.target.value)}
                    placeholder="e.g. Waree 580"
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Solar Panel Quantity
                  </label>
                  <input
                    type="text"
                    value={data.page2.solarPanelQty}
                    onChange={(e) => updatePage2Field('solarPanelQty', e.target.value)}
                    placeholder="e.g. 6"
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* Inverter Options */}
                <div className="col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">
                    Inverter Options (Options 1, 2, 3, 4)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    {INVERTER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onChange({
                            ...data,
                            page2: {
                              ...data.page2,
                              inverterOption: preset.id,
                              inverterBrand: preset.brand,
                            },
                          });
                        }}
                        className={`p-2 text-left rounded-lg border text-xs transition-all ${
                          data.page2.inverterOption === preset.id
                            ? 'border-sky-600 bg-sky-50 text-sky-950 font-bold ring-1 ring-sky-600'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="font-bold text-[11px] text-sky-800">{preset.id}</div>
                        <div className="font-semibold text-xs mt-0.5">{preset.brand}</div>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 items-center">
                    <span className="text-[11px] text-gray-500 whitespace-nowrap">Selected Make:</span>
                    <input
                      type="text"
                      value={data.page2.inverterBrand}
                      onChange={(e) => updatePage2Field('inverterBrand', e.target.value)}
                      placeholder="Custom Inverter Brand"
                      className="flex-1 px-3 py-1 text-xs rounded border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-semibold"
                    />
                  </div>
                </div>

                {/* Geb / Geda Charge */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Geb / Geda Charge (Inclusive / Exclusive)
                  </label>
                  <div className="flex rounded-md shadow-xs" role="group">
                    <button
                      type="button"
                      onClick={() => updatePage2Field('gebGedaCharge', 'Including')}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-l-md border ${
                        data.page2.gebGedaCharge === 'Including'
                          ? 'bg-sky-700 text-white border-sky-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Including
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePage2Field('gebGedaCharge', 'Excluding')}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-r-md border-t border-b border-r ${
                        data.page2.gebGedaCharge === 'Excluding'
                          ? 'bg-sky-700 text-white border-sky-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Excluding
                    </button>
                  </div>
                </div>

                {/* Project Type */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Project Type (Residential / Commercial)
                  </label>
                  <div className="flex rounded-md shadow-xs" role="group">
                    <button
                      type="button"
                      onClick={() => updatePage2Field('projectType', 'Residential')}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-l-md border ${
                        data.page2.projectType === 'Residential'
                          ? 'bg-sky-700 text-white border-sky-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Residential
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePage2Field('projectType', 'Commercial')}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-r-md border-t border-b border-r ${
                        data.page2.projectType === 'Commercial'
                          ? 'bg-sky-700 text-white border-sky-700'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Commercial
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Table 2 Pricing: Project Size, 3 Brand/Company Names, Values & Totals */}
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                <div>
                  <h4 className="font-bold text-gray-900 text-xs">
                    2. Table 2: Project Size, 3 Brand Names, Values &amp; 3 Totals
                  </h4>
                  <p className="text-[10.5px] text-gray-500 mt-0.5">
                    Configure the project size column and 3 brand/company options with individual values and automatic totals.
                  </p>
                </div>
                <span className="text-[10.5px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded font-semibold border border-sky-200">
                  Auto-Calculated Totals
                </span>
              </div>

              {/* Project Size Field */}
              <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1">
                    <label className="block font-bold text-gray-800 text-xs mb-1">
                      Project Size (Column before Value)
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={data.page2.projectSize || data.page1.capacityKw || '3.48 kw'}
                        onChange={(e) => updatePage2Field('projectSize', e.target.value)}
                        placeholder="e.g. 3.48 kW"
                        className="w-full sm:w-64 px-3 py-1.5 text-xs rounded border border-gray-300 font-bold text-[#0c3882] focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => updatePage2Field('projectSize', data.page1.capacityKw)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border border-gray-300 whitespace-nowrap"
                        title="Sync with Page 1 capacity"
                      >
                        Sync ({data.page1.capacityKw || '3.48 kw'})
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => applySubsidyToAll(78000)}
                      className="px-2 py-1 text-[10.5px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded"
                    >
                      Set ₹78,000 Subsidy on All
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDiscountToAll(0)}
                      className="px-2 py-1 text-[10.5px] font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 rounded"
                    >
                      Clear Discounts
                    </button>
                  </div>
                </div>
              </div>

              {/* 3 Brand Options Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {currentBrands.map((brand, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-lg border border-sky-200/80 p-3 shadow-2xs flex flex-col justify-between space-y-2.5"
                  >
                    {/* Header: Company / Brand Name */}
                    <div className="border-b border-gray-100 pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                          Option {idx + 1}
                        </span>
                        <span className="text-[10.5px] font-bold text-gray-400">
                          Brand #{idx + 1}
                        </span>
                      </div>
                      <label className="block font-bold text-gray-800 text-[11px] mb-1">
                        Company / Brand Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={brand.brandName}
                        onChange={(e) => updateBrandOption(idx as 0 | 1 | 2, 'brandName', e.target.value)}
                        placeholder={`e.g. Brand ${idx + 1}`}
                        className="w-full px-2.5 py-1 text-xs rounded border border-gray-300 font-bold text-[#0c3882] focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {/* Base Value */}
                    <div>
                      <label className="block font-semibold text-gray-700 text-[11px] mb-0.5">
                        Base Value (INR)
                      </label>
                      <input
                        type="number"
                        value={brand.baseValue}
                        onChange={(e) => updateBrandOption(idx as 0 | 1 | 2, 'baseValue', e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded border border-gray-300 font-bold focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                      <div className="text-[10.5px] text-gray-500 mt-0.5">
                        {formatINR(brand.baseValue)}
                      </div>
                    </div>

                    {/* Discount */}
                    <div>
                      <label className="block font-semibold text-gray-700 text-[11px] mb-0.5">
                        Discount (INR)
                      </label>
                      <input
                        type="number"
                        value={brand.discount}
                        onChange={(e) => updateBrandOption(idx as 0 | 1 | 2, 'discount', e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded border border-gray-300 font-semibold focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                      <div className="text-[10.5px] text-gray-500 mt-0.5">
                        Net: {formatINR(brand.netPayableAmount)}
                      </div>
                    </div>

                    {/* Subsidy */}
                    <div>
                      <label className="block font-semibold text-gray-700 text-[11px] mb-0.5">
                        Subsidy (INR)
                      </label>
                      <input
                        type="number"
                        value={brand.subsidy}
                        onChange={(e) => updateBrandOption(idx as 0 | 1 | 2, 'subsidy', e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded border border-gray-300 font-semibold focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {/* Total (Net Price After Subsidy) */}
                    <div className="bg-blue-50/80 border border-blue-200 rounded p-2 text-center mt-1">
                      <span className="text-[10px] font-bold text-blue-900 uppercase tracking-tight block">
                        Total {idx + 1} (After Subsidy)
                      </span>
                      <span className="text-sm font-black text-[#0c3882] block mt-0.5">
                        {formatINR(brand.netPriceAfterSubsidy)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 3 Totals Summary Bar */}
              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Three Quotation Totals Comparison</span>
                  <span className="text-[10px] text-gray-400 font-normal">Appears in Table 2 on Page 2</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {currentBrands.map((brand, idx) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-200">
                      <div className="text-[11px] font-bold text-[#0c3882] truncate">
                        {brand.brandName || `Brand ${idx + 1}`}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        Base: {formatINR(brand.baseValue)}
                      </div>
                      <div className="text-xs font-black text-[#0c3882] mt-1 pt-1 border-t border-gray-200">
                        Total: {formatINR(brand.netPriceAfterSubsidy)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Note Points & Custom Append Feature */}
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                <div>
                  <h4 className="font-bold text-gray-900 text-xs">
                    3. Quotation Note Points
                  </h4>
                  <p className="text-[10.5px] text-gray-500 mt-0.5">
                    Payment terms heading removed per request; custom notes get appended at the end.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetNotesToDefault}
                  className="text-[11px] text-gray-600 hover:text-gray-900 font-semibold underline"
                >
                  Reset to Defaults
                </button>
              </div>

              {/* Current Notes List */}
              <div className="space-y-1.5">
                {data.page2.notes.map((note, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-800 group"
                  >
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-700 flex-shrink-0" />
                      <span className="leading-snug">{note}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveNotePoint(idx)}
                      title="Remove Note"
                      className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Custom Note Form */}
              <div className="pt-2">
                <label className="block font-bold text-gray-700 text-[11px] mb-1">
                  Add Custom Note Point (Appends to the end of the note):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNoteInput}
                    onChange={(e) => setNewNoteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNotePoint();
                      }
                    }}
                    placeholder="Type custom note point and click Add..."
                    className="flex-1 px-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddNotePoint}
                    className="flex items-center gap-1 px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded font-bold text-xs shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAGE 3 EDIT CONTROLS ================= */}
        {activeTab === 'page3' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <h4 className="font-bold text-emerald-950 text-xs flex items-center gap-1.5 mb-1">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Page 3: Terms &amp; Conditions, Warranty, BOM, Bank Details
              </h4>
              <p className="text-[11px] text-emerald-800">
                Page 3 is configured to match the original document specifications with 0 modifications needed. Bank and company details are displayed below for reference.
              </p>
            </div>

            {/* Bank details editable */}
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-2">
              <h4 className="font-bold text-gray-900 text-xs">Company Bank Account Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-0.5">Account Name</label>
                  <input
                    type="text"
                    value={data.page3.bankDetails.accountName}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        page3: {
                          ...data.page3,
                          bankDetails: {
                            ...data.page3.bankDetails,
                            accountName: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-2.5 py-1 text-xs rounded border border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-0.5">Account Number</label>
                  <input
                    type="text"
                    value={data.page3.bankDetails.accountNumber}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        page3: {
                          ...data.page3,
                          bankDetails: {
                            ...data.page3.bankDetails,
                            accountNumber: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-2.5 py-1 text-xs rounded border border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-0.5">Bank &amp; Branch</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={data.page3.bankDetails.bankName}
                      onChange={(e) =>
                        onChange({
                          ...data,
                          page3: {
                            ...data.page3,
                            bankDetails: {
                              ...data.page3.bankDetails,
                              bankName: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-1/2 px-2.5 py-1 text-xs rounded border border-gray-300"
                      placeholder="Bank"
                    />
                    <input
                      type="text"
                      value={data.page3.bankDetails.branchName}
                      onChange={(e) =>
                        onChange({
                          ...data,
                          page3: {
                            ...data.page3,
                            bankDetails: {
                              ...data.page3.bankDetails,
                              branchName: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-1/2 px-2.5 py-1 text-xs rounded border border-gray-300"
                      placeholder="Branch"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-0.5">IFSC Code</label>
                  <input
                    type="text"
                    value={data.page3.bankDetails.ifscCode}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        page3: {
                          ...data.page3,
                          bankDetails: {
                            ...data.page3.bankDetails,
                            ifscCode: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-2.5 py-1 text-xs rounded border border-gray-300 uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Estimated other charges notice */}
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-1">
              <label className="block text-[11px] font-bold text-gray-700">
                Estimated Other Charges Notice (50% Advance Discom clause)
              </label>
              <textarea
                rows={3}
                value={data.page3.otherChargesText}
                onChange={(e) =>
                  onChange({
                    ...data,
                    page3: {
                      ...data.page3,
                      otherChargesText: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        )}

        {/* ================= COMPANY & TAX INFO CONTROLS ================= */}
        {activeTab === 'company' && (
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-3">
              <h4 className="font-bold text-gray-900 text-xs border-b border-gray-200 pb-1.5">
                Company Letterhead Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Company GST Number</label>
                  <input
                    type="text"
                    value={data.company.gstNo}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        company: { ...data.company, gstNo: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Company CIN Number</label>
                  <input
                    type="text"
                    value={data.company.cinNo}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        company: { ...data.company, cinNo: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 uppercase"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    value={data.company.email}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        company: { ...data.company, email: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded border border-gray-300"
                  />
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 space-y-3">
              <h4 className="font-bold text-gray-900 text-xs border-b border-gray-200 pb-1.5">
                Footer Office Locations
              </h4>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Corporate Office</label>
                <input
                  type="text"
                  value={data.footer.corporateOffice}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      footer: { ...data.footer, corporateOffice: e.target.value },
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Branch Office</label>
                <input
                  type="text"
                  value={data.footer.branchOffice}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      footer: { ...data.footer, branchOffice: e.target.value },
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
