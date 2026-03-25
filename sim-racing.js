/**
 * sim-racing.js — iRacing 2026 S2 schedule table
 */
(function () {

    const DATA_URL = '/data/iracing/2026S2.json';

    /* ------------------------------------------------------------------ */
    /*  DATE HELPERS                                                        */
    /* ------------------------------------------------------------------ */

    function parseDate(str) {
        // Parse YYYY-MM-DD as local midnight to avoid UTC-shift issues
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function formatDate(str) {
        return parseDate(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    /* ------------------------------------------------------------------ */
    /*  CALENDAR-WEEK HELPERS                                               */
    /* ------------------------------------------------------------------ */

    // Collect all unique week_start values across every series, sorted ascending
    function getCalendarWeeks(series) {
        const dates = new Set();
        series.forEach(s => s.weeks.forEach(w => dates.add(w.week_start)));
        return Array.from(dates).sort();
    }

    // 'past' | 'current' | 'future'  — based on [weekStart, weekStart+7)
    function weekStatus(weekStart, today) {
        const start = parseDate(weekStart);
        const end   = new Date(start);
        end.setDate(end.getDate() + 7);

        if (today < start) return 'future';
        if (today < end)   return 'current';
        return 'past';
    }

    /* ------------------------------------------------------------------ */
    /*  BUILD TOOLTIP DATA                                                  */
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
        };
    }

    function renderTooltipHTML(d) {
        const rainRow = d.rain_pct > 0
            ? `<div class="tt-row"><span class="tt-label">Rain</span><span class="tt-val tt-val-rain">${d.rain_pct}%</span></div>`
            : `<div class="tt-row"><span class="tt-label">Rain</span><span class="tt-val tt-val-dry">Dry</span></div>`;

        const raceDateRow = d.race_date
            ? `<div class="tt-row"><span class="tt-label">Race date</span><span class="tt-val">${formatDate(d.race_date)}</span></div>`
            : '';

        const noteRow = d.schedule_note
            ? `<div class="tt-note">${d.schedule_note}</div>`
            : '';

        return `
<div class="tt-track">${d.track}</div>
<div class="tt-divider"></div>
<div class="tt-row"><span class="tt-label">Duration</span><span class="tt-val">${d.race_duration}</span></div>
${raceDateRow}
<div class="tt-row"><span class="tt-label">Temp</span><span class="tt-val">${d.temp_c}°C / ${d.temp_f}°F</span></div>
${rainRow}
<div class="tt-row"><span class="tt-label">Frequency</span><span class="tt-val tt-val-freq">${d.race_frequency}</span></div>
${noteRow}
<div class="tt-divider"></div>
<div class="tt-cars">${d.cars.join(' · ')}</div>
<div class="tt-row"><span class="tt-label">Min iRating</span><span class="tt-val">${(d.min_ir * 1000).toLocaleString()}</span></div>
<div class="tt-row"><span class="tt-label">Splits at</span><span class="tt-val">${d.splits_at} drivers</span></div>
<div class="tt-row"><span class="tt-label">Drops</span><span class="tt-val">${d.drops} wks</span></div>`;
    }

    /* ------------------------------------------------------------------ */
    /*  TOOLTIP BEHAVIOUR                                                   */
    /* ------------------------------------------------------------------ */

    function initTooltips(container) {
        const tip   = container.querySelector('.schedule-tooltip');
        const cells = container.querySelectorAll('.td-track[data-tip]');

        cells.forEach(cell => {
            cell.addEventListener('mouseenter', e => {
                tip.innerHTML = renderTooltipHTML(JSON.parse(cell.dataset.tip));
                tip.classList.add('visible');
                positionTip(e, tip);
            });
            cell.addEventListener('mousemove',  e => positionTip(e, tip));
            cell.addEventListener('mouseleave', ()  => tip.classList.remove('visible'));
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
        const { series } = data;
        const calWeeks   = getCalendarWeeks(series);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const seasonStart    = parseDate(calWeeks[0]);
        const beforeSeason   = today < seasonStart;

        // Build per-series lookup: weekStart → weekData
        const lookup = series.map(s => {
            const map = {};
            s.weeks.forEach(w => { map[w.week_start] = w; });
            return map;
        });

        // thead
        const headCols = series.map(s => `
            <th class="th-series">
                <span class="series-short">${s.short_name}</span>
                <span class="series-full">${s.name}</span>
            </th>`).join('');

        // tbody rows
        const rows = calWeeks.map((ws, i) => {
            const status = beforeSeason && i === 0 ? 'current'
                         : beforeSeason            ? 'future'
                         : weekStatus(ws, today);

            const cells = series.map((s, si) => {
                const week = lookup[si][ws];
                if (!week) {
                    return `<td class="td-track td-empty"><span class="track-dash">—</span></td>`;
                }
                const tip = JSON.stringify(buildTooltipData(s, week)).replace(/'/g, '&#39;');
                return `<td class="td-track" data-tip='${tip}'><span class="track-name">${week.track}</span></td>`;
            }).join('');

            return `
            <tr class="week-row week-${status}">
                <td class="td-week">${String(i + 1).padStart(2, '0')}</td>
                <td class="td-date">${formatDate(ws)}</td>
                ${cells}
            </tr>`;
        }).join('');

        container.innerHTML = `
<div class="schedule-wrap">
    <div class="schedule-scroll">
        <table class="schedule-table" role="grid" aria-label="${data.season} Schedule">
            <thead>
                <tr>
                    <th class="th-week">#</th>
                    <th class="th-date">Week of</th>
                    ${headCols}
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>
    <div class="schedule-tooltip" role="tooltip" aria-hidden="true"></div>
</div>`;

        initTooltips(container);
    }

    /* ------------------------------------------------------------------ */
    /*  INIT                                                                */
    /* ------------------------------------------------------------------ */

    function init() {
        const container = document.getElementById('schedule-container');
        if (!container) return;

        fetch(DATA_URL)
            .then(r => r.json())
            .then(data => renderSchedule(container, data))
            .catch(err => {
                console.error('Failed to load iRacing schedule:', err);
                const container = document.getElementById('schedule-container');
                if (container) container.innerHTML =
                    `<p class="cm">// Error loading schedule data</p>`;
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
