/**
 * components.js — shared nav and footer for all pages
 * Edit this file to update the header/footer across the whole site.
 *
 * Each page needs:
 *   <div id="site-header"></div>  at the top of <body>
 *   <div id="site-footer"></div>  at the bottom of <body>
 *   <script src="/components.js"></script>  before </body>
 */
(function () {

    /* ------------------------------------------------------------------ */
    /*  NAV                                                                 */
    /* ------------------------------------------------------------------ */
    const navHTML = `
<nav id="nav">
    <a href="/" class="nav-logo">
        <span class="bracket">&lt;</span><span class="name">jc</span><span class="slash"> /&gt;</span>
    </a>
    <ul class="nav-tabs" id="navTabs">
        <li><a href="/#about"><span class="tab-dot"></span>about.md</a></li>
        <li><a href="/#connect"><span class="tab-dot"></span>contact.json</a></li>
        <li><a href="/#work"><span class="tab-dot"></span>work/</a></li>
        <li><a href="/#gallery"><span class="tab-dot"></span>gallery/</a></li>
        <li><a href="/#pages"><span class="tab-dot"></span>pages/</a></li>
    </ul>
    <div class="nav-toggle" id="navToggle" role="button" tabindex="0" aria-label="Toggle menu">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
    </div>
</nav>`;

    /* ------------------------------------------------------------------ */
    /*  FOOTER                                                              */
    /* ------------------------------------------------------------------ */
    const footerHTML = `
<footer>
    <div class="sb-left">
        <span class="sb-item">⎇ main</span>
        <span class="sb-sep">|</span>
        <span class="sb-item">jasoncarvalho.com</span>
    </div>
    <div class="sb-right">
        <span class="sb-item">UTF-8</span>
        <span class="sb-sep">|</span>
        <span class="sb-item">HTML</span>
        <span class="sb-sep">|</span>
        <span class="sb-item">© ${new Date().getFullYear()} Jason Carvalho</span>
    </div>
</footer>`;

    /* ------------------------------------------------------------------ */
    /*  INJECT                                                              */
    /* ------------------------------------------------------------------ */
    const headerEl = document.getElementById('site-header');
    const footerEl = document.getElementById('site-footer');
    if (headerEl) headerEl.outerHTML = navHTML;
    if (footerEl) footerEl.outerHTML = footerHTML;

    /* ------------------------------------------------------------------ */
    /*  NAV BEHAVIOUR                                                       */
    /* ------------------------------------------------------------------ */

    // Subtle border darkening on scroll
    const nav = document.getElementById('nav');
    window.addEventListener('scroll', () => {
        nav.style.borderBottomColor = window.scrollY > 10
            ? 'var(--border-lt)'
            : 'var(--border)';
    }, { passive: true });

    // Mobile hamburger toggle
    const toggle = document.getElementById('navToggle');
    const tabs   = document.getElementById('navTabs');
    toggle.addEventListener('click', () => tabs.classList.toggle('open'));
    toggle.addEventListener('keydown', e => {
        if (e.key === 'Enter') tabs.classList.toggle('open');
    });
    tabs.querySelectorAll('a').forEach(a =>
        a.addEventListener('click', () => tabs.classList.remove('open'))
    );


    /* ------------------------------------------------------------------ */
    /*  DATA-DRIVEN SECTIONS                                                */
    /* ------------------------------------------------------------------ */

    const dotColors = ['blue', 'purple', 'green'];

    function renderResearch(items) {
        const container = document.getElementById('research-items');
        if (!container) return;
        container.innerHTML = items.map((item, i) => `
            <div class="rc">
                <div class="rc-fileheader">
                    <div class="rc-lang-dot" style="background:var(--${dotColors[i % 3]})"></div>
                    <span>${item.id}.ts</span>
                </div>
                <div class="rc-body">
                    <div class="rc-year">${item.year}</div>
                    <h3 class="rc-title">${item.title}</h3>
                    <p class="rc-desc">${item.description}</p>
                    <div class="rc-tags">
                        ${item.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderPublications(items) {
        const container = document.getElementById('publications-items');
        if (!container) return;
        container.innerHTML = items.map((item, i) => `
            <div class="pub-item">
                <span class="pub-ref">[${String(i + 1).padStart(2, '0')}]</span>
                <div>
                    <div class="pub-authors">${item.authors}</div>
                    <div class="pub-title">${item.title}</div>
                    <div class="pub-venue">${item.venue}</div>
                </div>
                <span class="pub-year">${item.year}</span>
            </div>
        `).join('');
    }

    function renderApps(items) {
        const container = document.getElementById('apps-items');
        if (!container) return;
        container.innerHTML = items.map(item => `
            <a href="${item.url}" class="app-card">
                <div class="app-card-header">
                    <span>${item.id}/</span>
                    <span class="app-badge">${item.status}</span>
                </div>
                <div class="app-body">
                    <div class="app-name">${item.name}</div>
                    <p class="app-desc">${item.description}</p>
                </div>
                <div class="app-footer">
                    <span class="cm">// ${item.stack}</span>
                    <span class="app-link-label">visit <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
                </div>
            </a>
        `).join('');
    }

    Promise.all([
        fetch('/data/research.json').then(r => r.json()),
        fetch('/data/publications.json').then(r => r.json()),
        fetch('/data/apps.json').then(r => r.json()),
    ]).then(([research, publications, apps]) => {
        renderResearch(research);
        renderPublications(publications);
        renderApps(apps);
    }).catch(err => console.error('Failed to load site data:', err));

})();
