/**
 * update-publications.js — refresh src/_data/publications.json from ORCID
 *
 * Reads the public works list for the ORCID iD below, then looks each DOI up
 * on Crossref to fill in the full author list, venue and pages (ORCID
 * summaries rarely carry those). Works without a DOI, or whose Crossref
 * lookup fails, fall back to whatever the full ORCID record provides.
 *
 * The output file is only written if every step succeeds, so a network
 * failure never leaves the site with an empty publications list.
 *
 * Usage (Node 18+):
 *   npm run update-publications
 */
const fs = require('fs');
const path = require('path');

const ORCID_ID = '0009-0003-3458-9845';
const OUT = path.join(__dirname, '..', 'src', '_data', 'publications.json');
const HEADERS = { Accept: 'application/json', 'User-Agent': 'jason-carvalho-site/1.0 (publications updater)' };

async function getJson(url) {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return res.json();
}

// "Paul", "Mulholland" → "Mulholland, P."; "Jean-Luc" → "J.-L."
function apaName(given, family) {
    if (!given) return family;
    const initials = given.split(/\s+/).filter(Boolean)
        .map(part => part.split('-').map(p => p[0].toUpperCase() + '.').join('-'))
        .join(' ');
    return `${family}, ${initials}`;
}

// ORCID credit names are a single string — assume the last word is the family name
function splitCreditName(name) {
    const parts = name.trim().split(/\s+/);
    return parts.length === 1 ? [null, parts[0]] : [parts.slice(0, -1).join(' '), parts.at(-1)];
}

function joinAuthors(names) {
    if (names.length <= 1) return names.join('');
    return `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}`;
}

const stripTags = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function venueFromCrossref(m) {
    const containers = (m['container-title'] || []).map(stripTags);
    // Book chapters list [series, book] — show the book first
    const container = m.type === 'book-chapter' ? [...containers].reverse().join(', ') : containers[0];
    const parts = [container || m.publisher];
    if (m.volume) parts.push(`Vol. ${m.volume}`);
    if (m.issue) parts.push(`No. ${m.issue}`);
    if (m.page) parts.push(`pp. ${m.page.replace(/-/g, '–')}`);
    return parts.filter(Boolean).join(', ');
}

function dateParts(orcidDate, crossrefDate) {
    const cr = crossrefDate && crossrefDate['date-parts'] && crossrefDate['date-parts'][0];
    if (cr && cr[0]) return [cr[0], cr[1] || 1, cr[2] || 1];
    const y = orcidDate && orcidDate.year && +orcidDate.year.value;
    const mo = orcidDate && orcidDate.month && +orcidDate.month.value;
    const d = orcidDate && orcidDate.day && +orcidDate.day.value;
    return y ? [y, mo || 1, d || 1] : [0, 1, 1];
}

async function main() {
    const works = await getJson(`https://pub.orcid.org/v3.0/${ORCID_ID}/works`);
    // Each group is one work, possibly asserted by several sources; the first
    // summary is ORCID's preferred version.
    const putCodes = works.group.map(g => g['work-summary'][0]['put-code']);
    if (!putCodes.length) throw new Error('ORCID returned no works — refusing to overwrite the existing list.');

    // Full records (with contributors) in one bulk call — ORCID allows up to 100
    const bulk = await getJson(`https://pub.orcid.org/v3.0/${ORCID_ID}/works/${putCodes.join(',')}`);

    const pubs = [];
    for (const { work: w } of bulk.bulk) {
        const ids = (w['external-ids'] && w['external-ids']['external-id']) || [];
        const doiId = ids.find(e => e['external-id-type'] === 'doi');
        const doi = doiId && doiId['external-id-value'].toLowerCase();

        let cr = null;
        if (doi) {
            try {
                cr = (await getJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)).message;
            } catch (err) {
                console.warn(`Crossref lookup failed for ${doi} — using ORCID data only (${err.message})`);
            }
        }

        const title = [w.title.title.value, w.title.subtitle && w.title.subtitle.value].filter(Boolean).join(': ');

        let authors;
        if (cr && cr.author && cr.author.length) {
            authors = cr.author.map(a => a.family ? apaName(a.given, a.family) : a.name);
        } else {
            authors = ((w.contributors && w.contributors.contributor) || [])
                .filter(c => c['credit-name'])
                .map(c => apaName(...splitCreditName(c['credit-name'].value)));
        }

        const venue = cr ? venueFromCrossref(cr) : ((w['journal-title'] && w['journal-title'].value) || '');
        const [y, mo, d] = dateParts(w['publication-date'], cr && cr.issued);

        pubs.push({
            authors: joinAuthors(authors),
            title,
            venue,
            year: y || null,
            date: y ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null,
            url: doi ? `https://doi.org/${doi}` : ((w.url && w.url.value) || null),
        });
    }

    pubs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    fs.writeFileSync(OUT, JSON.stringify(pubs, null, 2) + '\n');
    console.log(`${path.relative(process.cwd(), OUT)}: ${pubs.length} publications`);
    for (const p of pubs) console.log(`  ${p.year}  ${p.title}`);
}

main().catch(err => {
    console.error(`Failed: ${err.message}`);
    process.exit(1);
});
