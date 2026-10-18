(() => {
  const section = document.querySelector('.home-concerns');
  if (!section) return;
  section.querySelectorAll('[data-concern-switcher]').forEach(switcher => {
    const places = [...switcher.querySelectorAll('[data-concern-place]')];
    const groups = [...switcher.querySelectorAll('[role="tabpanel"]')];

    const selectPlace = place => {
      places.forEach(button => {
        button.setAttribute('aria-selected', String(button === place));
        button.tabIndex = button === place ? 0 : -1;
      });
      const groupId = place.getAttribute('aria-controls');
      groups.forEach(group => { group.hidden = group.id !== groupId; });
    };

    switcher.addEventListener('click', event => {
      const place = event.target.closest('[data-concern-place]');
      if (!place || !switcher.contains(place) || place.getAttribute('aria-selected') === 'true') return;
      selectPlace(place);
    });

    switcher.addEventListener('keydown', event => {
      const index = places.indexOf(event.target);
      if (index < 0) return;
      const targets = { ArrowRight: (index + 1) % places.length,
        ArrowLeft: (index + places.length - 1) % places.length,
        Home: 0, End: places.length - 1 };
      if (!(event.key in targets)) return;
      event.preventDefault();
      const place = places[targets[event.key]];
      selectPlace(place);
      place.focus();
    });
  });
})();
