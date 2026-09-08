import React, { useState, useEffect } from 'react';
import {
  Download,
  Printer,
  Building2,
  Eye,
  Edit3,
  CheckCircle,
  SunMedium
} from 'lucide-react';
import { ClientReportData, VendorSettings } from './types';
import {
  DEFAULT_VENDOR_SETTINGS,
  INITIAL_CLIENTS,
  BLANK_CLIENT_TEMPLATE,
} from './data/defaultData';
import { DocumentFillingForm } from './components/DocumentFillingForm';
import { DocumentPreview } from './components/DocumentPreview';
import { VendorSettingsModal } from './components/VendorSettingsModal';
import { ReviewPrintModal } from './components/ReviewPrintModal';
import { exportDocumentToPdf } from './utils/pdfExport';

export default function App() {
  // STRICT REQUIREMENT: DO NOT store client info in JSON, localStorage, or any persistent place.
  // In-memory state only during the active browser session.
  const [currentClient, setCurrentClient] = useState<ClientReportData>(INITIAL_CLIENTS[0]);

  // Only vendor/contractor company settings (EPC code, Bank account) are remembered
  const [vendor, setVendor] = useState<VendorSettings>(() => {
    try {
      const saved = localStorage.getItem('solar_automator_vendor');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_VENDOR_SETTINGS;
  });

  const [showHighlights, setShowHighlights] = useState<boolean>(true);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isReviewPrintModalOpen, setIsReviewPrintModalOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'form' | 'preview'>('form');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync vendor to localStorage (EPC code & bank info only, NO client info)
  useEffect(() => {
    try {
      localStorage.setItem('solar_automator_vendor', JSON.stringify(vendor));
    } catch {
      // ignore
    }
  }, [vendor]);

  // Show temporary toast message
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Update current client in memory
  const handleClientChange = (updatedClient: ClientReportData) => {
    setCurrentClient(updatedClient);
  };

  // Reset current client to sample data
  const handleResetToSample = () => {
    setCurrentClient({
      ...INITIAL_CLIENTS[0],
      createdAt: new Date().toISOString(),
    });
    showToast('Loaded sample demo client (MISTRI KAPILABEN CHIMANLAL)');
  };

  // Clear client to start new form
  const handleClearNewClient = () => {
    setCurrentClient({
      ...BLANK_CLIENT_TEMPLATE,
      id: 'client-' + Date.now(),
      createdAt: new Date().toISOString(),
      consumerName: '',
      discomConsumerId: '',
      pmSuryaShaktiPortalId: '',
      janSamarthId: '',
      installationAddress: '',
      district: '',
      pincode: '',
    });
    showToast('Cleared form. Ready for new report data!');
  };

  // Save vendor settings
  const handleSaveVendor = (updatedVendor: VendorSettings) => {
    setVendor(updatedVendor);
    showToast('Vendor & Bank details updated successfully');
  };

  // SINGLE DOWNLOAD OPTION: Triggers browser's native Save As popup asking where to save as
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const sanitizedName = (currentClient.consumerName || 'Client')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 30);
      const fileName = `Feasibility_Report_${sanitizedName}.pdf`;

      const result = await exportDocumentToPdf(currentClient, vendor, {
        showHighlights: false, // clean official bank submission without yellow marks
        fileName,
        chooseSaveLocation: true, // triggers browser native Save As file picker popup
      });

      if (result.cancelled) {
        showToast('Download cancelled');
      } else if (result.method === 'picker') {
        showToast(`Saved to selected folder: ${fileName}`);
      } else {
        showToast(`Downloaded: ${fileName}`);
      }
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Download failed. You can use Review & Print.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Clean up any legacy saved clients from localStorage to ensure strict zero-storage compliance
  useEffect(() => {
    try {
      localStorage.removeItem('solar_automator_clients');
    } catch {
      // ignore
    }
  }, []);

  // SINGLE REVIEW POP-UP BEFORE PRINTING
  const handleOpenReviewPrint = () => {
    setIsReviewPrintModalOpen(true);
  };

  // Execute print from review pop-up
  const handleConfirmPrint = async () => {
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isInIframe) {
      // Browser sandboxes in preview iframes ignore window.print() ('allow-modals' is not set).
      // Seamlessly generate the official PDF and trigger the native Save As file picker!
      showToast('Generating official 3-page A4 PDF (Save As)...');
      await handleDownloadPdf();
    } else {
      try {
        window.print();
      } catch (err) {
        console.warn('Print command failed:', err);
        await handleDownloadPdf();
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP APPLICATION NAVBAR (Hidden in Print) */}
      <header className="no-print sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand & App Name */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-white shadow-xs">
              <SunMedium className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-none">
                  Solar Feasibility Report Automator
                </h1>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-sm">
                  Official A4
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                Fill client details &rarr; Review report &rarr; Download PDF or Print
              </p>
            </div>
          </div>

          {/* Clean Action Buttons */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
            {/* Vendor Settings Button */}
            <button
              onClick={() => setIsVendorModalOpen(true)}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Configure EPC Contractor & Bank Details"
            >
              <Building2 className="h-3.5 w-3.5 text-slate-600" />
              <span>Vendor / Bank Details</span>
            </button>

            {/* SINGLE REVIEW POP-UP BEFORE PRINTING BUTTON */}
            <button
              onClick={handleOpenReviewPrint}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Open review pop-up before printing"
            >
              <Printer className="h-3.5 w-3.5 text-amber-600" />
              <span>Review & Print</span>
            </button>

            {/* SINGLE DOWNLOAD BUTTON (triggers browser Save As dialog) */}
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              title="Download PDF - triggers browser Save As dialog asking where to save"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExportingPdf ? 'Saving...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>

        {/* Mobile View Toggle Switch */}
        <div className="lg:hidden border-t border-slate-200 px-4 py-2 bg-slate-50 flex gap-2">
          <button
            onClick={() => setActiveMobileTab('form')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
              activeMobileTab === 'form'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            1. Fill Client Form
          </button>
          <button
            onClick={() => setActiveMobileTab('preview')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
              activeMobileTab === 'preview'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            2. View Document ({currentClient.consumerName ? 'Ready' : 'Empty'})
          </button>
        </div>
      </header>

      {/* SUB-HEADER TIP / BANNER (Hidden in Print) */}
      <div className="no-print bg-amber-500/10 border-b border-amber-200/60 px-4 py-2 text-xs text-amber-900 flex items-center justify-between gap-2">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-600 inline-block shrink-0" />
            <span>
              <strong>Client Data:</strong> Kept in-memory for your active session. Download PDF prompts where to save on your computer.
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3 shrink-0 text-[11px]">
            <button
              onClick={() => setShowHighlights(!showHighlights)}
              className="underline font-semibold hover:text-amber-950 cursor-pointer"
            >
              {showHighlights ? 'Hide Yellow Highlighting' : 'Show Yellow Highlighting'}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN DUAL-PANE WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT PANE: FILLING FORM (Hidden in Print) */}
          <div
            className={`no-print lg:col-span-5 xl:col-span-5 h-full ${
              activeMobileTab === 'preview' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="lg:sticky lg:top-24">
              <DocumentFillingForm
                client={currentClient}
                vendor={vendor}
                onChange={handleClientChange}
                onResetToSample={handleResetToSample}
                onClearNewClient={handleClearNewClient}
                onOpenVendorSettings={() => setIsVendorModalOpen(true)}
                showHighlights={showHighlights}
                onToggleHighlights={() => setShowHighlights(!showHighlights)}
                onDownloadPdf={handleDownloadPdf}
                isExportingPdf={isExportingPdf}
                onReviewPrint={handleOpenReviewPrint}
              />
            </div>
          </div>

          {/* RIGHT PANE: LIVE OFFICIAL DOCUMENT PREVIEW */}
          <div
            className={`lg:col-span-7 xl:col-span-7 ${
              activeMobileTab === 'form' ? 'hidden lg:block' : 'block'
            } print:!block print:!w-full print:!col-span-12 print:!m-0 print:!p-0`}
          >
            {/* Toolbar above preview */}
            <div className="no-print mb-3 flex items-center justify-between bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-blue-600" />
                  Live Official Document (3 Pages)
                </span>
                <span className="text-[11px] text-slate-400">|</span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {currentClient.consumerName || 'Unnamed Consumer'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenReviewPrint}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                  title="Review report before printing"
                >
                  <Printer className="h-3 w-3 text-amber-600" />
                  <span>Review & Print</span>
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  title="Download PDF - prompts where to save"
                >
                  <Download className="h-3 w-3" />
                  <span>{isExportingPdf ? 'Saving...' : 'Download PDF'}</span>
                </button>
              </div>
            </div>

            {/* Document Preview Content Container */}
            <div className="printable-document-container overflow-x-auto pb-12">
              <DocumentPreview
                client={currentClient}
                vendor={vendor}
                showHighlights={showHighlights}
                totalPageCount={3}
              />
            </div>
          </div>
        </div>
      </main>

      {/* MODALS */}
      <VendorSettingsModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        vendor={vendor}
        onSave={handleSaveVendor}
      />

      {/* SINGLE REVIEW POP-UP BEFORE PRINTING MODAL */}
      <ReviewPrintModal
        isOpen={isReviewPrintModalOpen}
        onClose={() => setIsReviewPrintModalOpen(false)}
        client={currentClient}
        vendor={vendor}
        onConfirmPrint={handleConfirmPrint}
        onDownloadPdf={handleDownloadPdf}
        isExportingPdf={isExportingPdf}
      />
    </div>
  );
}

