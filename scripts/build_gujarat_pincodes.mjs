#!/usr/bin/env node
// Builds src/data/gujaratPincodes.json (one point per Gujarat pincode) from
// India Post's "All India Pincode Directory till last month" CSV. The trip km
// estimate (src/utils/tripKm.js) uses these points for the customer's pincode,
// for a typed start pincode, and to name the pincode nearest a phone location.
//
//   node scripts/build_gujarat_pincodes.mjs <path/to/pincode.csv> [out.json] [--verbose]
//
// The CSV is the government file (columns CircleName, RegionName, DivisionName,
// OfficeName, Pincode, OfficeType, Delivery, District, StateName, Latitude,
// Longitude; one row per post office). It is only READ here. If you use a
// newer file, update SOURCE below to say which one, and re-run the tests
// (tests/tripKm.test.mjs checks a few towns).
//
// Why the cleaning is more than "median of the offices": in this file many
// village offices (BO) carry a copied or mistyped coordinate, often the same
// wrong pair on 5-20 villages of one pincode (Radhanpur 385340: 7 villages
// sit on one point 42 km away), and some sub offices (SO) are wrong too
// (Kamli 384140, Kamrej 394185: 40 km off). A plain median follows the copies. So:
//   1. Gujarat rows only; coordinates must be plain decimals inside a Gujarat box.
//   2. A pair used by 3+ different pincodes is a head office's location handed
//      to its sub offices. It is used only for a pincode of the head office's
//      own series (same first 4 digits) with no pair of its own.
//   3. Each DISTINCT pair gets one vote, so a pair copied onto many villages
//      counts once. The best group = the most pairs within 30 km of one pair
//      (then more town offices, then more rows); its point is the median of
//      its town offices (HO / sub office: the town the pincode is named
//      after), else of the group. Offices outside it are dropped as outliers.
//   4. When the groups tie, or no two pairs agree at all, the pincode's series
//      neighbours (other pincodes with the same first 4 digits) decide; if
//      they cannot, the pincode is dropped. A weak majority far from its
//      neighbours gives way to the town office when that sits among them.
//   5. A group that is only one pair copied onto several villages (no town
//      office agreeing) is dropped. A point more than 50 km from every other
//      pincode of its own district, with most of its nearest pincodes in other
//      districts, is dropped. So are the hand-checked KNOWN_BAD ones.
// A dropped pincode just means the app asks for the km by hand (or uses the
// technician's "Reached site" location), which is safer than a wrong point.
// The table is still an estimate: a pincode's point is its main post office,
// and a pincode area can reach 15-20 km from it.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'Contains data from India Post (Department of Posts, Ministry of Communications, Government of India): '
    + '"All India Pincode Directory till last month", Open Government Data Platform India, '
    + 'https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month '
    + '(file pincode.csv, published there 4 Dec 2020, listed on 12 Oct 2026 as 23,760,720 bytes). '
    + 'Downloaded 12 Oct 2026 from a copy of that file with the same size and columns (23,760,720 bytes, 157,126 rows), committed 5 May 2024 at '
    + 'https://raw.githubusercontent.com/dropdevrahul/pincodes-india/d26206918dd2fb9f155bfba18de0421bd5fa0ca8/pincode.csv '
    + '(data.gov.in blocks automated download, so not compared byte for byte). Licence: Government Open Data License - India (GODL). '
    + 'Gujarat only, one point per pincode (the agreeing post offices, town office preferred; doubtful pincodes left out), '
    + 'built by scripts/build_gujarat_pincodes.mjs.';

const STATE = 'GUJARAT';
const BOX = { latMin: 20.0, latMax: 24.8, lngMin: 68.0, lngMax: 74.6 };
const AGREE_KM = 30;          // offices of one pincode further apart than this disagree
const SHARED_BY_PINCODES = 3; // a coordinate on this many pincodes is a head-office stand-in
const DISTRICT_KM = 50;       // further than this from every same-district pincode = suspect
const NEIGHBOURS = 5;
const FIT_KM = 20;            // a pincode of the same series this close "fits" a group
const NEIGHBOUR_KM = 25;      // further than this from its series' median = far from its neighbours

