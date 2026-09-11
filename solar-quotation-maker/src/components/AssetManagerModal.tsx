import React, { useState, useRef } from 'react';
import { Upload, X, RotateCcw, Check, Sparkles, Image as ImageIcon, Info, ArrowUpRight } from 'lucide-react';
import { AssetImages } from '../types';
import { WatersunLogo, GedaEmblem, MnreEmblem, SuryaGharQuoteBanner, TataPowerSolaroofLogo } from './CompanyLogos';

interface AssetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets?: AssetImages;
  onSaveAssets: (updated: AssetImages) => void;
  initialSlot?: keyof AssetImages;
}

type AssetKey = keyof AssetImages;

interface SlotInfo {
  key: AssetKey;
  label: string;
  badge: string;
  title: string;
  location: string;
  description: string;
  recommended: string;
}

const PRIMARY_SCREENSHOT_SLOTS: SlotInfo[] = [
  {
    key: 'watersunLogoUrl',
    label: 'Screenshot 1',
    badge: 'Top Header',
    title: 'Screenshot 1: Watersun Solar Energy Logo',
    location: 'Top-left on Page 1, Page 2, and Page 3',
    description: 'The official Watersun logo (water droplet in A, blue PV grid in U, and radiant sun in SOLAR ENERGY).',
    recommended: 'PNG, JPG, or SVG (Screenshot 1)',
  },
  {
    key: 'screenshot2MiddleBannerUrl',
    label: 'Screenshot 2',
    badge: 'Page 1 Middle',
    title: 'Screenshot 2: GEDA + MNRE + PM Modi Surya Ghar Banner',
    location: 'Middle section of Page 1 (between Empanelment title and intro letter)',
    description: 'The complete middle visual graphic: GEDA emblem on left, MNRE emblem on right, and Hon\'ble PM Narendra Modi Surya Ghar Muft Bijli Yojana quote banner below.',
    recommended: 'PNG or JPG (Screenshot 2)',
  },
  {
    key: 'tataSolaroofLogoUrl',
    label: 'Screenshot 3',
    badge: 'Page Footer',
    title: 'Screenshot 3: Tata Power Solaroof Authorized Partner',
    location: 'Bottom-left footer on Page 1, Page 2, and Page 3',
    description: 'Authorized Channel Partner badge with Tata blue oval emblem and Solaroof radiant solar cell logo.',
    recommended: 'PNG, JPG, or SVG (Screenshot 3)',
  },
];

const INDIVIDUAL_SUB_SLOTS: SlotInfo[] = [
  {
    key: 'suryaGharBannerUrl',
    label: 'Modi Banner',
    badge: 'Individual',
    title: 'PM Surya Ghar Narendra Modi Quote Banner Only',
    location: 'Middle of Page 1 (if not using combined Screenshot 2)',
    description: 'Only the horizontal banner with quote and Hon\'ble PM Narendra Modi portrait.',
    recommended: 'PNG or JPG',
  },
  {
    key: 'gedaLogoUrl',
    label: 'GEDA Emblem',
    badge: 'Individual',
    title: 'GEDA Emblem Only',
    location: 'Page 1 (left side above the Modi banner)',
    description: 'Circular Gujarat Energy Development Agency logo with Gujarati and English text.',
    recommended: 'PNG (transparent)',
  },
  {
    key: 'mnreLogoUrl',
    label: 'MNRE Emblem',
    badge: 'Individual',
    title: 'MNRE Ministry Emblem Only',
    location: 'Page 1 (right side above the Modi banner)',
    description: 'Ashoka Lion Capital Ministry of New and Renewable Energy official emblem.',
    recommended: 'PNG (transparent)',
  },
];

