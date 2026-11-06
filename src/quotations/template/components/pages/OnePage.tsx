import React from 'react';
import { QuotationData, AssetImages } from '../../types';
import { HighlightWrapper } from '../HighlightWrapper';
import { Page2 } from './Page2';

// Terms from page three that the one-page (final) quotation keeps.
const KEY_TERMS = [1, 2, 3, 4, 7, 9, 10];
const ITALIC_REMARKS = new Set(['Customer Scope', 'Included for 5 Years']);

interface OnePageProps {
  data: QuotationData;
  highlightChanges?: boolean;
  changedFields?: Set<string>;
  onEditField?: (fieldKey: string) => void;
  onOpenAssetSlot?: (slot: keyof AssetImages) => void;
}

// A final quotation has one panel option, so the proposal page carries the
// customer block, the key terms, the warranty and the sign-off on one A4 page.
export const OnePage: React.FC<OnePageProps> = (props) => {
  const { data, highlightChanges = false, changedFields = new Set(), onEditField } = props;
  const { page1, page3 } = data;
  const isFieldChanged = (key: string) => changedFields.has(key);
  const terms = KEY_TERMS
    .map((sr) => page3.termsAndConditions.find((item) => item.sr === sr))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const top = (
    <div className="quotation-customer-meta flex justify-between items-start mt-2 mb-1 text-[12px] leading-relaxed">
      <div className="q-customer-info flex flex-col max-w-[60%] break-words" role="group" aria-label="Customer details">
        <span className="font-bold text-gray-900">To,</span>
        <div className="mt-0.5">
          <HighlightWrapper
            isChanged={isFieldChanged('page1.customerName')}
            active={highlightChanges}
            fieldLabel="Customer Name"
            onClick={() => onEditField?.('page1.customerName')}
          >
            <span className="font-normal text-gray-900 tracking-wide uppercase">
              {page1.customerName || 'CUSTOMER NAME'}
            </span>
          </HighlightWrapper>
        </div>
        <div className="q-customer-contact-details">
          <div className="q-customer-phone text-gray-800">
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
        {(page1 as any).address && <p className="break-words">{(page1 as any).address}</p>}
      </div>

      <div className="q-quote-meta flex flex-col items-end text-right">
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
  );

  const bottom = (
    <div className="quotation-one-terms w-full mt-2">
      <div className="flex items-start gap-3">
        <div className="quotation-one-terms-col">
          <table className="quotation-detail-table w-full border-collapse border border-black text-[9px] leading-tight">
            <colgroup><col style={{ width: '7%' }} /><col style={{ width: '58%' }} /><col style={{ width: '35%' }} /></colgroup>
            <thead>
              <tr>
                <th colSpan={3} className="border border-black text-center font-bold">
                  <span className="quotation-section-label">Key Terms</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {terms.map((item, idx) => (
                <tr key={item.sr}>
                  <td className="border border-black text-center">{idx + 1}</td>
                  <td className="border border-black">{item.parameter}</td>
                  <td className={`border border-black ${ITALIC_REMARKS.has(item.remarks) ? 'italic' : ''}`}>{item.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="quotation-one-warranty-col">
          <table className="quotation-detail-table w-full border-collapse border border-black text-[9px] leading-tight">
            <colgroup><col style={{ width: '8%' }} /><col style={{ width: '50%' }} /><col style={{ width: '42%' }} /></colgroup>
            <thead>
              <tr>
                <th colSpan={3} className="border border-black text-center font-bold">
                  <span className="quotation-section-label">Warranty</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {page3.warranties.map((item) => (
                <tr key={item.sr}>
                  <td className="border border-black text-center">{item.sr}</td>
                  <td className="border border-black">{item.parameter}</td>
                  <td className="border border-black whitespace-pre-line">{item.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-end justify-between gap-6 mt-1.5">
        <p className="quotation-one-payment flex-1 min-w-0 text-justify">
          {page3.otherChargesText && <>
            <span className="font-bold">Payment: </span>
            {page3.otherChargesText.replace(/^\*\s*/, '')}
          </>}
        </p>

        <div className="quotation-signoff flex flex-col items-end shrink-0 text-right pr-2">
          <span className="font-bold text-gray-900">Yours Truly</span>
          <div className="mt-0.5">
            <HighlightWrapper
              isChanged={isFieldChanged('page1.yoursTrulyName')}
              active={highlightChanges}
              fieldLabel="Representative Name"
              onClick={() => onEditField?.('page1.yoursTrulyName')}
            >
              <span className="font-normal text-gray-900">{page1.yoursTrulyName || 'Mr. Watersun office'}</span>
            </HighlightWrapper>
          </div>
          <div className="text-gray-900">
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
    </div>
  );

  return <Page2 {...props} pageClass="quotation-page-one" top={top} bottom={bottom} />;
};
