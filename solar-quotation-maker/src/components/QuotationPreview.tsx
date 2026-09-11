import React, { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Printer,
  Eye,
  Layers,
  FileEdit,
  Sparkles,
  CheckCircle,
  EyeOff,
  Image as ImageIcon,
} from 'lucide-react';
import { QuotationData, AssetImages } from '../types';
import { Page1 } from './pages/Page1';
import { Page2 } from './pages/Page2';
import { Page3 } from './pages/Page3';

interface QuotationPreviewProps {
  data: QuotationData;
  onPrint: () => void;
  highlightChanges: boolean;
  changedFields: Set<string>;
  onToggleHighlights: () => void;
  onOpenEditor: () => void;
  onOpenAssetModal: (slot?: keyof AssetImages) => void;
  onEditField?: (fieldKey: string) => void;
}

export const QuotationPreview: React.FC<QuotationPreviewProps> = ({
  data,
  onPrint,
  highlightChanges,
  changedFields,
  onToggleHighlights,
  onOpenEditor,
  onOpenAssetModal,
  onEditField,
}) => {
  const [selectedView, setSelectedView] = useState<'all' | '1' | '2' | '3'>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(0.92);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.1, 1.4));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoomLevel(0.92);

  const changedCount = changedFields.size;

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Review Banner (Shown when highlights are enabled and fields were modified) */}
      {highlightChanges && changedCount > 0 && (
        <div className="print:hidden bg-amber-400 text-slate-950 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm z-20">
          <div className="flex items-center gap-2 font-medium text-xs sm:text-sm">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-950"></span>
            </span>
            <span className="font-extrabold">Review Mode Active:</span>
            <span>
              <strong>{changedCount}</strong> modified value{changedCount > 1 ? 's' : ''} highlighted in yellow below for quick checking.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleHighlights}
              className="px-2.5 py-1 text-xs font-bold bg-slate-900 text-amber-300 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1 shadow-xs"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hide Highlights
            </button>
            <button
              type="button"
              onClick={onOpenEditor}
              className="px-2.5 py-1 text-xs font-bold bg-white text-slate-950 hover:bg-amber-50 rounded-md transition-colors flex items-center gap-1 shadow-xs"
            >
              <FileEdit className="w-3.5 h-3.5" />
              Edit Values
            </button>
          </div>
        </div>
      )}

      {/* Top Preview Navigation Bar (Hidden in Print) */}
      <div className="print:hidden bg-slate-800 border-b border-slate-700 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 z-10 text-white shadow-xs">
        {/* Left Side: Fill Values Action Button & Highlight Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenEditor}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-sm transition-transform active:scale-95"
          >
            <FileEdit className="w-4 h-4" />
            <span>Fill / Edit Values</span>
            {changedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-slate-950 text-amber-400 rounded-full text-[10px]">
                {changedCount}
              </span>
            )}
          </button>

          {/* Highlight Toggle Button */}
          <button
            type="button"
            onClick={onToggleHighlights}
            title="Toggle highlighting of changed fields"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              highlightChanges
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-700 text-gray-300 border-slate-600 hover:bg-slate-600'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${highlightChanges ? 'text-amber-400' : 'text-gray-400'}`} />
            <span>{highlightChanges ? 'Highlights: ON' : 'Highlights: OFF'}</span>
          </button>

          {/* Use My 3 Screenshots Button */}
          <button
            type="button"
            onClick={() => onOpenAssetModal()}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-900/60 text-sky-200 border border-sky-600/60 hover:bg-sky-800 hover:text-white transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5 text-sky-300" />
            <span>Use My 3 Screenshots</span>
          </button>
        </div>

        {/* Center: Page Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700">
          <button
            type="button"
            onClick={() => setSelectedView('all')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              selectedView === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            All Pages
          </button>
          <button
            type="button"
            onClick={() => setSelectedView('1')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
              selectedView === '1'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Page 1
          </button>
          <button
            type="button"
            onClick={() => setSelectedView('2')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
              selectedView === '2'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Page 2
          </button>
          <button
            type="button"
            onClick={() => setSelectedView('3')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
              selectedView === '3'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Page 3
          </button>
        </div>

        {/* Right Side: Zoom Controls & Print Button */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold text-gray-300 min-w-[36px] text-center select-none">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Reset Zoom"
              className="p-1 text-gray-500 hover:text-gray-300 ml-0.5"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={onPrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {/* Pages Workspace with Zoom and Scrolling */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 flex flex-col items-center bg-slate-950/60 print:p-0 print:bg-white print:overflow-visible">
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="print:transform-none flex flex-col items-center gap-8 print:gap-0"
        >
          {/* Page 1 */}
          <div className={`${selectedView === '1' || selectedView === 'all' ? 'block' : 'hidden print:block'} print-break`}>
            <div className="print:hidden text-center text-xs font-bold text-gray-400 mb-2 flex items-center justify-center gap-1">
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>Page 1: Customer Details, Empanelment &amp; Authority Letter</span>
            </div>
            <Page1
              data={data}
              highlightChanges={highlightChanges}
              changedFields={changedFields}
              onEditField={onEditField}
              onOpenAssetSlot={onOpenAssetModal}
            />
          </div>

          {/* Page 2 */}
          <div className={`${selectedView === '2' || selectedView === 'all' ? 'block' : 'hidden print:block'} print-break`}>
            <div className="print:hidden text-center text-xs font-bold text-gray-400 mb-2 flex items-center justify-center gap-1">
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>Page 2: Techno Commercial Proposal, Pricing &amp; Notes</span>
            </div>
            <Page2
              data={data}
              highlightChanges={highlightChanges}
              changedFields={changedFields}
              onEditField={onEditField}
              onOpenAssetSlot={onOpenAssetModal}
            />
          </div>

          {/* Page 3 */}
          <div className={`${selectedView === '3' || selectedView === 'all' ? 'block' : 'hidden print:block'} print-break`}>
            <div className="print:hidden text-center text-xs font-bold text-gray-400 mb-2 flex items-center justify-center gap-1">
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>Page 3: Terms &amp; Conditions, Warranty, BOM &amp; Bank Details</span>
            </div>
            <Page3 data={data} onOpenAssetSlot={onOpenAssetModal} />
          </div>
        </div>
      </div>
    </div>
  );
};