// Checked by hand (review of 12 Oct 2026, against Wikipedia / village
// directories and the district each office is filed under): the only usable
// pairs of these pincodes are wrong, so no rule above can see it. Dropped,
// never guessed. Also left out of the neighbour test in step 4.
const KNOWN_BAD = {
    382115: 'Godhavi SO has only the Ahmedabad GPO point; its villages carry rounded pairs 30-110 km apart. Godhavi is near Sanand',
    384002: 'Mahesana Railway Colony SO sits on 23.6579, 72.1185, 27 km west of Mehsana; the I E SO has only the shared Mehsana point',
    384003: 'Mahesana ONGC Colony SO has one rounded pair, 23.35, 72.36, about 25 km south of the colony at Palavasna, Mehsana',
    384221: 'Vadavali / Chhamichha (Chanasma taluka) sit on 23.7107, 72.5192 near Visnagar, about 40 km east of Chanasma',
    384229: 'Lanva SO sits on 23.7107, 72.5192 near Visnagar, about 40 km east of Chanasma; Lanva is a Chanasma taluka village about 15 km from Chanasma',
    384230: 'Kamboi SO sits on 23.03, 74.02 near Dahod and Delmal BO on 23.609, 72.511 near Visnagar; both villages are in Chanasma taluka',
    384246: 'Sankheshwar SO and both villages sit on 23.4697, 72.6904, about 90 km east of Shankheshwar',
    384285: 'Wagdod SO sits on 23.23, 72.21 and its villages on 23.599, 72.70-72.97 near Vijapur; Vagdod (Saraswati taluka) is at about 23.94, 72.10',
    384540: 'Ladol SO sits on 23.3711, 72.44 near Kadi; Ladol is at 23.62, 72.73, 7 km from Vijapur',
    390014: 'Makarpura SO has only the Vadodara point; its one village pair (Dhaniavi BO) sits near Anand, 45 km north of Makarpura',
    391115: 'Sinor SO has only the Vadodara point; its one village pair sits at 22.73, 73.35, about 90 km north of Sinor on the Narmada',
    391450: 'Karkhadi SO has only the Vadodara point; its one village pair sits at 22.96, 73.04 near Kapadvanj, far outside Vadodara district',
    391530: 'Sandasal SO has only the Vadodara point; its village pairs sit at 23.11, 73.78 in Mahisagar district',
    391774: 'Desar SO has only the Vadodara point; its one village pair sits at 23.16, 73.17 among Aravalli pincodes',
    394317: 'Baleshwar SO sits on 21.0549, 72.5827, in the sea west of Surat; Baleshwar (Palsana taluka) is near 21.13, 72.95',
    394327: 'Kadodara SO sits on 21.1026, 72.5733, in the sea west of Surat; Kadodara is on NH48 near 21.17, 72.96',
    395017: 'Althan SO (Surat city) sits on 21.6305, 72.4818, in the Gulf of Khambhat about 55 km from Surat',
};

// Approximate town centres, to catch a broken build (all should be < 15 km).
// The last four were 27-42 km off before the neighbour test (step 4).
const SPOT_CHECKS = [
    ['385340', 'Radhanpur', 23.83, 71.60],
    ['385001', 'Palanpur', 24.17, 72.43],
    ['384265', 'Patan', 23.85, 72.12],
    ['385535', 'Deesa', 24.25, 72.17],
    ['384001', 'Mehsana', 23.60, 72.39],
    ['383001', 'Himmatnagar', 23.60, 72.96],
    ['370140', 'Bhachau', 23.30, 70.34],
    ['370165', 'Rapar', 23.57, 70.64],
    ['370001', 'Bhuj', 23.25, 69.67],
    ['385565', 'Tharad', 24.40, 71.63],
    ['385575', 'Vav', 24.36, 71.53],
    ['382010', 'Gandhinagar', 23.22, 72.65],
    ['380001', 'Ahmedabad', 23.03, 72.58],
    ['384140', 'Kamli', 23.86, 72.40],
    ['382740', 'Pansar', 23.31, 72.49],
    ['394185', 'Kamrej', 21.27, 72.96],
    ['370615', 'Nakhatrana', 23.35, 69.26],
];

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter(a => a !== '--verbose');
const verbose = process.argv.includes('--verbose');
const csvPath = args[0];
const outPath = resolve(args[1] || resolve(here, '../src/data/gujaratPincodes.json'));
if (!csvPath) {
    console.error('Usage: node scripts/build_gujarat_pincodes.mjs <pincode.csv> [out.json] [--verbose]');
    process.exit(1);
}

// Plain RFC 4180 reader: quoted fields, "" inside quotes, CRLF or LF.
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
            } else field += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(field); field = '';
            if (row.length > 1 || row[0] !== '') rows.push(row);
            row = [];
        } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
}

