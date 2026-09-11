// Company-controlled template, copied from the approved solar-quotation-maker reference.

export const INVERTER_PRESETS = [
  { id: 'Option 1', label: 'Option 1 - Solaryan', brand: 'Solaryan', specs: 'Grid-tied string inverter' },
  { id: 'Option 2', label: 'Option 2 - Growatt', brand: 'Growatt', specs: 'Single phase / Three phase high efficiency' },
  { id: 'Option 3', label: 'Option 3 - Sungrow', brand: 'Sungrow', specs: 'Smart residential inverter' },
  { id: 'Option 4', label: 'Option 4 - TATA Approved / UTL', brand: 'TATA Approved / UTL', specs: 'Premium grid-tied inverter' },
];

export const INITIAL_QUOTATION = {
  company: {
    name: 'WATERSUN',
    tagline: 'SOLAR ENERGY',
    gstNo: '24AACCW4587D1ZA',
    cinNo: 'U31900GJ2019PTC108876',
    email: 'watersunelectrical@gmail.com',
  },

  page1: {
    customerName: '',
    customerPhone: '',
    quotationNo: '',
    date: '',
    capacityKw: '',
    yoursTrulyName: '',
    yoursTrulyPhone: '',
    introParagraph1:
      'We, Watersun Electrical Solutions Pvt Ltd (WESPL), are a reputed supplier of Solar PV modules, solar water Pumping Systems, Solar Inverter and have vast experience of over 10 years in the field of Solar PV. WESPL provides turnkey solutions and single window support for industrial & commercial Solar Rooftop Power plants for captive consumption and ground-mounted MW scale projects including Design, Engineering, Manufacturing, Procurement, Installation, Testing, Commissioning, O&M, Monitoring, and Training.',
    introParagraph2:
      'WESPL has installed more than 20 MW solar power plants with plant capacity from 3 KW to 500 KW. Each single project has been running successfully for many years with generation performance more than 17% PLF.',
  },

  page2: {
    solarPanelMake: '',
    solarPanelQty: '',
    inverterOption: '',
    inverterBrand: '',
    gebGedaCharge: 'Including',
    projectType: 'Residential',

    projectSize: '',
    brandOptions: [
      {
        brandName: 'Waaree Solar',
        baseValue: 0,
        discount: 0,
        netPayableAmount: 0,
        subsidy: 0,
        netPriceAfterSubsidy: 0,
      },
      {
        brandName: 'Tata Power Solar',
        baseValue: 0,
        discount: 0,
        netPayableAmount: 0,
        subsidy: 0,
        netPriceAfterSubsidy: 0,
      },
      {
        brandName: 'Adani Solar',
        baseValue: 0,
        discount: 0,
        netPayableAmount: 0,
        subsidy: 0,
        netPriceAfterSubsidy: 0,
      },
    ],

    baseValue: 0,
    discount: 0,
    netPayableAmount: 0,
    subsidy: 0,
    netPriceAfterSubsidy: 0,

    notes: [
      'All GST is inclusive',
      '70% Solar Power System-(HSN CODE-8541)-5% @GST',
      '30% Solar Power System-(HSN CODE-9954)-18% @GST',
      'Owner Name:-Sandipkumar Jayantilal Trivedi',
      'National Portal Empanelment Number -NPUG-002',
      'Electrical Contractor Number -GJ/PTN/C-03368',
    ],
  },

  page3: {
    termsAndConditions: [
      { sr: 1, parameter: 'Rooftop area @10 Sq.Mtr./KWp to be provided', remarks: 'Customer Scope' },
      { sr: 2, parameter: 'Civil works', remarks: 'Included' },
      { sr: 3, parameter: 'Mounting, Erection, and Commissioning', remarks: 'Included' },
      { sr: 4, parameter: 'Power evacuations (solar plant to mains)', remarks: 'Included' },
      { sr: 5, parameter: 'Lightening arrester systems', remarks: 'Included' },
      { sr: 6, parameter: 'Earthing systems', remarks: 'Included' },
      { sr: 7, parameter: 'Free Operation & Maintenance (Cleaning has to be done by the customer)', remarks: 'Included for 5 Years' },
      { sr: 8, parameter: 'Transport charges', remarks: 'Included' },
      { sr: 9, parameter: 'Supply, Erection & Commissioning Period', remarks: 'Generally, it is 1 month.' },
      { sr: 10, parameter: 'Validity period for this quote', remarks: '15 days from the date of this offer' },
      { sr: 11, parameter: 'All extra and additional material/work', remarks: 'As per the bill raised on actual expenditure' },
    ],

    warranties: [
      { sr: 1, parameter: 'SPV modules (for Manufacturing Defects)', remarks: '15 Years' },
      {
        sr: 2,
        parameter: 'SPV modules (for performance)',
        remarks: '90% Power output for the 1st 10 years\n80% power output for the 2nd 30 years',
      },
      { sr: 3, parameter: 'Inverter (for Manufacturing Defects) Back to Back', remarks: '10 Years' },
    ],

    bomItems: [
      {
        sr: 1,
        description: 'Solar modules',
        unit: 'Nos',
        qty: 'As Per the Above First Page',
        size: 'As Per the Project',
        make: 'As Per the Above First Page',
      },
      {
        sr: 2,
        description: 'Module mounting structure (GI)',
        unit: 'Set',
        qty: 'As per design',
        size: '(max up to 8 FT from Ground)',
        make: 'Watersun Standard',
      },
      {
        sr: 3,
        description: 'String type Grid Tied Inverter',
        unit: 'Nos',
        qty: 'As per design',
        size: 'As Per the Project',
        make: 'TATA Approved / SOLARYAAN / UTL',
      },
      {
        sr: 4,
        description: 'AJB with accessories',
        unit: 'Nos',
        qty: 'As per design',
        size: '****',
        make: 'Polycab / C&S / Standard',
      },
      {
        sr: 5,
        description: 'ACDB',
        unit: 'Nos',
        qty: 'At actual',
        size: 'As per design',
        make: 'Polycab / C&S / Standard',
      },
      {
        sr: 6,
        description: 'DC cable with UV protected',
        unit: 'Mtr.',
        qty: 'At actual',
        size: 'As per design',
        make: 'Polycab / Equivalent',
      },
      {
        sr: 7,
        description: 'AC Cable',
        unit: 'Mtr.',
        qty: 'At actual',
        size: 'As per design',
        make: 'Polycab / Johnson / Equivalent',
      },
      {
        sr: 8,
        description: 'Earthing systems',
        unit: 'Nos',
        qty: 'At actual',
        size: 'As per design',
        make: 'Standard',
      },
      {
        sr: 9,
        description: 'Lightening arrester systems',
        unit: 'Nos',
        qty: 'At actual',
        size: '****',
        make: 'Standard',
      },
      {
        sr: 10,
        description: 'LA Cable',
        unit: 'MTR',
        qty: 'At actual',
        size: '16 Sqmm Aluminium',
        make: 'Flexguard / Johnson / Polycab',
      },
    ],

    otherChargesText:
      '* 50% Advance includes discom registration charges of Rs.2000/- per KW. If any client refused to install solar plant after discom registration payment, then we shall refund the amount after deducting discom charges and receipt of same will be provided with A/C statement.',

    bankDetails: {
      accountName: 'WATERSUN ELECTRICAL SOLUTIONS PRIVATE LIMITED',
      accountNumber: '50200041765376',
      bankName: 'HDFC BANK',
      branchName: 'RADHANPUR',
      ifscCode: 'HDFC0002794',
    },
  },

  footer: {
    authorizedPartner: 'TATA POWER SOLAROOF',
    corporateOffice: 'Plot No. 40 Kandla Highway, GIDC, Radhanpur, Gujarat-385340',
    branchOffice: 'E-5, Third floor, New Bus Port, Palanpur',
  },
};
