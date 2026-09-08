import React, { useState } from 'react';
import { X, Building2, Save, RotateCcw } from 'lucide-react';
import { VendorSettings } from '../types';
import { DEFAULT_VENDOR_SETTINGS } from '../data/defaultData';

interface VendorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: VendorSettings;
  onSave: (updated: VendorSettings) => void;
}

export const VendorSettingsModal: React.FC<VendorSettingsModalProps> = ({
  isOpen,
  onClose,
  vendor,
  onSave,
}) => {
  const [formData, setFormData] = useState<VendorSettings>({ ...vendor });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleResetToDefault = () => {
    setFormData({ ...DEFAULT_VENDOR_SETTINGS });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Vendor & EPC Contractor Settings
              </h3>
              <p className="text-xs text-slate-500">
                These details apply automatically across all client reports
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vendor Name (Shown in Page 2 Header Box)
            </label>
            <input
              type="text"
              value={formData.vendorName}
              onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              EPC Contractor Address (Item 12)
            </label>
            <input
              type="text"
              value={formData.epcContractorAddress}
              onChange={(e) => setFormData({ ...formData, epcContractorAddress: e.target.value })}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              EPC Code (Item 13)
            </label>
            <input
              type="text"
              value={formData.epcCode}
              onChange={(e) => setFormData({ ...formData, epcCode: e.target.value })}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank A/c No. (Item 14)
              </label>
              <input
                type="text"
                value={formData.bankAccountNo}
                onChange={(e) => setFormData({ ...formData, bankAccountNo: e.target.value })}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank IFSC Code (Item 14)
              </label>
              <input
                type="text"
                value={formData.bankIfsc}
                onChange={(e) => setFormData({ ...formData, bankIfsc: e.target.value.toUpperCase() })}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Signatory Text
            </label>
            <input
              type="text"
              value={formData.signatoryText}
              onChange={(e) => setFormData({ ...formData, signatoryText: e.target.value })}
              className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Defaults
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
