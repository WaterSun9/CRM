// ─── src/mock/demoData.js ──────────────────────────────────────────────────
// Fake Login Credentials & Mock Dev Roles ONLY
// (Full mock customer table data has been completely commented out as requested)
// ──────────────────────────────────────────────────────────────────────────

/*
// ════════════════════════════════════════════════════════════════════════════
// [COMMENTED OUT] 16 FULL DEMO RECORDS
// ════════════════════════════════════════════════════════════════════════════
export const DEMO_CUSTOMERS_ARCHIVE = [
    {
        id: 'demo-lead-1',
        crn: 'CRN-2026-0001',
        folder_no: 'DEMO-101',
        customer_name: 'RAMESHBHAI MANILAL PATEL',
        phone_number: '9825012345',
        consumer_no: '8401928374',
        village: 'Kadi',
        villages: 'Kadi',
        sub_division: 'Mehsana City',
        sub_divisions: 'Mehsana City',
        system_capacity_kwp: 3.3,
        module_brand: 'Adani Solar (Mono PERC)',
        module_wp: 550,
        registration_date: '2026-02-10',
        payment_type: 'Cash',
        stage: 'LEADS',
        loan_tag: null,
        subsidy_tag: 'Received',
        installation_status: 'Pending',
        registration_by: 'Office Sales Team',
        channel_partner: 'Apex Solar Gujarat',
        sub_channel_partner: 'Siddhpur Field Team',
        invoice_no: 'INV-WS-2026-0101',
        stamp: true,
        file_status: true,
        adhaar_card_front: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&q=80',
        adhaar_card_back: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&q=80',
        pan_card: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&q=80',
        light_bill: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&q=80',
        index_2: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&q=80',
        bank_details: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&q=80',
        created_at: '2026-02-10T10:00:00Z'
    },
    {
        id: 'demo-lead-2',
        crn: 'CRN-2026-0002',
        folder_no: 'DEMO-102',
        customer_name: 'DINESHBHAI BHIKHABHAI CHAUDHARY',
        phone_number: '9879512345',
        consumer_no: '8401928375',
        village: 'Visnagar',
        villages: 'Visnagar',
        sub_division: 'Visnagar Rural',
        sub_divisions: 'Visnagar Rural',
        system_capacity_kwp: 4.4,
        module_brand: 'Goldi Solar',
        module_wp: 550,
        registration_date: '2026-02-11',
        payment_type: 'Loan',
        stage: 'REGISTRATION',
        loan_tag: 'In Progress',
        subsidy_tag: 'In Process',
        installation_status: 'Process',
        registration_by: 'Bhavik Patel',
        channel_partner: 'Apex Solar Gujarat',
        sub_channel_partner: 'Visnagar Unit',
        invoice_no: 'INV-WS-2026-0102',
        stamp: true,
        file_status: true,
        created_at: '2026-02-11T11:00:00Z'
    },
    {
        id: 'demo-lead-3',
        crn: 'CRN-2026-0003',
        folder_no: 'DEMO-103',
        customer_name: 'JITENDRASINH VIKRAMSINH VAGHELA',
        phone_number: '9426012345',
        consumer_no: '8401928376',
        village: 'Mansa',
        villages: 'Mansa',
        sub_division: 'Gandhinagar North',
        sub_divisions: 'Gandhinagar North',
        system_capacity_kwp: 5.5,
        module_brand: 'Waaree Energies',
        module_wp: 540,
        registration_date: '2026-02-12',
        payment_type: 'Loan',
        stage: 'LOAN',
        loan_tag: 'Processed',
        subsidy_tag: 'In Process',
        installation_status: 'Pending',
        registration_by: 'Deepak Shah',
        channel_partner: 'Apex Solar Gujarat',
        bank_name: 'State Bank of India',
        loan_sanction_amount: 220000,
        loan_disbursed_amount: 110000,
        loan_sanction_date: '2026-02-15',
        created_at: '2026-02-12T09:30:00Z'
    },
    {
        id: 'demo-lead-4',
        crn: 'CRN-2026-0004',
        folder_no: 'DEMO-104',
        customer_name: 'PRAVINBHAI SHANTILAL SHAH',
        phone_number: '9724012345',
        consumer_no: '8401928377',
        village: 'Palanpur',
        villages: 'Palanpur',
        sub_division: 'Palanpur City',
        sub_divisions: 'Palanpur City',
        system_capacity_kwp: 3.3,
        module_brand: 'Adani Solar',
        module_wp: 550,
        registration_date: '2026-02-13',
        payment_type: 'Cash',
        stage: 'CASH',
        loan_tag: 'All Clear',
        subsidy_tag: 'Received',
        installation_status: 'Process',
        registration_by: 'Ketan Prajapati',
        channel_partner: 'Apex Solar Gujarat',
        cash_advance_amount: 50000,
        cash_advance_date: '2026-02-13',
        created_at: '2026-02-13T14:15:00Z'
    },
    {
        id: 'demo-lead-5',
        crn: 'CRN-2026-0005',
        folder_no: 'DEMO-105',
        customer_name: 'SURESHBHAI KANJIBHAI THAKOR',
        phone_number: '9909012345',
        consumer_no: '8401928378',
        village: 'Unjha',
        villages: 'Unjha',
        sub_division: 'Unjha Rural',
        sub_divisions: 'Unjha Rural',
        system_capacity_kwp: 3.3,
        module_brand: 'Goldi Solar',
        module_wp: 550,
        registration_date: '2026-02-14',
        payment_type: 'Loan',
        stage: 'HOLD PROCUREMENT',
        hold_status: 'Waiting for Material',
        hold_reason: 'Awaiting 550W DCR Modules dispatch from factory.',
        loan_tag: 'In Progress',
        subsidy_tag: 'In Process',
        installation_status: 'Pending',
        channel_partner: 'Apex Solar Gujarat',
        created_at: '2026-02-14T16:00:00Z'
    },
    {
        id: 'demo-lead-6',
        crn: 'CRN-2026-0006',
        folder_no: 'DEMO-106',
        customer_name: 'BHAVESHBHAI AMRUTLAL SUTHAR',
        phone_number: '9824012345',
        consumer_no: '8401928379',
        village: 'Patan',
        villages: 'Patan',
        sub_division: 'Patan Sub',
        sub_divisions: 'Patan Sub',
        system_capacity_kwp: 4.4,
        module_brand: 'Adani Solar',
        module_wp: 550,
        registration_date: '2026-02-15',
        payment_type: 'Cash',
        stage: 'MATERIAL ORDER',
        loan_tag: null,
        subsidy_tag: 'In Process',
        installation_status: 'Pending',
        channel_partner: 'Apex Solar Gujarat',
        po_number: 'PO-2026-089',
        vendor: 'Shreeji Solar Installations',
        vendor_quote: 6500,
        created_at: '2026-02-15T12:00:00Z'
    },
    {
        id: 'demo-lead-7',
        crn: 'CRN-2026-0007',
        folder_no: 'DEMO-107',
        customer_name: 'HARESHBHAI SOMABHAI RABARI',
        phone_number: '9898012345',
        consumer_no: '8401928380',
        village: 'Vadnagar',
        villages: 'Vadnagar',
        sub_division: 'Kheralu Division',
        sub_divisions: 'Kheralu Division',
        system_capacity_kwp: 3.3,
        module_brand: 'Waaree Energies',
        module_wp: 540,
        registration_date: '2026-02-16',
        payment_type: 'Loan',
        stage: 'MATERIAL INTEGRATION',
        loan_tag: 'Processed',
        subsidy_tag: 'In Process',
        installation_status: 'Process',
        channel_partner: 'Apex Solar Gujarat',
        inverter_brand: 'Havells 3.3kW On-Grid',
        inverter_serial_no: 'HAV-2026-98124',
        panel_serial_no: 'WAA540-001\nWAA540-002\nWAA540-003\nWAA540-004\nWAA540-005\nWAA540-006',
        dcr_certificate: 'DCR-WAA-2026-0492',
        created_at: '2026-02-16T11:20:00Z'
    },
    {
        id: 'demo-lead-8',
        crn: 'CRN-2026-0008',
        folder_no: 'DEMO-108',
        customer_name: 'KIRITBHAI GOVINDBHAI PRAJAPATI',
        phone_number: '9712012345',
        consumer_no: '8401928381',
        village: 'Kalol',
        villages: 'Kalol',
        sub_division: 'Kalol GIDC',
        sub_divisions: 'Kalol GIDC',
        system_capacity_kwp: 3.3,
        module_brand: 'Adani Solar',
        module_wp: 550,
        registration_date: '2026-02-17',
        payment_type: 'Cash',
        stage: 'MATERIAL DELIVERY',
        loan_tag: null,
        subsidy_tag: 'In Process',
        installation_status: 'Process',
        channel_partner: 'Apex Solar Gujarat',
        material_delivery_date: '2026-02-20',
        driver_name: 'Mahesh Rajput',
        driver_phone_number: '9876543210',
        delivery_vehicle_no: 'GJ-02-XX-4819',
        vendor: 'Patel Solar Technicians',
        vendor_quote: 6000,
        created_at: '2026-02-17T15:45:00Z'
    },
    {
        id: 'demo-lead-9',
        crn: 'CRN-2026-0009',
        folder_no: 'DEMO-109',
        customer_name: 'MAHENDRABHAI KALYANJI DARJI',
        phone_number: '9428012345',
        consumer_no: '8401928382',
        village: 'Himatnagar',
        villages: 'Himatnagar',
        sub_division: 'Sabarkantha Sub',
        sub_divisions: 'Sabarkantha Sub',
        system_capacity_kwp: 5.5,
        module_brand: 'Goldi Solar',
        module_wp: 550,
        registration_date: '2026-02-18',
        payment_type: 'Loan',
        stage: 'INSTALLATION STATUS',
        loan_tag: '1st Payment',
        subsidy_tag: 'In Process',
        installation_status: 'Yes',
        installation_date: '2026-02-22',
        material_delivery_date: '2026-02-20',
        vendor: 'Shreeji Solar Installations',
        vendor_quote: 8500,
        vendor_payment_status: 'Pending',
        installed_by: 'Shreeji Solar Team (Lead: Jayesh)',
        channel_partner: 'Apex Solar Gujarat',
        created_at: '2026-02-18T10:10:00Z'
    },
    {
        id: 'demo-lead-10',
        crn: 'CRN-2026-0010',
        folder_no: 'DEMO-110',
        customer_name: 'ASHOKBHAI NATVARLAL PANCHAL',
        phone_number: '9879012345',
        consumer_no: '8401928383',
        village: 'Vijapur',
        villages: 'Vijapur',
        sub_division: 'Vijapur East',
        sub_divisions: 'Vijapur East',
        system_capacity_kwp: 3.3,
        module_brand: 'Adani Solar',
        module_wp: 550,
        registration_date: '2026-02-19',
        payment_type: 'Cash',
        stage: 'GEO TAG PHOTO',
        loan_tag: null,
        subsidy_tag: 'In Process',
        installation_status: 'Yes',
        installation_date: '2026-02-21',
        geo_tag_image: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=600&q=80',
        house_geo_tag_photo: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&q=80',
        channel_partner: 'Apex Solar Gujarat',
        created_at: '2026-02-19T09:00:00Z'
    },
    {
        id: 'demo-lead-11',
        crn: 'CRN-2026-0011',
        folder_no: 'DEMO-111',
        customer_name: 'CHETANBHAI JAYANTILAL KAPADI',
        phone_number: '9825112345',
        consumer_no: '8401928384',
        village: 'Deesa',
        villages: 'Deesa',
        sub_division: 'Banaskantha West',
        sub_divisions: 'Banaskantha West',
        system_capacity_kwp: 6.6,
        module_brand: 'Waaree Energies',
        module_wp: 540,
        registration_date: '2026-02-20',
        payment_type: 'Loan',
        stage: 'DISCOM SUBMISSION',
        loan_tag: 'Processed',
        subsidy_tag: 'In Process',
        installation_status: 'Yes',
        discom_application_no: 'DIS-UGVCL-2026-8941',
        discom_submission_date: '2026-02-22',
        discom_sub_division: 'Deesa Rural',
        feasibilty_document: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&q=80',
        channel_partner: 'Apex Solar Gujarat',
        created_at: '2026-02-20T14:30:00Z'
    },
    {
        id: 'demo-lead-12',
        crn: 'CRN-2026-0012',
        folder_no: 'DEMO-112',
        customer_name: 'VIKRAMKUMAR SHANKARLAL RAVAL',
        phone_number: '9876512345',
        consumer_no: '8401928385',
        village: 'Radhanpur',
        villages: 'Radhanpur',
        sub_division: 'Patan North',
        sub_divisions: 'Patan North',
        system_capacity_kwp: 3.3,
        module_brand: 'Adani Solar',
        module_wp: 550,
        registration_date: '2026-02-21',
        payment_type: 'Cash',
        stage: 'METER INSTALLATION',
        loan_tag: null,
        subsidy_tag: 'In Process',
        installation_status: 'Yes',
        meter_number: 'MTR-L&T-2026-7819',
        meter_installation_date: '2026-02-23',
        meter_installation_photo: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=600&q=80',
        channel_partner: 'Apex Solar Gujarat',
        created_at: '2026-02-21T16:00:00Z'
    },
    {
        id: 'demo-lead-13',
        crn: 'CRN-2026-0013',
        folder_no: 'DEMO-113',
        customer_name: 'BHAGATJI BHURANJI GELOT',
        phone_number: '9924012345',
        consumer_no: '8401928386',
        village: 'Tharad',
        villages: 'Tharad',
        sub_division: 'Tharad Division',
        sub_divisions: 'Tharad Division',
        system_capacity_kwp: 4.4,
        module_brand: 'Goldi Solar',
        module_wp: 550,
        registration_date: '2026-02-22',
        payment_type: 'Loan',
        stage: 'DISCOM INSPECTION',
        loan_tag: 'Processed',
        subsidy_tag: 'In Process',
        installation_status: 'Yes',
        inspection_officer_name: 'R. K. Dave (AE UGVCL)',
        inspection_date: '2026-02-24',
        inspection_status: 'Approved',
        channel_partner: 'Apex Solar Gujarat',
        created_at: '2026-02-22T10:00:00Z'
    },
    {
        id: 'demo-lead-14',
        crn: 'CRN-2026-0014',
        folder_no: 'DEMO-114',
        customer_name: 'AMIRKHAN RAGHJI MALEK',
        phone_number: '9825212345',
        consumer_no: '8401928387',
        village: 'Chanasma',
        villages: 'Chanasma',
        sub_division: 'Patan South',
        sub_divisions: 'Patan South',
        system_capacity_kwp: 3.3,
        module_brand: 'Adani Solar',
        module_wp: 550,
        registration_date: '2026-02-23',
        payment_type: 'Loan',
        stage: 'SUBSIDY STATUS',
        loan_tag: 'Processed',
        subsidy_tag: 'Received',
        subsidy_token_no: 'SUB-MNRE-2026-48192',
        subsidy_amount: 78000,
        subsidy_credited_date: '2026-02-24',
        installation_status: 'Yes',
        channel_partner: 'Apex Solar Gujarat',
        created_at: '2026-02-23T11:30:00Z'
    },
    {
        id: 'demo-lead-15',
        crn: 'CRN-2026-0015',
        folder_no: 'DEMO-115',
        customer_name: 'PRABHABEN RAMESHBHAI SUTHAR',
        phone_number: '9427012345',
        consumer_no: '8401928388',
        village: 'Mehsana',
        villages: 'Mehsana',
        sub_division: 'Mehsana City',
        sub_divisions: 'Mehsana City',
        system_capacity_kwp: 3.3,
        module_brand: 'Waaree Energies',
        module_wp: 540,
        registration_date: '2026-02-24',
        payment_type: 'Loan',
        stage: 'FINAL REVIEW',
        loan_tag: 'Processed',
        subsidy_tag: 'Redeemed',
        installation_status: 'Yes',
        final_audit_by: 'Master Admin',
        final_audit_date: '2026-02-24',
        channel_partner: 'Apex Solar Gujarat',
        created_at: '2026-02-24T12:00:00Z'
    },
    {
        id: 'demo-lead-16',
        crn: 'CRN-2026-0016',
        folder_no: 'DEMO-116',
        customer_name: 'JASHODABEN MEGHABHAI KANABI',
        phone_number: '9825312345',
        consumer_no: '8401928389',
        village: 'Sidhpur',
        villages: 'Sidhpur',
        sub_division: 'Sidhpur Sub',
        sub_divisions: 'Sidhpur Sub',
        system_capacity_kwp: 5.5,
        module_brand: 'Adani Solar',
        module_wp: 550,
        registration_date: '2026-01-15',
        payment_type: 'Cash',
        stage: 'COMPLETED',
        loan_tag: 'All Clear',
        subsidy_tag: 'Received',
        installation_status: 'Yes',
    }
];
*/

