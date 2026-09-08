export interface ClientReportData {
  id: string;
  createdAt: string;
  // Highlighted client fields
  consumerName: string;
  discomConsumerId: string;
  pmSuryaShaktiPortalId: string;
  janSamarthId: string;
  installationAddress: string;
  district: string;
  state: string;
  pincode: string;
  actualCapacityKw: string;
  projectCost: string;

  // Additional document fields
  discomId: string;
  oemName: string;
  channelPartner: string;
  rtsCapacityAppliedKw: string;
  isVendorRegisteredMnre: boolean;
  feasibilityStatus: 'feasible' | 'not_feasible';
  signatureDate: string;

  // Site layout & photos
  sitePhotos: string[];
}

export interface VendorSettings {
  vendorName: string;
  epcContractorAddress: string;
  epcCode: string;
  bankAccountNo: string;
  bankIfsc: string;
  signatoryText: string;
  stampImage?: string;
}

export interface DocumentSettings {
  showHighlights: boolean;
  totalPageCount: number;
}
