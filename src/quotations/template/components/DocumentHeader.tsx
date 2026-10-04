import React from 'react';
import { WatersunLogo } from './CompanyLogos';
import { QuotationData } from '../types';
import referenceHeader from '../../../assets/quotation-reference-header.jpg?inline';
import standardLogo from '../../../assets/watersun-logo-blue.png?inline';

interface DocumentHeaderProps {
  company: QuotationData['company'];
  assets?: QuotationData['assets'];
  onEditLogo?: () => void;
}

// The client's reference quotation uses one header picture (logo, GST/CIN,
// email with envelope icon, rule). When the company details are the standard
// Watersun ones, use that exact picture so the header matches it 1:1, the same
// way DocumentFooter uses the reference footer.
const REFERENCE_COMPANY = {
  gstNo: '24AACCW4587D1ZA',
  cinNo: 'U31900GJ2019PTC108876',
  email: 'watersunelectrical@gmail.com',
};

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({ company, assets }) => {
  const logo = assets?.watersunLogoUrl || company.logoUrl;
  const matchesReference = (!logo || logo === standardLogo)
    && company.gstNo === REFERENCE_COMPANY.gstNo
    && company.cinNo === REFERENCE_COMPANY.cinNo
    && company.email === REFERENCE_COMPANY.email;
  if (matchesReference) {
    return (
      <>
        <img
          src={referenceHeader}
          alt={`Watersun Solar Energy. GST NO: ${company.gstNo}. CIN NO: ${company.cinNo}. ${company.email}`}
          className="quotation-reference-header"
        />
        <div className="quotation-reference-header-spacer" aria-hidden="true" />
      </>
    );
  }
  return (
  <div className="q-document-header w-full mb-3 select-none">
    <div className="q-document-header-row">
      <div className="q-document-logo">
        <WatersunLogo customLogoUrl={assets?.watersunLogoUrl || company.logoUrl} className="h-[75px]" />
      </div>

      <div className="q-company-details" role="group" aria-label="Company details">
        <div className="q-company-id text-[14px] text-[#0c3882] tracking-wide leading-tight">
          <span className="font-bold">GST NO :</span>{' '}
          <span className="font-normal text-[#0c3882]">{company.gstNo}</span>
        </div>
        <div className="q-company-id text-[13.5px] text-[#0c3882] mt-1 tracking-wide leading-tight">
          <span className="font-bold">CIN NO :</span>{' '}
          <span className="font-normal text-[#0c3882]">{company.cinNo}</span>
        </div>
        <div className="q-company-id text-[13.5px] text-[#0c3882] mt-1 tracking-wide leading-tight">
          <span className="font-bold">Mail :</span>{' '}
          <span className="font-normal text-[#0c3882]">{company.email}</span>
        </div>
      </div>
    </div>

    <div className="w-full h-[2.5px] bg-[#1e488f] mt-1" />
  </div>
);
};
