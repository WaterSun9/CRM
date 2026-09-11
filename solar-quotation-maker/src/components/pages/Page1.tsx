import React from 'react';
import { Phone } from 'lucide-react';
import { QuotationData, AssetImages } from '../../types';
import { DocumentHeader } from '../DocumentHeader';
import { DocumentFooter } from '../DocumentFooter';
import { GedaEmblem, MnreEmblem, SuryaGharQuoteBanner } from '../CompanyLogos';
import { HighlightWrapper } from '../HighlightWrapper';

interface Page1Props {
  data: QuotationData;
  highlightChanges?: boolean;
  changedFields?: Set<string>;
  onEditField?: (fieldKey: string) => void;
  onOpenAssetSlot?: (slot: keyof AssetImages) => void;
}

export const Page1: React.FC<Page1Props> = ({
  data,
  highlightChanges = false,
  changedFields = new Set(),
  onEditField,
  onOpenAssetSlot,
}) => {
  const { company, page1, footer, assets } = data;

  const isFieldChanged = (key: string) => changedFields.has(key);

  return (
    <div className="a4-page bg-white shadow-xl print:shadow-none border border-gray-200 print:border-none mx-auto w-[210mm] min-h-[297mm] p-[12mm_15mm] flex flex-col justify-between text-gray-900 text-sm relative box-border overflow-hidden">
      {/* Top Header */}
      <div>
        <DocumentHeader
          company={company}
          assets={assets}
          onEditLogo={() => onOpenAssetSlot?.('watersunLogoUrl')}
        />

        {/* Customer & Quote Meta Section */}
        <div className="flex justify-between items-start mt-3 mb-3 text-[12px] leading-relaxed">
          {/* Customer info */}
          <div className="flex flex-col">
            <span className="font-bold text-gray-900">To,</span>
            <div className="mt-0.5">
              <HighlightWrapper
                isChanged={isFieldChanged('page1.customerName')}
                active={highlightChanges}
                fieldLabel="Customer Name"
                onClick={() => onEditField?.('page1.customerName')}
              >
                <span className="font-normal text-gray-900 tracking-wide uppercase text-[13px]">
                  {page1.customerName || 'CUSTOMER NAME'}
                </span>
              </HighlightWrapper>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-gray-800">
              <Phone className="w-3.5 h-3.5 text-gray-700 stroke-[2.2]" />
              <HighlightWrapper
                isChanged={isFieldChanged('page1.customerPhone')}
                active={highlightChanges}
                fieldLabel="Customer Phone"
                onClick={() => onEditField?.('page1.customerPhone')}
              >
                <span className="font-normal">{page1.customerPhone || 'PHONE NUMBER'}</span>
              </HighlightWrapper>
            </div>
          </div>

          {/* Quote info */}
          <div className="flex flex-col items-end text-right">
            <div className="flex gap-2">
              <span className="font-bold text-gray-900">Quotation NO :</span>
              <HighlightWrapper
                isChanged={isFieldChanged('page1.quotationNo')}
                active={highlightChanges}
                fieldLabel="Quotation Number"
                onClick={() => onEditField?.('page1.quotationNo')}
              >
                <span className="font-normal text-gray-800">{page1.quotationNo || 'Quote-0000'}</span>
              </HighlightWrapper>
            </div>
            <div className="flex gap-2 mt-0.5">
              <span className="font-bold text-gray-900">Date :</span>
              <HighlightWrapper
                isChanged={isFieldChanged('page1.date')}
                active={highlightChanges}
                fieldLabel="Quotation Date"
                onClick={() => onEditField?.('page1.date')}
              >
                <span className="font-normal text-gray-800">{page1.date}</span>
              </HighlightWrapper>
            </div>
          </div>
        </div>

        {/* Subject */}
        <div className="my-2.5 text-[13px]">
          <span className="font-bold text-gray-900">Subject: </span>
          <HighlightWrapper
            isChanged={isFieldChanged('page1.capacityKw')}
            active={highlightChanges}
            fieldLabel="Capacity (kW)"
            onClick={() => onEditField?.('page1.capacityKw')}
          >
            <span className="font-normal text-gray-800">
              {page1.capacityKw.toLowerCase().includes('kw') ? page1.capacityKw : `${page1.capacityKw} kw`}
            </span>
          </HighlightWrapper>
        </div>

        {/* Empanelment Tagline (Increased 10% and solid black) */}
        <div className="text-center font-bold text-[14.5px] text-black my-2 tracking-tight">
          Authorized And Empanelment Vendor of Pradhan Mantri Suryoday Yojna &amp; GEDA
        </div>

        {/* Logos & Quote Area (Screenshot 2 or individual emblems) */}
        <div className="my-2 relative group">
          {assets?.screenshot2MiddleBannerUrl ? (
            <div
              onClick={() => onOpenAssetSlot?.('screenshot2MiddleBannerUrl')}
              className="w-full my-1 rounded overflow-hidden border border-gray-200 shadow-2xs cursor-pointer hover:opacity-95 transition-opacity"
              title="Click to replace Screenshot 2"
            >
              <img
                src={assets.screenshot2MiddleBannerUrl}
                alt="GEDA, MNRE and PM Surya Ghar Banner (Screenshot 2)"
                className="w-full h-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div
              onClick={() => onOpenAssetSlot?.('screenshot2MiddleBannerUrl')}
              className="cursor-pointer hover:opacity-95 transition-opacity"
              title="Click to replace with your Screenshot 2 file"
            >
              <div className="flex items-center justify-between px-2 mb-1.5">
                <GedaEmblem customLogoUrl={assets?.gedaLogoUrl} className="h-11" />
                <MnreEmblem customLogoUrl={assets?.mnreLogoUrl} className="h-11" />
              </div>
              <SuryaGharQuoteBanner customLogoUrl={assets?.suryaGharBannerUrl} />
            </div>
          )}
          {onOpenAssetSlot && (
            <button
              type="button"
              onClick={() => onOpenAssetSlot('screenshot2MiddleBannerUrl')}
              className="print:hidden absolute -top-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-sky-800 bg-sky-100/95 border border-sky-300 rounded px-2 py-0.5 shadow-2xs flex items-center gap-1 z-10"
            >
              <span>Replace with Screenshot 2</span>
            </button>
          )}
        </div>

        {/* Body Paragraphs */}
        <div className="space-y-2.5 text-[11px] leading-[1.65] text-justify text-gray-800 font-normal mt-3">
          <p>
            {page1.introParagraph1 ||
              'We, Watersun Electrical Solutions Pvt Ltd (WESPL), are a reputed supplier of Solar PV modules, solar water Pumping Systems, Solar Inverter and have vast experience of over 10 years in the field of Solar PV. WESPL provides turnkey solutions and single window support for industrial & commercial Solar Rooftop Power plants for captive consumption and ground-mounted MW scale projects including Design, Engineering, Manufacturing, Procurement, Installation, Testing, Commissioning, O&M, Monitoring, and Training.'}
          </p>
          <p>
            {page1.introParagraph2 ||
              'WESPL has installed more than 20 MW solar power plants with plant capacity from 3 KW to 500 KW. Each single project has been running successfully for many years with generation performance more than 17% PLF.'}
          </p>
          <p>
            We hope this is in line with your requirements. Please feel free to contact us for any further details and information as required.
          </p>
          <p>
            We look forward to your acknowledgment and favorable consideration for the offer submitted.
          </p>
        </div>

        {/* Yours Truly Sign-off */}
        <div className="flex flex-col items-end mt-4 text-right pr-2">
          <span className="font-bold text-gray-900 text-[12.5px]">Yours Truly</span>
          <div className="mt-1">
            <HighlightWrapper
              isChanged={isFieldChanged('page1.yoursTrulyName')}
              active={highlightChanges}
              fieldLabel="Representative Name"
              onClick={() => onEditField?.('page1.yoursTrulyName')}
            >
              <span className="font-normal text-gray-900 text-[13px]">
                {page1.yoursTrulyName || 'Mr. Watersun office'}
              </span>
            </HighlightWrapper>
          </div>
          <div className="mt-0.5 text-[12px] text-gray-900">
            <span className="font-bold">Phone No: </span>
            <HighlightWrapper
              isChanged={isFieldChanged('page1.yoursTrulyPhone')}
              active={highlightChanges}
              fieldLabel="Representative Phone"
              onClick={() => onEditField?.('page1.yoursTrulyPhone')}
            >
              <span className="font-normal text-gray-800">{page1.yoursTrulyPhone || '+91 70165 89864'}</span>
            </HighlightWrapper>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <DocumentFooter
        footer={footer}
        assets={assets}
        onEditLogo={() => onOpenAssetSlot?.('tataSolaroofLogoUrl')}
      />
    </div>
  );
};
