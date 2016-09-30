/**
 * @file lazyload.js
 * We only load the first 6 images in a gallery directly; beyond that
 * we lazyload for better loading performance since it's all coming off
 * of a single domain so these long galleries get stuck by per-hostname
 * limitations.
 *
 * Masthead images are originally loaded by all window sizes as the
 * medium size. After everything else is in (window load), we swap
 * that over to the full resolution. In tests, browsers don't remove
 * the loaded source until the replacement source is fully loaded, so
 * it ends up looking like a progressive load, but "paused" in the
 * middle to get something up then prioritize remaining content.
 */
(function () {
  'use strict';

  function lazyloadRemainingImages() {
    // Adapted from https://davidwalsh.name/lazyload-image-fade
    // the [].foreach.call() is better explained at http://stackoverflow.com/questions/16053357/what-does-foreach-call-do-in-javascript
    [].forEach.call(document.querySelectorAll('img[data-src]'), function (img) {
      var newSrc = img.getAttribute('data-src');
      img.setAttribute('src', newSrc);
      img.onload = function () {
        img.removeAttribute('data-src');
      };
    });
  }

  function lazyloadUpsize() {
    var mq = window.matchMedia('(min-width: 800px)');
    if (mq.matches) {
      [].forEach.call(document.querySelectorAll('img[data-big]'), function (img) {
        img.setAttribute('src', img.getAttribute('data-big'));
      });
    }
  }

  document.addEventListener('DOMContentLoaded', lazyloadRemainingImages);
  window.addEventListener('load', lazyloadUpsize);
})();
