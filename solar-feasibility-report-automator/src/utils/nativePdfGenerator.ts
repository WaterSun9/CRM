import jsPDF from 'jspdf';
import { ClientReportData, VendorSettings } from '../types';

export interface PdfExportResult {
  saved: boolean;
  cancelled?: boolean;
  method?: 'picker' | 'download';
  blobUrl?: string;
}

/**
 * Generates an official 3-page Solar Feasibility Report PDF natively using vector commands.
 * Extremely fast, clean official formatting, guaranteed never to crash.
 */
export async function generateNativePdf(
  client: ClientReportData,
  vendor: VendorSettings,
  options: {
    showHighlights?: boolean;
    fileName?: string;
    chooseSaveLocation?: boolean;
  } = {}
): Promise<PdfExportResult> {
  // By default: no highlights for official bank/Discom submission
  const showHighlights = options.showHighlights ?? false;
  const chooseSaveLocation = options.chooseSaveLocation ?? false;
  const fileName = options.fileName || `Feasibility_Report_${(client.consumerName || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  // Standard A4: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const leftMargin = 20;
  const rightMargin = 20;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 170mm

  // Helper for drawing highlighted or plain text
  const drawFieldWithHighlight = (
    label: string,
    value: string,
    x: number,
    y: number,
    isHighlighted: boolean = false
  ): number => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text(label, x, y);

    const labelWidth = doc.getTextWidth(label);
    const valueX = x + labelWidth + 1.5;
    const displayValue = value || '__________________________';

    doc.setFont('helvetica', 'bold');
    const valueWidth = doc.getTextWidth(displayValue);

    if (showHighlights && isHighlighted) {
      // Yellow highlight background
      doc.setFillColor(254, 240, 138); // Soft yellow #fef08a
      doc.rect(valueX - 0.8, y - 3.8, valueWidth + 1.6, 5, 'F');
    }

    doc.text(displayValue, valueX, y);
    doc.setFont('helvetica', 'normal');

    return y;
  };

  // Helper for drawing crisp vector checkmark (✓ / tick)
  const drawVectorCheckmark = (x: number, y: number, width: number = 3.4, height: number = 3.4) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.7);
    const startX = x + width * 0.15;
    const startY = y + height * 0.55;
    const midX = x + width * 0.45;
    const midY = y + height * 0.92;
    const endX = x + width * 0.95;
    const endY = y + height * 0.15;
    doc.line(startX, startY, midX, midY);
    doc.line(midX, midY, endX, endY);
  };

  // ==========================================
  // PAGE 1: Feasibility Report Format
  // ==========================================
  let curY = 20;

  // Title Headers (Centered & Underlined) - increased font by 10%
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text('Residential Roof Top Solar Installation Vendor', pageWidth / 2, curY, { align: 'center' });
  const title1Width = doc.getTextWidth('Residential Roof Top Solar Installation Vendor');
  doc.setLineWidth(0.3);
  doc.line((pageWidth - title1Width) / 2, curY + 1.2, (pageWidth + title1Width) / 2, curY + 1.2);

  curY += 8;
  doc.setFontSize(13.2);
  doc.text('Feasibility Report Format', pageWidth / 2, curY, { align: 'center' });
  const title2Width = doc.getTextWidth('Feasibility Report Format');
  doc.line((pageWidth - title2Width) / 2, curY + 1.2, (pageWidth + title2Width) / 2, curY + 1.2);

  curY += 13;
  // Increased line gap by 20% (from 7.2mm to 8.64mm)
  const lineGap = 8.64;

  // Base font size increased by 10% (from 10.5 to 11.55)
  doc.setFontSize(11.55);

  // 1. Name of the Consumer
  drawFieldWithHighlight('1. Name of the Consumer: ', client.consumerName, leftMargin, curY, true);
  curY += lineGap;

  // 2. Discom Consumer ID
  drawFieldWithHighlight('2. Discom Consumer ID: ', client.discomConsumerId, leftMargin, curY, true);
  curY += lineGap;

  // 3. Discom ID
  drawFieldWithHighlight('3. Discom ID: ', client.discomId || '', leftMargin, curY, false);
  curY += lineGap;

  // 4. PM Surya Shakti Portal ID
  drawFieldWithHighlight('4. PM Surya Shakti Portal ID: ', client.pmSuryaShaktiPortalId, leftMargin, curY, true);
  curY += lineGap;

  // 5. Jan Samarth ID
  drawFieldWithHighlight('5. Jan Samarth ID: ', client.janSamarthId, leftMargin, curY, true);
  curY += lineGap;

  // 6. Address for Installation
  drawFieldWithHighlight('6. Address for Installation: ', client.installationAddress, leftMargin, curY, true);
  curY += lineGap;

  // 7. District of Installation
  drawFieldWithHighlight('7. District of Installation: ', client.district, leftMargin, curY, true);
  curY += lineGap;

  // 8. State of Installation
  drawFieldWithHighlight('8. State of Installation: ', client.state, leftMargin, curY, true);
  curY += lineGap;

  // 9. Pin Code of Installation
  drawFieldWithHighlight('9. Pin Code of Installation: ', client.pincode, leftMargin, curY, true);
  curY += lineGap;

  // 10. OEM Name
  drawFieldWithHighlight('10. OEM Name: ', client.oemName || '', leftMargin, curY, false);
  curY += lineGap;

  // 11. Channel Partner, if any
  drawFieldWithHighlight('11. Channel Partner, if any: ', client.channelPartner || '', leftMargin, curY, false);
  curY += lineGap;

  // 12. EPC Contractor Address
  drawFieldWithHighlight('12. EPC Contractor Address: ', vendor.epcContractorAddress, leftMargin, curY, false);
  curY += lineGap;

  // 13. EPC
  drawFieldWithHighlight('13. EPC - ', vendor.epcCode, leftMargin, curY, false);
  curY += lineGap;

  // 14. Bank Details
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.55);
  doc.text('14. EPC Contractor Bank Details :', leftMargin, curY);
  curY += 6.5;

  // Account No Box & IFSC Box
  const bankX = leftMargin + 6;
  doc.text('A/c No :-', bankX, curY);
  const acLabelW = doc.getTextWidth('A/c No :-');

  const acBoxX = bankX + acLabelW + 2.5;
  const acBoxW = 46;
  doc.setDrawColor(0, 0, 0);
  doc.rect(acBoxX, curY - 4.5, acBoxW, 6.2);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(vendor.bankAccountNo, acBoxX + 2.5, curY);

  const ifscLabelX = acBoxX + acBoxW + 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.55);
  doc.text('IFSC CODE :-', ifscLabelX, curY);
  const ifscLabelW = doc.getTextWidth('IFSC CODE :-');

  const ifscBoxX = ifscLabelX + ifscLabelW + 2.5;
  const ifscBoxW = 44;
  doc.rect(ifscBoxX, curY - 4.5, ifscBoxW, 6.2);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(vendor.bankIfsc, ifscBoxX + 2.5, curY);

  curY += 8.5;

  // 14 (duplicate in original): RTS Capacity Applied
  drawFieldWithHighlight('14. RTS Capacity in KW Applied: ', client.rtsCapacityAppliedKw || '', leftMargin, curY, false);
  curY += lineGap;

  // 15. Actual RTS Capacity to be installed
  drawFieldWithHighlight('15. Actual RTS Capacity to be installed: ', client.actualCapacityKw, leftMargin, curY, true);
  curY += lineGap;

  // 16. MNRE Registration
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.55);
  doc.text('16. Is the vendor registered in MNRE Portal: ', leftMargin, curY);
  const mnreLabelW = doc.getTextWidth('16. Is the vendor registered in MNRE Portal: ');
  doc.setFont('helvetica', 'bold');
  if (client.isVendorRegisteredMnre) {
    const yesStart = leftMargin + mnreLabelW;
    doc.text('Yes', yesStart, curY);
    const yesW = doc.getTextWidth('Yes');
    doc.line(yesStart, curY + 0.8, yesStart + yesW, curY + 0.8);
    // Draw tick next to Yes
    drawVectorCheckmark(yesStart + yesW + 1.2, curY - 3.2, 2.8, 2.8);
    doc.setFont('helvetica', 'normal');
    doc.text(' / No', yesStart + yesW + 5.5, curY);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('Yes / ', leftMargin + mnreLabelW, curY);
    const noStart = leftMargin + mnreLabelW + doc.getTextWidth('Yes / ');
    doc.setFont('helvetica', 'bold');
    doc.text('No', noStart, curY);
    const noW = doc.getTextWidth('No');
    doc.line(noStart, curY + 0.8, noStart + noW, curY + 0.8);
    // Draw tick next to No
    drawVectorCheckmark(noStart + noW + 1.2, curY - 3.2, 2.8, 2.8);
  }

  curY += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('(Note: Only vendors registered in MNRE portal will be allowed)', leftMargin, curY);
  curY += 7.5;

  // 17. Feasibility Report Status
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.55);
  doc.text('17. Feasibility Report Status:', leftMargin, curY);
  curY += 6;

  // Checkboxes
  const isFeasible = client.feasibilityStatus === 'feasible';
  const checkX1 = leftMargin + 10;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(checkX1, curY - 3.8, 4.4, 4.4);
  if (isFeasible) {
    drawVectorCheckmark(checkX1 + 0.5, curY - 3.4, 3.4, 3.4);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.55);
  doc.text('Feasible', checkX1 + 7, curY);

  const checkX2 = checkX1 + 38;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(checkX2, curY - 3.8, 4.4, 4.4);
  if (!isFeasible) {
    drawVectorCheckmark(checkX2 + 0.5, curY - 3.4, 3.4, 3.4);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.55);
  doc.text('Not Feasible', checkX2 + 7, curY);

  curY += 8.5;

  // 18. Project Cost
  let costDisplay = '';
  if (client.projectCost) {
    const rawCost = client.projectCost.replace(/^[₹¹\s]+/, '').trim();
    if (rawCost) {
      costDisplay = /^Rs\.?/i.test(rawCost) ? rawCost : `Rs. ${rawCost}`;
    }
  }
  drawFieldWithHighlight(
    '18. Project Cost (All inclusive) :',
    costDisplay,
    leftMargin,
    curY,
    true
  );
  curY += lineGap;

  // 19. Site Layout
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.55);
  doc.text('19 : Site Layout – Images (2-4 Images to be uploaded) :', leftMargin, curY);

  // Authorised Signatory bottom right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.55);
  doc.text(vendor.signatoryText || 'Authorised Signatory of the vender with Stamp', pageWidth - rightMargin, 266, {
    align: 'right',
  });

  // Page 1 footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(90, 90, 90);
  doc.text('Page 1 of 3', pageWidth - rightMargin, 285, { align: 'right' });

  // ==========================================
  // PAGE 2: Borrower Undertaking & Terms
  // ==========================================
  doc.addPage();
  curY = 24;

  // Vendor Name Border Box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(leftMargin, curY, contentWidth, 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Name of the Vender : ${vendor.vendorName}`, leftMargin + 4, curY + 8);

  curY += 22;

  // Paragraphs - increased font by 10% (11pt) and spacing by 20%
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  // (a)
  doc.text('(a) Disbursement of Loan and payment of Margin up to installation of SRT [Capacity - up to 3 KW].', leftMargin, curY);
  curY += 6.6;
  const pA = '-70% of the total project cost [i.e., 60% of the project cost (loan) and Borrower\'s Margin contribution (10%)]';
  doc.text(pA, leftMargin + 6, curY);
  curY += 11;

  // (b)
  doc.text('(b) Disbursement of Loans and payment of Margin up to installation of SRT [Capacity - more than 3 KW & up to 10 KW]', leftMargin, curY);
  curY += 6.6;
  const pB = '70% of the total project cost (50% of the project cost (loan) and Borrower\'s Margin)';
  doc.text(pB, leftMargin + 6, curY);
  curY += 12;

  // 2.
  const p2 = '2. I further understand that the installation of the SRT is the sole responsibility of the Vendor. The Vendor is expected to install the SRT within 45 days from the date of disbursement. However, Bank will not be liable for any delayed installation, faulty installation/equipment, OR non-installation of the Solar Roof Top by the Vendor.';
  const p2Lines = doc.splitTextToSize(p2, contentWidth);
  doc.text(p2Lines, leftMargin, curY);
  curY += p2Lines.length * 6 + 7;

  // 3.
  const p3 = '3. I also understand that interest in the loan account will start to accrue from the date of disbursement of loan and my obligation to repay the loan EMI along with interest, as and when due, will exist, irrespective of the installation of the Solar Roof top equipment.';
  const p3Lines = doc.splitTextToSize(p3, contentWidth);
  doc.text(p3Lines, leftMargin, curY);
  curY += p3Lines.length * 6 + 14;

  // SignatureDate
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.55);
  doc.text('SignatureDate:', leftMargin, curY);
  const sigDateX = leftMargin + doc.getTextWidth('SignatureDate:') + 3;
  const dateStr = client.signatureDate || new Date().toLocaleDateString('en-GB');
  doc.text(dateStr, sigDateX, curY);
  doc.setLineWidth(0.2);
  doc.line(sigDateX, curY + 0.8, sigDateX + doc.getTextWidth(dateStr), curY + 0.8);

  curY += 14;

  // Name of the Borrower
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.55);
  doc.text('Name of the Borrower :', leftMargin, curY);
  curY += 3.5;

  doc.rect(leftMargin, curY, contentWidth, 15);
  if (showHighlights && client.consumerName) {
    doc.setFillColor(254, 240, 138);
    const bNameW = doc.getTextWidth(client.consumerName);
    doc.rect(leftMargin + 3.5, curY + 5, bNameW + 2, 5.5, 'F');
  }
  doc.setFont('helvetica', 'bold');
  doc.text(client.consumerName || '_____________________________________', leftMargin + 4.5, curY + 9.5);

  curY += 22;

  // Address
  doc.setFont('helvetica', 'normal');
  doc.text('Address :', leftMargin, curY);
  curY += 3.5;

  doc.rect(leftMargin, curY, contentWidth, 26);
  const fullAddress = client.installationAddress
    ? `${client.installationAddress}, ${client.district}, ${client.state} - ${client.pincode}`
    : '__________________________________________________________________________________';

  const addrLines = doc.splitTextToSize(fullAddress, contentWidth - 8);
  if (showHighlights && client.installationAddress) {
    doc.setFillColor(254, 240, 138);
    let tempY = curY + 3.5;
    addrLines.forEach((line: string) => {
      const lineW = doc.getTextWidth(line);
      doc.rect(leftMargin + 3.5, tempY, lineW + 2, 5.5, 'F');
      tempY += 6;
    });
  }
  doc.setFont('helvetica', 'bold');
  doc.text(addrLines, leftMargin + 4.5, curY + 8);

  // Page 2 footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(90, 90, 90);
  doc.text('Page 2 of 3', pageWidth - rightMargin, 285, { align: 'right' });

  // ==========================================
  // PAGE 3: Site Photos
  // Left completely empty as requested
  // ==========================================
  doc.addPage();
  curY = 25;

  // Title - increased font by 10%
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Site Photos :', leftMargin, curY);
  const siteTitleW = doc.getTextWidth('Site Photos :');
  doc.line(leftMargin, curY + 1.2, leftMargin + siteTitleW, curY + 1.2);

  // Page 3 Signatory at bottom
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`EPC Code: ${vendor.epcCode}`, leftMargin, 265);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.55);
  doc.text(vendor.signatoryText || 'Authorised Signatory of the vender with Stamp', pageWidth - rightMargin, 265, {
    align: 'right',
  });

  // Page 3 footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(90, 90, 90);
  doc.text('Page 3 of 3', pageWidth - rightMargin, 285, { align: 'right' });

  // ==========================================
  // SAVE / EXPORT EXECUTION
  // ==========================================
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);

  // If user requested to choose location and browser supports showSaveFilePicker
  if (chooseSaveLocation && typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'PDF Document (*.pdf)',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      return { saved: true, method: 'picker', blobUrl };
    } catch (err: any) {
      if (err && err.name === 'AbortError') {
        // User deliberately cancelled the file picker dialog
        return { saved: false, cancelled: true, blobUrl };
      }
      // Fallback to standard save if picker threw unexpected error (e.g. inside iframe)
      doc.save(fileName);
      return { saved: true, method: 'download', blobUrl };
    }
  }

  // Standard save (prompts or saves to browser default download folder)
  doc.save(fileName);
  return { saved: true, method: 'download', blobUrl };
}

export { generateNativePdf as exportDocumentToPdf };
