import test from 'node:test';
import assert from 'node:assert/strict';
import {
    PARTNER_TYPES, PHOTO_LIMIT, PHOTOS_NEEDED_TEXT, COMMENT_MAX,
    groupIssueFiles, photoCounts, hasCompletionPhotos, photoCountLabel, photoSlotsLeft, pickPhotos,
    isOpenJobFor, canUploadPhotos, canDeletePhoto, isPhotoType, photoPath, photoError, plainError,
    canComment, canDeleteComment, cleanComment, commentFits, commentError, missingTable,
} from '../src/components/service/serviceLabels.js';

const TECH = 'tech-1', OTHER = 'tech-2';
const job = (status, assigned_to = TECH) => ({ id: 'issue-1', status, assigned_to });
const file = (kind, uploaded_by = TECH) => ({ id: `${kind}-${Math.random()}`, kind, uploaded_by });

test('files are grouped by kind; old files and unknown kinds count as problem files', () => {
    const groups = groupIssueFiles([file('before'), file('after'), file('after'), file('problem'), { id: 'x' }, file('weird')]);
    assert.equal(groups.before.length, 1);
    assert.equal(groups.after.length, 2);
    assert.equal(groups.problem.length, 3);
    assert.deepEqual(groupIssueFiles(null), { before: [], after: [], problem: [] });
});

test('the code needs at least one Before and one After photo', () => {
    assert.deepEqual(photoCounts([file('before'), file('problem')]), { before: 1, after: 0 });
    assert.equal(hasCompletionPhotos(photoCounts([file('before'), file('problem')])), false);
    assert.equal(hasCompletionPhotos(photoCounts([file('after')])), false);
    assert.equal(hasCompletionPhotos(photoCounts([file('before'), file('after')])), true);
    assert.equal(hasCompletionPhotos(null), false, 'unknown while the photos load');
    assert.equal(PHOTOS_NEEDED_TEXT, 'Add at least one Before and one After photo first.');
});

test('10 photos of each kind: counts, slots left and skipped picks', () => {
    assert.equal(PHOTO_LIMIT, 10);
    assert.equal(photoCountLabel('before', 3), 'Before 3/10');
    assert.equal(photoCountLabel('after', 10), 'After 10/10');
    assert.equal(photoSlotsLeft(0), 10);
    assert.equal(photoSlotsLeft(9), 1);
    assert.equal(photoSlotsLeft(12), 0);
    const { take, skipped } = pickPhotos(['a', 'b', 'c'], 8);
    assert.deepEqual(take, ['a', 'b']);
    assert.deepEqual(skipped, ['c']);
    assert.deepEqual(pickPhotos(['a'], 10), { take: [], skipped: ['a'] });
});

test('only the technician on an open job uploads', () => {
    for (const status of ['assigned', 'completion_pending']) assert.equal(canUploadPhotos(job(status), TECH, 'technician'), true, status);
    for (const status of ['open', 'completed', 'cancelled']) assert.equal(canUploadPhotos(job(status), TECH, 'technician'), false, status);
    assert.equal(canUploadPhotos(job('assigned', OTHER), TECH, 'technician'), false, 'someone else\'s job');
    assert.equal(canUploadPhotos(job('assigned'), null, 'technician'), false);
    for (const type of ['admin', 'sales', ...PARTNER_TYPES]) assert.equal(canUploadPhotos(job('assigned', TECH), TECH, type), false, type);
    assert.equal(isOpenJobFor(undefined, TECH), false);
});

test('office deletes any file; the technician only their own while the job is open; partners never', () => {
    const mine = file('before', TECH);
    assert.equal(canDeletePhoto(mine, job('completed'), 'admin-1', 'admin'), true);
    assert.equal(canDeletePhoto(file('problem', 'someone'), job('open', null), 'sales-1', 'sales'), true);
    assert.equal(canDeletePhoto(mine, job('assigned'), TECH, 'technician'), true);
    assert.equal(canDeletePhoto(mine, job('completion_pending'), TECH, 'technician'), true);
    assert.equal(canDeletePhoto(mine, job('completed'), TECH, 'technician'), false);
    assert.equal(canDeletePhoto(file('before', OTHER), job('assigned'), TECH, 'technician'), false);
    for (const type of PARTNER_TYPES) assert.equal(canDeletePhoto(mine, job('assigned'), 'cp-1', type), false, type);
});

