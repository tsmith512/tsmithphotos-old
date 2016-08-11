/**
 * @file gulpfile.js
 *
 * Build tasks and generator tools for www.tsmithphotos.com
 * By Taylor Smith @tsmith512 - www.tsmithcreative.com 2016.
 *
 * Run `gulp help` to for a list of suggested tasks.
 */

/* eslint strict: ["error", "global"] */
/* global require */
'use strict';

/*
     _
  __| | ___ _ __  ___
 / _` |/ _ \ '_ \/ __|
| (_| |  __/ |_) \__ \
 \__,_|\___| .__/|___/
           |_|
*/

var gulp = require('gulp-help')(require('gulp'), {
  description: false,
  hideDepsMessage: true,
  hideEmpty: true
});
var gutil = require('gulp-util');

var autoprefixer = require('gulp-autoprefixer');
var cleanCSS = require('gulp-clean-css');
var concat = require('gulp-concat');
var eslint = require('gulp-eslint');
var exif = require('exif-parser');
var fs = require('fs');
var glob = require('glob');
var gulpicon = require('gulpicon/tasks/gulpicon');
var gulpiconConfig = require('./_icons/config.js');
var gulpiconFiles = glob.sync('./_icons/*.svg');
var imagemin = require('gulp-imagemin');
var imageminMozjpeg = require('imagemin-mozjpeg');
var imgsize = require('image-size');
var merge = require('deepmerge');
var mergeStream = require('merge-stream');
var recursiveReadSync = require('recursive-readdir-sync');
var resize = require('gulp-image-resize');
var rename = require('gulp-rename');
var runSequence = require('run-sequence');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');
var yaml = require('js-yaml');

/*
       _           _
 _ __ | |__   ___ | |_ ___  ___
| '_ \| '_ \ / _ \| __/ _ \/ __|
| |_) | | | | (_) | || (_) \__ \
| .__/|_| |_|\___/ \__\___/|___/
|_|
*/

// Containers for image data processing which is kicked off by gulp
// but aren't actually gulp tasks. Adapted from http://stackoverflow.com/a/18934385
// We don't need a recursive function since we know the structure.
// Create object: {
//   'album name' : {
//     'title': (directory name without the date)
//     'date': (directory name without the name)
//     'contents': [ (an array of photo objects, to be sorted by date)
//       {
//         properties pulled from EXIF data and image size
//       }
//     ]
// }
var walkPhotos = function(path, index) {
  var directory = fs.readdirSync(path);

  // Directory is going to be an array of album directories
  for (var i=0; i < directory.length; i++) {
    // This is the directory name from Lightroom ('2015-12-31 New Years Eve' style)
    var album = directory[i];

    // This is the directory shortname Gulp is using for image output.
    var dirname = album.replace(/[a-z]/g, '').replace(/ /, '-').replace(/\s/g, '');

    // This will be the image contents and any subdirectories
    var photos = recursiveReadSync(path + '/' + album);
    var contains = [];

    for (var j=0; j < photos.length; j++) {
      // recursiveReadSync returns the path relative to the CWD, not just the name
      // like fs.readdirSync so this will be /source/Photography/.../whatever.img
      var photo = photos[j];

      // So split on / and take the last component for the filename.
      var file = photo.split('/').pop();

      // Original images are sometimes in subdirectories by day or activity, which
      // is why we recused the whole thing. Don't try to get stats on a directory,
      // just skip it.
      if (fs.statSync(photo).isDirectory()) { continue; }

      var dimensions = imgsize(photo);

      var photoBuffer = fs.readFileSync(photo);
      var exifParser = exif.create(photoBuffer);
      var exifResult = exifParser.parse();

      contains.push({
        filename: file,
        width: dimensions.width || null,
        height: dimensions.height || null,
        // The D7000 writes 'NIKON CORPORATION / NIKON D7000' across these fields.
        // The X-E1 writes 'FUJIFILM / XE-1'. So we do this stupid thing to normalize
        // as 'Make Model' which is what they should be in the first place...
        camera: [(exifResult.tags.Make.split(' ')[0] || null), (exifResult.tags.Model.split(' ').pop()) || null].join(' '),
        lens: exifResult.tags.LensModel || null,
        focal: exifResult.tags.FocalLength || null,
        aperture: exifResult.tags.FNumber || null,
        shutter: (exifResult.tags.ExposureTime > 1 ? (exifResult.tags.ExposureTime + 's') : ('1/' + (1/exifResult.tags.ExposureTime))) || null,
        iso: exifResult.tags.ISO || null,
        date: exifResult.tags.DateTimeOriginal || null,
      });
    }

    index[dirname] = {
      title: album.replace(/.+? /, ''),
      date: album.split(/ /, 1)[0],
      contents: contains
    };
  }

  // Now sort all photos in each album by the date of the exposure instead
  // of the name. We do this here because:
  // - The existing index file (which has custom data) is already sorted
  // - Sorted albums are arrays, not objects. So if the order here doesn't
  //   match what's in the generated file, custom attributes will be applied
  //   to the wrong image when merging (because arrays are indexed, not keyed).
  //   ^^ @TODO: That'll fix most of the issue, but inserting/deleting within
  //      an existing album will still cause attributes to shift. :(
  for (album in index) {
    if( ! index.hasOwnProperty(album) ) { continue; }
    index[album].contents = index[album].contents.sort(function(a,b) {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return  1;
      return 0;
    });
  }
}

