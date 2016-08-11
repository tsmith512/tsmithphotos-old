// Adapted from https://raw.githubusercontent.com/filamentgroup/gulpicon/master/example/config.js

var path = require( "path" );

module.exports = {
  dest: "./_site/gfx/icons",

  // CSS filenames
  datasvgcss: "icons.data.svg.css",
  datapngcss: "icons.data.png.css",
  urlpngcss: "icons.fallback.css",

  // preview HTML filename
  previewhtml: "preview.html",

  // grunticon loader code snippet filename
  loadersnippet: "grunticon.loader.js",

  // Include loader code for SVG markup embedding
  enhanceSVG: true,

  // Make markup embedding work across domains (if CSS hosted externally)
  corsEmbed: false,

  // folder name (within dest) for png output
  pngfolder: "png",

  // prefix for CSS classnames
  cssprefix: ".icon-",

  defaultWidth: "100px",
  defaultHeight: "100px",

  // define vars that can be used in filenames if desirable,
  // like foo.colors-primary-secondary.svg
  colors: {
    main: "#999999",
    blue: "#3347af",
    light: "#CCCCCC"
  },

  dynamicColorOnly: true,

  // css file path prefix
  // this defaults to "/" and will be placed before the "dest" path
  // when stylesheets are loaded. It allows root-relative referencing
  // of the CSS. If you don't want a prefix path, set to to ""
  cssbasepath: "/gfx/icons",
  customselectors: {
    "fpx-main": [".fpx"],
    "fpx-blue": [".fpx:hover"],
    "behance-main": [".behance"],
    "behance-blue": [".behance:hover"],
    "drupal-main": [".drupal"],
    "drupal-blue": [".drupal:hover"],
    "facebook-main": [".facebook"],
    "facebook-blue": [".facebook:hover"],
    "github-main": [".github"],
    "github-blue": [".github:hover"],
    "linkedin-main": [".linkedin"],
    "linkedin-blue": [".linkedin:hover"],
    "twitter-main": [".twitter"],
    "twitter-blue": [".twitter:hover"],
    "rss-main": [".rss"],
    "rss-blue": [".rss:hover"],
  },

  compressPNG: true
};
