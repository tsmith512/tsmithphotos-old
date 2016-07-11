/**
 * @file photoswipe.js
 * Include this site's setup and init for Photoswipe. We get the
 * library's primary and skin JS/CSS through the node module package.
 */
(function(){
  'use strict';


  document.addEventListener("DOMContentLoaded", function() {
    var pswpElement = document.querySelectorAll('.pswp')[0];
    var items = [];
    var photos = document.querySelectorAll('.album a');
    var total = photos.length;

    for (var i = 0; i < total; i++) {
        var photo = photos[i]; // This element is the link tag, not the thumbnail image.
        
        // Include only elements
        if (photo.nodeType !== 1) { continue; }

        var size = photo.getAttribute('data-size').split('x');

        var item = {
            src: photo.getAttribute('href'),
            w: parseInt(size[0], 10),
            h: parseInt(size[1], 10),
            msrc: photo.getAttribute('href').replace('original', 'medium'),
        };

        items.push(item);
    }
    console.log(items);
    // define options (if needed)
    var options = {
        // optionName: 'option value'
        // for example:
        // index: 0 // start at first slide
    };

    // Initializes and opens PhotoSwipe
    var gallery = new PhotoSwipe( pswpElement, PhotoSwipeUI_Default, items, options);
    gallery.init();
  });
  
})();