export const AssetManagerModal: React.FC<AssetManagerModalProps> = ({
  isOpen,
  onClose,
  assets = {},
  onSaveAssets,
  initialSlot = 'watersunLogoUrl',
}) => {
  const [activeSlot, setActiveSlot] = useState<AssetKey>(initialSlot);
  const [tempAssets, setTempAssets] = useState<AssetImages>(assets);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if initialSlot changes
  React.useEffect(() => {
    if (initialSlot) {
      setActiveSlot(initialSlot);
    }
  }, [initialSlot, isOpen]);

  if (!isOpen) return null;

  const allSlots = [...PRIMARY_SCREENSHOT_SLOTS, ...INDIVIDUAL_SUB_SLOTS];
  const currentSlotInfo = allSlots.find((s) => s.key === activeSlot) || PRIMARY_SCREENSHOT_SLOTS[0];

  const handleFile = (file: File, targetSlot?: AssetKey) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, SVG, or WEBP)');
      return;
    }
    const slotToUse = targetSlot || activeSlot;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setTempAssets((prev) => ({
        ...prev,
        [slotToUse]: result,
      }));
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

  const handleResetCurrentSlot = () => {
    setTempAssets((prev) => {
      const updated = { ...prev };
      delete updated[activeSlot];
      return updated;
    });
  };

  const handleResetAllToDefaults = () => {
    if (window.confirm('Reset all logos and graphics back to the built-in standard vector assets?')) {
      setTempAssets({});
    }
  };

  const handleSaveAndApply = () => {
    onSaveAssets(tempAssets);
    onClose();
  };

  // Render preview for a specific slot
  const renderSlotPreview = (key: AssetKey, url?: string) => {
    switch (key) {
      case 'watersunLogoUrl':
        return <WatersunLogo customLogoUrl={url} className="h-[75px] max-w-full" />;
      case 'screenshot2MiddleBannerUrl':
        if (url) {
          return (
            <img
              src={url}
              alt="Screenshot 2: GEDA, MNRE & Modi Banner"
              className="max-h-36 w-auto max-w-full object-contain rounded shadow-xs"
            />
          );
        }
        return (
          <div className="w-full max-w-lg p-2 bg-white rounded border border-gray-200">
            <div className="flex items-center justify-between px-2 mb-1">
              <GedaEmblem className="h-8" />
              <MnreEmblem className="h-8" />
            </div>
            <SuryaGharQuoteBanner />
          </div>
        );
      case 'tataSolaroofLogoUrl':
        return <TataPowerSolaroofLogo customLogoUrl={url} className="h-[81px]" />;
      case 'suryaGharBannerUrl':
        return <SuryaGharQuoteBanner customLogoUrl={url} />;
      case 'gedaLogoUrl':
        return <GedaEmblem customLogoUrl={url} className="h-11" />;
      case 'mnreLogoUrl':
        return <MnreEmblem customLogoUrl={url} className="h-11" />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-300 w-full max-w-3xl overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-slate-900 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Use Your 3 Screenshots
              </h3>
              <p className="text-xs text-gray-400">
                Directly attach Screenshot 1 (Watersun logo), Screenshot 2 (Middle banner), and Screenshot 3 (Tata Solaroof)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Explanation Banner */}
        <div className="bg-blue-50/80 border-b border-blue-200/80 px-5 py-2.5 text-xs text-blue-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Why upload here?</span> When screenshots are pasted in chat, AI Studio processes them through AI vision, but doesn&apos;t save the files onto the app&apos;s disk. Drop or select your 3 screenshots below to replace the graphics on the pages instantly and save them!
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Primary 3 Screenshot Slots */}
          <div>
            <span className="block text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
              Primary 3 Screenshots:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PRIMARY_SCREENSHOT_SLOTS.map((slot) => {
                const isCustom = !!tempAssets[slot.key];
                const isSelected = activeSlot === slot.key;
                return (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => setActiveSlot(slot.key)}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-sky-600 bg-sky-50 shadow-xs ring-2 ring-sky-500/40'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50/70 hover:bg-gray-100/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-sky-800 uppercase tracking-wider">
                          {slot.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-gray-200 text-gray-700">
                          {slot.badge}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-gray-900 mt-1 line-clamp-1">
                        {slot.title.split(':')[1]?.trim() || slot.title}
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-gray-200/60 text-[11px]">
                      <span className={isCustom ? 'text-emerald-700 font-bold flex items-center gap-1' : 'text-gray-500'}>
                        {isCustom ? '✓ Screenshot Active' : 'Default Asset'}
                      </span>
                      {isSelected && <span className="text-sky-700 font-bold text-[10px]">Editing</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Asset Details & Preview Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-200">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">{currentSlotInfo.title}</h4>
                <p className="text-xs text-gray-600 mt-0.5">{currentSlotInfo.description}</p>
                <p className="text-[11px] text-sky-700 font-medium mt-0.5">
                  <span className="font-bold">Location:</span> {currentSlotInfo.location}
                </p>
              </div>
              {tempAssets[activeSlot] && (
                <button
                  type="button"
                  onClick={handleResetCurrentSlot}
                  className="self-start sm:self-auto text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Revert to Default
                </button>
              )}
            </div>

            {/* Live Render in Container */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 flex flex-col items-center justify-center min-h-[110px] shadow-2xs">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {tempAssets[activeSlot] ? 'Preview: Your Uploaded Screenshot File' : 'Preview: Built-in Standard Asset'}
              </span>
              <div className="w-full flex items-center justify-center">
                {renderSlotPreview(activeSlot, tempAssets[activeSlot])}
              </div>
            </div>
          </div>

          {/* Upload Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
              dragActive
                ? 'border-sky-500 bg-sky-50/70'
                : 'border-gray-300 hover:border-sky-400 hover:bg-sky-50/40'
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
            <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                Click or drag &amp; drop to upload {currentSlotInfo.label || 'image'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Supports {currentSlotInfo.recommended} (PNG, JPG, SVG)
              </p>
            </div>
          </div>

          {/* Optional Individual Sub-slots (Collapsible/Secondary) */}
          <details className="text-xs text-gray-600 bg-gray-50 rounded-lg border border-gray-200 p-3">
            <summary className="font-bold text-gray-800 cursor-pointer select-none">
              Need to upload individual emblems separately? Click to view individual slots
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-2 border-t border-gray-200">
              {INDIVIDUAL_SUB_SLOTS.map((slot) => {
                const isCustom = !!tempAssets[slot.key];
                const isSelected = activeSlot === slot.key;
                return (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => setActiveSlot(slot.key)}
                    className={`p-2 rounded-lg border text-left text-[11px] ${
                      isSelected
                        ? 'border-sky-600 bg-sky-50 font-bold'
                        : 'border-gray-200 hover:bg-white'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{slot.label}</div>
                    <div className="text-[10px] text-gray-500">
                      {isCustom ? 'Custom image uploaded' : 'Default'}
                    </div>
                  </button>
                );
              })}
            </div>
          </details>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={handleResetAllToDefaults}
            className="text-xs text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-5 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Apply to Quotation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
