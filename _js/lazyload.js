/**
 * @file lazyload.js
 * We only load the first 6 images in a gallery directly; beyond that
 * we lazyload for better loading performance since it's all coming off
 * of a single domain so these long galleries get stuck by per-hostname
 * limitations.
 */
(function () {
  'use strict';

  function lazyloadRemainingImages () {
    // Adapted from https://davidwalsh.name/lazyload-image-fade
    // the [].foreach.call() is better explained at http://stackoverflow.com/questions/16053357/what-does-foreach-call-do-in-javascript
    [].forEach.call(document.querySelectorAll('img[data-src]'), function (img) {
      var newSrc = img.getAttribute('data-src');
      img.removeAttribute('data-src');
      img.setAttribute('src', newSrc);
    });
  }

  document.addEventListener('DOMContentLoaded', lazyloadRemainingImages);
})();
