import React from 'react';
import { Mail } from 'lucide-react';
import { WatersunLogo } from './CompanyLogos';
import { QuotationData } from '../types';

interface DocumentHeaderProps {
  company: QuotationData['company'];
  assets?: QuotationData['assets'];
  onEditLogo?: () => void;
}

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({ company, assets, onEditLogo }) => {
  return (
    <div className="w-full mb-3 select-none">
      <div className="flex items-start justify-between pb-2">
        {/* Left: Company Logo with quick click-to-replace */}
        <div className="flex-shrink-0 relative group">
          <div
            onClick={onEditLogo}
            className={`cursor-pointer transition-opacity ${onEditLogo ? 'hover:opacity-90' : ''}`}
            title="Click to replace Watersun logo with Screenshot 1"
          >
            <WatersunLogo customLogoUrl={assets?.watersunLogoUrl || company.logoUrl} className="h-[75px]" />
          </div>
          {onEditLogo && (
            <button
              type="button"
              onClick={onEditLogo}
              className="print:hidden absolute -bottom-2 left-0 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-300 rounded px-1.5 py-0.5 shadow-2xs flex items-center gap-1 z-10"
            >
              <span>Replace with Screenshot 1</span>
            </button>
          )}
        </div>

        {/* Right: Tax & Contact details (All in clean corporate blue) */}
        <div className="flex flex-col items-end text-right justify-center">
          <div className="text-[14px] text-[#0c3882] tracking-wide leading-tight">
            <span className="font-bold">GST NO :</span> <span className="font-normal text-[#0c3882]">{company.gstNo}</span>
          </div>
          <div className="text-[13.5px] text-[#0c3882] mt-1 tracking-wide leading-tight">
            <span className="font-bold">CIN NO :</span> <span className="font-normal text-[#0c3882]">{company.cinNo}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-[#0c3882] mt-1 leading-tight">
            <Mail className="w-4 h-4 text-[#0c3882]" />
            <span className="text-[#0c3882] font-normal">{company.email}</span>
          </div>
        </div>
      </div>

      {/* Decorative colored divider line */}
      <div className="w-full h-[2.5px] bg-[#1e488f] mt-1" />
    </div>
  );
};
