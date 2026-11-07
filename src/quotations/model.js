import { INITIAL_QUOTATION } from './template/data/initialData.js';

export const QUOTATION_ROLES = ['agent', 'agent2', 'channel_partner_office', 'admin', 'sales'];
// System details (panel, Wp, inverter, GEB/GEDA) are filled on the Pricing step.
export const STEPS = ['Customer', 'Pricing & review'];
export const canUseQuotations = user => QUOTATION_ROLES.includes(user?.userType);
export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0);
const clone = value => JSON.parse(JSON.stringify(value));
const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const date = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Customer fields shared by all quotation options.
export const leadMapping = {
    customer_name: 'customer_name', customer_phone: 'phone_number', customer_email: 'email_address',
    full_address: 'full_address', village: 'villages', taluka: 'sub_divisions', district: 'district',
    pincode: 'pincode', capacity_kw: 'system_capacity_kwp', solar_panel_make: 'module_brand',
    solar_panel_qty: 'no_of_modules', panel_wattage: 'module_wp', project_type: 'property_type', inverter_brand: 'inverter_make',
};
export function newForm(user = {}) {
    const today = new Date();
    const until = new Date(today); until.setDate(until.getDate() + 15);
    return {
        customer_name: '', customer_phone: '', customer_email: '', full_address: '', village: '', taluka: '', district: '', pincode: '',
        quotation_date: date(today), valid_until: date(until), owner_name_snapshot: user.name || '', owner_phone_snapshot: user.phone || '',
        capacity_kw: '', project_type: 'Residential', solar_panel_make: '', solar_panel_qty: '', panel_wattage: '',
        inverter_option: '', inverter_brand: '', geb_geda_charge: 'Including', source_lead_id: null,
        // GEB and GEDA are separate lines. Blank = "Included"; an amount is added
        // to each option's net payable. Stored in quotation_data only.
        geb_charge: '', geda_charge: '',
        // Optional salesperson name printed on this quotation only. Blank = their own name.
        print_owner_name: '',
        // A quote has one panel option. Another size or price is another quote for the same client.
        options: INITIAL_QUOTATION.page2.brandOptions.slice(0, 1).map(b => ({ brandName: b.brandName, panel_wattage: '', solar_panel_qty: '', capacity_kw: '', baseValue: '', discount: 0, subsidy: 0 })),
        custom_notes: [],
    };
}
// Old quotations keep their shared specifications until edited. New options own theirs.
export function optionSpecs(form, option) {
    const panel_wattage = option?.panel_wattage ?? form?.panel_wattage ?? '';
    const solar_panel_qty = option?.solar_panel_qty ?? form?.solar_panel_qty ?? '';
    const capacity_kw = option?.capacity_kw ?? (Number(panel_wattage) > 0 && Number(solar_panel_qty) > 0
        ? Math.round(Number(panel_wattage) * Number(solar_panel_qty)) / 1000 : form?.capacity_kw ?? '');
    return { panel_wattage, solar_panel_qty, capacity_kw };
}
// One quote: open, picked (the client chose it), converted (added to leads) or lost.
export function statusOf(row) {
    if (row?.status === 'lost') return 'lost';
    // An old 1-page (final) quote was linked to its lead by source_lead_id.
    if (row?.converted_lead_id || row?.status === 'converted' || (isFinalQuotation(row) && row?.source_lead_id)) return 'converted';
    if (row?.selected_option) return 'picked';
    return 'open';
}
// Old 1-page copies made from a 3-page quote (before 6 Nov). They reprint as that one page.
export const isFinalQuotation = row => row?.quotation_data?.kind === 'final' || row?.kind === 'final';
// Every other quote is the full quotation: cover letter, proposal, then terms/warranty/BOM/bank.
export const QUOTATION_PAGES = ['Cover letter', 'Techno commercial proposal', 'Terms, warranty, BOM, other charges and bank details'];
export const quotationPageCount = row => (isFinalQuotation(row) ? 1 : QUOTATION_PAGES.length);
// Keeps one option of an older quote that had three.
export function oneOption(form, number) {
    const option = form.options?.[number - 1];
    if (!option) throw new Error('Select a panel option first.');
    return { ...clone(form), ...optionSpecs(form, option), solar_panel_make: option.brandName,
        options: [{ ...clone(option), ...optionSpecs(form, option) }] };
}
// Quotes of one client share a key: quotation_data.client_id. Older quotes have none,
// so each is its own client (an old 1-page copy joins the 3-page quote it came from).
export const clientKey = row => row?.client_id || row?.quotation_data?.client_id || row?.final_of || row?.quotation_data?.final_of || row?.id;
const supersededOf = row => row?.superseded_by || row?.quotation_data?.superseded_by || null;
const finalIdOf = row => row?.final_id || row?.quotation_data?.final_id || null;
const createdOf = row => String(row?.created_at || '');
export const CLIENT_TABS = ['all', 'open', 'picked', 'converted', 'lost'];
// A client can have up to three quotes (options), numbered Quote-<client no>-1, -2, -3.
export const MAX_QUOTES = 3;
export const clientSeqOf = row => Number(row?.client_seq || row?.quotation_data?.client_seq) || null;
export const clientNoOf = row => row?.client_no || row?.quotation_data?.client_no || row?.quotation_no;
// Quotes that are shown: not a replaced revision, and not an old 3-page quote whose 1-page copy is here.
export function liveQuotes(rows) {
    const ids = new Set(rows.map(row => row.id));
    return rows.filter(row => !supersededOf(row) && !(finalIdOf(row) && ids.has(finalIdOf(row))));
}
// A client is converted once a quote is added to leads, lost when every quote is lost,
// picked when they chose a quote, else open.
export function clientStatus(quotes) {
    const states = quotes.map(statusOf);
    if (states.includes('converted')) return 'converted';
    if (states.every(s => s === 'lost')) return 'lost';
    if (states.includes('picked')) return 'picked';
    return 'open';
}
// The list as clients, newest activity first, each with its quotes oldest first (Quote 1, 2 ...).
export function groupClients(rows) {
    const groups = new Map();
    for (const row of liveQuotes(rows)) {
        const key = clientKey(row);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }
    return [...groups.entries()].map(([key, quotes]) => {
        quotes.sort((a, b) => (clientSeqOf(a) || 1) - (clientSeqOf(b) || 1) || createdOf(a).localeCompare(createdOf(b)) || (a.quotation_no || 0) - (b.quotation_no || 0));
        const latest = quotes.at(-1);
        const status = clientStatus(quotes);
        // The quote the client chose: the one added to leads, else the one marked picked.
        const picked = quotes.find(q => statusOf(q) === (status === 'converted' ? 'converted' : 'picked')) || null;
        const place = [latest.village || latest.quotation_data?.form?.village, latest.district || latest.quotation_data?.form?.district].filter(Boolean)[0] || '';
        return { key, quotes, latest, picked, status, name: latest.customer_name, phone: latest.customer_phone, place, full: quotes.length >= MAX_QUOTES };
    }).sort((a, b) => createdOf(b.latest).localeCompare(createdOf(a.latest)));
}
export function tallyClients(clients) {
    const counts = Object.fromEntries(CLIENT_TABS.map(tab => [tab, tab === 'all' ? clients.length : clients.filter(c => c.status === tab).length]));
    // The sidebar badge: clients still waiting on an outcome.
    return { ...counts, waiting: counts.open + counts.picked };
}
// Panel brand of a quote (its picked option on an older three-option quote).
export function quoteBrand(row) {
    const options = row?.options || row?.quotation_data?.form?.options || [];
    if (options.length > 1 && !row?.selected_option) return `${options.length} brands`;
    return options[(row?.selected_option || 1) - 1]?.brandName || options[0]?.brandName || row?.solar_panel_make || '';
}
// kW and price for the overview; an older three-option quote shows its picked option.
export function quoteFigures(row) {
    const options = row?.options || row?.quotation_data?.form?.options || [];
    const option = options.length > 1 && row?.selected_option ? options[row.selected_option - 1] : null;
    if (option) return { kw: option.capacity_kw ?? null, price: option.netPayableAmount ?? null };
    return { kw: row?.capacity_kw ?? null, price: row?.starting_price ?? null };
}
// A new quote for an existing client: their details and their last quote's panel, dated today.
export function nextQuoteForm(row, user = {}) {
    const fresh = newForm(user);
    const form = fromRow(row, user);
    const number = row.selected_option && form.options[row.selected_option - 1] ? row.selected_option : 1;
    return { ...oneOption(form, number), quotation_date: fresh.quotation_date, valid_until: fresh.valid_until,
        owner_name_snapshot: fresh.owner_name_snapshot || form.owner_name_snapshot, owner_phone_snapshot: fresh.owner_phone_snapshot || form.owner_phone_snapshot,
        print_owner_name: '', source_lead_id: null, client_id: clientKey(row) };
}
export function toLead(form, choice = null, knownBrands = []) {
    const lead = Object.fromEntries(Object.entries(leadMapping).map(([field, target]) => [target, form[field] ?? '']));
    if (choice) {
        lead.module_brand = leadBrand(choice.brandName, knownBrands);
        const specs = optionSpecs(form, choice);
        lead.module_wp = specs.panel_wattage;
        lead.no_of_modules = specs.solar_panel_qty;
        lead.system_capacity_kwp = specs.capacity_kw;
        // Net payable is the agreed project amount, before the customer subsidy.
        lead.invoice_value = choice.netPayableAmount;
    }
    return lead;
}
// The three priced options a customer can choose when the quote is won (1-based number).
export function chosenOptions(form) {
    return calculate(form?.options || [], extraCharges(form))
        .map((option, index) => ({ ...option, ...optionSpecs(form, form.options[index]), number: index + 1 }))
        .filter(option => option.baseValue > 0);
}
// CRM brand names are short capitals (TATA, WAAREE, ADANI); match the option's brand to one.
export function leadBrand(brandName, known = []) {
    const first = String(brandName || '').trim().split(/\s+/)[0].toUpperCase();
    return known.find(name => String(name).toUpperCase() === first) || first || '';
}
// Blank (or 0) means the charge is included in the price.
export const chargeAmount = value => (String(value ?? '').trim() === '' ? 0 : round(value));
export const chargeLabel = value => (chargeAmount(value) > 0 ? chargeAmount(value) : 'Included');
export const extraCharges = form => round(chargeAmount(form?.geb_charge) + chargeAmount(form?.geda_charge));
// Sets geb_charge or geda_charge ('' = Included, or an amount) and keeps the older
// single Including/Excluding choice in step, so an old "Excluding" quote stops printing it once edited.
export function withCharge(form, key, value) {
    if (!['geb_charge', 'geda_charge'].includes(key)) throw new Error(`Unknown charge: ${key}`);
    const next = { ...form, [key]: value };
    return { ...next, geb_geda_charge: extraCharges(next) > 0 ? 'Excluding' : 'Including' };
}
// An older quote saved "Excluding" with no amounts; it still prints "Excluding".
export const legacyExcluding = form => form?.geb_geda_charge === 'Excluding' && extraCharges(form) === 0;
export function calculate(options, charges = 0) {
    return options.map(option => {
        const baseValue = round(option.baseValue), discount = round(option.discount), subsidy = round(option.subsidy);
        const netPayableAmount = round(baseValue - discount + round(charges));
        return { ...option, brandName: option.brandName, baseValue, discount, subsidy, netPayableAmount, netPriceAfterSubsidy: round(netPayableAmount - subsidy) };
    });
}
export function validate(form) {
    const errors = [];
    const required = (key, title, step) => { if (!String(form[key] ?? '').trim()) errors.push(`${STEPS[step]}: ${title} is required`); };
    [['customer_name','Customer name'],['quotation_date','Quotation date'],['owner_name_snapshot','Salesperson name']].forEach(([key,title]) => required(key,title,0));
    const validPhone = value => /^(?:91)?[6-9]\d{9}$/.test(String(value || '').replace(/[\s()+-]/g,''));
    if (!validPhone(form.customer_phone)) errors.push('Customer: Enter a valid Indian mobile number');
    // Salesperson phone is profile-derived and optional. Keep it on the document
    // when available, but never block saving, previewing, or issuing a quotation.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.quotation_date) || !Number.isFinite(Date.parse(form.quotation_date))) errors.push('Customer: Enter a valid quotation date');
    if (form.valid_until && form.valid_until < form.quotation_date) errors.push('Customer: Valid-until date cannot precede quotation date');
    if (form.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email)) errors.push('Customer: Enter a valid email');
    [['inverter_brand','Inverter brand / make']].forEach(([key,title]) => required(key,title,1));
    if (!['Residential','Commercial'].includes(form.project_type)) errors.push('Pricing: Select a project type');
    [['geb_charge','GEB charge'],['geda_charge','GEDA charge']].forEach(([key,title]) => {
        const v = form[key];
        if (String(v ?? '').trim() !== '' && !(Number.isFinite(Number(v)) && Number(v) >= 0)) errors.push(`Pricing: ${title} must be blank (Included) or an amount`);
    });
    if (![1, 3].includes(form.options?.length)) errors.push('Pricing: Choose 1 or 3 options');
    (form.options || []).forEach((option, i) => {
        const prefix = `Pricing: Option ${i + 1}`;
        const specs = optionSpecs(form, option);
        if (!(Number(specs.capacity_kw) > 0) || !Number.isFinite(Number(specs.capacity_kw))) errors.push(`${prefix} capacity must be greater than zero`);
        if (!(Number(specs.solar_panel_qty) > 0 && Number.isInteger(Number(specs.solar_panel_qty)))) errors.push(`${prefix} panel quantity must be a positive whole number`);
        if (!(Number(specs.panel_wattage) > 0) || !Number.isFinite(Number(specs.panel_wattage))) errors.push(`${prefix} Module Wp must be greater than zero`);
        if (!option.brandName?.trim()) errors.push(`${prefix} brand is required`);
        if (!(Number(option.baseValue) > 0) || !Number.isFinite(Number(option.baseValue))) errors.push(`${prefix} base value must be greater than zero`);
        for (const key of ['discount','subsidy']) if (option[key] === '' || !Number.isFinite(Number(option[key])) || Number(option[key]) < 0) errors.push(`${prefix} ${key} must be non-negative`);
        if (Number(option.discount) > Number(option.baseValue)) errors.push(`${prefix} discount exceeds base value`);
        if (Number(option.subsidy) > Number(option.baseValue) - Number(option.discount)) errors.push(`${prefix} subsidy exceeds net payable`);
        if (Number(option.baseValue) > 999999999999.99) errors.push(`${prefix} amount is too large`);
    });
    if ((form.custom_notes || []).length > 5 || (form.custom_notes || []).some(n => n.length > 250)) errors.push('Notes & review: Use at most five notes of 250 characters each');
    return errors;
}
export function freshTemplate() { return clone(INITIAL_QUOTATION); }
export function fromRow(row, user) {
    if (row.schema_version !== 1) throw new Error('This quotation uses a newer format. Update the CRM before editing it.');
    const form = { ...newForm(user), ...Object.fromEntries(Object.keys(newForm(user)).filter(k => row[k] != null).map(k => [k,row[k]])), ...row.quotation_data?.form };
    return { ...form, options: form.options.map(option => ({ ...option, ...optionSpecs(form, option) })) };
}
export function payload(form, template) {
    form = { ...form, ...optionSpecs(form, form.options?.[0]), options: form.options.map(option => ({ ...option, ...optionSpecs(form, option) })) };
    const columns = Object.keys(newForm()).filter(k => !['options','custom_notes','geb_charge','geda_charge','print_owner_name'].includes(k));
    const values = Object.fromEntries(columns.map(k => [k, form[k] === '' ? null : form[k]]));
    // Retain the legacy column for older clients without a second editable brand.
    values.solar_panel_make = form.options?.[0]?.brandName || form.solar_panel_make || null;
    values.geb_geda_charge = extraCharges(form) > 0 ? 'Excluding' : 'Including';
    ['capacity_kw','solar_panel_qty','panel_wattage'].forEach(k => { values[k] = Number(form[k]) > 0 ? Number(form[k]) : null; });
    const options = calculate(form.options, extraCharges(form));
    const prices = options.filter(b => b.baseValue > 0 && b.netPayableAmount >= 0 && Number.isFinite(b.netPayableAmount)).map(b => b.netPayableAmount);
    return { ...values, starting_price: prices.length ? Math.min(...prices) : null, schema_version: 1,
        quotation_data: { schema_version: 1, template_version: 1, template: clone(template), form: { ...clone(form), options } } };
}
// The printed address: the full address, then village, taluka, district and PIN
// only when they are not already written in it (or in a part before them).
// Stops "..., PATAN, PIN Code: 384265, PATAN, PATAN, PATAN, 384265".
export function addressLine(form) {
    const flat = text => ` ${String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
    const parts = [];
    let seen = ' ';
    for (const value of [form.full_address, form.village, form.taluka, form.district, form.pincode]) {
        const text = String(value ?? '').trim();
        if (!text) continue;
        const words = flat(text);
        if (words.trim() && seen.includes(words)) continue;
        parts.push(text);
        seen += words;
    }
    return parts.join(', ');
}
export function documentFor(row) {
    const form = fromRow(row);
    const data = clone(row.quotation_data?.template || INITIAL_QUOTATION);
    data.page1 = { ...data.page1, customerName: form.customer_name || '', customerPhone: form.customer_phone || '',
        quotationNo: quoteLabel(row), date: form.quotation_date ? form.quotation_date.split('-').reverse().join('-') : '',
        capacityKw: form.options.length === 1 || new Set(form.options.map(o => String(o.capacity_kw))).size === 1 ? `${form.options[0]?.capacity_kw || ''} kWp` : 'Panel options', yoursTrulyName: form.print_owner_name?.trim() || form.owner_name_snapshot || '', yoursTrulyPhone: form.owner_phone_snapshot || '',
        address: addressLine(form),
        email: form.customer_email || '', validUntil: form.valid_until || '' };
    data.page2 = { ...data.page2, solarPanelMake: form.solar_panel_make || '', solarPanelQty: form.solar_panel_qty || '', panelWattage: form.panel_wattage || '',
        inverterOption: form.inverter_option || '', inverterBrand: form.inverter_brand || '', gebGedaCharge: form.geb_geda_charge || 'Including',
        // Quotations saved before the split show their old single choice.
        gebCharge: extraCharges(form) === 0 && form.geb_geda_charge === 'Excluding' ? 'Excluding' : chargeLabel(form.geb_charge),
        gedaCharge: extraCharges(form) === 0 && form.geb_geda_charge === 'Excluding' ? 'Excluding' : chargeLabel(form.geda_charge),
        projectType: form.project_type || 'Residential', projectSize: form.options.length === 1 ? `${form.options[0]?.capacity_kw || ''} kWp` : 'Per option', brandOptions: calculate(form.options || [], extraCharges(form)),
        notes: [...data.page2.notes, ...(form.custom_notes || []).filter(n => n && n.trim())] };
    data.page3.bomItems = data.page3.bomItems.map(item => {
        if (/^solar modules$/i.test(item.description)) return { ...item,
            qty: new Set(form.options.map(option => String(option.solar_panel_qty))).size > 1 ? 'Per option' : String(form.solar_panel_qty || item.qty),
            size: new Set(form.options.map(option => String(option.panel_wattage))).size > 1 ? 'See page 2' : form.panel_wattage ? `${form.panel_wattage} Wp` : item.size,
            make: form.options.length === 1 ? form.options[0].brandName : 'See price options on page 2' };
        if (/inverter/i.test(item.description) && form.inverter_brand) return { ...item, make: form.inverter_brand };
        return item;
    });
    if (form.valid_until) data.page3.termsAndConditions = data.page3.termsAndConditions.map(t => t.sr === 10 ? { ...t, remarks: `Valid until ${form.valid_until.split('-').reverse().join('-')}` } : t);
    return data;
}
// Revisions: { baseNo, n }. n = 0 for the original quotation.
export function revisionInfo(row) {
    const r = row?.quotation_data?.revision || row?.revision;
    return r ? { baseNo: r.base_no, n: r.n } : { baseNo: row?.quotation_no, n: 0 };
}
export const quoteLabel = row => {
    // Quotes made since quotes are grouped by client carry the client's number and their place: Quote-3255-2.
    if (clientSeqOf(row)) return clientNoOf(row) ? `Quote-${clientNoOf(row)}-${clientSeqOf(row)}` : 'Quote-DRAFT';
    if (isFinalQuotation(row)) return row.quotation_no ? `Quote-${row.quotation_no}` : 'Quote-DRAFT';
    const { baseNo, n } = revisionInfo(row);
    if (!baseNo) return 'Quote-DRAFT';
    return n ? `Quote-${baseNo}-R${n}` : `Quote-${baseNo}`;
};
// Saved under the customer's full name and quote number, e.g. "Ramesh Kumar Patel (Quote-3255).pdf",
// so a client's quotes do not overwrite each other. Only characters that file systems reject are removed.
export const pdfName = row => {
    const name = String(row.customer_name || 'Quotation').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,100) || 'Quotation';
    return `${name} (${quoteLabel(row)}).pdf`;
};
