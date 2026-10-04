// Keep stage lists current when a save or realtime event changes a row in place.
// Older records without updated_at fall back to their creation time for order.
const timestamp = value => {
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(time) ? time : 0;
};

export const newestCustomerFirst = (a, b) =>
    (timestamp(b?.updated_at) || timestamp(b?.created_at))
    - (timestamp(a?.updated_at) || timestamp(a?.created_at))
    || timestamp(b?.created_at) - timestamp(a?.created_at);

export const formatCustomerTimestamp = value => {
    if (!timestamp(value)) return '—';
    return new Date(value).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
};
