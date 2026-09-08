import React, { useState } from 'react';
import {
  X,
  Printer,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Zap,
  ArrowRight,
  Download,
  ExternalLink,
  Info
} from 'lucide-react';
import { ClientReportData, VendorSettings } from '../types';
import { DocumentPreview } from './DocumentPreview';

interface ReviewPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientReportData;
  vendor: VendorSettings;
  onConfirmPrint: () => void;
  onDownloadPdf: () => void;
  isExportingPdf?: boolean;
}

export const ReviewPrintModal: React.FC<ReviewPrintModalProps> = ({
  isOpen,
  onClose,
  client,
  vendor,
  onConfirmPrint,
  onDownloadPdf,
  isExportingPdf = false,
}) => {
  const [viewMode, setViewMode] = useState<'summary' | 'full'>('summary');
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  if (!isOpen) return null;

  const isFeasible = client.feasibilityStatus === 'feasible';
  const hasConsumerName = !!client.consumerName?.trim();
  const hasDiscomId = !!client.discomConsumerId?.trim();
  const hasCapacity = !!client.actualCapacityKw?.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600 text-white shadow-xs">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Review Report Before Printing
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify consumer and installation details before sending to the printer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs (Summary vs Full Page Preview) */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('summary')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'summary'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Verification Summary
            </button>
            <button
              type="button"
              onClick={() => setViewMode('full')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'full'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Full 3-Page Preview
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline-block">
            Print view automatically removes yellow highlights
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 space-y-4 custom-scrollbar">
          {viewMode === 'summary' ? (
            <div className="space-y-4">
              {/* Alert status if any critical fields empty */}
              {(!hasConsumerName || !hasDiscomId || !hasCapacity) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-800 text-xs">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Missing key details: </span>
                    {[
                      !hasConsumerName && 'Consumer Name',
                      !hasDiscomId && 'Discom Consumer ID',
                      !hasCapacity && 'Actual RTS Capacity',
                    ]
                      .filter(Boolean)
                      .join(', ')}{' '}
                    - you may still print or return to complete them.
                  </div>
                </div>
              )}

              {/* Grid of Verified Items */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden text-sm">
                <div className="p-3.5 bg-slate-100/70 font-semibold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Key Report Information
                </div>

                <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div>
                    <span className="text-slate-400 block text-xs">1. Consumer Name</span>
                    <span className="font-bold text-slate-900">
                      {client.consumerName || '- (Blank)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs">2. Discom Consumer ID</span>
                    <span className="font-bold text-slate-900">
                      {client.discomConsumerId || '- (Blank)'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div>
                    <span className="text-slate-400 block text-xs">4. PM Surya Portal ID</span>
                    <span className="font-medium text-slate-800">
                      {client.pmSuryaShaktiPortalId || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs">5. Jan Samarth ID</span>
                    <span className="font-medium text-slate-800">
                      {client.janSamarthId || '-'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 text-xs sm:text-sm">
                  <span className="text-slate-400 block text-xs">6. Address for Installation</span>
                  <span className="font-medium text-slate-800">
                    {client.installationAddress
                      ? `${client.installationAddress}, ${client.district} - ${client.pincode}, ${client.state}`
                      : '- (Blank)'}
                  </span>
                </div>

                <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                  <div>
                    <span className="text-slate-400 block text-xs">Applied Capacity</span>
                    <span className="font-bold text-slate-900">
                      {client.rtsCapacityAppliedKw || '-'} kW
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs">Actual Capacity to Install</span>
                    <span className="font-bold text-blue-700">
                      {client.actualCapacityKw || '-'} kW
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs">Project Cost</span>
                    <span className="font-bold text-slate-900">
                      {client.projectCost
                        ? (/^Rs\.?/i.test(client.projectCost.trim())
                            ? client.projectCost.trim()
                            : `Rs. ${client.projectCost.replace(/^[₹¹\s]+/, '').trim()}`)
                        : '-'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">17. Feasibility:</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs ${
                        isFeasible
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isFeasible ? 'Feasible (✓)' : 'Not Feasible (✓)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">16. MNRE Registered:</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {client.isVendorRegisteredMnre ? 'Yes (✓)' : 'No (✓)'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm bg-slate-50/70">
                  <div>
                    <span className="text-slate-400 block text-xs">EPC Contractor</span>
                    <span className="font-semibold text-slate-800">{vendor.epcCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs">Bank Account</span>
                    <span className="font-mono font-bold text-slate-900">
                      {vendor.bankAccountNo} ({vendor.bankName})
                    </span>
                  </div>
                </div>
              </div>

              {/* Iframe Sandbox vs Standalone mode helper tip */}
              {isInIframe ? (
                <div className="p-3.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-amber-950 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Info className="h-4 w-4 text-amber-700 shrink-0" />
                    <span>Embedded Preview Mode (Browser Sandbox Active)</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed text-[11.5px]">
                    Web browsers disable modal print popups inside sandboxed preview frames (<code>'allow-modals' is not set</code>). You can:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-900 text-[11.5px] pl-1">
                    <li>
                      <strong>Download Official PDF (Save As)</strong>: Choose where to save the exact 3-page A4 document on your computer.
                    </li>
                    <li>
                      <strong>Open in New Tab</strong>: Access the standalone tab where the browser's native Print dialog is 100% unlocked.
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold">Ready for Print:</span> The report will print as an official 3-page A4 document with crisp black checkmarks.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-2 border border-slate-200 overflow-x-auto">
              <DocumentPreview
                client={client}
                vendor={vendor}
                showHighlights={false}
                totalPageCount={3}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            Back to Edit Form
          </button>

          <div className="flex items-center flex-wrap gap-2">
            {/* Download PDF button (triggers Save As) */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onDownloadPdf();
              }}
              disabled={isExportingPdf}
              className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Save official 3-page PDF - prompts where to save on your computer"
            >
              <Download className="h-4 w-4" />
              {isExportingPdf ? 'Saving PDF...' : 'Download Official PDF (Save As)'}
            </button>

            {/* If in iframe, offer Open In New Tab */}
            {isInIframe && (
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors"
                title="Open app in a new standalone tab to use browser print preview dialog"
              >
                <ExternalLink className="h-3.5 w-3.5 text-slate-600" />
                <span>Open in Tab to Print</span>
              </a>
            )}

            {/* Print button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onConfirmPrint();
              }}
              className="px-4 py-2.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title={isInIframe ? "In iframe: triggers Save As PDF; in new tab: triggers browser print preview" : "Send report to printer"}
            >
              <Printer className="h-4 w-4 text-slate-900" />
              <span>{isInIframe ? 'Proceed to Print' : 'Proceed to Print Report'}</span>
              <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
