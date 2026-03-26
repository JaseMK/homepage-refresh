/**
 * lightbox.js — standalone lightbox for pages that don't use sim-racing.js
 */
(function () {
    function initLightbox() {
        var lb = document.getElementById('lightbox');
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLightbox);
    } else {
        initLightbox();
    }
})();