const toRad = (d) => d * Math.PI / 180;
function km(a, b) {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function median(values) {
    const s = [...values].sort((x, y) => x - y);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
const medianPoint = (list) => ({ lat: median(list.map(c => c.lat)), lng: median(list.map(c => c.lng)) });

// Only plain decimals: "NA", blanks, "23.5N" and the like are rejected.
const decimal = (v) => (/^-?\d+(\.\d+)?$/.test(String(v ?? '').trim()) ? Number(v) : null);
const round4 = (n) => Math.round(n * 1e4) / 1e4;
const normDistrict = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z]/g, '');

const text = readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
const [header, ...rows] = parseCsv(text);
const col = Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i]));
for (const name of ['pincode', 'statename', 'latitude', 'longitude', 'officename', 'officetype', 'district']) {
    if (!(name in col)) { console.error(`CSV has no "${name}" column. Header: ${header.join(', ')}`); process.exit(1); }
}

// ---- 1. Gujarat offices with usable coordinates -------------------------
const stats = { allRows: rows.length, gujaratRows: 0, badPincode: 0, noCoords: 0, outsideBox: 0, outlierRows: 0 };
const pins = new Map();           // pincode -> { districts: Map, coords: Map(key -> coord) }
const pinsByCoord = new Map();    // coordinate key -> Set of pincodes
const headOffices = new Map();    // coordinate key -> Set of pincodes with a head office (HO) there
for (const r of rows) {
    if (String(r[col.statename] ?? '').trim().toUpperCase() !== STATE) continue;
    stats.gujaratRows++;
    const pin = String(r[col.pincode] ?? '').trim();
    if (!/^[1-9]\d{5}$/.test(pin)) { stats.badPincode++; continue; }
    if (!pins.has(pin)) pins.set(pin, { districts: new Map(), coords: new Map() });
    const entry = pins.get(pin);
    const district = normDistrict(r[col.district]);
    entry.districts.set(district, (entry.districts.get(district) || 0) + 1);

    const lat = decimal(r[col.latitude]);
    const lng = decimal(r[col.longitude]);
    if (lat === null || lng === null) { stats.noCoords++; continue; }
    if (lat < BOX.latMin || lat > BOX.latMax || lng < BOX.lngMin || lng > BOX.lngMax) { stats.outsideBox++; continue; }
    const key = `${lat},${lng}`;
    if (!entry.coords.has(key)) entry.coords.set(key, { lat, lng, key, rows: 0, main: false, names: [] });
    const c = entry.coords.get(key);
    c.rows++;
    // HO = head office, PO = sub office: the delivery office in the town itself.
    if (['HO', 'PO', 'SO'].includes(String(r[col.officetype] ?? '').trim().toUpperCase())) c.main = true;
    c.names.push(String(r[col.officename] ?? '').trim());
    if (!pinsByCoord.has(key)) pinsByCoord.set(key, new Set());
    pinsByCoord.get(key).add(pin);
    if (String(r[col.officetype] ?? '').trim().toUpperCase() === 'HO') {
        if (!headOffices.has(key)) headOffices.set(key, new Set());
        headOffices.get(key).add(pin);
    }
}

// ---- 2. which coordinates may speak for a pincode --------------------------
// A pair used by 3+ pincodes is a head office's location handed to its sub
// offices. It is right only for the head office's own delivery area (the
// pincodes sharing its first 4 digits: Ahmedabad GPO 380001 -> 3800xx). On
// other pincodes it is 20-80 km off (Bhuj HO's point is on Kandla Port 370210
// and Gandhidham's Udaynagar 370203), so it is only a fallback for a pincode of
// that area with no pair of its own.
function standInArea(key) {
    const heads = [...(headOffices.get(key) || [])].map(p => p.slice(0, 4));
    if (heads.length) return new Set(heads).size === 1 ? heads[0] : null;
    const counts = new Map();
    for (const p of pinsByCoord.get(key)) counts.set(p.slice(0, 4), (counts.get(p.slice(0, 4)) || 0) + 1);
    const [top, second] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return top[1] >= 2 && (!second || top[1] > second[1]) ? top[0] : null;   // clear majority only
}

// ---- 3. groups of agreeing coordinates --------------------------------------
// Each DISTINCT pair gets one vote (a pair copied onto many villages counts
// once). A group = the pairs within AGREE_KM of one pair. Best group: most
// pairs, then most town offices (HO / sub office), then most rows.
function groupsOf(candidates) {
    const seen = new Set();
    const groups = [];
    for (const c of candidates) {
        const members = candidates.filter(o => km(c, o) <= AGREE_KM);
        const id = members.map(m => m.key).sort().join('|');
        if (seen.has(id)) continue;
        seen.add(id);
        const mains = members.filter(m => m.main);
        groups.push({
            members,
            size: members.length,
            mains: mains.length,
            rows: members.reduce((n, m) => n + m.rows, 0),
            // The town office is the place the pincode is named after.
            point: medianPoint(mains.length ? mains : members),
        });
    }
    return groups.sort((a, b) => b.size - a.size || b.mains - a.mains || b.rows - a.rows);
}