gulp.task('index', 'Scan for new and deleted photos and albums, merge with the index', function() {
  var index = {};
  var generatedIndex = {};
  try {
    index = fs.readFileSync('source/index.yml', {encoding: 'utf8'});
    index = yaml.safeLoad(index);
  } catch (e) {
    if (e.code === 'ENOENT') {
      gutil.log('No original index found; will create one.');
    } else {
      throw e;
    }
  }
  walkPhotos('source/Photography', generatedIndex);
  var mergedIndex = merge(index, generatedIndex);

  fs.writeFileSync('source/index.yml', yaml.safeDump(mergedIndex));
});

gulp.task('photos', 'Rebuild all image derivatives: original, medium, thumb, mini. WARNING: ~30 minutes', function() {
  return gulp.src('source/Photography/**/*.jpg')
    .pipe(rename(function (path) {
      // Sometimes I use subdirectories within albums to denote days, squash em
      // @TODO: Technically this could lead to collisions, but it is unlikely because the
      // cameras both don't cycle until 9999 so only if 10,000 were taken in a day.
      path.dirname = path.dirname.split('/')[0];

      // Now, for shorter and more URL friendly paths, drop spaces and lowercase letters
      // so '2016-03-21 Tulsa Weekend for Roadtrip Video with Fuji XE1' becomes
      // '2016-03-21-TWRVFXE1'. Keeping capital letters and numbers helps with collisions.
      path.dirname = path.dirname.replace(/[a-z]/g, '').replace(/ /, '-').replace(/\s/g, '');
    }))
    .pipe(imagemin([imagemin.jpegtran({progressive: true})]))
    .pipe(gulp.dest('_site/photo/original/'))
    .pipe(resize({width: 600, height: 600, crop: false, upscale: false}))
    .pipe(imagemin([imagemin.jpegtran({progressive: true})]))
    .pipe(gulp.dest('_site/photo/medium/'))
    .pipe(resize({width: 200, height: 200, crop: true, upscale: false}))
    .pipe(imagemin([imagemin.jpegtran({progressive: true})]))
    .pipe(gulp.dest('_site/photo/thumb/'))
    .pipe(resize({width: 100, height: 100, crop: true, upscale: false}))
    .pipe(imagemin([imagemin.jpegtran({progressive: true})]))
    .pipe(gulp.dest('_site/photo/mini/'))
    // @TODO: Can we do that thing Rupl used to do with blurry 10px images for a pre-load?
});

gulp.task('prime-posts', 'Create stub post files for any albums that don\'t have them already', function() {
  var index = {};
  try {
    index = fs.readFileSync('source/index.yml', {encoding: 'utf8'});
    index = yaml.safeLoad(index);
  } catch (e) {
    throw e;
  }

  for (var album in index) {
    if (!index.hasOwnProperty(album)) continue;

    var postFile = '_posts/' + album + '.markdown';
    var postContent = ['---', ('title: ' + index[album].title), 'location:', '---', ''].join('\n');
    try {
      fs.writeFileSync(postFile, postContent, { flag: 'wx' });
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw err;
      } else {
        continue;
      }
    }

    // We created a post (if it already existed, the `continue` would have fired)
    gutil.log('Created new Jekyll post file for ' + album);
  }
});

/*
                    _
  __ _ ___ ___  ___| |_ ___
 / _` / __/ __|/ _ \ __/ __|
| (_| \__ \__ \  __/ |_\__ \
 \__,_|___/___/\___|\__|___/

*/

