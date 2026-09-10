/**
 * slim-iracing-schedule.js — prepare a parsed iRacing schedule for the site
 *
 * Takes the schedule.json produced by the iRacingSchedule parser and writes a
 * compact copy with the PDF-provenance fields (raw strings, page numbers,
 * unparsed tokens) removed. The page never displays those, and dropping them
 * roughly halves the payload.
 *
 * Usage:
 *   node scripts/slim-iracing-schedule.js <path/to/schedule.json> src/data/iracing/2026S4.json
 */
const fs = require('fs');

const DROP_KEYS = new Set(['raw', 'settings_raw', 'cars_raw', 'page', 'unparsed']);

function slim(value) {
    if (Array.isArray(value)) return value.map(slim);
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (!DROP_KEYS.has(k)) out[k] = slim(v);
        }
        return out;
    }
    return value;
}

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
    console.error('Usage: node scripts/slim-iracing-schedule.js <schedule.json> <output.json>');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(src, 'utf8'));
const unparsed = data.series.reduce((n, s) => n + s.weeks.reduce((m, w) => m + (w.unparsed || []).length, 0), 0);
if (unparsed) console.warn(`Warning: ${unparsed} unparsed settings tokens — the parser may need updating.`);

const json = JSON.stringify(slim(data));
fs.writeFileSync(dest, json);
console.log(`${dest}: ${data.series.length} series, ${(json.length / 1024).toFixed(0)} KB`);