const choices = new Map();        // pincode -> { groups, best, rivals, contested, district }
const dropped = [];               // [pincode, reason]
const log = [];
for (const pin of [...pins.keys()].sort()) {
    const { coords, districts } = pins.get(pin);
    const all = [...coords.values()];
    if (!all.length) { dropped.push([pin, 'no office with usable coordinates']); continue; }
    const own = all.filter(c => pinsByCoord.get(c.key).size < SHARED_BY_PINCODES);
    const candidates = own.length ? own : all.filter(c => standInArea(c.key) === pin.slice(0, 4));
    if (!candidates.length) {
        dropped.push([pin, `only a head office's coordinates from another area (${all.map(c => c.names[0]).join(', ')})`]);
        continue;
    }
    const groups = groupsOf(candidates);
    const best = groups[0];
    const rivals = groups.filter(g => km(g.point, best.point) > AGREE_KM);
    // Contested: two groups as strong as each other, or no two pairs agree at
    // all (one office against another). The town-office tie-break was wrong in
    // about half the cases checked by hand (Kamrej 394185, Kamli 384140, Vadtal
    // 387375 sat 40 km off; Sankheda, Padra, Varahi were right), so a
    // contested pincode is settled by its neighbours below, or dropped.
    const contested = rivals.length > 0
        && (best.size === 1 || rivals.some(g => g.size === best.size && g.mains === best.mains));
    const district = [...districts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    choices.set(pin, { groups, best, rivals, contested, district });
}

// ---- 4. neighbours settle disagreements ---------------------------------------
// Pincodes are numbered by postal route, so pincodes sharing their first 4
// digits mostly lie together (3841xx: Unjha / Sidhpur / Kamli). A group "fits"
// when other pincodes of that series lie within FIT_KM of it.
//  - Contested pincodes: the group that fits best wins if it fits strictly
//    better than every disagreeing group; otherwise the pincode is dropped.
//    (Kamli 384140: the sub office pair sits 40 km south among 3844xx, the
//    village pair sits among 3841xx, at Kamli.)
//  - A weak majority (one or two pairs) that is far from its neighbours loses
//    to a disagreeing group with the town office that fits clearly better.
//    Pansar 382740: the sub office is at Pansar next to Kalol (3827xx); two
//    rounded village pairs sit 35 km away near Dehgam. "Far" is measured from
//    the median of the pincodes sharing 5 digits (at least 2), else 4 digits
//    (at least 3): 3824xx is both Ahmedabad city and Dhandhuka, 38246x only
//    Dhandhuka.
// Only uncontested pincodes placed by their own town office count as
// neighbours (village-only points can be wrong together: in 3914xx two wrong
// village pairs near Kapadvanj "fitted" each other), minus the KNOWN_BAD ones.
const firstPass = new Map([...choices]
    .filter(([pin, c]) => !c.contested && c.best.mains > 0 && !(pin in KNOWN_BAD))
    .map(([pin, c]) => [pin, c.best.point]));
function siblings(pin, digits) {
    return [...firstPass].filter(([q]) => q !== pin && q.slice(0, digits) === pin.slice(0, digits)).map(([, p]) => p);
}
function neighbourCentre(pin) {
    for (const [digits, min] of [[5, 2], [4, 3]]) {
        const near = siblings(pin, digits);
        if (near.length >= min) return medianPoint(near);
    }
    return null;
}
const fit = (pin, point) => siblings(pin, 4).filter(p => km(p, point) <= FIT_KM).length;

const points = new Map();         // pincode -> { lat, lng, district, copiedOnly }
for (const [pin, { groups, best, rivals, contested, district }] of choices) {
    let chosen = best;
    const describe = (g) => `${g.members[0].names[0]} at ${g.point.lat.toFixed(3)}, ${g.point.lng.toFixed(3)}`;
    if (contested) {
        const ranked = groups.map(g => ({ g, fit: fit(pin, g.point) })).sort((a, b) => b.fit - a.fit);
        const top = ranked[0];
        const clear = top.fit >= 1 && ranked.slice(1)
            .every(r => km(r.g.point, top.g.point) <= AGREE_KM || r.fit < top.fit);
        if (!clear) {
            dropped.push([pin, `offices disagree and no group fits its neighbours better (${groups.map(describe).join(' / ')})`]);
            continue;
        }
        chosen = top.g;
        if (chosen !== best) log.push(`${pin} settled by neighbours: ${describe(chosen)} (not ${describe(best)})`);
    } else if (rivals.length && best.size <= 2) {
        const centre = neighbourCentre(pin);
        if (centre && km(best.point, centre) > NEIGHBOUR_KM) {
            const bestFit = fit(pin, best.point);
            const rival = rivals.filter(g => g.mains).map(g => ({ g, fit: fit(pin, g.point) })).sort((a, b) => b.fit - a.fit)[0];
            if (rival && rival.fit >= 2 && rival.fit > bestFit) {
                chosen = rival.g;
                log.push(`${pin} moved to the group among its neighbours: ${describe(chosen)} (not ${describe(best)}, ${km(best.point, centre).toFixed(0)} km from them)`);
            }
        }
    }
    for (const c of new Set(groups.flatMap(g => g.members))) {
        if (chosen.members.includes(c)) continue;
        stats.outlierRows += c.rows;
        log.push(`${pin} outlier: ${c.names.join(' / ')} at ${c.lat}, ${c.lng}`);
    }
    // A pair copied onto several villages, with no town office agreeing, is not
    // evidence (Chandod 391105: two villages on one point 60 km away). It is
    // dropped after step 5, where it still helps place its neighbours.
    const copiedOnly = !chosen.mains && chosen.members.every(c => c.rows > 1)
        ? `only copied village coordinates (${chosen.members.map(c => `${c.lat}, ${c.lng} on ${c.rows} offices`).join('; ')})`
        : null;
    points.set(pin, { ...chosen.point, district, copiedOnly });
}

// ---- 5. copies, district sanity check, hand-checked drops ------------------------
const suspects = [];
for (const [pin, p] of points) {
    if (p.copiedOnly) continue;
    const others = [...points].filter(([q]) => q !== pin).map(([q, o]) => ({ q, d: km(p, o), district: o.district }))
        .sort((a, b) => a.d - b.d);
    const sameDistrict = others.find(o => o.district === p.district);
    const foreign = others.slice(0, NEIGHBOURS).filter(o => o.district !== p.district).length;
    if ((!sameDistrict || sameDistrict.d > DISTRICT_KM) && foreign > NEIGHBOURS / 2) {
        suspects.push([pin, `${sameDistrict ? sameDistrict.d.toFixed(0) : '?'} km from the nearest ${p.district} pincode, near ${others.slice(0, 3).map(o => `${o.q} ${o.district}`).join(', ')}`]);
    }
}
for (const [pin, reason] of suspects) { points.delete(pin); dropped.push([pin, `wrong district: ${reason}`]); }
for (const [pin, p] of [...points]) {
    if (p.copiedOnly) { points.delete(pin); dropped.push([pin, p.copiedOnly]); }
}
for (const [pin, reason] of Object.entries(KNOWN_BAD)) {
    if (points.delete(pin)) dropped.push([pin, `checked by hand: ${reason}`]);
}

// ---- write ----------------------------------------------------------------
// One pincode per line keeps git diffs readable when the file is rebuilt.
const body = [...points.keys()].sort()
    .map(pin => `    ${JSON.stringify(pin)}: [${round4(points.get(pin).lat)}, ${round4(points.get(pin).lng)}]`).join(',\n');
const json = `{\n  "source": ${JSON.stringify(SOURCE)},\n  "points": {\n${body}\n  }\n}\n`;
const check = JSON.parse(json);   // never write a broken file
writeFileSync(outPath, json);

console.log(`CSV rows: ${stats.allRows}. Gujarat rows: ${stats.gujaratRows}, Gujarat pincodes: ${pins.size}`);
console.log(`Rows skipped: bad pincode ${stats.badPincode}, no coordinates ${stats.noCoords}, outside the Gujarat box ${stats.outsideBox}`);
console.log(`Office rows dropped as outliers (not within ${AGREE_KM} km of the agreeing group): ${stats.outlierRows}`);
if (verbose) for (const line of log) console.log(`  ${line}`);
console.log(`Pincodes written: ${Object.keys(check.points).length}. Dropped: ${dropped.length}`);
for (const [pin, reason] of dropped.sort()) console.log(`  ${pin}: ${reason}`);
console.log(`Wrote ${outPath} (${Buffer.byteLength(json)} bytes)`);
console.log('Spot checks (should be < 15 km):');
for (const [pin, town, lat, lng] of SPOT_CHECKS) {
    const p = check.points[pin];
    console.log(`  ${pin} ${town}: ${p ? `${km({ lat, lng }, { lat: p[0], lng: p[1] }).toFixed(1)} km` : 'MISSING'}`);
}