// Active customer array stub (empty)
export const DEMO_CUSTOMERS = [];

// ─── Fake Credentials & Mock Roles (for all screens) ────────────────────────
export const MOCK_DEV_ROLES = [
    {
        id: 'admin_master',
        name: 'Master Admin',
        title: 'Admin Master',
        email: 'admin@watersun.com',
        password: 'admin',
        userType: 'admin',
        role: 'Admin',
        channel_partner: '',
        badge: 'Admin Screen',
        description: 'Complete CRM access: all stages, full customer modals, operations & user management.'
    },
    {
        id: 'office_staff',
        name: 'Office Staff',
        title: 'Office User',
        email: 'office@watersun.com',
        password: 'office',
        userType: 'sales',
        role: 'Office',
        channel_partner: '',
        badge: 'Office Screen',
        description: 'Sales & pipeline workflow, lead creation, Discom submissions, and agreement generator.'
    },
    {
        id: 'cpo_manager',
        name: 'Channel Partner Office (CPO)',
        title: 'CPO Head Office',
        email: 'cpo@watersun.com',
        password: 'cpo',
        userType: 'channel_partner_office',
        role: 'Channel Partner Office',
        channel_partner: 'Apex Solar Gujarat',
        badge: 'CPO Screen',
        description: 'CPO Team Dashboard, manage branch managers & field agents, and track branch pipeline.'
    },
    {
        id: 'cp_manager_office2',
        name: 'CP Manager (Office 2)',
        title: 'Vikram Patel (CP Manager)',
        email: 'manager.cpo@watersun.com',
        password: 'manager',
        userType: 'office2',
        role: 'Channel Partner Manager',
        channel_partner: 'Apex Solar Gujarat',
        badge: 'CP Manager Screen',
        description: 'Branch management view: oversees branch operations and assigned partner clients.'
    },
    {
        id: 'direct_cp_agent',
        name: 'Channel Partner (Agent)',
        title: 'Om Solar (Direct CP)',
        email: 'direct.agent@watersun.com',
        password: 'agent',
        userType: 'agent',
        role: 'Channel Partners',
        channel_partner: 'Om Solar Direct',
        badge: 'Agent Portal',
        description: 'Independent Channel Partner Portal: manages customer leads & document workdesk.'
    },
    {
        id: 'agent_partner_agent2',
        name: 'Sub-Agent (Agent 2)',
        title: 'Rahul Sharma (Field Agent)',
        email: 'agent2@watersun.com',
        password: 'agent',
        userType: 'agent2',
        role: 'Channel Partner',
        channel_partner: 'Apex Solar Gujarat',
        badge: 'Sub-Agent Portal',
        description: 'Field agent under CP Office: leads are linked to parent branch.'
    },
    {
        id: 'vendor_tech',
        name: 'Vendor / Technician',
        title: 'Shreeji Solar Installations',
        email: 'vendor@watersun.com',
        password: 'vendor',
        userType: 'vendor',
        role: 'Vendors',
        channel_partner: '',
        badge: 'Vendor Portal',
        description: 'Mobile Vendor Portal for installation status, delivery details, and Geo Tag photos.'
    },
    {
        id: 'stamp_maker',
        name: 'Stamp Guy / Stamp Maker',
        title: 'PM Surya Ghar Stamp Maker',
        email: 'stamp@watersun.com',
        password: 'stamp',
        userType: 'stamp',
        role: 'Stamp',
        channel_partner: '',
        badge: 'Stamp Portal',
        description: 'Mobile Stamp Portal: view requested customer party details, upload stamps & complete tasks.'
    }
];

