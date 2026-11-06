(function () {
  'use strict';

  var cores = navigator.hardwareConcurrency || 2;
  var mem = navigator.deviceMemory || 4;
  var tier = cores >= 8 && mem >= 8 ? 'high'
           : cores >= 4 && mem >= 4 ? 'mid'
           : 'low';

  var root = document.documentElement;
  root.setAttribute('data-perf-tier', tier);

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.setAttribute('data-motion', 'static');
  }
})();