import React from 'react';
import { X, Check, FileEdit, Sparkles, Building } from 'lucide-react';
import { QuotationData } from '../types';
import { QuotationEditor } from './QuotationEditor';

interface QuotationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: QuotationData;
  onChange: (updated: QuotationData) => void;
  onOpenAssetModal: () => void;
  changedCount: number;
}

export const QuotationFormModal: React.FC<QuotationFormModalProps> = ({
  isOpen,
  onClose,
  data,
  onChange,
  onOpenAssetModal,
  changedCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-300 w-full max-w-4xl h-[92vh] max-h-[900px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-slate-900 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Fill Quotation Values</h3>
                {changedCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-400 text-slate-950 rounded-full">
                    {changedCount} modified field{changedCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Update customer info, system size, equipment, and pricing — changes will be highlighted in the preview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: The Complete Editor Component */}
        <div className="flex-1 overflow-hidden p-3 sm:p-4 bg-gray-100/60">
          <div className="h-full bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            <QuotationEditor
              data={data}
              onChange={onChange}
              onOpenLogoModal={onOpenAssetModal}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-t border-gray-200 flex-shrink-0">
          <div className="text-xs text-gray-500 hidden sm:flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>All changes will be highlighted in yellow in the document review</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Done &amp; Review Quotation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
