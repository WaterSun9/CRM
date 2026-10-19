// Customer warranty: 5 years from commissioning. There is no separate
// commissioning column, so installation_date stands in for it, then
// material_delivery_date, then the day the customer moved to Completed (IST).
// The database works this out the same way (public.warranty_end_for and the
// service_issues insert trigger in 20261012190000_service_jobs_v2.sql), so a
// change here must be made there too.

export const WARRANTY_YEARS = 5;

export const WARRANTY_STATUS_LABELS = {
    in_warranty: 'In warranty',
    out_of_warranty: 'Out of warranty',
    unknown: 'Warranty date missing',
};

const IST_OFFSET_MS = 330 * 60 * 1000;   // India has no daylight saving: always UTC+05:30
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n, width = 2) => String(n).padStart(width, '0');
const toIso = (y, m, d) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// 'YYYY-MM-DD' (a date column, or the start of a longer string) -> [y, m, d],
// or null for blanks and impossible dates like 2025-02-30.
const parseIsoDate = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? '').trim());
    if (!match) return null;
    const [y, m, d] = match.slice(1).map(Number);
    if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
    return [y, m, d];
};

const isoDateOnly = (value) => {
    const parts = parseIsoDate(value);
    return parts ? toIso(...parts) : null;
};

const addDays = (iso, days) => {
    const [y, m, d] = parseIsoDate(iso);
    return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
};

// Same as Postgres `date + interval 'n years'`: 29 Feb lands on 28 Feb.
const addYears = (iso, years) => {
    const [y, m, d] = parseIsoDate(iso);
    return toIso(y + years, m, Math.min(d, daysInMonth(y + years, m)));
};

// Calendar date in India for an instant (Date, ISO timestamp or epoch ms).
const istDateOf = (instant) => {
    const time = instant instanceof Date ? instant.getTime() : new Date(instant).getTime();
    if (!Number.isFinite(time)) return null;
    return new Date(time + IST_OFFSET_MS).toISOString().slice(0, 10);
};

export function todayIST(now = new Date()) {
    return istDateOf(now);
}

// Where the warranty starts for this customer, and which field it came from.
export function warrantyStartOf(customer) {
    const installed = isoDateOnly(customer?.installation_date);
    if (installed) return { date: installed, source: 'installation_date' };
    const delivered = isoDateOnly(customer?.material_delivery_date);
    if (delivered) return { date: delivered, source: 'material_delivery_date' };
    const completed = customer?.completed_at ? istDateOf(customer.completed_at) : null;
    if (completed) return { date: completed, source: 'completed_at' };
    return { date: null, source: null };
}

// Last day of cover: start + 5 years - 1 day (12 Oct 2021 -> 11 Oct 2026).
export function warrantyEndDate(startIso) {
    const start = isoDateOnly(startIso);
    if (!start) return null;
    return addDays(addYears(start, WARRANTY_YEARS), -1);
}

export function warrantyInfo(customer, todayIso = todayIST()) {
    const { date: start, source } = warrantyStartOf(customer);
    const end = warrantyEndDate(start);
    if (!end) return { status: 'unknown', start: null, end: null, source: null };
    // ISO dates compare correctly as plain strings.
    return { status: todayIso > end ? 'out_of_warranty' : 'in_warranty', start, end, source };
}

// The latest start date whose warranty has already ended on todayIso: a start
// on or before this date is out of warranty. Used for the server-side filter
// on the Warranty page. Found by stepping from "today minus 5 years"
// so the 29 Feb clamping matches warrantyEndDate exactly.
export function expiredStartCutoff(todayIso = todayIST()) {
    const today = isoDateOnly(todayIso);
    if (!today) return null;
    const isExpired = (start) => warrantyEndDate(start) < today;
    let cutoff = addYears(today, -WARRANTY_YEARS);
    while (!isExpired(cutoff)) cutoff = addDays(cutoff, -1);
    while (isExpired(addDays(cutoff, 1))) cutoff = addDays(cutoff, 1);
    return cutoff;
}

// UTC instant of 00:00 IST on a date, for comparing against timestamptz
// columns such as completed_at ('2021-10-12' -> '2021-10-11T18:30:00.000Z').
export function istMidnightUtc(iso) {
    const parts = parseIsoDate(iso);
    if (!parts) return null;
    const [y, m, d] = parts;
    return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS).toISOString();
}

// PostgREST .or() filter for admin rows whose warranty has ended by todayIso.
// Same start-date order as warrantyStartOf; the timestamp is double-quoted
// because PostgREST reserves ':' and '.' inside or().
export function expiredWarrantyOrFilter(todayIso = todayIST()) {
    const cutoff = expiredStartCutoff(todayIso);
    const completedBefore = istMidnightUtc(addDays(cutoff, 1));
    return [
        `installation_date.lte.${cutoff}`,
        `and(installation_date.is.null,material_delivery_date.lte.${cutoff})`,
        `and(installation_date.is.null,material_delivery_date.is.null,completed_at.lt."${completedBefore}")`,
    ].join(',');
}

// PostgREST .or() filter for admin rows still in warranty on todayIso: has a start
// date and it is after the expired cutoff. Exactly the rows expiredWarrantyOrFilter
// leaves out, minus the ones with no date at all.
export function inWarrantyOrFilter(todayIso = todayIST()) {
    const cutoff = expiredStartCutoff(todayIso);
    const completedFrom = istMidnightUtc(addDays(cutoff, 1));
    return [
        `installation_date.gt.${cutoff}`,
        `and(installation_date.is.null,material_delivery_date.gt.${cutoff})`,
        `and(installation_date.is.null,material_delivery_date.is.null,completed_at.gte."${completedFrom}")`,
    ].join(',');
}

// '2031-10-11' -> '11 Oct 2031'
export function formatWarrantyDate(iso) {
    const parts = parseIsoDate(iso);
    if (!parts) return '';
    const [y, m, d] = parts;
    return `${d} ${MONTHS[m - 1]} ${y}`;
}
