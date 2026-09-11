import { useState, useEffect, useMemo } from 'react';
import { QuotationData, AssetImages } from './types';
import { INITIAL_QUOTATION } from './data/initialData';
import { QuotationPreview } from './components/QuotationPreview';
import { QuotationFormModal } from './components/QuotationFormModal';
import { AssetManagerModal } from './components/AssetManagerModal';
import { AppNavbar } from './components/AppNavbar';
import { getChangedFields } from './utils/changeTracker';

const STORAGE_KEY = 'watersun_quotation_data_v2';

export default function App() {
  const [quotationData, setQuotationData] = useState<QuotationData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_QUOTATION,
          ...parsed,
          page1: { ...INITIAL_QUOTATION.page1, ...(parsed.page1 || {}) },
          page2: {
            ...INITIAL_QUOTATION.page2,
            ...(parsed.page2 || {}),
            brandOptions:
              parsed.page2?.brandOptions && Array.isArray(parsed.page2.brandOptions) && parsed.page2.brandOptions.length === 3
                ? parsed.page2.brandOptions
                : INITIAL_QUOTATION.page2.brandOptions,
          },
          page3: { ...INITIAL_QUOTATION.page3, ...(parsed.page3 || {}) },
          company: { ...INITIAL_QUOTATION.company, ...(parsed.company || {}) },
          footer: { ...INITIAL_QUOTATION.footer, ...(parsed.footer || {}) },
          assets: { ...(INITIAL_QUOTATION.assets || {}), ...(parsed.assets || {}) },
        };
      } catch (err) {
        console.error('Failed to parse stored quotation:', err);
      }
    }
    return INITIAL_QUOTATION;
  });

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [assetModalSlot, setAssetModalSlot] = useState<keyof AssetImages>('watersunLogoUrl');
  const [highlightChanges, setHighlightChanges] = useState(false);

  const handleOpenAssetModal = (slot?: keyof AssetImages) => {
    if (slot) {
      setAssetModalSlot(slot);
    }
    setIsAssetModalOpen(true);
  };

  // Compute which fields differ from standard baseline
  const changedFields = useMemo(() => {
    return getChangedFields(quotationData, INITIAL_QUOTATION);
  }, [quotationData]);

  // Auto-save changes to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quotationData));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }, [quotationData]);

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    if (window.confirm('Reset all quotation fields back to the standard initial PDF template?')) {
      setQuotationData(INITIAL_QUOTATION);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleSaveAssets = (updatedAssets: AssetImages) => {
    setQuotationData((prev) => ({
      ...prev,
      assets: updatedAssets,
      company: {
        ...prev.company,
        logoUrl: updatedAssets.watersunLogoUrl,
      },
    }));
  };

  const handleEditField = () => {
    setIsFormModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-900 flex flex-col font-sans">
      {/* Top Application Navbar */}
      <AppNavbar
        onOpenEditor={() => setIsFormModalOpen(true)}
        highlightChanges={highlightChanges}
        onToggleHighlights={() => setHighlightChanges((prev) => !prev)}
        changedCount={changedFields.size}
        onPrint={handlePrint}
        onReset={handleReset}
        onOpenAssetModal={() => handleOpenAssetModal('watersunLogoUrl')}
        capacityKw={quotationData.page1.capacityKw}
      />

      {/* Main Content Workspace: Clean full document page preview */}
      <main className="flex-1 overflow-hidden relative flex flex-col bg-slate-950">
        <QuotationPreview
          data={quotationData}
          onPrint={handlePrint}
          highlightChanges={highlightChanges}
          changedFields={changedFields}
          onToggleHighlights={() => setHighlightChanges((prev) => !prev)}
          onOpenEditor={() => setIsFormModalOpen(true)}
          onOpenAssetModal={handleOpenAssetModal}
          onEditField={handleEditField}
        />
      </main>

      {/* "Fill Values" Pop-up Modal */}
      <QuotationFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        data={quotationData}
        onChange={setQuotationData}
        onOpenAssetModal={() => {
          setIsFormModalOpen(false);
          handleOpenAssetModal('watersunLogoUrl');
        }}
        changedCount={changedFields.size}
      />

      {/* Logos & Emblems Asset Manager Modal */}
      <AssetManagerModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        assets={quotationData.assets}
        onSaveAssets={handleSaveAssets}
        initialSlot={assetModalSlot}
      />
    </div>
  );
}