test('photo types and storage path {issue}/{uid}/{kind}-{id}.ext', () => {
    assert.equal(isPhotoType('image/jpeg'), true);
    assert.equal(isPhotoType('image/png'), true);
    assert.equal(isPhotoType('image/webp'), true);
    for (const type of ['image/heic', 'application/pdf', '', undefined, 'constructor']) assert.equal(isPhotoType(type), false, String(type));
    assert.equal(photoPath('i1', 'u1', 'before', 'abc'), 'i1/u1/before-abc.jpg');
    assert.equal(photoPath('i1', 'u1', 'after', 'abc', 'image/png'), 'i1/u1/after-abc.png');
    assert.equal(photoPath('i1', 'u1', 'after', 'abc', 'image/webp').split('/').length, 3);
});

test('upload failures read as plain words', () => {
    assert.equal(photoError(new Error('Failed to fetch')), 'No internet. Try again.');
    assert.equal(photoError({ message: 'A complaint can have at most 10 before photos' }), 'Only 10 photos of each kind can be added.');
    assert.equal(photoError({ message: 'The object exceeded the maximum allowed size' }), 'The photo is too large.');
    assert.equal(photoError({ message: 'mime type image/heic is not supported' }), 'Only JPG, PNG or WebP photos can be added.');
    assert.equal(photoError({ message: 'new row violates row-level security policy' }), 'This job is not open for you any more. Refresh the page.');
    assert.equal(photoError({ message: 'Something else' }), 'Something else');
    assert.equal(photoError(null), 'Could not add the photo.');
    // Messages made on the phone (shrinking) are kept word for word.
    assert.equal(photoError(plainError('Only JPG, PNG or WebP photos can be added. Use Take photo instead.')),
        'Only JPG, PNG or WebP photos can be added. Use Take photo instead.');
    // The database's own limit and type messages.
    assert.equal(photoError({ message: 'A complaint can have at most 10 Before photos. Delete one first.' }), 'Only 10 photos of each kind can be added.');
    assert.equal(photoError({ message: 'Only photos (JPG, PNG or WebP) can be added to a complaint.' }), 'Only JPG, PNG or WebP photos can be added.');
});

test('comments: who can write, trimming, 2000 characters, admin-only delete', () => {
    for (const type of ['admin', 'sales', 'technician', ...PARTNER_TYPES]) assert.equal(canComment(type), true, type);
    for (const type of ['vendor', 'stamp', undefined]) assert.equal(canComment(type), false, String(type));
    assert.equal(canDeleteComment('admin'), true);
    assert.equal(canDeleteComment('sales'), false);
    assert.equal(cleanComment('  hello \n'), 'hello');
    assert.equal(commentFits('   '), false);
    assert.equal(commentFits('x'.repeat(COMMENT_MAX)), true);
    assert.equal(commentFits(`  ${'x'.repeat(COMMENT_MAX)}  `), true, 'spaces around are trimmed first');
    assert.equal(commentFits('x'.repeat(COMMENT_MAX + 1)), false);
    assert.equal(commentError({ code: '42501', message: 'new row violates row-level security policy' }), 'You cannot comment on this complaint.');
    assert.equal(commentError({ code: '23514', message: 'violates check constraint' }), 'Write a comment of 1 to 2000 characters.');
    assert.equal(missingTable({ code: 'PGRST205', message: "Could not find the table 'public.service_issue_comments'" }), true);
    assert.equal(commentError({ code: '42P01', message: 'relation does not exist' }), 'Comments are not set up yet. Ask the office.');
});
