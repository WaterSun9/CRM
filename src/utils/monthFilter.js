// Month filter for Leads and Registration. Each option carries its year
// ("2026-12"), so choosing December in January means last December, not the
// December still to come.

const pad = n => String(n).padStart(2, '0');

// The last `count` months, newest first: [['2026-11', 'November 2026'], ...].
export function recentMonthOptions(now = new Date(), count = 12) {
    const options = [];
    for (let i = 0; i < count; i += 1) {
        const day = new Date(now.getFullYear(), now.getMonth() - i, 1);
        options.push([`${day.getFullYear()}-${pad(day.getMonth() + 1)}`,
            day.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })]);
    }
    return options;
}

// "YYYY-MM" for a filter value: 'this-month', a "YYYY-MM" option, or an old
// month-only value ("12"), which means the latest such month up to now.
export function monthValueFor(selected, now = new Date()) {
    if (!selected) return '';
    if (selected === 'this-month') return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    if (/^\d{4}-\d{2}$/.test(selected)) return selected;
    if (/^\d{2}$/.test(selected)) {
        const month = Number(selected);
        const year = month > now.getMonth() + 1 ? now.getFullYear() - 1 : now.getFullYear();
        return `${year}-${selected}`;
    }
    return '';
}
