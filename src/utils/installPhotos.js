// Installation photos (client list from Sandeep, 2026-11-19): 17 named photos the installer
// takes at the end of an installation. Each one is a customer document with its own doc_type,
// like the geo tag photo, so no database change is needed. The names are the client's own words
// (Gujarati included); do not "correct" them. List: docs/client-requests-2026-11-14/installation-photos.md
//
// Whether all 17 are required before the stage moves is not decided yet (asked 2026-11-19):
// the app only shows what is missing and does not block.

export const INSTALL_PHOTOS = [
    { docType: 'install_plant_photo', name: 'Plant Photo' },
    { docType: 'install_la', name: 'LA' },
    { docType: 'install_la_earthing', name: 'La Earthing' },
    { docType: 'install_body_earthing_structure', name: 'Body Earthing Structure' },
    { docType: 'install_nut_bolt_tightness', name: 'Nut bolt ટાઈટનેસ with Marking' },
    { docType: 'install_mc4_connector', name: 'MC4 Connector' },
    { docType: 'install_inverter_display', name: 'Inverter Display' },
    { docType: 'install_acdb_open', name: 'Acdb open photo' },
    { docType: 'install_dcdb_open', name: 'Dcdb open photo' },
    { docType: 'install_system_far', name: 'System no dur thi photo' },
    { docType: 'install_inverter_body_earthing', name: 'Inverter body Earthing' },
    { docType: 'install_inverter_mc4', name: 'Inverter MC4 Connector' },
    { docType: 'install_earthing_3', name: 'Earthing 3 photo' },
    { docType: 'install_earthing_far', name: 'Earthing no dur thi photo' },
    { docType: 'install_google_review', name: 'Customer Reviews google no photo' },
    { docType: 'install_feedback_form_sign', name: 'Feedback form sign photo' },
    { docType: 'install_inverter_serial', name: 'Inverter serial number photo' },
];

// doc_type -> the client's name, for the documents list.
export const INSTALL_PHOTO_LABELS = Object.fromEntries(INSTALL_PHOTOS.map(({ docType, name }) => [docType, name]));

export const isInstallPhotoType = docType => Object.prototype.hasOwnProperty.call(INSTALL_PHOTO_LABELS, docType);

const uploadedAt = doc => Date.parse(doc?.uploaded_at || doc?.created_at || '') || 0;

// Where the 17 photos stand for one customer's documents:
// { total, done, missing: [{ docType, name, number }], slots: [{ docType, name, number, doc }] }.
// When a slot has more than one file (a retake whose old copy could not be removed), the newest counts.
export function installPhotoStatus(documents = []) {
    const newest = {};
    for (const doc of documents || []) {
        if (!doc || !isInstallPhotoType(doc.doc_type)) continue;
        if (!newest[doc.doc_type] || uploadedAt(doc) >= uploadedAt(newest[doc.doc_type])) newest[doc.doc_type] = doc;
    }
    const slots = INSTALL_PHOTOS.map((photo, index) => ({ ...photo, number: index + 1, doc: newest[photo.docType] || null }));
    const missing = slots.filter(slot => !slot.doc).map(({ docType, name, number }) => ({ docType, name, number }));
    return { total: slots.length, done: slots.length - missing.length, missing, slots };
}
