(() => {
  const root = document.getElementById('cch-first-lp');
  if (!root || !document.body.classList.contains('c-beginner-lp')) return;

  for (const view of root.querySelectorAll('[data-before-after]')) {
    if (view.querySelector('.icv__control')) continue;
    const images = [...view.querySelectorAll('img')];
    if (images.length !== 2) continue;

    const label = side => {
      const element = document.createElement('span');
      element.className = `icv__label icv__label-${side.toLowerCase()} keep on-hover`;
      element.textContent = side;
      return element;
    };
    const before = label('Before');
    const after = label('After');
    images.forEach((image, index) => image.classList.add('icv__img', index ? 'icv__img-b' : 'icv__img-a'));

    const wrapper = document.createElement('div');
    wrapper.className = 'icv__wrapper';
    wrapper.style.height = '50%';
    wrapper.append(images[1]);

    const control = document.createElement('div');
    control.className = 'icv__control';
    control.style.width = '50px';
    control.style.touchAction = 'none';
    control.setAttribute('role', 'slider');
    control.setAttribute('tabindex', '0');
    control.setAttribute('aria-label', 'BeforeとAfterの比較位置');
    control.setAttribute('aria-valuemin', '0');
    control.setAttribute('aria-valuemax', '100');
    control.setAttribute('aria-orientation', 'horizontal');

    const line = document.createElement('div');
    line.className = 'icv__control-line';
    line.style.width = '2px';
    line.style.background = '#FFFFFF';
    line.style.boxShadow = '0px 0px 15px rgba(0,0,0,0.33)';
    const arrows = document.createElement('div');
    arrows.className = 'icv__theme-wrapper';
    arrows.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 2; index++) {
      const arrow = document.createElement('div');
      arrow.className = 'icv__arrow-wrapper';
      arrows.append(arrow);
    }
    control.append(line, arrows, line.cloneNode(true));

    const safari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
    if (!('ontouchstart' in document.documentElement) && !safari &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      wrapper.style.transition = '100ms ease-out';
      control.style.transition = '100ms ease-out';
    }

    view.classList.add('icv', 'icv__icv--horizontal', 'standard');
    view.style.touchAction = 'pan-y pinch-zoom';
    view.style.userSelect = 'none';
    view.replaceChildren(images[0], before, after, wrapper, control);

    let split = 50;
    let activePointer = null;
    const update = value => {
      split = Math.max(0, Math.min(100, value));
      wrapper.style.width = `calc(100% - ${split}%)`;
      control.style.left = `calc(${split}% - 25px)`;
      const rounded = Math.round(split);
      control.setAttribute('aria-valuenow', String(rounded));
      control.setAttribute('aria-valuetext', `Before ${rounded}％、After ${100 - rounded}％`);
    };
    const moveTo = clientX => {
      const rect = view.getBoundingClientRect();
      if (rect.width) update((clientX - rect.left) / rect.width * 100);
    };
    const endDrag = event => {
      if (activePointer === null || (event && event.pointerId !== activePointer)) return;
      const pointer = activePointer;
      activePointer = null;
      if (view.hasPointerCapture(pointer)) view.releasePointerCapture(pointer);
    };

    view.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || activePointer !== null) return;
      // A finger outside the handle retains the page's normal vertical scrolling.
      if (event.pointerType === 'touch' && !control.contains(event.target)) return;
      activePointer = event.pointerId;
      view.setPointerCapture(activePointer);
      control.focus({preventScroll: true});
      moveTo(event.clientX);
      event.preventDefault();
    });
    view.addEventListener('pointermove', event => {
      if (event.pointerId !== activePointer) return;
      if (event.pointerType === 'mouse' && !(event.buttons & 1)) {
        endDrag(event);
        return;
      }
      moveTo(event.clientX);
      event.preventDefault();
    });
    view.addEventListener('pointerup', event => {
      if (event.pointerId === activePointer) moveTo(event.clientX);
      endDrag(event);
    });
    view.addEventListener('pointercancel', endDrag);
    view.addEventListener('lostpointercapture', endDrag);
    window.addEventListener('blur', () => endDrag());
    window.addEventListener('resize', () => endDrag());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) endDrag();
    });

    control.addEventListener('keydown', event => {
      const step = event.shiftKey ? 10 : 5;
      const value = {
        ArrowLeft: split - step,
        ArrowDown: split - step,
        ArrowRight: split + step,
        ArrowUp: split + step,
        Home: 0,
        End: 100,
      }[event.key];
      if (value === undefined) return;
      update(value);
      event.preventDefault();
    });
    update(split);
  }
})();
