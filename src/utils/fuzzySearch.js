// ─── Spelling-tolerant name search (Oct 2026) ───────────────────────────────
// The top search used `customer_name ilike %q%`, so "sandeep" never found
// "SANDIP" and a stray letter ("ksandip") found nothing. These helpers turn a
// typed name into a Postgres regex that also matches the usual spelling
// variants of Indian names, plus one typo, and rank the results so the
// closest names come first. No database change is needed: the regex runs
// through PostgREST's `imatch` filter, so RLS still applies.

// Reduce a word to the letters that matter for "sounds the same":
//   ee/ii/ie/y -> i, oo/uu/ou -> u, aa -> a, ph -> f, w -> v, z -> j, q/c -> k,
//   an h after a consonant is dropped (bh -> b, sh -> s, chh -> c),
//   and doubled letters collapse (Lalla -> lala).
export const skeleton = (word) => {
    let s = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    s = s.replace(/ch/g, 'C').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/[cq]/g, 'k')
        .replace(/w/g, 'v').replace(/z/g, 'j').replace(/y/g, 'i');
    s = s.replace(/([^aeiouh])h+/gi, '$1').replace(/C/g, 'c');
    s = s.replace(/(ee|ii|ie)/g, 'i').replace(/(oo|uu|ou)/g, 'u');
    return s.replace(/(.)\1+/g, '$1');
};

// Regex piece for one skeleton letter: matches every spelling it came from.
const LETTER = {
    a: 'a+', e: '[eiy]+', i: '[iey]+', o: '[ou]+', u: '[uo]+',
    k: '[kcq]+h?', c: 'c+h*', v: '[vw]+h?', j: '[jz]+h?', f: '(f+|ph)',
};
const letterRe = (ch) => LETTER[ch] || `${ch}+h?`;
const wordRe = (sk) => sk.split('').map(letterRe).join('');

// Postgres regex for one typed word, or null when the word is too short to
// search loosely (1-2 letters stay a plain substring search).
export const fuzzyWordPattern = (word) => {
    const sk = skeleton(word);
    if (sk.length < 3) return null;
    const variants = [wordRe(sk)];
    if (sk.length >= 4) {
        for (let i = 0; i < sk.length; i += 1) {
            // one extra letter typed (ksandip -> sandip)
            variants.push(wordRe(sk.slice(0, i) + sk.slice(i + 1)));
            // one wrong letter typed (sandop -> sandip)
            variants.push(sk.slice(0, i).split('').map(letterRe).join('') + '[a-z]{1,2}'
                + sk.slice(i + 1).split('').map(letterRe).join(''));
        }
    }
    if (sk.length >= 5) {
        // one letter missed (sndip -> sandip)
        variants.push(sk.split('').map(letterRe).join('[a-z]?'));
    }
    return `(${[...new Set(variants)].join('|')})`;
};

// Typed text -> one pattern per word (each word must match somewhere).
// At most 4 words, to keep the request URL short.
export const fuzzyPatterns = (query) => String(query || '')
    .split(/\s+/)
    .map(fuzzyWordPattern)
    .filter(Boolean)
    .slice(0, 4);

const editDistance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i += 1) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const keep = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = keep;
        }
    }
    return row[b.length];
};

// Lower is closer. For each typed word, the best match among the name's
// words, also comparing against the start of a word so "sandip" is close to
// "SANDIPBHAI".
export const nameDistance = (query, name) => {
    const nameWords = String(name || '').split(/\s+/).map(skeleton).filter(Boolean);
    if (!nameWords.length) return Infinity;
    return String(query || '').split(/\s+/).map(skeleton).filter(Boolean).reduce((total, qw) => {
        let best = Infinity;
        for (const nw of nameWords) {
            best = Math.min(best, editDistance(qw, nw), editDistance(qw, nw.slice(0, qw.length)) + 0.5);
        }
        return total + best;
    }, 0);
};

// Exact (substring) matches first, in the order given; then the loose matches
// closest-first. Duplicates are dropped by id.
export const mergeSearchResults = (query, exact, loose, limit = 8) => {
    const seen = new Set((exact || []).map(r => r.id));
    const extra = (loose || [])
        .filter(r => !seen.has(r.id))
        .map(r => ({ r, d: nameDistance(query, r.customer_name) }))
        .sort((x, y) => x.d - y.d || String(x.r.customer_name || '').length - String(y.r.customer_name || '').length)
        .map(x => x.r);
    return [...(exact || []), ...extra].slice(0, limit);
};