// ─── Verify Fake Credentials Helper ─────────────────────────────────────────
export const verifyDemoCredentials = (email, password) => {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    
    // Check against mock roles
    const matchedRole = MOCK_DEV_ROLES.find(r => r.email.toLowerCase() === cleanEmail);
    if (matchedRole) {
        return {
            id: `dev-${matchedRole.id}`,
            email: matchedRole.email,
            name: matchedRole.title,
            role: matchedRole.role,
            userType: matchedRole.userType,
            channel_partner: matchedRole.channel_partner || matchedRole.title || '',
            isDevBackdoor: true
        };
    }
    
    // If it's a test/demo login with @watersun or admin/demo keyword
    if (cleanEmail.includes('admin') || cleanEmail.includes('demo') || cleanEmail.endsWith('@watersun.com')) {
        const adminRole = MOCK_DEV_ROLES[0];
        return {
            id: `dev-${adminRole.id}`,
            email: email,
            name: 'Admin Master',
            role: 'Admin',
            userType: 'admin',
            channel_partner: '',
            isDevBackdoor: true
        };
    }
    
    return null;
};

// ─── Safe Fallback Stubs ───────────────────────────────────────────────────
const DEMO_STORAGE_KEY = 'watersun_demo_table_admin';

export const getStoredDemoCustomers = () => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.sessionStorage.getItem(DEMO_STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
};

