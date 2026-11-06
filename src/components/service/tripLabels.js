// Small helpers shared by the technician trip panel and the office visit form.
// No React here.
import { NEAR_PINCODE_KM, loadPincodes, nearestPincode } from '../../utils/tripKm';

export const isPincode = value => /^[1-9]\d{5}$/.test(String(value || ''));

// The pincode table ({ "385340": [lat, lng], ... }). loadPincodes() caches it.
// Accepts either the points map or the whole file, so a change there does not break this.
export async function pincodePoints() {
    const data = await loadPincodes();
    return data?.points && typeof data.points === 'object' ? data.points : data;
}

// A 6-digit pincode written in an address ("..., Radhanpur 385340"), else ''.
export function pincodeInText(text) {
    const found = String(text || '').match(/(?:^|\D)([1-9]\d{2}\s?\d{3})(?!\d)/g);
    if (!found) return '';
    const last = found[found.length - 1].replace(/\D/g, '');
    return isPincode(last) ? last : '';
}

// One GPS reading. Resolves { lat, lng, accuracy } or rejects with a plain message.
export function phonePosition() {
    return new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && window.isSecureContext === false) {
            reject(new Error('Open the CRM with https:// to use location.'));
            return;
        }
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            reject(new Error('This phone cannot share its location here.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }),
            failure => {
                if (failure?.code === 1) reject(new Error('Location is blocked for the CRM. Allow location for this site in Chrome settings.'));
                else if (failure?.code === 3) reject(new Error('The phone took too long to find the location.'));
                else reject(new Error('The phone could not find its location.'));
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
    });
}

// GPS accuracy as the trips SQL stores it (0.1 m), or null.
export const roundAccuracy = metres => (Number.isFinite(metres) ? Math.round(metres * 10) / 10 : null);

// "about 20 m" / "about 3.2 km" for a GPS accuracy in metres.
export function accuracyText(metres) {
    const value = Number(metres);
    if (!Number.isFinite(value) || value <= 0) return '';
    return value >= 1000 ? `about ${(value / 1000).toFixed(1)} km` : `about ${Math.max(1, Math.round(value))} m`;
}
// Android "approximate location" is a few km wide; worth a warning.
export const ROUGH_ACCURACY_M = 1000;

// "pincode 385001 (typed)" / "near 385340 (phone location, about 20 m)".
// With the pincode table, a phone start saved without a pincode gets the nearest
// one, but only within NEAR_PINCODE_KM (as TripPanel does when saving).
export function startText(trip, points = null) {
    if (!trip) return '';
    if (trip.start_source === 'manual') return `pincode ${trip.start_pincode} (typed)`;
    let near = trip.start_pincode;
    if (!near && points) {
        try {
            const found = nearestPincode(points, trip.start_lat, trip.start_lng);
            near = found && found.km <= NEAR_PINCODE_KM ? found.pincode : null;
        } catch { near = null; }
    }
    const accuracy = accuracyText(trip.start_accuracy_m);
    return near ? `near ${near} (phone location${accuracy ? `, ${accuracy}` : ''})` : `phone location${accuracy ? ` (${accuracy})` : ''}`;
}

// Database answers about trips, in plain words. `who` is 'office' on the office
// visit form, where "Tell the office" would make no sense.
export function tripError(failure, who = 'technician') {
    const message = failure?.message || '';
    // Function or table missing: the trips SQL has not been run yet.
    if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(failure?.code) || /could not find the (function|table)/i.test(message)) {
        return who === 'office'
            ? 'Trips are not set up on the server yet (the trips SQL has not been run).'
            : 'Trips are not set up on the server yet. Tell the office.';
    }
    if (/technician account required/i.test(message)) return 'Only the technician on this job can start a trip.';
    return message || 'Could not save the trip. Try again.';
}
