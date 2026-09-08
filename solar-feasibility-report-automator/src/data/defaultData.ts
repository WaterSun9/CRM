import { ClientReportData, VendorSettings } from '../types';

export const DEFAULT_VENDOR_SETTINGS: VendorSettings = {
  vendorName: 'Watersun Electrical Solutions Pvt. Ltd',
  epcContractorAddress: 'RADHANPUR,385340',
  epcCode: 'NRGP002',
  bankAccountNo: '5020 004 1765376',
  bankIfsc: 'HDFC0002794',
  signatoryText: 'Authorised Signatory of the vender with Stamp',
};

export const INITIAL_CLIENTS: ClientReportData[] = [
  {
    id: 'client-1',
    createdAt: new Date().toISOString(),
    consumerName: 'MISTRI KAPILABEN CHIMANLAL',
    discomConsumerId: '22139106156',
    pmSuryaShaktiPortalId: 'NP-GJUG26-14118759',
    janSamarthId: 'ANS-SOLAR-17360555-5375664',
    installationAddress: 'VILL- GANESHPURA TAL SIDHPUR',
    district: 'PATAN',
    state: 'GUJARAT',
    pincode: '384151',
    actualCapacityKw: '3.24',
    projectCost: '1,84,000',
    discomId: '',
    oemName: '',
    channelPartner: '',
    rtsCapacityAppliedKw: '',
    isVendorRegisteredMnre: true,
    feasibilityStatus: 'feasible',
    signatureDate: new Date().toLocaleDateString('en-GB'),
    sitePhotos: []
  },
  {
    id: 'client-2',
    createdAt: new Date().toISOString(),
    consumerName: 'PATEL RAMESHBHAI SOMABHAI',
    discomConsumerId: '22148902341',
    pmSuryaShaktiPortalId: 'NP-GJUG26-14229980',
    janSamarthId: 'ANS-SOLAR-17360555-6124892',
    installationAddress: 'PLOT NO 42, SHIVAM SOCIETY, NEAR BUS STAND',
    district: 'MEHSANA',
    state: 'GUJARAT',
    pincode: '384002',
    actualCapacityKw: '4.00',
    projectCost: '2,20,000',
    discomId: 'UGVCL',
    oemName: 'WAAREE ENERGIES',
    channelPartner: '',
    rtsCapacityAppliedKw: '4.0',
    isVendorRegisteredMnre: true,
    feasibilityStatus: 'feasible',
    signatureDate: new Date().toLocaleDateString('en-GB'),
    sitePhotos: []
  }
];

export const BLANK_CLIENT_TEMPLATE: Omit<ClientReportData, 'id' | 'createdAt'> = {
  consumerName: '',
  discomConsumerId: '',
  pmSuryaShaktiPortalId: '',
  janSamarthId: '',
  installationAddress: '',
  district: '',
  state: 'GUJARAT',
  pincode: '',
  actualCapacityKw: '3.24',
  projectCost: '1,84,000',
  discomId: '',
  oemName: '',
  channelPartner: '',
  rtsCapacityAppliedKw: '',
  isVendorRegisteredMnre: true,
  feasibilityStatus: 'feasible',
  signatureDate: new Date().toLocaleDateString('en-GB'),
  sitePhotos: []
};
