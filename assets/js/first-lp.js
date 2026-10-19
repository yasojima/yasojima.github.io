/* Shared tabs own click handling; this page adds keyboard navigation and local anchors. */
(() => {
  const root = document.getElementById('cch-first-lp');
  if (!root) return;
  root.querySelectorAll('.js-tab-buttons').forEach(group => {
    const tabs = [...group.querySelectorAll('[role="tab"]')];
    group.addEventListener('keydown', event => {
      const current = tabs.indexOf(event.target);
      if (current < 0) return;
      let next;
      if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      tabs[next].click();
      tabs[next].focus();
    });
  });
  root.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      target.setAttribute('tabindex', '-1');
      target.focus({preventScroll:true});
      target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
      history.replaceState(null, '', link.hash);
    });
  });
})();
