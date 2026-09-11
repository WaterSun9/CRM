import React from 'react';
import { TataPowerSolaroofLogo } from './CompanyLogos';
import { QuotationData } from '../types';

interface DocumentFooterProps {
  footer: QuotationData['footer'];
  assets?: QuotationData['assets'];
  onEditLogo?: () => void;
}

export const DocumentFooter: React.FC<DocumentFooterProps> = ({ footer, assets, onEditLogo }) => {
  return (
    <div className="w-full mt-auto pt-3 select-none">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Authorized Partner with quick click-to-replace */}
        <div className="flex flex-col items-start relative group">
          <span className="text-[10.5px] font-bold text-[#0c3882] tracking-tight mb-1">
            Authorized Channel Partner
          </span>
          <div
            onClick={onEditLogo}
            className={`cursor-pointer transition-opacity ${onEditLogo ? 'hover:opacity-90' : ''}`}
            title="Click to replace Tata Solaroof logo with Screenshot 3"
          >
            <TataPowerSolaroofLogo customLogoUrl={assets?.tataSolaroofLogoUrl} className="h-[81px]" />
          </div>
          {onEditLogo && (
            <button
              type="button"
              onClick={onEditLogo}
              className="print:hidden absolute -bottom-2 left-0 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-300 rounded px-1.5 py-0.5 shadow-2xs flex items-center gap-1 z-10"
            >
              <span>Replace with Screenshot 3</span>
            </button>
          )}
        </div>

        {/* Right: Office Address Badge with exact rounded diagonal slant & orange accent matching reference */}
        <div className="relative flex-1 max-w-[510px] min-h-[72px] flex items-center justify-end">
          <svg
            viewBox="0 0 510 74"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          >
            <defs>
              <linearGradient id="footerNavyRef" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#083884" />
                <stop offset="100%" stopColor="#072d6b" />
              </linearGradient>
            </defs>

            {/* Main Deep Navy Blue Body with Rounded Top-Left & Slanted Left Face */}
            {/* Starts bottom-left at (10, 71), slants up-right to (48, 14), rounds smoothly into top horizontal at (66, 3), goes to (510, 3), down to (510, 71), back to (10, 71) */}
            <path
              d="M 12,71 L 46,15 Q 54,3 68,3 L 510,3 L 510,71 L 12,71 Z"
              fill="url(#footerNavyRef)"
            />

            {/* Continuous Orange Contour Border: Top horizontal + Rounded Corner + Diagonal Slanted Left Edge */}
            <path
              d="M 510,3 L 68,3 Q 54,3 46,15 L 12,71"
              stroke="#f39200"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {/* Bottom Orange Border along the base of the blue block */}
            <line
              x1="12"
              y1="71"
              x2="510"
              y2="71"
              stroke="#f39200"
              strokeWidth="3.5"
              strokeLinecap="square"
            />
          </svg>

          {/* Address Text Content matching reference screenshot (pure white text with bold headings) */}
          <div className="relative z-10 py-2.5 px-4 pr-3 pl-16 text-right flex flex-col justify-center min-h-[72px] w-full">
            <div className="flex flex-col gap-1 text-[10.5px] leading-snug font-serif text-white">
              <div>
                <span className="font-bold">Corporate Office:</span>{' '}
                <span className="font-normal">{footer.corporateOffice}</span>
              </div>
              <div>
                <span className="font-bold">Branch Office:</span>{' '}
                <span className="font-normal">{footer.branchOffice}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width bottom orange accent bar connecting the entire footer */}
      <div className="w-full h-[3.5px] bg-[#f39200] mt-1 rounded-full" />
    </div>
  );
};
