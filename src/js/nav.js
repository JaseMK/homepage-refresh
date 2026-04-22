/**
 * nav.js — shared nav behaviour for all pages
 */
(function () {
    const nav    = document.getElementById('nav');
    const toggle = document.getElementById('navToggle');
    const tabs   = document.getElementById('navTabs');

    if (!nav || !toggle || !tabs) return;

    // Subtle border darkening on scroll
    window.addEventListener('scroll', function () {
        nav.style.borderBottomColor = window.scrollY > 10
            ? '#c5ceee'
            : 'var(--border)';
    }, { passive: true });

    // Mobile hamburger
    toggle.addEventListener('click', function () {
        tabs.classList.toggle('open');
    });

    toggle.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            tabs.classList.toggle('open');
        }
    });

    // Close menu when a link is clicked
    tabs.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
            tabs.classList.remove('open');
        });
    });
})();
