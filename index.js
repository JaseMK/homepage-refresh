/**
 * index.js — home page interactions
 */
(function () {

    /* ------------------------------------------------------------------ */
    /*  HERO CAROUSEL                                                       */
    /* ------------------------------------------------------------------ */

    function initCarousel() {
        const carousel = document.getElementById('heroCarousel');
        if (!carousel) return;

        const slides        = Array.from(carousel.querySelectorAll('.hc-slide'));
        const dotsContainer = carousel.querySelector('.hc-dots');
        const prevBtn       = carousel.querySelector('.hc-prev');
        const nextBtn       = carousel.querySelector('.hc-next');

        if (!slides.length) return;

        let current = 0;
        let timer   = null;
        const INTERVAL = 4500;

        // Build dots
        slides.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className   = 'hc-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', `Photo ${i + 1}`);
            dot.setAttribute('role', 'tab');
            dot.addEventListener('click', () => { goTo(i); resetTimer(); });
            dotsContainer.appendChild(dot);
        });

        function goTo(n) {
            slides[current].classList.remove('active');
            dotsContainer.children[current].classList.remove('active');
            current = (n + slides.length) % slides.length;
            slides[current].classList.add('active');
            dotsContainer.children[current].classList.add('active');
        }

        prevBtn.addEventListener('click', () => { goTo(current - 1); resetTimer(); });
        nextBtn.addEventListener('click', () => { goTo(current + 1); resetTimer(); });

        // Swipe support
        let touchStartX = null;
        carousel.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
        carousel.addEventListener('touchend', e => {
            if (touchStartX === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) > 40) { goTo(current + (dx < 0 ? 1 : -1)); resetTimer(); }
            touchStartX = null;
        });

        function startTimer() { timer = setInterval(() => goTo(current + 1), INTERVAL); }
        function resetTimer() { clearInterval(timer); startTimer(); }

        carousel.addEventListener('mouseenter', () => clearInterval(timer));
        carousel.addEventListener('mouseleave', () => { clearInterval(timer); startTimer(); });

        startTimer();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCarousel);
    } else {
        initCarousel();
    }

})();
