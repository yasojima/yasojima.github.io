(() => {
  const root = document.querySelector('.home-pickup__carousel');
  const slider = root?.querySelector('.swiper')?.swiper;
  if (!slider) return;
  const playback = root.querySelector('.home-pickup__playback');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motion.matches;
  let visible = false;
  let focused = false;
  let hovered = false;

  function update() {
    slider.params.speed = motion.matches ? 0 : 1000;
    playback.setAttribute('aria-pressed', String(paused));
    playback.setAttribute('aria-label', paused ? '自動スライドを再生' : '自動スライドを停止');
    if (paused || !visible || focused || hovered || document.hidden) slider.autoplay.stop();
    else if (!slider.autoplay.running) slider.autoplay.start();
  }
  function updateSlides() {
    slider.slides.forEach(slide => {
      slide.setAttribute('aria-hidden', String(!slide.classList.contains('swiper-slide-active')));
    });
  }
  playback.addEventListener('click', () => { paused = !paused; update(); });
  root.addEventListener('focusin', () => { focused = true; update(); });
  root.addEventListener('focusout', event => {
    if (!root.contains(event.relatedTarget)) { focused = false; update(); }
  });
  root.addEventListener('mouseenter', () => { hovered = true; update(); });
  root.addEventListener('mouseleave', () => { hovered = false; update(); });
  root.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') slider.slidePrev();
    else slider.slideNext();
  });
  document.addEventListener('visibilitychange', update);
  motion.addEventListener('change', () => { paused = motion.matches; update(); });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    update();
  }, { threshold: 0.25 }).observe(root);
  slider.on('slideChangeTransitionEnd', updateSlides);
  slider.on('loopFix', updateSlides);
  updateSlides();
  update();
})();
