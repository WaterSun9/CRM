import React from 'react';
import {
  CheckCircle2,
  Info,
  Building2,
  User,
  Zap,
  IndianRupee,
  MapPin,
  Calendar,
  Layers,
  Download,
  FolderDown,
  Printer,
  FileText,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { ClientReportData, VendorSettings } from '../types';

interface DocumentFillingFormProps {
  client: ClientReportData;
  vendor: VendorSettings;
  onChange: (updated: ClientReportData) => void;
  onResetToSample: () => void;
  onClearNewClient: () => void;
  onOpenVendorSettings: () => void;
  showHighlights: boolean;
  onToggleHighlights: () => void;
  onDownloadPdf: () => void;
  isExportingPdf?: boolean;
  onReviewPrint: () => void;
}

export const DocumentFillingForm: React.FC<DocumentFillingFormProps> = ({
  client,
  vendor,
  onChange,
  onResetToSample,
  onClearNewClient,
  onOpenVendorSettings,
  showHighlights,
  onToggleHighlights,
  onDownloadPdf,
  isExportingPdf = false,
  onReviewPrint,
}) => {
  const updateField = <K extends keyof ClientReportData>(
    field: K,
    value: ClientReportData[K]
  ) => {
    onChange({
      ...client,
      [field]: value,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
              <Zap className="h-4 w-4" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Client Data Input Sheet
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Fill the highlighted fields below to auto-generate the official Feasibility Report
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* ONE Single Download Option (triggers browser Save As popup) */}
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={isExportingPdf}
            className="text-xs px-3.5 py-1.5 rounded-md font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            title="Download PDF - triggers browser Save As dialog to choose location"
          >
            <Download className="h-3.5 w-3.5" />
            {isExportingPdf ? 'Saving PDF...' : 'Download PDF'}
          </button>

          {/* ONE Single Review Pop-up Before Printing Option */}
          <button
            type="button"
            onClick={onReviewPrint}
            className="text-xs px-3 py-1.5 rounded-md font-semibold bg-slate-800 hover:bg-slate-900 text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Open review pop-up before printing"
          >
            <Printer className="h-3.5 w-3.5" />
            Review & Print
          </button>

          <button
            type="button"
            onClick={onToggleHighlights}
            className={`text-xs px-2.5 py-1.5 rounded-md font-medium border transition-colors flex items-center gap-1.5 ${
              showHighlights
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
            title="Toggle yellow highlights"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-600 inline-block" />
            {showHighlights ? 'Highlights ON' : 'Highlights OFF'}
          </button>

          <button
            type="button"
            onClick={onClearNewClient}
            className="text-xs px-2.5 py-1.5 rounded-md font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
            title="Clear all fields to fill a new report"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear Form
          </button>

          <button
            type="button"
            onClick={onResetToSample}
            className="text-xs px-2.5 py-1.5 rounded-md font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer"
            title="Load sample demo data"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            Sample Data
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar">
        {/* SECTION 1: HIGHLIGHTED CLIENT FIELDS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200 bg-amber-50/60 p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500 shadow-xs"></span>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Highlighted Fields (Client Specific)
              </h3>
            </div>
            <span className="text-[11px] font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
              Changes per client
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Name of Consumer */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-amber-600" />
                1. Name of the Consumer (Borrower)
                <span className="text-amber-600 font-bold">*</span>
              </label>
              <input
                type="text"
                value={client.consumerName}
                onChange={(e) => updateField('consumerName', e.target.value.toUpperCase())}
                placeholder="e.g. MISTRI KAPILABEN CHIMANLAL"
                className="w-full text-sm font-medium px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900"
              />
            </div>

            {/* 2. Discom Consumer ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                2. Discom Consumer ID <span className="text-amber-600 font-bold">*</span>
              </label>
              <input
                type="text"
                value={client.discomConsumerId}
                onChange={(e) => updateField('discomConsumerId', e.target.value)}
                placeholder="e.g. 22139106156"
                className="w-full text-sm px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
              />
            </div>

            {/* 4. PM Surya Shakti Portal ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                4. PM Surya Shakti Portal ID <span className="text-amber-600 font-bold">*</span>
              </label>
              <input
                type="text"
                value={client.pmSuryaShaktiPortalId}
                onChange={(e) => updateField('pmSuryaShaktiPortalId', e.target.value.toUpperCase())}
                placeholder="e.g. NP-GJUG26-14118759"
                className="w-full text-sm px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
              />
            </div>

            {/* 5. Jan Samarth ID */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                5. Jan Samarth ID <span className="text-amber-600 font-bold">*</span>
              </label>
              <input
                type="text"
                value={client.janSamarthId}
                onChange={(e) => updateField('janSamarthId', e.target.value.toUpperCase())}
                placeholder="e.g. ANS-SOLAR-17360555-5375664"
                className="w-full text-sm px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
              />
            </div>

            {/* 6. Address for Installation */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-amber-600" />
                6. Address for Installation <span className="text-amber-600 font-bold">*</span>
              </label>
              <textarea
                rows={2}
                value={client.installationAddress}
                onChange={(e) => updateField('installationAddress', e.target.value.toUpperCase())}
                placeholder="e.g. VILL- GANESHPURA TAL SIDHPUR"
                className="w-full text-sm px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900"
              />
            </div>

            {/* 7. District */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                7. District of Installation <span className="text-amber-600 font-bold">*</span>
              </label>
              <input
                type="text"
                value={client.district}
                onChange={(e) => updateField('district', e.target.value.toUpperCase())}
                placeholder="e.g. PATAN"
                className="w-full text-sm px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            {/* 8. State */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                8. State of Installation <span className="text-amber-600 font-bold">*</span>
              </label>
              <input
                type="text"
                value={client.state}
                onChange={(e) => updateField('state', e.target.value.toUpperCase())}
                placeholder="e.g. GUJARAT"
                className="w-full text-sm px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            {/* 9. Pin Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                9. Pin Code of Installation <span className="text-amber-600 font-bold">*</span>
              </label>
              <input
                type="text"
                value={client.pincode}
                onChange={(e) => updateField('pincode', e.target.value)}
                placeholder="e.g. 384151"
                className="w-full text-sm px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
              />
            </div>

            {/* 15. Actual RTS Capacity to be installed */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-600" />
                15. Actual RTS Capacity (KW) <span className="text-amber-600 font-bold">*</span>
              </label>
              <input
                type="text"
                value={client.actualCapacityKw}
                onChange={(e) => updateField('actualCapacityKw', e.target.value)}
                placeholder="e.g. 3.24"
                className="w-full text-sm font-bold px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            {/* 18. Project Cost */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <IndianRupee className="h-3.5 w-3.5 text-amber-600" />
                18. Project Cost (All inclusive) <span className="text-amber-600 font-bold">*</span>
              </label>
              <input
                type="text"
                value={client.projectCost}
                onChange={(e) => updateField('projectCost', e.target.value)}
                placeholder="e.g. 1,84,000 or Rs. 1,84,000"
                className="w-full text-sm font-bold px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: ADDITIONAL DOCUMENT FIELDS */}
        <div className="space-y-4 pt-2">
          <div className="pb-2 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              Additional Details & Status
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 3. Discom ID */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                3. Discom ID (Optional)
              </label>
              <input
                type="text"
                value={client.discomId}
                onChange={(e) => updateField('discomId', e.target.value.toUpperCase())}
                placeholder="e.g. UGVCL / PGVCL"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 10. OEM Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                10. OEM Name (Optional)
              </label>
              <input
                type="text"
                value={client.oemName}
                onChange={(e) => updateField('oemName', e.target.value.toUpperCase())}
                placeholder="e.g. WAAREE / ADANI"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 11. Channel Partner */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                11. Channel Partner (if any)
              </label>
              <input
                type="text"
                value={client.channelPartner}
                onChange={(e) => updateField('channelPartner', e.target.value)}
                placeholder="Leave blank if none"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 14. RTS Capacity in KW Applied */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                14. RTS Capacity Applied (KW)
              </label>
              <input
                type="text"
                value={client.rtsCapacityAppliedKw}
                onChange={(e) => updateField('rtsCapacityAppliedKw', e.target.value)}
                placeholder="e.g. 3.3"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 17. Feasibility Status */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                17. Feasibility Report Status
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateField('feasibilityStatus', 'feasible')}
                  className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${
                    client.feasibilityStatus === 'feasible'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Feasible
                </button>
                <button
                  type="button"
                  onClick={() => updateField('feasibilityStatus', 'not_feasible')}
                  className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${
                    client.feasibilityStatus === 'not_feasible'
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Not Feasible
                </button>
              </div>
            </div>

            {/* Signature Date */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Signature Date
              </label>
              <input
                type="text"
                value={client.signatureDate}
                onChange={(e) => updateField('signatureDate', e.target.value)}
                placeholder="e.g. 08/09/2026"
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: VENDOR DETAILS PREVIEW (REUSED ACROSS CLIENTS) */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-800">
                Fixed Vendor & Bank Setup
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenVendorSettings}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-2"
            >
              Edit Vendor Details
            </button>
          </div>
          <div className="text-[11px] text-slate-600 grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="font-semibold text-slate-700">Vendor:</span> {vendor.vendorName}
            </div>
            <div>
              <span className="font-semibold text-slate-700">EPC Code:</span> {vendor.epcCode}
            </div>
            <div>
              <span className="font-semibold text-slate-700">A/c:</span> {vendor.bankAccountNo}
            </div>
            <div>
              <span className="font-semibold text-slate-700">IFSC:</span> {vendor.bankIfsc}
            </div>
          </div>
        </div>

        {/* Export Actions Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-4 sm:p-5 shadow-sm border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Download className="h-4 w-4 text-amber-400" />
                Export Official Feasibility Report
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Official 3-page A4 document without highlights, ready for bank & Discom submission.
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-2.5">
              {/* Single Download Option */}
              <button
                type="button"
                onClick={onDownloadPdf}
                disabled={isExportingPdf}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                title="Download PDF - triggers browser Save As dialog to choose location"
              >
                <Download className="h-4 w-4 text-white" />
                {isExportingPdf ? 'Generating PDF...' : 'Download PDF'}
              </button>

              {/* Single Review & Print Option */}
              <button
                type="button"
                onClick={onReviewPrint}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg border border-slate-600 flex items-center gap-2 transition-colors cursor-pointer"
                title="Review report details before sending to printer"
              >
                <Printer className="h-4 w-4 text-amber-400" />
                Review & Print
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
