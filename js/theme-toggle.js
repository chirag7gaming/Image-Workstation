(function () {
  'use strict';

  var root = document.documentElement;

  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored);
  } catch (e) {}

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }

  function toggle() {
    apply(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  }

  var btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', toggle);

  window.toggleTheme = toggle;
})();