import React from 'react';
import { ClientReportData, VendorSettings } from '../types';

interface DocumentPreviewProps {
  client: ClientReportData;
  vendor: VendorSettings;
  showHighlights: boolean;
  totalPageCount?: number;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  client,
  vendor,
  showHighlights,
  totalPageCount = 3,
}) => {
  const highlightClass = showHighlights
    ? 'bg-[#fef08a] px-1 py-0.5 rounded-xs font-semibold text-black inline-block transition-colors print:bg-transparent print:p-0 print:rounded-none'
    : 'font-semibold text-black';

  return (
    <div id="full-document-preview" className="doc-font text-black selection:bg-yellow-200">
      {/* ================= PAGE 1 ================= */}
      <div className="printable-page bg-white shadow-xl rounded-sm mx-auto mb-10 w-full max-w-[794px] min-h-[1123px] p-10 md:p-14 text-[14.5px] md:text-[15.5px] leading-[1.85] flex flex-col justify-between border border-slate-200 print:border-none print:shadow-none print:mb-0 print:p-8">
        <div>
          {/* Header Title */}
          <div className="text-center mb-8">
            <h1 className="text-[19px] md:text-[21px] font-bold underline underline-offset-4 tracking-tight text-black">
              Residential Roof Top Solar Installation Vendor
            </h1>
            <h2 className="text-[16.5px] md:text-[17.5px] font-bold underline underline-offset-4 mt-1.5 text-black">
              Feasibility Report Format
            </h2>
          </div>

          {/* Numbered Items - increased spacing by 20% */}
          <div className="space-y-3.5 text-black">
            {/* 1 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">1. Name of the Consumer:</span>
              <span className={highlightClass}>
                {client.consumerName || '__________________________'}
              </span>
            </div>

            {/* 2 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">2. Discom Consumer ID:</span>
              <span className={highlightClass}>
                {client.discomConsumerId || '____________________'}
              </span>
            </div>

            {/* 3 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">3. Discom ID:</span>
              <span className="font-medium text-black">
                {client.discomId || ''}
              </span>
            </div>

            {/* 4 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">4. PM Surya Shakti Portal ID:</span>
              <span className={highlightClass}>
                {client.pmSuryaShaktiPortalId || '____________________'}
              </span>
            </div>

            {/* 5 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">5. Jan Samarth ID:</span>
              <span className={highlightClass}>
                {client.janSamarthId || '____________________'}
              </span>
            </div>

            {/* 6 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">6. Address for Installation:</span>
              <span className={highlightClass}>
                {client.installationAddress || '__________________________________'}
              </span>
            </div>

            {/* 7 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">7. District of Installation:</span>
              <span className={highlightClass}>
                {client.district || '_____________'}
              </span>
            </div>

            {/* 8 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">8. State of Installation:</span>
              <span className={highlightClass}>
                {client.state || '_____________'}
              </span>
            </div>

            {/* 9 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">9. Pin Code of Installation:</span>
              <span className={highlightClass}>
                {client.pincode || '______'}
              </span>
            </div>

            {/* 10 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">10.OEM Name:</span>
              <span className="font-medium text-black">{client.oemName || ''}</span>
            </div>

            {/* 11 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">11.Channel Partner, if any:</span>
              <span className="font-medium text-black">{client.channelPartner || ''}</span>
            </div>

            {/* 12 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">12.EPC Contractor Address:</span>
              <span className="font-medium text-black">{vendor.epcContractorAddress}</span>
            </div>

            {/* 13 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">13.EPC -</span>
              <span className="font-medium text-black">{vendor.epcCode}</span>
            </div>

            {/* 14 (Bank Details) */}
            <div className="pt-1">
              <div className="font-normal text-black mb-1.5">14.EPC Contractor Bank Details :</div>
              <div className="flex flex-wrap items-center gap-2 pl-4">
                <span className="font-normal text-black">A/c No :-</span>
                <span className="border border-black px-3 py-1 font-bold font-mono text-[14px] md:text-[15px] tracking-wider bg-white">
                  {vendor.bankAccountNo}
                </span>
                <span className="font-normal text-black ml-3">IFSC CODE :-</span>
                <span className="border border-black px-3 py-1 font-bold font-mono text-[14px] md:text-[15px] tracking-wider bg-white">
                  {vendor.bankIfsc}
                </span>
              </div>
            </div>

            {/* 14 duplicate (in original template) */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">14. RTS Capacity in KW Applied:</span>
              <span className="font-medium text-black">{client.rtsCapacityAppliedKw || ''}</span>
            </div>

            {/* 15 */}
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-normal text-black">15.Actual RTS Capacity to be installed:</span>
              <span className={highlightClass}>
                {client.actualCapacityKw || '____'}
              </span>
            </div>

            {/* 16 */}
            <div className="pt-0.5">
              <div className="flex items-center gap-2">
                <span className="font-normal text-black">16. Is the vendor registered in MNRE Portal:</span>
                <span className="font-semibold text-black inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span className={client.isVendorRegisteredMnre ? 'underline font-bold text-black' : 'text-slate-700'}>
                      Yes
                    </span>
                    {client.isVendorRegisteredMnre && (
                      <span className="font-bold text-black text-sm">✓</span>
                    )}
                  </span>
                  <span>/</span>
                  <span className="inline-flex items-center gap-1">
                    <span className={!client.isVendorRegisteredMnre ? 'underline font-bold text-black' : 'text-slate-700'}>
                      No
                    </span>
                    {!client.isVendorRegisteredMnre && (
                      <span className="font-bold text-black text-sm">✓</span>
                    )}
                  </span>
                </span>
              </div>
              <div className="text-[13px] font-bold text-black mt-1">
                (Note: Only vendors registered in MNRE portal will be allowed)
              </div>
            </div>

            {/* 17 */}
            <div className="pt-1.5">
              <span className="font-normal text-black block mb-1.5">17.Feasibility Report Status:</span>
              <div className="flex items-center gap-8 pl-4">
                <div className="flex items-center gap-2 cursor-default">
                  <span className="w-5 h-5 border-2 border-black inline-flex items-center justify-center font-bold text-sm bg-white text-black shrink-0">
                    {client.feasibilityStatus === 'feasible' ? (
                      <svg
                        className="w-3.5 h-3.5 text-black stroke-[3]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="font-medium text-black">Feasible</span>
                </div>
                <div className="flex items-center gap-2 cursor-default">
                  <span className="w-5 h-5 border-2 border-black inline-flex items-center justify-center font-bold text-sm bg-white text-black shrink-0">
                    {client.feasibilityStatus === 'not_feasible' ? (
                      <svg
                        className="w-3.5 h-3.5 text-black stroke-[3]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="font-medium text-black">Not Feasible</span>
                </div>
              </div>
            </div>

            {/* 18 */}
            <div className="flex flex-wrap items-baseline gap-1.5 pt-1">
              <span className="font-normal text-black">18. Project Cost (All inclusive) :</span>
              <span className={highlightClass}>
                {client.projectCost
                  ? (/^Rs\.?/i.test(client.projectCost.trim())
                      ? client.projectCost.trim()
                      : `Rs. ${client.projectCost.replace(/^[₹¹\s]+/, '').trim()}`)
                  : '__________'}
              </span>
            </div>

            {/* 19 */}
            <div className="flex flex-wrap items-baseline gap-1.5 pt-1">
              <span className="font-normal text-black">19 : Site Layout – Images (2-4 Images to be uploaded) :</span>
            </div>
          </div>
        </div>

        {/* Footer & Signatory of Page 1 */}
        <div className="mt-10 pt-4">
          <div className="text-right">
            {vendor.stampImage && (
              <div className="flex justify-end mb-2">
                <img
                  src={vendor.stampImage}
                  alt="Vendor Stamp"
                  className="h-16 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            <p className="font-bold text-[14.5px] md:text-[15.5px] text-black">
              {vendor.signatoryText || 'Authorised Signatory of the vender with Stamp'}
            </p>
          </div>

          <div className="text-right text-[12px] text-slate-600 mt-6 font-normal">
            Page 1 of {totalPageCount}
          </div>
        </div>
      </div>

      {/* ================= PAGE 2 ================= */}
      <div className="printable-page bg-white shadow-xl rounded-sm mx-auto mb-10 w-full max-w-[794px] min-h-[1123px] p-10 md:p-14 text-[14.5px] md:text-[15.5px] leading-[1.85] flex flex-col justify-between border border-slate-200 print:border-none print:shadow-none print:mb-0 print:p-8">
        <div>
          {/* Vendor Name Header Box */}
          <div className="border border-black p-4 mb-9 bg-white">
            <span className="font-bold text-black text-[15.5px] md:text-[16.5px]">
              Name of the Vender : {vendor.vendorName}
            </span>
          </div>

          {/* Terms & Clauses - increased vertical spacing by 20% */}
          <div className="space-y-6 text-black text-justify">
            <div>
              <p className="font-normal text-black mb-1.5">
                (a) Disbursement of Loan and payment of Margin up to installation of SRT [Capacity - up to 3 KW].
              </p>
              <p className="pl-5 text-black">
                -70% of the total project cost [i.e., 60% of the project cost (loan) and Borrower&apos;s Margin contribution (10%)]
              </p>
            </div>

            <div>
              <p className="font-normal text-black mb-1.5">
                (b) Disbursement of Loans and payment of Margin up to installation of SRT [Capacity - more than 3 KW & up to 10 KW]
              </p>
              <p className="pl-5 text-black">
                70% of the total project cost (50% of the project cost (loan) and Borrower&apos;s Margin)
              </p>
            </div>

            <div>
              <p className="font-normal text-black">
                2. I further understand that the installation of the SRT is the sole responsibility of the Vendor. The Vendor is expected to install the SRT within 45 days from the date of disbursement. However, Bank will not be liable for any delayed installation, faulty installation/equipment, OR non-installation of the Solar Roof Top by the Vendor.
              </p>
            </div>

            <div>
              <p className="font-normal text-black">
                3. I also understand that interest in the loan account will start to accrue from the date of disbursement of loan and my obligation to repay the loan EMI along with interest, as and when due, will exist, irrespective of the installation of the Solar Roof top equipment.
              </p>
            </div>
          </div>
        </div>

        {/* Signature & Borrower Details Box on Page 2 */}
        <div className="mt-10 space-y-6">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-black">SignatureDate:</span>
            <span className="font-semibold text-black underline underline-offset-2">
              {client.signatureDate || new Date().toLocaleDateString('en-GB')}
            </span>
          </div>

          <div>
            <div className="font-normal text-black mb-1.5">Name of the Borrower :</div>
            <div className="border border-black p-3.5 min-h-[52px] bg-white flex items-center">
              <span className={highlightClass}>
                {client.consumerName || '_________________________________'}
              </span>
            </div>
          </div>

          <div>
            <div className="font-normal text-black mb-1.5">Address :</div>
            <div className="border border-black p-3.5 min-h-[86px] bg-white text-black">
              <span className={highlightClass}>
                {client.installationAddress ? (
                  <>
                    {client.installationAddress}, {client.district}, {client.state} - {client.pincode}
                  </>
                ) : (
                  '____________________________________________________________________'
                )}
              </span>
            </div>
          </div>

          <div className="text-right text-[12px] text-slate-600 pt-4 font-normal">
            Page 2 of {totalPageCount}
          </div>
        </div>
      </div>

      {/* ================= PAGE 3 ================= */}
      <div className="printable-page bg-white shadow-xl rounded-sm mx-auto mb-10 w-full max-w-[794px] min-h-[1123px] p-10 md:p-14 text-[14.5px] md:text-[15.5px] leading-[1.85] flex flex-col justify-between border border-slate-200 print:border-none print:shadow-none print:mb-0 print:p-8">
        <div>
          {/* Header Title */}
          <div className="mb-6">
            <h2 className="text-[19px] md:text-[21px] font-bold underline underline-offset-4 text-black">
              Site Photos :
            </h2>
          </div>
          {/* Main page area left completely empty as requested */}
        </div>

        {/* Footer Page 3 */}
        <div className="mt-14 pt-4">
          <div className="flex justify-between items-end">
            <div className="text-[13px] text-slate-600">
              <span className="font-semibold">EPC Code:</span> {vendor.epcCode}
            </div>
            <div className="text-right">
              <p className="font-bold text-[14.5px] md:text-[15.5px] text-black">
                {vendor.signatoryText || 'Authorised Signatory of the vender with Stamp'}
              </p>
            </div>
          </div>
          <div className="text-right text-[12px] text-slate-600 mt-6 font-normal">
            Page 3 of {totalPageCount}
          </div>
        </div>
      </div>
    </div>
  );
};
