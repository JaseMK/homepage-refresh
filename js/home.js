(function () {
    const track   = document.getElementById('homeCarousel');
    const dotsEl  = document.getElementById('homeCarouselDots');
    const caption = document.getElementById('homeCarouselCaption');
    if (!track) return;

    const imgs = track.querySelectorAll('.home-img');
    let current = 0;
    let timer;

    imgs.forEach((img, i) => {
        const btn = document.createElement('button');
        btn.className = 'home-img-dot' + (i === 0 ? ' active' : '');
        btn.setAttribute('aria-label', 'Image ' + (i + 1));
        btn.addEventListener('click', () => goTo(i));
        dotsEl.appendChild(btn);
    });

    function goTo(idx) {
        imgs[current].classList.remove('active');
        dotsEl.children[current].classList.remove('active');
        current = (idx + imgs.length) % imgs.length;
        imgs[current].classList.add('active');
        dotsEl.children[current].classList.add('active');
        if (caption) caption.textContent = imgs[current].alt;
    }

    function advance() { goTo(current + 1); }
    function start()   { timer = setInterval(advance, 4500); }
    function stop()    { clearInterval(timer); }

    track.addEventListener('mouseenter', stop);
    track.addEventListener('mouseleave', start);

    let sx = 0;
    track.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend',   e => {
        const dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 40) goTo(current + (dx < 0 ? 1 : -1));
    }, { passive: true });

    start();
})();