export const saveStoredDemoCustomers = (list) => {
    if (typeof window !== 'undefined') {
        try {
            window.sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(list));
            window.dispatchEvent(new CustomEvent('watersun_demo_update', { detail: list }));
        } catch (e) {
            // no-op
        }
    }
};

export const resetStoredDemoCustomers = () => {
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(DEMO_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent('watersun_demo_update', { detail: [] }));
    }
    return [];
};

export const updateStoredDemoCustomer = (id, updates) => {
    const list = getStoredDemoCustomers();
    const idx = list.findIndex(c => c.id === id);
    if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
        saveStoredDemoCustomers(list);
        return list[idx];
    }
    return null;
};

export const createStoredDemoCustomer = (newCust) => {
    const list = getStoredDemoCustomers();
    const id = `demo-lead-${Date.now()}`;
    const randCRN = `CRN-2026-${String(list.length + 1).padStart(4, '0')}`;
    const created = {
        id,
        crn: randCRN,
        created_at: new Date().toISOString(),
        stage: 'LEADS',
        ...newCust
    };
    list.unshift(created);
    saveStoredDemoCustomers(list);
    return created;
};

export const moveStoredDemoCustomerStage = (id, newStage, oldRemark = '') => {
    const list = getStoredDemoCustomers();
    const idx = list.findIndex(c => c.id === id);
    if (idx !== -1) {
        const c = list[idx];
        const oldStage = c.stage;
        const prevRemarks = typeof c.stages_remarks === 'object' && c.stages_remarks ? c.stages_remarks : {};
        const updated = {
            ...c,
            stage: newStage,
            stages_remarks: {
                ...prevRemarks,
                [oldStage]: oldRemark || prevRemarks[oldStage] || ''
            },
            updated_at: new Date().toISOString()
        };
        list[idx] = updated;
        saveStoredDemoCustomers(list);
        return updated;
    }
    return null;
};

