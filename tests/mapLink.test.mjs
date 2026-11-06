import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLatLng, isShortMapLink, mapLinkHint, inIndia, latLngText, mapViewUrl } from '../src/utils/mapLink.js';

const RADHANPUR = { lat: 23.8312, lng: 71.6043 };
const near = (got, want, places = 4) => {
    assert.ok(got, `expected a point, got ${JSON.stringify(got)}`);
    assert.equal(got.lat.toFixed(places), want.lat.toFixed(places));
    assert.equal(got.lng.toFixed(places), want.lng.toFixed(places));
};

test('plain coordinates: comma, space, brackets, degrees, N/E, extra zeros', () => {
    for (const text of [
        '23.8312, 71.6043',
        '23.8312,71.6043',
        '23.8312 71.6043',
        '  23.8312 ,  71.6043  ',
        '(23.8312, 71.6043)',
        '23.831200, 71.604300',
        '23.8312° N, 71.6043° E',
        '23.8312°N 71.6043°E',
        '23.8312N, 71.6043E',
        '23.8312,\n71.6043',
    ]) assert.deepEqual(parseLatLng(text), RADHANPUR, text);
    assert.deepEqual(parseLatLng('+23.5, 72'), { lat: 23.5, lng: 72 });
    assert.deepEqual(parseLatLng('23.5 S, 72 W'), { lat: -23.5, lng: -72 });
});

test('degrees, minutes, seconds (as Google Maps shows on a computer)', () => {
    near(parseLatLng(`23°49'52.3"N 71°36'15.5"E`), { lat: 23.831194, lng: 71.604306 }, 5);
    near(parseLatLng('23°49′52.3″N, 71°36′15.5″E'), { lat: 23.831194, lng: 71.604306 }, 5);
    // Longitude first is still read right.
    near(parseLatLng(`71°36'15.5"E 23°49'52.3"N`), { lat: 23.831194, lng: 71.604306 }, 5);
    assert.equal(parseLatLng(`23°49'52.3"N 71°36'15.5"N`), null, 'two latitudes');
    assert.equal(parseLatLng(`23°75'52.3"N 71°36'15.5"E`), null, '75 minutes');
});

test('Google Maps links: @centre, ?q=, ?query=, !3d!4d pin, without https://', () => {
    near(parseLatLng('https://www.google.com/maps/@23.8312,71.6043,17z'), RADHANPUR);
    near(parseLatLng('https://www.google.com/maps/@23.8312,71.6043,350m/data=!3m1!1e3?entry=ttu'), RADHANPUR);
    near(parseLatLng('https://maps.google.com/?q=23.8312,71.6043'), RADHANPUR);
    near(parseLatLng('https://maps.google.com/maps?q=23.8312%2C71.6043&z=17'), RADHANPUR);
    near(parseLatLng('https://www.google.com/maps/search/?api=1&query=23.8312,71.6043'), RADHANPUR);
    near(parseLatLng('https://www.google.com/maps?q=loc:23.8312+71.6043'), RADHANPUR);
    near(parseLatLng('https://www.google.com/maps/dir/?api=1&destination=23.8312,71.6043'), RADHANPUR);
    near(parseLatLng('google.com/maps/@23.8312,71.6043,17z'), RADHANPUR);
    near(parseLatLng('www.google.co.in/maps/@23.8312,71.6043,15z'), RADHANPUR);
    near(parseLatLng('geo:23.8312,71.6043?z=17'), RADHANPUR);
    // A forwarded WhatsApp message with the link inside.
    near(parseLatLng("Ramesh bhai's house https://maps.google.com/?q=23.8312,71.6043 near temple"), RADHANPUR);
});

test('coordinates inside other words (a forwarded message)', () => {
    for (const text of [
        'Location: 23.8312, 71.6043',
        'Ramesh bhai house 23.8312, 71.6043 (near temple)',
        '23.8312, 71.6043.',
        'Pin - 23.831200 71.604300, gate on the left',
        'Site 23.8312 N, 71.6043 E',
        '23.8312, 71.6043 West gate',
    ]) near(parseLatLng(text), RADHANPUR);
    // The hint is empty, so the office can save it (after "Found ..." and the map link).
    assert.equal(mapLinkHint('Location: 23.8312, 71.6043'), '');
    for (const text of [
        'House 23.83, 71.60',                       // fewer than 3 decimals: could be anything
        'Rs 1250.50, paid 300.25',
        '23.8312, 71.6043 or 23.9000, 71.7000',     // two points: which one?
        '5, 23.8312, 71.6043',                      // part of a longer list of numbers
        '23.8312, 71.6043, 72.5000',
        'lat 23.8312 lng 71.6043',
    ]) assert.equal(parseLatLng(text), null, text);
});

test('negative, out of India and swapped numbers are read but flagged, never saved', () => {
    assert.deepEqual(parseLatLng('-23.8312, 71.6043'), { lat: -23.8312, lng: 71.6043 });
    assert.equal(inIndia(parseLatLng('-23.8312, 71.6043')), false);
    assert.match(mapLinkHint('-23.8312, 71.6043'), /outside India/);
    assert.match(mapLinkHint('23.8312, -71.6043'), /outside India/);
    assert.match(mapLinkHint('0, 0'), /outside India/);
    assert.match(mapLinkHint('37.0001, 72'), /outside India/);
    assert.equal(mapLinkHint('6, 68'), '', 'the box edge counts as India, like the database');
    for (const text of ['71.6043, 23.8312', 'https://www.google.com/maps/@71.6043,23.8312,17z', 'https://maps.google.com/?q=71.6043,23.8312']) {
        assert.equal(inIndia(parseLatLng(text)), false, text);
        assert.match(mapLinkHint(text), /look swapped/, text);
    }
    assert.equal(parseLatLng('91, 72'), null, 'not a latitude at all');
});