gulp.task('sass', 'Compile Sass to CSS', function () {
  return gulp.src('./_sass/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({
      browsers: ['last 2 versions'],
      cascade: false
    }))
    // Run CleanCSS, but mostly just for minification. Starting light here.
    .pipe(cleanCSS({
      advanced: false,
      mediaMerging: false,
      rebase: false,
      restructuring: false,
      shorthandCompacting: false
    }))
    .pipe(gulp.dest('./_site/css'));
});

gulp.task('js-photoswipe', false, function() {
  return gulp.src(['./node_modules/photoswipe/dist/*.js', '_js/photoswipe.tsp.js'])
    .pipe(concat('photoswipe.all.js'))
    .pipe(uglify({mangle: false}))
    .pipe(gulp.dest('./_site/js'));
});

gulp.task('js-photoswipe-assets', false, function() {
  return gulp.src(['./node_modules/photoswipe/dist/default-skin/*.png', './node_modules/photoswipe/dist/default-skin/*.svg', './node_modules/photoswipe/dist/default-skin/*.gif'])
    .pipe(gulp.dest('./_site/css'));
});

gulp.task('js-all', false, function() {
  return gulp.src([
      './_js/lazyload.js',
      './node_modules/fg-loadcss/src/loadCSS.js',
      './node_modules/fg-loadcss/src/cssrelpreload.js'
    ])
    .pipe(concat('all.js'))
    .pipe(uglify({mangle: false}))
    .pipe(gulp.dest('./_site/js'));
});

gulp.task('lint', 'Lint all non-vendor JS', function() {
  return gulp.src(['gulpfile.js', '_js/**/*.js','!node_modules/**'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('js', 'JS/Photoswipe aggregation/minify, custom JS linting', ['js-photoswipe', 'js-photoswipe-assets', 'js-all', 'lint']);

gulp.task('icons', false, gulpicon(gulpiconFiles, gulpiconConfig));

gulp.task('graphics', 'Compress site graphics and aggregate icons', ['icons'], function() {
  return gulp.src('./_gfx/**/*.*')
    .pipe(imagemin())
    .pipe(gulp.dest('./_site/gfx/'));
});

/*
     _ _         _           _ _     _
 ___(_) |_ ___  | |__  _   _(_) | __| |
/ __| | __/ _ \ | '_ \| | | | | |/ _` |
\__ \ | ||  __/ | |_) | |_| | | | (_| |
|___/_|\__\___| |_.__/ \__,_|_|_|\__,_|

*/

gulp.task('jekyll', 'Run jekyll build', function (cb){
 var spawn = require('child_process').spawn;
 var jekyll = spawn('jekyll', ['build'], {stdio: 'inherit'});
 jekyll.on('exit', function(code) {
   cb(code === 0 ? null : 'ERROR: Jekyll process exited with code: '+code);
 });
});

gulp.task('htaccess', 'Update/install .htaccess files', function() {
  var root  = gulp.src('./_htaccess/root').pipe(rename('.htaccess')).pipe(gulp.dest('./_site/'));
  var photo = gulp.src('./_htaccess/photo').pipe(rename('.htaccess')).pipe(gulp.dest('./_site/photo/'));

  return mergeStream(root, photo);
});


gulp.task('update', 'Add/remove photos and albums: index, photos, prime-posts, and jekyll. WARNING: ~30 minutes.', function(cb) {
  runSequence(['index', 'photos'], 'prime-posts', 'jekyll', cb);
});

gulp.task('build', 'Run all site-generating tasks: sass, js, graphics, icons, htaccess then jekyll', function(cb) {
  runSequence(['sass', 'js', 'graphics', 'icons', 'htaccess'], 'jekyll', cb);
});

/*
             _             _          __  __
  __ _ _   _| |_ __    ___| |_ _   _ / _|/ _|
 / _` | | | | | '_ \  / __| __| | | | |_| |_
| (_| | |_| | | |_) | \__ \ |_| |_| |  _|  _|
 \__, |\__,_|_| .__/  |___/\__|\__,_|_| |_|
 |___/        |_|
*/

gulp.task('default', false, ['help']);

gulp.task('watch', 'Watch-run sass, jekyll, js, graphics, and icons tasks', function () {
  gulp.watch('./_sass/**/*.scss', ['sass']);
  gulp.watch(['./**/*.html','./**/*.yml', './**/*.markdown', './**/.*.md', '!./_site/**'], ['jekyll']);
  gulp.watch(['./**/*.js', '!./_site/**', '!./node_modules/**'], ['js']);
  gulp.watch(['./_gfx/**/*.*'], ['graphics']);
  gulp.watch(['./_icons/**/*.*'], ['icons']);
});
