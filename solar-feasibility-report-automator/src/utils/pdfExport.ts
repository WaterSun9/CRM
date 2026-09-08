import { ClientReportData, VendorSettings } from '../types';
import { generateNativePdf, PdfExportResult } from './nativePdfGenerator';

export { generateNativePdf };
export type { PdfExportResult };

export async function exportDocumentToPdf(
  client: ClientReportData,
  vendor: VendorSettings,
  options?: {
    showHighlights?: boolean;
    fileName?: string;
    chooseSaveLocation?: boolean;
  }
): Promise<PdfExportResult> {
  return await generateNativePdf(client, vendor, options);
}

export function exportDocumentToWordDoc(elementId: string, fileName: string = 'Solar_Feasibility_Report.doc'): void {
  const container = document.getElementById(elementId);
  if (!container) return;

  const content = container.innerHTML;
  const header = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileName}</title><style>
    body { font-family: Arial, sans-serif; font-size: 13pt; line-height: 1.5; color: #000; }
    .page-break { page-break-after: always; }
    table { width: 100%; border-collapse: collapse; }
    td, th { padding: 4px 8px; }
  </style></head><body>`;
  const footer = `</body></html>`;
  const blob = new Blob(['\ufeff' + header + content + footer], {
    type: 'application/msword;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
