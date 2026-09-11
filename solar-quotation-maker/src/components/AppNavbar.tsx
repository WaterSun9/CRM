import React from 'react';
import {
  Printer,
  RotateCcw,
  FileSpreadsheet,
  FileEdit,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';

interface AppNavbarProps {
  onOpenEditor: () => void;
  highlightChanges: boolean;
  onToggleHighlights: () => void;
  changedCount: number;
  onPrint: () => void;
  onReset: () => void;
  onOpenAssetModal: () => void;
  capacityKw: string;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  onOpenEditor,
  highlightChanges,
  onToggleHighlights,
  changedCount,
  onPrint,
  onReset,
  onOpenAssetModal,
  capacityKw,
}) => {
  return (
    <header className="print:hidden bg-[#0c234b] text-white border-b border-[#1b3d75] px-3 sm:px-5 py-2.5 flex items-center justify-between shadow-md z-30">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-amber-400">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-sm sm:text-base tracking-wide text-white">
              WATERSUN <span className="font-light text-sky-300">Quotation Maker</span>
            </h1>
            <span className="inline-block text-[10px] uppercase font-extrabold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
              {capacityKw || '3.48 kW'}
            </span>
          </div>
          <p className="text-[11px] text-sky-200/80 hidden sm:block">
            PM Surya Ghar Muft Bijli Yojana &amp; GEDA Authorized Rooftop Proposal
          </p>
        </div>
      </div>

      {/* Center / Action Toolbar */}
      <div className="flex items-center gap-2">
        {/* Primary Action: Fill / Edit Values Pop-up */}
        <button
          type="button"
          onClick={onOpenEditor}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-lg text-xs shadow-md transition-all active:scale-95"
          title="Open pop-up to edit customer, capacity, equipment, and pricing"
        >
          <FileEdit className="w-4 h-4 text-slate-950" />
          <span className="hidden sm:inline">Fill / Edit Values</span>
          <span className="sm:hidden">Edit</span>
          {changedCount > 0 && (
            <span className="px-1.5 py-0.5 bg-slate-950 text-amber-300 rounded-full text-[10px] font-black">
              {changedCount}
            </span>
          )}
        </button>

        {/* Highlights Toggle */}
        <button
          type="button"
          onClick={onToggleHighlights}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
            highlightChanges
              ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 hover:bg-amber-400/30'
              : 'bg-slate-800 text-gray-300 border-slate-700 hover:bg-slate-700'
          }`}
          title="Toggle highlight markers on preview document"
        >
          <Sparkles className={`w-3.5 h-3.5 ${highlightChanges ? 'text-amber-400' : 'text-gray-400'}`} />
          <span className="hidden md:inline">{highlightChanges ? 'Highlights: ON' : 'Highlights: OFF'}</span>
        </button>

        {/* Asset / Screenshot Manager */}
        <button
          type="button"
          onClick={onOpenAssetModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-100 bg-sky-900/60 hover:bg-sky-800 hover:text-white rounded-lg border border-sky-600/60 transition-colors shadow-xs"
          title="Upload or change your 3 screenshots (Watersun logo, Page 1 middle banner, Tata Solaroof)"
        >
          <ImageIcon className="w-3.5 h-3.5 text-sky-300" />
          <span className="hidden sm:inline">Use My 3 Screenshots</span>
          <span className="sm:hidden">Screenshots</span>
        </button>

        {/* Reset */}
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Reset back to standard initial PDF data"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Reset</span>
        </button>

        {/* Print / Save PDF */}
        <button
          type="button"
          onClick={onPrint}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-lg shadow-md transition-all active:scale-95"
          title="Print or Save as PDF"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save PDF</span>
        </button>
      </div>
    </header>
  );
};
