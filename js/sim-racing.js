/**
 * sim-racing.js — iRacing season explorer + screenshot lightbox
 *
 * The page fetches one parsed season (see scripts/slim-iracing-schedule.js),
 * holds it in memory and re-renders the "this week" cards and season grid
 * whenever the settings panel changes. Settings persist in localStorage.
 */
(function () {

    /* ------------------------------------------------------------------ */
    /*  CONFIG                                                              */
    /* ------------------------------------------------------------------ */

    const STORE_KEY = 'iracing-schedule';

    // Season-agnostic series keys (see seriesKey) so picks survive a new season
    const DEFAULT_SERIES = [
        'gt4-falken-tyre-challenge',
        'gte-sprint-series',
        'imsa-iracing-series-fixed-by-go-fast',
        'clio-cup',
        'caterham-academy-challenge',
        'caterham-420r-cup',
    ];

    // Optional details, toggled from the settings panel
    const ATTRS = [
        { key: 'layout',   label: 'Track layout',     on: true },
        { key: 'length',   label: 'Race length',      on: true },
        { key: 'cars',     label: 'Cars',             on: true },
        { key: 'licence',  label: 'Licence class',    on: true },
        { key: 'cadence',  label: 'Race times' },
        { key: 'temp',     label: 'Temperature' },
        { key: 'rain',     label: 'Rain chance' },
        { key: 'tod',      label: 'Time of day' },
        { key: 'start',    label: 'Start type' },
        { key: 'cautions', label: 'Cautions' },
        { key: 'qual',     label: 'Qual scrutiny' },
        { key: 'bop',      label: 'Fuel / tyres / BoP' },
    ];

    const CATEGORY_ORDER = ['SPORTS CAR', 'FORMULA CAR', 'OVAL', 'DIRT ROAD', 'DIRT OVAL', 'UNRANKED'];
    const LICENCE_ORDER  = ['R', 'D', 'C', 'B', 'A'];

    const CAUTIONS = {
        disabled:       'No cautions',
        full_course:    'Full-course cautions',
        local_enforced: 'Local cautions',
        local_advisory: 'Local cautions (advisory)',
    };

    /* ------------------------------------------------------------------ */
    /*  DATE HELPERS — schedule dates are calendar days; maths in UTC       */
    /* ------------------------------------------------------------------ */

    function parseDate(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d));
    }

    function addDays(iso, n) {
        const d = parseDate(iso);
        d.setUTCDate(d.getUTCDate() + n);
        return d.toISOString().slice(0, 10);
    }

    function daysBetween(a, b) {
        return Math.round((parseDate(b) - parseDate(a)) / 86400000);
    }

    function fmtDate(iso, opts) {
        return parseDate(iso).toLocaleDateString('en-GB', Object.assign({ timeZone: 'UTC' }, opts));
    }

    function fmtShort(iso) { return fmtDate(iso, { day: 'numeric', month: 'short' }); }
    function fmtDay(iso)   { return fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short' }); }

    // "15–21 Sep" or "29 Sep – 5 Oct"
    function fmtRange(a, b) {
        return parseDate(a).getUTCMonth() === parseDate(b).getUTCMonth()
            ? parseDate(a).getUTCDate() + '–' + fmtShort(b)
            : fmtShort(a) + ' – ' + fmtShort(b);
    }

    // Today as a local calendar date; ?date=YYYY-MM-DD previews another day
    function todayISO() {
        const q = new URLSearchParams(location.search).get('date');
        if (/^\d{4}-\d{2}-\d{2}$/.test(q || '')) return q;
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    /* ------------------------------------------------------------------ */
    /*  TEXT HELPERS                                                        */
    /* ------------------------------------------------------------------ */

    function esc(str) {
        return String(str).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function plural(n, word, many) { return n + ' ' + (n === 1 ? word : (many || word + 's')); }
    function cap(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
    function titleCase(str) { return cap(str.toLowerCase()); }

    // "gt4-falken-tyre-challenge-2026-season-4" → "gt4-falken-tyre-challenge"
    function seriesKey(id) { return id.replace(/-20\d\d-season(-\d+)?/, ''); }

    // Drop the season suffix and sponsor: "IMSA iRacing Series - Fixed by GO Fast - 2026 Season 4" → "IMSA iRacing Series (Fixed)"
    function shortName(name) {
        return name
            .replace(/\s*-?\s*20\d\d\s*-?\s*Season(\s*\d)?/i, '')
            .replace(/\s+by\s+.+?(?=\s+-|$)/i, '')
            .replace(/\s+-(?=[A-Za-z])/g, ' - ')
            .replace(/(\s+-?\s*\(?(Fixed|Open)\)?)+\s*$/i, ' ($2)')
            .trim();
    }

    // "Oulton Park Circuit" → "Oulton Park"; full name stays in the detail popover
    function trackName(t) { return t.name.replace(/\s+(Racing\s+)?Circuit$/, ''); }
    function trackLayout(t) { return t.config && t.config !== t.name ? t.config : ''; }

    function fmtMinutes(m) {
        if (m < 60) return m + ' min';
        return Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '');
    }

    function fmtLength(rl) {
        switch (rl.type) {
            case 'laps':  return plural(rl.laps, 'lap');
            case 'time':  return fmtMinutes(rl.minutes);
            case 'heats': return 'Heat ' + rl.heat_laps + ' / feature ' + rl.feature_laps + ' laps';
        }
        return '';
    }

    function licenceText(g) {
        if (g === 'R') return 'Rookie';
        const below = LICENCE_ORDER[LICENCE_ORDER.indexOf(g) - 1];
        return 'Class ' + g + ' · also open to ' + (below === 'R' ? 'Rookie' : 'Class ' + below) + ' at 4.0 SR';
    }

    function licBadge(s, attrs) {
        if (!attrs.licence) return '';
        const g = s.license_group;
        return '<span class="lic lic-' + g + '" title="' + esc(licenceText(g)) + '">' + g + '</span>';
    }

    function seriesCars(s, w) { return (w && w.cars) || s.all_cars; }

    function carsBrief(cars, n) {
        return cars.length <= n ? cars.join(', ') : cars.slice(0, n - 1).join(', ') + ' +' + (cars.length - n + 1) + ' more';
    }

    function simTime(session) {
        const mult = session.time_of_day_multiplier;
        return session.simulated_time + (mult > 1 ? ' (' + mult + '× speed)' : '');
    }

    // Group per-car setup adjustments that share identical settings
    function bopGroups(adjs) {
        const groups = new Map();
        (adjs || []).forEach(function (a) {
            const parts = [];
            if (a.fuel_percent  != null) parts.push('fuel ' + a.fuel_percent + '%');
            if (a.tire_sets     != null) parts.push(plural(a.tire_sets, 'tyre set'));
            if (a.weight_kg     != null) parts.push('weight ' + a.weight_kg + ' kg');
            if (a.power_percent != null) parts.push('power ' + a.power_percent + '%');
            const key = parts.join(', ');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(a.car_code);
        });
        return Array.from(groups, function (e) { return { parts: e[0], codes: e[1] }; });
    }

    // Toggleable per-week details, for grid cells and cards
    function weekExtras(w, attrs) {
        const out = [];
        if (attrs.temp && w.weather && w.weather.temp_c != null) out.push(w.weather.temp_c + '°C');
        if (attrs.rain && w.rain_chance_percent != null)         out.push('Rain ' + w.rain_chance_percent + '%');
        if (attrs.tod && w.session && w.session.simulated_time)  out.push('Sim ' + simTime(w.session));
        if (attrs.start && w.start_type)                         out.push(w.start_type + ' start');
        if (attrs.cautions && w.cautions)                        out.push(CAUTIONS[w.cautions] || w.cautions);
        if (attrs.qual && w.qualifying_scrutiny)                 out.push(w.qualifying_scrutiny + ' qual');
        if (attrs.bop) {
            bopGroups(w.setup_adjustments).forEach(function (g) {
                out.push(cap(g.parts) + (g.codes.length > 2 ? ' ×' + g.codes.length : ' ' + g.codes.join('/')));
            });
        }
        return out;
    }

    /* ------------------------------------------------------------------ */
    /*  SETTINGS                                                            */
    /* ------------------------------------------------------------------ */

    function defaultSettings() {
        const attrs = {};
        ATTRS.forEach(function (a) { attrs[a.key] = !!a.on; });
        return { series: DEFAULT_SERIES.slice(), attrs: attrs };
    }

    function loadSettings() {
        const settings = defaultSettings();
        try {
            const stored = JSON.parse(localStorage.getItem(STORE_KEY));
            if (stored && Array.isArray(stored.series)) settings.series = stored.series;
            if (stored && stored.attrs) Object.assign(settings.attrs, stored.attrs);
        } catch (e) { /* storage unavailable — defaults it is */ }
        return settings;
    }

    function saveSettings(settings) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
    }

    /* ------------------------------------------------------------------ */
    /*  SEASON MODEL                                                        */
    /* ------------------------------------------------------------------ */

    function buildSeason(data) {
        // Most series open on the same Tuesday — that's week 1 of the grid
        const counts = {};
        data.series.forEach(function (s) { counts[s.first_week_start] = (counts[s.first_week_start] || 0) + 1; });
        const start = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];

        const byKey = {}, byId = {};
        data.series.forEach(function (s) { byKey[seriesKey(s.id)] = s; byId[s.id] = s; });

        return { data: data, start: start, byKey: byKey, byId: byId,
                 label: data.meta.season.year + ' S' + data.meta.season.quarter };
    }

    // Calendar rows (Tuesday-anchored weeks) with each selected series' race in
    // the row its own week starts in. Series don't all start on the Tuesday, and
    // full-year series carry earlier rounds, which are left out.
    function buildRows(season, selected, today) {
        let end = addDays(season.start, 6);
        selected.forEach(function (s) {
            s.weeks.forEach(function (w) { if (w.end_date > end) end = w.end_date; });
        });

        const rows = [];
        for (let start = season.start; start <= end; start = addDays(start, 7)) {
            const rowEnd = addDays(start, 6);
            rows.push({
                start:  start,
                end:    rowEnd,
                status: today > rowEnd ? 'past' : today >= start ? 'current' : 'future',
                cells:  selected.map(function () { return null; }),
            });
        }
        if (today < season.start) rows[0].status = 'next';

        selected.forEach(function (s, si) {
            s.weeks.forEach(function (w) {
                if (w.end_date < season.start) return;
                const row = rows[Math.max(0, Math.floor(daysBetween(season.start, w.start_date) / 7))];
                if (row && !row.cells[si]) row.cells[si] = w;
            });
        });
        return rows;
    }

    // The race live today, else the next one this season
    function focusWeek(s, today, seasonStart) {
        return s.weeks.find(function (w) { return w.start_date <= today && today <= w.end_date; })
            || s.weeks.find(function (w) { return w.start_date > today && w.end_date >= seasonStart; })
            || null;
    }

    function cellState(w, today) {
        return w.end_date < today ? ' is-past' : w.start_date <= today ? ' is-live' : '';
    }

    function weekRef(s, w) {
        return ' tabindex="0" data-s="' + esc(s.id) + '" data-w="' + w.week + '"';
    }

    /* ------------------------------------------------------------------ */
    /*  RENDER — this week                                                  */
    /* ------------------------------------------------------------------ */

    function renderNow(season, selected, rows, today, attrs) {
        const current = rows.find(function (r) { return r.status === 'current'; });
        let label, dates = '';
        if (today < season.start) {
            const days = daysBetween(today, season.start);
            label = 'Up next';
            dates = 'Season starts ' + fmtDay(season.start) + ' · ' + (days === 1 ? 'tomorrow' : 'in ' + plural(days, 'day'));
        } else if (current) {
            label = 'This week';
            dates = 'Week ' + (rows.indexOf(current) + 1) + ' · ' + fmtRange(current.start, current.end);
        } else {
            label = 'Season complete';
        }

        const refStart = current ? current.start : season.start;
        const cards = selected.map(function (s) {
            return renderCard(s, focusWeek(s, today, season.start), today, refStart, attrs);
        }).join('');

        return '<div class="sched-now">'
            + '<div class="now-head"><span class="now-label">' + label + '</span>'
            + (dates ? '<span class="now-dates">' + dates + '</span>' : '') + '</div>'
            + '<div class="now-cards">' + cards + '</div>'
            + '</div>';
    }

    function renderCard(s, w, today, refStart, attrs) {
        const head = '<div class="nc-head"><span class="nc-series">' + esc(shortName(s.name)) + '</span>' + licBadge(s, attrs) + '</div>';
        if (!w) {
            return '<article class="now-card card is-empty">' + head + '<p class="nc-none">No more races this season</p></article>';
        }

        const layout = attrs.layout && trackLayout(w.track);
        const extras = weekExtras(w, attrs);
        const note   = w.start_date > today && w.start_date !== refStart ? 'Starts ' + fmtDay(w.start_date) : '';

        return '<article class="now-card card' + cellState(w, today) + '"' + weekRef(s, w) + '>'
            + head
            + '<div class="nc-track">' + esc(trackName(w.track)) + '</div>'
            + (layout ? '<div class="nc-layout">' + esc(layout) + '</div>' : '')
            + (attrs.length ? '<div class="nc-length">' + esc(fmtLength(w.race_length)) + '</div>' : '')
            + (extras.length ? '<div class="nc-meta">' + extras.map(esc).join(' · ') + '</div>' : '')
            + (attrs.cadence ? '<div class="nc-meta">' + esc(s.schedule_text) + '</div>' : '')
            + (attrs.cars ? '<div class="nc-cars">' + esc(carsBrief(seriesCars(s, w), 4)) + '</div>' : '')
            + '<div class="nc-foot">Wk ' + w.week + ' of ' + s.week_count
            + (note ? ' · <span class="nc-note">' + note + '</span>' : '') + '</div>'
            + '</article>';
    }

    /* ------------------------------------------------------------------ */
    /*  RENDER — season grid (wide) and week list (narrow)                  */
    /* ------------------------------------------------------------------ */

    function weekBody(w, attrs, rowStart) {
        const layout = attrs.layout && trackLayout(w.track);
        const extras = weekExtras(w, attrs);
        return '<span class="wk-track">' + esc(trackName(w.track)) + '</span>'
            + (layout ? '<span class="wk-layout">' + esc(layout) + '</span>' : '')
            + (attrs.length ? '<span class="wk-length">' + esc(fmtLength(w.race_length)) + '</span>' : '')
            + (w.start_date !== rowStart ? '<span class="wk-from">From ' + fmtDay(w.start_date) + '</span>' : '')
            + (extras.length ? '<span class="wk-meta">' + extras.map(esc).join(' · ') + '</span>' : '');
    }

    function seriesHeader(s, attrs) {
        const cars = seriesCars(s);
        return '<span class="sh-top">' + licBadge(s, attrs) + '<span class="sh-name">' + esc(shortName(s.name)) + '</span></span>'
            + (attrs.cars ? '<span class="sh-sub" title="' + esc(cars.join(', ')) + '">' + esc(carsBrief(cars, 3)) + '</span>' : '')
            + (attrs.cadence ? '<span class="sh-sub">' + esc(s.schedule_text) + '</span>' : '');
    }

    function rowFlag(r) {
        const text = r.status === 'current' ? 'This week' : r.status === 'next' ? 'Up next' : '';
        return text ? '<span class="row-flag">' + text + '</span>' : '';
    }

    function renderGrid(selected, rows, today, attrs) {
        const head = selected.map(function (s) {
            return '<th class="th-series" scope="col" title="' + esc(s.name) + '">' + seriesHeader(s, attrs) + '</th>';
        }).join('');

        const body = rows.map(function (r, i) {
            const cells = r.cells.map(function (w, si) {
                return w
                    ? '<td class="td-track' + cellState(w, today) + '"' + weekRef(selected[si], w) + '>' + weekBody(w, attrs, r.start) + '</td>'
                    : '<td class="td-empty">—</td>';
            }).join('');
            return '<tr class="week-' + r.status + '">'
                + '<td class="td-week">' + String(i + 1).padStart(2, '0') + '</td>'
                + '<td class="td-date">' + fmtShort(r.start) + rowFlag(r) + '</td>'
                + cells + '</tr>';
        }).join('');

        return '<div class="sched-grid"><div class="schedule-scroll">'
            + '<table class="schedule-table">'
            + '<thead><tr><th class="th-week" scope="col">Wk</th><th class="th-date" scope="col">Week of</th>' + head + '</tr></thead>'
            + '<tbody>' + body + '</tbody>'
            + '</table></div></div>';
    }

    function renderList(selected, rows, today, attrs) {
        return '<div class="sched-list">' + rows.map(function (r, i) {
            const items = r.cells.map(function (w, si) {
                if (!w) return '';
                const s = selected[si];
                return '<li class="sl-item' + cellState(w, today) + '"' + weekRef(s, w) + '>'
                    + '<span class="sl-series">' + licBadge(s, attrs) + '<span>' + esc(shortName(s.name)) + '</span></span>'
                    + '<span class="sl-body">' + weekBody(w, attrs, r.start) + '</span></li>';
            }).join('');
            return '<section class="sl-week week-' + r.status + '">'
                + '<div class="sl-head"><span class="sl-num">Wk ' + String(i + 1).padStart(2, '0') + '</span>'
                + '<span class="sl-dates">' + fmtRange(r.start, r.end) + '</span>' + rowFlag(r) + '</div>'
                + (items ? '<ul class="sl-items">' + items + '</ul>' : '<p class="sl-none">No races</p>')
                + '</section>';
        }).join('') + '</div>';
    }

    function renderView(view, app) {
        const season   = app.season;
        const attrs    = app.settings.attrs;
        const selected = app.settings.series.map(function (k) { return season.byKey[k]; }).filter(Boolean);

        if (!selected.length) {
            view.innerHTML = '<p class="sched-empty">No series selected — open <strong>Customise</strong> to pick some.</p>';
            return;
        }

        const rows = buildRows(season, selected, app.today);
        view.innerHTML = renderNow(season, selected, rows, app.today, attrs)
            + renderGrid(selected, rows, app.today, attrs)
            + renderList(selected, rows, app.today, attrs);
    }

    /* ------------------------------------------------------------------ */
    /*  DETAIL POPOVER — hover on desktop, tap/click/Enter to pin           */
    /* ------------------------------------------------------------------ */

    function detailHTML(s, w) {
        const rows = [
            ['Length',     fmtLength(w.race_length)],
            ['Weather',    w.weather && w.weather.temp_c != null ? w.weather.temp_c + '°C / ' + w.weather.temp_f + '°F' : ''],
            ['Rain',       w.rain_chance_percent != null ? w.rain_chance_percent + '%' : 'None'],
            ['Sim time',   w.session && w.session.simulated_time ? simTime(w.session) : ''],
            ['Start',      w.start_type],
            ['Cautions',   CAUTIONS[w.cautions] || w.cautions],
            ['Qualifying', w.qualifying_scrutiny ? w.qualifying_scrutiny + ' scrutiny' : ''],
        ].filter(function (r) { return r[1]; });

        const adjustments = bopGroups(w.setup_adjustments).map(function (g) {
            return cap(g.parts) + ': ' + g.codes.join(', ');
        }).join('\n');

        function block(label, text) {
            return text ? '<div class="pop-block"><span class="pop-label">' + label + '</span><span class="pop-text">' + esc(text) + '</span></div>' : '';
        }

        return '<div class="pop-series">' + licBadge(s, { licence: true })
            + '<span>' + esc(shortName(s.name)) + ' · Wk ' + w.week + ' of ' + s.week_count + '</span></div>'
            + '<div class="pop-track">' + esc(w.track.full_name) + '</div>'
            + '<div class="pop-dates">' + fmtDay(w.start_date) + ' – ' + fmtDay(w.end_date) + '</div>'
            + '<div class="pop-divider"></div>'
            + rows.map(function (r) {
                return '<div class="pop-row"><span class="pop-label">' + r[0] + '</span><span class="pop-val">' + esc(r[1]) + '</span></div>';
            }).join('')
            + '<div class="pop-divider"></div>'
            + block('Race times', s.schedule_text)
            + block('Licence', licenceText(s.license_group))
            + block('Cars', seriesCars(s, w).join(', '))
            + block('Adjustments', adjustments);
    }

    function initPopover(root, season) {
        const pop = document.createElement('div');
        pop.className = 'sched-pop';
        pop.setAttribute('role', 'tooltip');
        document.body.appendChild(pop);

        const canHover = window.matchMedia('(hover: hover)').matches;
        let current = null, pinned = false;

        function show(el, pin) {
            const s = season.byId[el.dataset.s];
            const w = s && s.weeks.find(function (x) { return x.week === Number(el.dataset.w); });
            if (!w) return;
            current = el;
            pinned  = pin;
            pop.innerHTML = detailHTML(s, w);
            pop.classList.add('visible');

            const GAP = 8, r = el.getBoundingClientRect();
            const pw = pop.offsetWidth, ph = pop.offsetHeight;
            let y = r.bottom + GAP;
            if (y + ph > window.innerHeight - GAP) y = Math.max(GAP, r.top - ph - GAP);
            pop.style.left = Math.max(GAP, Math.min(r.left, window.innerWidth - pw - GAP)) + 'px';
            pop.style.top  = y + 'px';
        }

        function hide() {
            pop.classList.remove('visible');
            current = null;
            pinned  = false;
        }

        if (canHover) {
            root.addEventListener('mouseover', function (e) {
                const el = e.target.closest('[data-w]');
                if (el && el !== current && !pinned) show(el, false);
            });
            root.addEventListener('mouseout', function (e) {
                const el = e.target.closest('[data-w]');
                if (el && !pinned && !el.contains(e.relatedTarget)) hide();
            });
        }

        root.addEventListener('click', function (e) {
            const el = e.target.closest('[data-w]');
            if (!el) return;
            e.stopPropagation();
            if (el === current && pinned) hide(); else show(el, true);
        });

        root.addEventListener('keydown', function (e) {
            const el = e.target.closest('[data-w]');
            if (el && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                el.click();
            }
        });

        document.addEventListener('click', function (e) { if (pinned && !pop.contains(e.target)) hide(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
        document.addEventListener('scroll', hide, { capture: true, passive: true });

        return { hide: hide };
    }

    /* ------------------------------------------------------------------ */
    /*  SETTINGS PANEL                                                      */
    /* ------------------------------------------------------------------ */

    function initSettings(host, app, onChange) {
        const season   = app.season;
        const settings = app.settings;

        const groups = {};
        season.data.series.forEach(function (s) { (groups[s.category] = groups[s.category] || []).push(s); });
        const cats = CATEGORY_ORDER.filter(function (c) { return groups[c]; })
            .concat(Object.keys(groups).filter(function (c) { return CATEGORY_ORDER.indexOf(c) < 0; }));

        const catHTML = cats.map(function (c) {
            const list = groups[c].slice().sort(function (a, b) {
                return LICENCE_ORDER.indexOf(a.license_group) - LICENCE_ORDER.indexOf(b.license_group)
                    || shortName(a.name).localeCompare(shortName(b.name));
            });
            return '<div class="ss-cat"><h4 class="ss-cat-name">' + esc(titleCase(c)) + ' <span>' + list.length + '</span></h4>'
                + '<div class="ss-list">' + list.map(function (s) {
                    const key = seriesKey(s.id);
                    return '<label class="ss-series" title="' + esc(s.name) + '" data-text="' + esc((s.name + ' ' + s.all_cars.join(' ')).toLowerCase()) + '">'
                        + '<input type="checkbox" data-series="' + esc(key) + '"' + (settings.series.indexOf(key) >= 0 ? ' checked' : '') + '>'
                        + licBadge(s, { licence: true })
                        + '<span class="ss-name">' + esc(shortName(s.name)) + '</span></label>';
                }).join('') + '</div></div>';
        }).join('');

        const pillHTML = ATTRS.map(function (a) {
            return '<label class="ss-pill"><input type="checkbox" data-attr="' + a.key + '"' + (settings.attrs[a.key] ? ' checked' : '') + '>' + a.label + '</label>';
        }).join('');

        host.innerHTML = '<details class="sched-settings">'
            + '<summary><span class="ss-title">Customise</span><span class="ss-summary"></span>'
            + '<svg class="ss-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
            + '</summary>'
            + '<div class="ss-body">'
            + '<div class="ss-group"><h3 class="ss-label">Show</h3><div class="ss-pills">' + pillHTML + '</div></div>'
            + '<div class="ss-group">'
            + '<div class="ss-series-head"><h3 class="ss-label">Series</h3>'
            + '<input type="search" class="ss-filter" placeholder="Filter by series or car…" aria-label="Filter series by name or car">'
            + '<button type="button" class="ss-reset">Reset to defaults</button></div>'
            + '<div class="ss-cats">' + catHTML + '<p class="ss-nomatch" hidden>No series match.</p></div>'
            + '</div></div></details>';

        const summary = host.querySelector('.ss-summary');
        const filter  = host.querySelector('.ss-filter');
        const noMatch = host.querySelector('.ss-nomatch');

        function syncSummary() {
            const n     = settings.series.filter(function (k) { return season.byKey[k]; }).length;
            const shown = ATTRS.filter(function (a) { return settings.attrs[a.key]; }).length;
            summary.textContent = plural(n, 'series', 'series') + ' · ' + plural(shown, 'detail') + ' shown';
        }

        host.addEventListener('change', function (e) {
            const t = e.target;
            if (t.dataset.attr) {
                settings.attrs[t.dataset.attr] = t.checked;
            } else if (t.dataset.series) {
                const key = t.dataset.series;
                settings.series = settings.series.filter(function (k) { return k !== key; });
                if (t.checked) settings.series.push(key);
            } else {
                return;
            }
            syncSummary();
            onChange();
        });

        filter.addEventListener('input', function () {
            const terms = filter.value.toLowerCase().split(/\s+/).filter(Boolean);
            let any = false;
            host.querySelectorAll('.ss-cat').forEach(function (cat) {
                let visible = 0;
                cat.querySelectorAll('.ss-series').forEach(function (label) {
                    const hit = terms.every(function (t) { return label.dataset.text.indexOf(t) >= 0; });
                    label.hidden = !hit;
                    if (hit) visible++;
                });
                cat.hidden = !visible;
                if (visible) any = true;
            });
            noMatch.hidden = any;
        });

        host.querySelector('.ss-reset').addEventListener('click', function () {
            Object.assign(settings, defaultSettings());
            host.querySelectorAll('[data-attr]').forEach(function (i) { i.checked = settings.attrs[i.dataset.attr]; });
            host.querySelectorAll('[data-series]').forEach(function (i) { i.checked = settings.series.indexOf(i.dataset.series) >= 0; });
            syncSummary();
            onChange();
        });

        syncSummary();
    }

    /* ------------------------------------------------------------------ */
    /*  INIT — schedule                                                     */
    /* ------------------------------------------------------------------ */

    function startSchedule(root, data) {
        const season = buildSeason(data);
        const app    = { season: season, settings: loadSettings(), today: todayISO() };

        const label = document.getElementById('schedule-season');
        if (label) label.textContent = season.label;

        root.innerHTML = '<div class="sched-settings-host"></div><div class="sched-view"></div>';
        const view = root.querySelector('.sched-view');
        const pop  = initPopover(view, season);

        function render() {
            pop.hide();
            renderView(view, app);
        }

        initSettings(root.querySelector('.sched-settings-host'), app, function () {
            saveSettings(app.settings);
            render();
        });
        render();
    }

    function initSchedule() {
        const root = document.getElementById('schedule-app');
        if (!root) return;

        // Data URL is injected by Eleventy via data-json attribute
        fetch(root.dataset.json)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) { startSchedule(root, data); })
            .catch(function (err) {
                console.error('Failed to load iRacing schedule:', err);
                root.innerHTML = '<p class="schedule-loading">Couldn’t load the schedule.</p>';
            });
    }

    /* ------------------------------------------------------------------ */
    /*  LIGHTBOX                                                            */
    /* ------------------------------------------------------------------ */

    function initLightbox() {
        var lb      = document.getElementById('lightbox');
        if (!lb) return;
        var lbImg   = lb.querySelector('.lightbox-img');
        var lbCap   = lb.querySelector('.lightbox-caption');
        var lbClose = lb.querySelector('.lightbox-close');
        var lbBack  = lb.querySelector('.lightbox-backdrop');

        function open(src, caption, alt) {
            lbImg.src = src;
            lbImg.alt = alt || caption;
            lbCap.textContent = caption || '';
            lb.classList.add('open');
            document.body.style.overflow = 'hidden';
        }

        function close() {
            lb.classList.remove('open');
            document.body.style.overflow = '';
            setTimeout(function () {
                if (!lb.classList.contains('open')) lbImg.src = '';
            }, 250);
        }

        document.querySelectorAll('[data-lightbox]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                var img = el.querySelector('img');
                open(el.dataset.lightbox, el.dataset.caption, img ? img.alt : '');
            });
        });

        lbClose.addEventListener('click', close);
        lbBack.addEventListener('click', close);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && lb.classList.contains('open')) close();
        });
    }

    /* ------------------------------------------------------------------ */
    /*  BOOT                                                                */
    /* ------------------------------------------------------------------ */

    function init() {
        initSchedule();
        initLightbox();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
