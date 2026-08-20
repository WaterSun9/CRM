import React, { useState, useRef } from 'react';
import { Page1 } from './Page1';
import { Page2 } from './Page2';
import { Page3 } from './Page3';
import { Page4 } from './Page4';
import { Printer, ZoomIn, ZoomOut, FileText, Eye, EyeOff, X, Type } from 'lucide-react';

export const AgreementPreview = ({ data, onChange, onClose }) => {
  const [zoom, setZoom] = useState(100);
  const [fontSize, setFontSize] = useState('text-[17px]');
  const containerRef = useRef(null);

  const handlePrint = () => {
    const printContainer = containerRef.current;
    if (!printContainer) return;

    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) {
      alert('Pop-up blocked. Please enable pop-ups for this site to print.');
      return;
    }

    // Capture stylesheet and link elements from parent document head
    const parentStyles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(tag => tag.outerHTML)
      .join('\n');

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PM Surya Ghar Agreement</title>
          <meta charset="utf-8">
          ${parentStyles}
          <style>
            @media print {
              @page { size: A4 portrait; margin: 0; }
              html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
            }
            body { font-family: Calibri, 'Calibri Light', sans-serif; font-weight: 400; background: white; margin: 0; padding: 0; }
            .doc-page { 
              width: 210mm !important; 
              min-height: 297mm !important; 
              height: 297mm !important; 
              margin: 0 auto !important; 
              padding: 12mm 15mm 16mm 15mm !important; 
              box-sizing: border-box !important; 
              page-break-after: always !important; 
              break-after: page !important;
              position: relative !important; 
              font-weight: 400 !important; 
              background: white !important;
              color: #1e293b !important;
              box-shadow: none !important;
              border: none !important;
            }
            .font-normal { font-weight: 400 !important; }
            .font-medium { font-weight: 500 !important; }
            .font-semibold { font-weight: 600 !important; }
            .font-bold, b, strong { font-weight: 700 !important; }
            .no-print { display: none !important; }
            
            /* Footer pinning */
            .doc-page .absolute.bottom-5 {
              position: absolute !important;
              bottom: 12mm !important;
              left: 15mm !important;
              right: 15mm !important;
            }
            /* Reset zoom transform in print window */
            div[style*="transform"] {
              transform: none !important;
            }
          </style>
        </head>
        <body style="background: white; margin: 0; padding: 0;">
          <div style="padding: 0; margin: 0;">
            ${printContainer.innerHTML}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 400);
            };
            // Fallback timeout in case onload event was already triggered
            setTimeout(() => {
              window.print();
              window.close();
            }, 1200);
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const scrollToPage = (pageNum) => {
    const pageEl = document.getElementById(`crm-agreement-page-${pageNum}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 no-print animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-[28px] w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden border border-slate-800 shadow-2xl relative">
        
        {/* Header (Controls) */}
        <div className="bg-slate-950 px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 flex-shrink-0">
          {/* Left: Title & Page Jumps */}
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              PM Surya Ghar Agreement {data.gpaeStampUrl ? '(5 Pages · GPAE Stamp Attached)' : '(4 Pages)'}
            </span>
            <div className="h-4 w-[1px] bg-slate-800 mx-1" />
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
              {data.gpaeStampUrl && (
                <button
                  type="button"
                  onClick={() => scrollToPage(0)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 transition cursor-pointer"
                >
                  Stamp Page
                </button>
              )}
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => scrollToPage(num)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition cursor-pointer"
                >
                  Page {num}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Zoom, Font, Highlights, Print & Close */}
          <div className="flex items-center gap-5 xl:gap-6">
            
            {/* Highlight Toggle */}
            <button
              type="button"
              onClick={() => onChange({ ...data, showHighlights: !data.showHighlights })}
              className={`px-4 py-2 rounded-xl border text-xs flex items-center gap-2 transition font-bold ${
                data.showHighlights
                  ? 'bg-amber-400/20 border-amber-500/30 text-amber-300 shadow-lg shadow-amber-400/5'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
              }`}
            >
              {data.showHighlights ? <Eye className="w-4 h-4 text-amber-400" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
              <span>{data.showHighlights ? 'Highlights On' : 'Highlights Off'}</span>
            </button>

            {/* Font Size Selection */}
            <div className="flex items-center gap-2 bg-slate-900 rounded-xl border border-slate-800 px-3.5 py-1.5">
              <Type className="w-4 h-4 text-slate-400" />
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="bg-transparent border-0 text-xs font-bold text-slate-200 focus:outline-none focus:ring-0 cursor-pointer pr-1"
              >
                <option value="text-[14px]">Small (14px)</option>
                <option value="text-[16px]">Medium (16px)</option>
                <option value="text-[17px]">Standard (17px)</option>
                <option value="text-[19px]">Large (19px)</option>
              </select>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-slate-900 rounded-xl border border-slate-800 px-3.5 py-1.5">
              <button
                onClick={() => setZoom(Math.max(60, zoom - 10))}
                className="text-slate-400 hover:text-slate-200 p-0.5"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-200 w-9 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(140, zoom + 10))}
                className="text-slate-400 hover:text-slate-200 p-0.5"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transition text-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Zoomable Pages Scroll Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-8 bg-slate-950 print:bg-white print-document-container"
        >
          <div
            className="transition-transform origin-top mx-auto space-y-8 print:space-y-0 print:p-0 print:m-0 print:transform-none"
            style={{ transform: `scale(${zoom / 100})`, width: '210mm' }}
          >
            {data.gpaeStampUrl && (
              <div id="crm-agreement-page-0" className="print:m-0 print:p-0">
                <div 
                  className="doc-page bg-white relative flex flex-col items-center justify-center p-4 mx-auto shadow-2xl rounded-sm overflow-hidden" 
                  style={{ minHeight: '297mm', height: '297mm', width: '210mm', boxSizing: 'border-box' }}
                >
                  {data.gpaeStampUrl.toLowerCase().includes('.pdf') ? (
                    <iframe 
                      src={data.gpaeStampUrl} 
                      className="w-full h-full border-0 rounded"
                      style={{ minHeight: '275mm', width: '100%' }}
                      title="PM Surya GPAE Stamp" 
                    />
                  ) : (
                    <img 
                      src={data.gpaeStampUrl} 
                      alt="PM Surya GPAE Stamp" 
                      className="w-full h-full object-contain max-h-[280mm]" 
                    />
                  )}
                </div>
              </div>
            )}
            <div id="crm-agreement-page-1" className="print:m-0 print:p-0"><Page1 data={data} fontSizeClass={fontSize} /></div>
            <div id="crm-agreement-page-2" className="print:m-0 print:p-0"><Page2 data={data} fontSizeClass={fontSize} /></div>
            <div id="crm-agreement-page-3" className="print:m-0 print:p-0"><Page3 data={data} fontSizeClass={fontSize} /></div>
            <div id="crm-agreement-page-4" className="print:m-0 print:p-0"><Page4 data={data} fontSizeClass={fontSize} /></div>
          </div>
        </div>
      </div>
    </div>
  );
};