export const softDeleteStoredDemoCustomer = (id) => {
    return updateStoredDemoCustomer(id, { deleted_at: new Date().toISOString() });
};

export const recoverStoredDemoCustomer = (id) => {
    return updateStoredDemoCustomer(id, { deleted_at: null });
};

export const hardDeleteStoredDemoCustomer = (id) => {
    const list = getStoredDemoCustomers();
    const filtered = list.filter(c => c.id !== id);
    saveStoredDemoCustomers(filtered);
    return true;
};

export const getDemoMetrics = (partnerName = null, channelPartnerFilter = null) => {
    let list = getStoredDemoCustomers().filter(c => !c.deleted_at);
    if (partnerName && partnerName.trim()) {
        list = list.filter(c => (c.channel_partner || '').toLowerCase() === partnerName.trim().toLowerCase());
    } else if (channelPartnerFilter && channelPartnerFilter.trim()) {
        list = list.filter(c => (c.channel_partner || '').toLowerCase() === channelPartnerFilter.trim().toLowerCase());
    }

    const stageCounts = {};
    list.forEach(c => {
        const s = (c.stage || 'LEADS').toUpperCase();
        stageCounts[s] = (stageCounts[s] || 0) + 1;
    });

    return {
        totalProjects: list.length,
        completedCount: list.filter(c => (c.stage || '').toUpperCase() === 'COMPLETED').length,
        liveProjects: list.filter(c => (c.stage || '').toUpperCase() !== 'COMPLETED').length,
        loanCount: list.filter(c => c.payment_type === 'Loan').length,
        cashCount: list.filter(c => c.payment_type === 'Cash').length,
        loanTagCount: list.filter(c => c.loan_tag && c.loan_tag !== 'All Clear').length,
        subsidyTagCount: list.filter(c => c.subsidy_tag).length,
        installationTagCount: list.filter(c => c.installation_status && c.installation_status !== 'Pending').length,
        stageCounts
    };
};

export const DEMO_METADATA = {
    channel_partner: [],
    module_brand: [],
    registration_by: [],
    integration_by: [],
    inverter_make: [],
    company_branch: []
};

export const getDemoMetadata = () => {
    return { ...DEMO_METADATA };
};

export const generateSampleTabData = () => {
    return {};
};