test('place, search and directions links; Android geo: links', () => {
    near(parseLatLng('https://www.google.com/maps/place/23.8312,71.6043'), RADHANPUR);
    near(parseLatLng('https://www.google.com/maps/search/23.8312,+71.6043?entry=tts'), RADHANPUR);
    near(parseLatLng(`https://www.google.com/maps/place/23%C2%B049'52.3%22N+71%C2%B036'15.5%22E`), { lat: 23.831194, lng: 71.604306 }, 5);
    // The place in the path is the point; @ is only where the map was looking.
    near(parseLatLng(`https://www.google.com/maps/place/23%C2%B049'52.3%22N+71%C2%B036'15.5%22E/@23.80,71.50,12z`), { lat: 23.831194, lng: 71.604306 }, 5);
    // A route: its last stop is the customer, never the map centre.
    near(parseLatLng('https://www.google.com/maps/dir/23.0,72.0/23.8312,71.6043/@23.4,71.8,10z'), RADHANPUR);
    assert.equal(parseLatLng('https://www.google.com/maps/dir/Radhanpur/Santalpur/@23.4,71.8,10z'), null);
    near(parseLatLng('geo:0,0?q=23.8312,71.6043(Ramesh)'), RADHANPUR);
    near(parseLatLng('geo:0,0?q=23.8312%2C71.6043'), RADHANPUR);
});

test('the dropped pin (!3d!4d) wins over the map centre (@)', () => {
    const link = 'https://www.google.com/maps/place/Radhanpur,+Gujarat+385340/@23.8,71.5,13z/data=!3m1!4b1!4m6!3m5!1s0x395b:0x1!8m2!3d23.8312!4d71.6043!16zL20vMGJ3?entry=ttu';
    near(parseLatLng(link), RADHANPUR);
    // Encoded "!" (%21) is read too.
    near(parseLatLng(link.replace(/!/g, '%21')), RADHANPUR);
    // ?q= wins over @ when there is no pin.
    near(parseLatLng('https://www.google.com/maps/@23.0,72.0,12z?q=23.8312,71.6043'), RADHANPUR);
});

test('short links and links without coordinates give null', () => {
    for (const text of ['https://maps.app.goo.gl/AbCdEf123', 'maps.app.goo.gl/AbCdEf123', 'https://goo.gl/maps/xyz', 'https://g.co/kgs/abc']) {
        assert.equal(parseLatLng(text), null, text);
        assert.equal(isShortMapLink(text), true, text);
    }
    assert.equal(isShortMapLink('https://www.google.com/maps/@23.8312,71.6043,17z'), false);
    assert.equal(isShortMapLink('23.8312, 71.6043'), false);
    assert.equal(parseLatLng('https://www.google.com/maps/place/Radhanpur'), null);
    assert.equal(parseLatLng('https://maps.google.com/?q=Radhanpur+bus+stand'), null);
});

test('never guesses from addresses, pincodes or junk', () => {
    for (const text of [
        '', '   ', null, undefined, '385340', 'Radhanpur 385340', 'Plot 12, near temple, Santalpur',
        '23.8312', '23.8312, 71.6043, 5', '2383.12, 71.6043', '23,8312, 71,6043', 'abc, def', '91, 72', '23, 181',
        '9876543210', 'javascript:alert(1)', 'x'.repeat(5000),
    ]) assert.equal(parseLatLng(text), null, String(text).slice(0, 40));
});

test('inIndia uses the same box as the database (6-37 N, 68-98 E)', () => {
    assert.equal(inIndia(RADHANPUR), true);
    assert.equal(inIndia({ lat: 6, lng: 68 }), true);
    assert.equal(inIndia({ lat: 37, lng: 98 }), true);
    assert.equal(inIndia({ lat: 5.99, lng: 72 }), false);
    assert.equal(inIndia({ lat: 23, lng: 98.01 }), false);
    assert.equal(inIndia(null), false);
});

test('mapLinkHint: what to tell the office', () => {
    assert.equal(mapLinkHint(''), '');
    assert.equal(mapLinkHint('23.8312, 71.6043'), '');
    assert.equal(mapLinkHint('https://www.google.com/maps/@23.8312,71.6043,17z'), '');
    assert.equal(mapLinkHint('https://maps.app.goo.gl/AbCdEf123'), 'Open the link, then copy the coordinates (long-press the pin in Google Maps).');
    assert.match(mapLinkHint('71.6043, 23.8312'), /look swapped/);
    assert.match(mapLinkHint('51.5072, -0.1276'), /outside India/);
    assert.match(mapLinkHint('https://www.google.com/maps/place/Radhanpur'), /no coordinates/);
    assert.match(mapLinkHint('Radhanpur 385340'), /Paste the coordinates like 23\.8312, 71\.6043/);
});

test('latLngText and mapViewUrl', () => {
    assert.equal(latLngText(RADHANPUR), '23.8312, 71.6043');
    assert.equal(latLngText({ lat: 23.123456789, lng: 71.1 }), '23.123457, 71.1');
    assert.equal(latLngText(null), '');
    assert.equal(mapViewUrl(RADHANPUR), 'https://www.google.com/maps/search/?api=1&query=23.8312,71.6043');
    assert.equal(parseLatLng(mapViewUrl(RADHANPUR)).lat, RADHANPUR.lat, 'our own link reads back');
});
