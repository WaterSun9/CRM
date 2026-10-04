import React from 'react';
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
  const publicAssetUrl = (fileName: string) => `${import.meta.env.BASE_URL}${fileName}`;
  const gedaLogoUrl = assets?.gedaLogoUrl || publicAssetUrl('geda.jpg.jpeg');
  const mnreLogoUrl = assets?.mnreLogoUrl || publicAssetUrl('MNRE.png');
  const suryaGharBannerUrl = assets?.suryaGharBannerUrl || publicAssetUrl('BANNER.jpg.jpeg');

  const isFieldChanged = (key: string) => changedFields.has(key);

  return (
    <div className="a4-page quotation-page-1 bg-white shadow-xl print:shadow-none border border-gray-200 print:border-none mx-auto w-[210mm] min-h-[297mm] p-[12mm_15mm] flex flex-col justify-between text-gray-900 text-sm relative box-border overflow-hidden">
      {/* Top Header */}
      <div>
        <DocumentHeader
          company={company}
          assets={assets}
          onEditLogo={() => onOpenAssetSlot?.('watersunLogoUrl')}
        />

        {/* Customer & Quote Meta Section */}
        <div className="quotation-customer-meta flex justify-between items-start mt-3 mb-3 text-[12px] leading-relaxed">
          {/* Customer info */}
          <div className="q-customer-info flex flex-col max-w-[60%] break-words" role="group" aria-label="Customer details">
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
            <div className="q-customer-contact-details">
              <div className="q-customer-phone mt-1 text-[13px] text-gray-800">
                <HighlightWrapper
                  isChanged={isFieldChanged('page1.customerPhone')}
                  active={highlightChanges}
                  fieldLabel="Customer Phone"
                  onClick={() => onEditField?.('page1.customerPhone')}
                >
                  <span className="font-normal tracking-normal">{page1.customerPhone || 'PHONE NUMBER'}</span>
                </HighlightWrapper>
              </div>
            </div>
            {(page1 as any).address && <p className="mt-1 text-[11px] break-words">{(page1 as any).address}</p>}
            {/*
            <div className="mt-1 text-left" style={{ whiteSpace: 'nowrap' }}>
              <table
                className="q-contact-row"
                style={{
                  display: 'inline-table',
                  verticalAlign: 'middle',
                  borderCollapse: 'collapse',
                  border: 'none',
                  margin: 0,
                  padding: 0,
                  width: 'auto',
                  tableLayout: 'auto',
                }}
              >
                <tbody>
                  <tr>
                    <td
                      className="q-contact-icon"
                      style={{ padding: '0 6px 0 0', verticalAlign: 'middle', lineHeight: 0, border: 'none' }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#4b5563"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ display: 'block', margin: 0, padding: 0 }}
                      >
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </td>
                    <td
                      className="q-contact-text"
                      style={{
                        padding: 0,
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                        border: 'none',
                        lineHeight: 1,
                      }}
                    >
                      <HighlightWrapper
                        isChanged={isFieldChanged('page1.customerPhone')}
                        active={highlightChanges}
                        fieldLabel="Customer Phone"
                        onClick={() => onEditField?.('page1.customerPhone')}
                      >
                        <span className="text-[13px] font-normal text-gray-800 tracking-normal" style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
                          {page1.customerPhone || 'PHONE NUMBER'}
                        </span>
                      </HighlightWrapper>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {(page1 as any).address && <p className="mt-1 text-[11px] break-words">{(page1 as any).address}</p>}
            {(page1 as any).email && <p className="text-[11px] break-all">{(page1 as any).email}</p>}
            */}
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
        <div className="quotation-subject my-2.5 text-[13px]">
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
        <div className="quotation-empanelment text-center font-bold text-[14.5px] text-black my-2 tracking-tight">
          Authorized And Empanelment Vendor of Pradhan Mantri Suryoday Yojna &amp; GEDA
        </div>

        {/* Logos & Quote Area (Individual emblems and quote banner) */}
        <div className="my-2">
          {assets?.screenshot2MiddleBannerUrl ? (
            <div className="w-full my-1 rounded overflow-hidden border border-gray-200">
              <img
                src={assets.screenshot2MiddleBannerUrl}
                alt="GEDA, MNRE and PM Surya Ghar Banner"
                className="w-full h-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between px-2 mb-2">
                <GedaEmblem customLogoUrl={gedaLogoUrl} className="h-20" />
                {assets?.mnreLogoUrl ? (
                  <MnreEmblem customLogoUrl={assets.mnreLogoUrl} className="h-20" />
                ) : (
                  <div className="h-20 w-[165px] shrink-0 overflow-hidden" aria-label="Ministry of New and Renewable Energy">
                    <img
                      src={mnreLogoUrl}
                      alt="Ministry of New and Renewable Energy"
                      className="block h-auto w-full max-w-none"
                      style={{ transform: 'translateY(-39px)' }}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>
              <SuryaGharQuoteBanner customLogoUrl={suryaGharBannerUrl} />
            </div>
          )}
        </div>

        {/* Body Paragraphs */}
        <div className="quotation-intro space-y-2.5 text-[11px] leading-[1.65] text-justify text-gray-800 font-normal mt-3">
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
        <div className="quotation-signoff flex flex-col items-end mt-4 text-right pr-2">
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
