import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, RotateCcw, Check } from 'lucide-react';
import { WatersunLogo } from './CompanyLogos';

interface LogoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLogoUrl?: string;
  onSaveLogo: (url?: string) => void;
}

export const LogoUploadModal: React.FC<LogoUploadModalProps> = ({
  isOpen,
  onClose,
  currentLogoUrl,
  onSaveLogo,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentLogoUrl);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, SVG, or WEBP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSave = () => {
    onSaveLogo(previewUrl);
    onClose();
  };

  const handleResetToDefault = () => {
    setPreviewUrl(undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-sky-700" />
            <h3 className="font-bold text-gray-900 text-base">Company Logo Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <p className="text-xs text-gray-600">
            You can use the official high-resolution Watersun vector logo or upload your own company logo image. It will appear on all 3 quotation pages.
          </p>

          {/* Current / Selected Preview */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col items-center justify-center min-h-[90px]">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {previewUrl ? 'Custom Uploaded Logo' : 'Default Standard Logo'}
            </span>
            <div className="p-2 bg-white rounded border border-gray-100 shadow-xs">
              <WatersunLogo customLogoUrl={previewUrl} className="h-14" />
            </div>
          </div>

          {/* Upload Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 ${
              dragActive
                ? 'border-sky-500 bg-sky-50/50'
                : 'border-gray-300 hover:border-sky-400 hover:bg-gray-50/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
            <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-700 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Click or drag &amp; drop to upload logo
              </p>
              <p className="text-xs text-gray-500 mt-0.5">PNG, JPG, SVG, or WEBP (Max 5MB)</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors px-2 py-1.5 rounded hover:bg-gray-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default Logo
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              Apply Logo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
