/**
 * sim-racing.js — iRacing season schedule table + lightbox
 */
(function () {

    /* ------------------------------------------------------------------ */
    /*  DATE HELPERS                                                        */
    /* ------------------------------------------------------------------ */

    function parseDate(str) {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function formatDate(str) {
        return parseDate(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    /* ------------------------------------------------------------------ */
    /*  CALENDAR-WEEK HELPERS                                               */
    /* ------------------------------------------------------------------ */

    function getCalendarWeeks(series) {
        const dates = new Set();
        series.forEach(function (s) { s.weeks.forEach(function (w) { dates.add(w.week_start); }); });
        return Array.from(dates).sort();
    }

    function weekStatus(weekStart, today) {
        const start = parseDate(weekStart);
        const end   = new Date(start);
        end.setDate(end.getDate() + 7);
        if (today < start) return 'future';
        if (today < end)   return 'current';
        return 'past';
    }

    /* ------------------------------------------------------------------ */
    /*  TOOLTIP                                                             */
    /* ------------------------------------------------------------------ */

    function buildTooltipData(series, week) {
        return {
            track:          week.track,
            race_duration:  week.race_duration  || series.race_duration,
            race_frequency: series.race_frequency,
            schedule_note:  series.schedule_note || null,
            race_date:      week.race_date       || null,
            temp_c:         week.temp_c,
            temp_f:         week.temp_f,
            rain_pct:       week.rain_chance_pct,
            cars:           series.cars,
            min_ir:         series.min_ir,
            splits_at:      series.splits_at,
            drops:          series.drops,
            completed:      week.completed === true,
        };
    }

    function renderTooltipHTML(d) {
        const rainRow = d.rain_pct > 0
            ? '<div class="tt-row"><span class="tt-label">Rain</span><span class="tt-val tt-val-rain">' + d.rain_pct + '%</span></div>'
            : '<div class="tt-row"><span class="tt-label">Rain</span><span class="tt-val tt-val-dry">Dry</span></div>';

        const raceDateRow = d.race_date
            ? '<div class="tt-row"><span class="tt-label">Race date</span><span class="tt-val">' + formatDate(d.race_date) + '</span></div>'
            : '';

        const noteRow = d.schedule_note
            ? '<div class="tt-note">' + d.schedule_note + '</div>'
            : '';

        return '<div class="tt-track">' + d.track + '</div>'
            + '<div class="tt-divider"></div>'
            + '<div class="tt-row"><span class="tt-label">Duration</span><span class="tt-val">' + d.race_duration + '</span></div>'
            + raceDateRow
            + '<div class="tt-row"><span class="tt-label">Temp</span><span class="tt-val">' + d.temp_c + '°C / ' + d.temp_f + '°F</span></div>'
            + rainRow
            + '<div class="tt-row"><span class="tt-label">Frequency</span><span class="tt-val tt-val-freq">' + d.race_frequency + '</span></div>'
            + noteRow
            + '<div class="tt-divider"></div>'
            + '<div class="tt-cars">' + d.cars.join(' · ') + '</div>'
            + '<div class="tt-row"><span class="tt-label">Min iRating</span><span class="tt-val">' + (d.min_ir * 1000).toLocaleString() + '</span></div>'
            + '<div class="tt-row"><span class="tt-label">Splits at</span><span class="tt-val">' + d.splits_at + ' drivers</span></div>'
            + '<div class="tt-row"><span class="tt-label">Drops</span><span class="tt-val">' + d.drops + ' wks</span></div>';
    }

    function initTooltips(container) {
        const tip   = container.querySelector('.schedule-tooltip');
        const cells = container.querySelectorAll('.td-track[data-tip]');

        cells.forEach(function (cell) {
            cell.addEventListener('mouseenter', function (e) {
                tip.innerHTML = renderTooltipHTML(JSON.parse(cell.dataset.tip));
                tip.classList.add('visible');
                positionTip(e, tip);
            });
            cell.addEventListener('mousemove',  function (e) { positionTip(e, tip); });
            cell.addEventListener('mouseleave', function ()  { tip.classList.remove('visible'); });
        });
    }

    function positionTip(e, tip) {
        const GAP = 14;
        const vw  = window.innerWidth;
        const vh  = window.innerHeight;
        const tw  = tip.offsetWidth;
        const th  = tip.offsetHeight;
        let x = e.clientX + GAP;
        let y = e.clientY + GAP;
        if (x + tw > vw - GAP) x = e.clientX - tw - GAP;
        if (y + th > vh - GAP) y = e.clientY - th - GAP;
        tip.style.left = x + 'px';
        tip.style.top  = y + 'px';
    }

    /* ------------------------------------------------------------------ */
    /*  TABLE RENDER                                                        */
    /* ------------------------------------------------------------------ */

    function renderSchedule(container, data) {
        var series    = data.series;
        var calWeeks  = getCalendarWeeks(series);
        var today     = new Date();
        today.setHours(0, 0, 0, 0);

        var seasonStart  = parseDate(calWeeks[0]);
        var beforeSeason = today < seasonStart;

        var lookup = series.map(function (s) {
            var map = {};
            s.weeks.forEach(function (w) { map[w.week_start] = w; });
            return map;
        });

        var headCols = series.map(function (s) {
            return '<th class="th-series">'
                + '<span class="series-short">' + s.short_name + '</span>'
                + '<span class="series-full">'  + s.name       + '</span>'
                + '</th>';
        }).join('');

        var rows = calWeeks.map(function (ws, i) {
            var status = (beforeSeason && i === 0) ? 'current'
                       : beforeSeason              ? 'future'
                       : weekStatus(ws, today);

            var cells = series.map(function (s, si) {
                var week = lookup[si][ws];
                if (!week) {
                    return '<td class="td-track td-empty"><span class="track-dash">—</span></td>';
                }
                var tip  = JSON.stringify(buildTooltipData(s, week)).replace(/'/g, '&#39;');
                var done = week.completed === true;
                return '<td class="td-track' + (done ? ' td-completed' : '') + '" data-tip=\'' + tip + '\'>'
                    + (done ? '<span class="track-tick" aria-label="Completed">✓</span>' : '')
                    + '<span class="track-name">' + week.track + '</span></td>';
            }).join('');

            return '<tr class="week-row week-' + status + '">'
                + '<td class="td-week">' + String(i + 1).padStart(2, '0') + '</td>'
                + '<td class="td-date">' + formatDate(ws) + '</td>'
                + cells
                + '</tr>';
        }).join('');

        container.innerHTML =
            '<div class="schedule-wrap">'
            + '<div class="schedule-scroll">'
            + '<table class="schedule-table" role="grid" aria-label="' + data.season + ' Schedule">'
            + '<thead><tr>'
            + '<th class="th-week">#</th>'
            + '<th class="th-date">Week of</th>'
            + headCols
            + '</tr></thead>'
            + '<tbody>' + rows + '</tbody>'
            + '</table></div>'
            + '<div class="schedule-tooltip" role="tooltip" aria-hidden="true"></div>'
            + '</div>';

        initTooltips(container);
    }

    /* ------------------------------------------------------------------ */
    /*  INIT — schedule                                                     */
    /* ------------------------------------------------------------------ */

    function initSchedule() {
        var container = document.getElementById('schedule-container');
        if (!container) return;

        // Data URL is injected by Eleventy via data-json attribute
        var dataUrl = container.dataset.json || 'data/iracing/2026S2.json';

        fetch(dataUrl)
            .then(function (r) { return r.json(); })
            .then(function (data) { renderSchedule(container, data); })
            .catch(function (err) {
                console.error('Failed to load iRacing schedule:', err);
                container.innerHTML = '<p class="cm">// Error loading schedule data</p>';
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
