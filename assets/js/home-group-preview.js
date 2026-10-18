(() => {
  if (new URLSearchParams(window.location.search).get('home-design') !== 'four-groups') return;

  document.documentElement.dataset.homeDesign = 'four-groups';
  const robots = document.querySelector('meta[name="robots"]') || document.createElement('meta');
  robots.name = 'robots';
  robots.content = 'noindex,nofollow';
  if (!robots.isConnected) document.head.append(robots);
})();
