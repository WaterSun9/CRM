import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTALL_PHOTOS, INSTALL_PHOTO_LABELS, REQUIRED_INSTALL_PHOTOS, installPhotoStatus, isInstallPhotoType, requiredInstallPhotoProblems } from '../src/utils/installPhotos.js';

test('the 17 photos keep the client names exactly, Gujarati included', () => {
    assert.equal(INSTALL_PHOTOS.length, 17);
    assert.equal(INSTALL_PHOTOS[0].name, 'Plant Photo');
    assert.equal(INSTALL_PHOTOS[4].name, 'Nut bolt ટાઈટનેસ with Marking');
    assert.equal(INSTALL_PHOTOS[16].name, 'Inverter serial number photo');
    assert.equal(new Set(INSTALL_PHOTOS.map(p => p.docType)).size, 17, 'doc types are unique');
    assert.ok(INSTALL_PHOTOS.every(p => p.docType.startsWith('install_')));
    assert.ok(!isInstallPhotoType('geo_tag_image'), 'the geo tag photo stays its own document');
    assert.equal(INSTALL_PHOTO_LABELS.install_la, 'LA');
});

test('nothing uploaded: 0/17 and every name missing in order', () => {
    const s = installPhotoStatus([]);
    assert.equal(s.done, 0);
    assert.equal(s.total, 17);
    assert.deepEqual(s.missing.map(m => m.number), Array.from({ length: 17 }, (_, i) => i + 1));
});

test('counts only installation photos, the newest per slot', () => {
    const docs = [
        { id: 'a', doc_type: 'install_la', uploaded_at: '2026-11-19T05:00:00Z' },
        { id: 'b', doc_type: 'install_la', uploaded_at: '2026-11-19T06:00:00Z' },
        { id: 'c', doc_type: 'install_plant_photo', uploaded_at: '2026-11-19T05:00:00Z' },
        { id: 'd', doc_type: 'geo_tag_image' },
        { id: 'e', doc_type: 'pan_card' },
        null,
    ];
    const s = installPhotoStatus(docs);
    assert.equal(s.done, 2);
    assert.equal(s.missing.length, 15);
    assert.equal(s.slots.find(slot => slot.docType === 'install_la').doc.id, 'b');
    assert.ok(!s.missing.some(m => m.name === 'LA' || m.name === 'Plant Photo'));
});

test('all 17 uploaded: nothing missing', () => {
    const s = installPhotoStatus(INSTALL_PHOTOS.map((p, i) => ({ id: String(i), doc_type: p.docType })));
    assert.equal(s.done, 17);
    assert.deepEqual(s.missing, []);
});

test('D-043: only #17 Inverter serial number photo is required', () => {
    assert.deepEqual(REQUIRED_INSTALL_PHOTOS.map(p => p.docType), ['install_inverter_serial']);
    assert.deepEqual(installPhotoStatus([]).requiredMissing.map(m => m.number), [17]);
    assert.deepEqual(requiredInstallPhotoProblems([]), ['Installation photo 17: Inverter serial number photo (required)']);
    // 16 optional photos without #17 still blocks; #17 alone does not.
    const sixteen = INSTALL_PHOTOS.filter(p => !p.required).map((p, i) => ({ id: String(i), doc_type: p.docType }));
    assert.equal(requiredInstallPhotoProblems(sixteen).length, 1);
    assert.deepEqual(requiredInstallPhotoProblems([{ id: 'x', doc_type: 'install_inverter_serial' }]), []);
});

test('a photo sent back or replaced does not count as taken (2026-11-20)', () => {
    const docs = [
        { id: 'a', doc_type: 'install_la', remark: '[RETURNED] Please upload the correct document.' },
        { id: 'b', doc_type: 'install_plant_photo', remark: '[REPLACED] old' },
        { id: 'c', doc_type: 'install_plant_photo', remark: '' },
    ];
    const status = installPhotoStatus(docs);
    assert.equal(status.done, 1);
    assert.ok(status.missing.some(m => m.docType === 'install_la'));
});
