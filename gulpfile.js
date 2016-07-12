var gulp = require('gulp');
var gutil = require('gulp-util');

var exif = require('exif-parser');
var fs = require('fs');
var imagemin = require('gulp-imagemin');
var imgsize = require('image-size');
var merge = require('deepmerge');
var recursiveReadSync = require('recursive-readdir-sync');
var resize = require('gulp-image-resize');
var rename = require("gulp-rename");
var sass = require('gulp-sass');
var yaml = require('js-yaml');

// Containers for image data processing which is kicked off by gulp
// but aren't actually gulp tasks. Adapted from http://stackoverflow.com/a/18934385
// We don't need a recursive function since we know the structure.
// Create object: {
//   'album name' : {
//     'title': (directory name without the date)
//     'date': (directory name without the name)
//     'contents': [
//       'image name': {
//         (@TODO: PhotoSwipe will need the width and height. I'd like to show the EXIF data and add titles)
//       }
//     ]
// }
var walkPhotos = function(path, index) {
  var directory = fs.readdirSync(path);

  // Directory is going to be an array of album directories
  for (var i=0; i < directory.length; i++) {
    // This is the directory name from Lightroom ("2015-12-31 New Years Eve" style)
    var album = directory[i];

    // This is the directory shortname Gulp is using for image output.
    var dirname = album.replace(/[a-z]/g, '').replace(/ /, '-').replace(/\s/g, '');

    // This will be the image contents and any subdirectories
    var photos = recursiveReadSync(path + '/' + album);
    var contains = {};

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

      contains[file] = {
        width: dimensions.width || null,
        height: dimensions.height || null,
        // The D7000 writes "NIKON CORPORATION / NIKON D7000" across these fields.
        // The X-E1 writes "FUJIFILM / XE-1". So we do this stupid thing to normalize
        // as "Make Model" which is what they should be in the first place...
        camera: [(exifResult.tags.Make.split(' ')[0] || null), (exifResult.tags.Model.split(' ').pop()) || null].join(' '),
        lens: exifResult.tags.LensModel || null,
        focal: exifResult.tags.FocalLength || null,
        aperture: exifResult.tags.FNumber || null,
        shutter: exifResult.tags.ExposureTime || null,
        iso: exifResult.tags.ISO || null,
        date: exifResult.tags.DateTimeOriginal || null,
      };
    }

    index[dirname] = {
      title: album.replace(/.+? /, ''),
      date: album.split(/ /, 1)[0],
      contents: contains
    };
  }
}

gulp.task('index', function() {
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

gulp.task('prime-posts', function() {
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
    var postContent = ['---', ('title: ' + index[album].title), '---', ''].join("\n");
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
    gutil.log("Created new Jekyll post file for " + album);
  }
});

gulp.task('photos', function() {
  return gulp.src('source/Photography/**/*.jpg')
    .pipe(rename(function (path) {
      // Sometimes I use subdirectories within albums to denote days, squash em
      // @TODO: Technically this could lead to collisions, but it is unlikely because the
      // cameras both don't cycle until 9999 so only if 10,000 were taken in a day.
      path.dirname = path.dirname.split('/')[0];

      // Now, for shorter and more URL friendly paths, drop spaces and lowercase letters
      // so "2016-03-21 Tulsa Weekend for Roadtrip Video with Fuji XE1" becomes
      // "2016-03-21-TWRVFXE1". Keeping capital letters and numbers helps with collisions.
      path.dirname = path.dirname.replace(/[a-z]/g, '').replace(/ /, '-').replace(/\s/g, '');
    }))
    .pipe(imagemin({progressive: true}))
    .pipe(gulp.dest('_site/photo/original/'))
    .pipe(resize({width: 600, height: 600, crop: false, upscale: false}))
    .pipe(gulp.dest('_site/photo/medium/'))
    .pipe(resize({width: 200, height: 200, crop: true, upscale: false}))
    .pipe(gulp.dest('_site/photo/thumb/'))
    // @TODO: Can we do that thing Rupl used to do with blurry 10px images for a pre-load?
});

gulp.task('sass', function () {
  return gulp.src('./_sass/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('./_site/css'));
});

gulp.task('js-photoswipe', function() {
  return gulp.src(['./node_modules/photoswipe/dist/*.js', '_js/photoswipe.tsp.js'])
    .pipe(gulp.dest('./_site/js'));
});

gulp.task('js-photoswipe-assets', function() {
  return gulp.src(['./node_modules/photoswipe/dist/default-skin/*.png', './node_modules/photoswipe/dist/default-skin/*.svg', './node_modules/photoswipe/dist/default-skin/*.gif'])
    .pipe(gulp.dest('./_site/css'));
});

gulp.task('js', ['js-photoswipe', 'js-photoswipe-assets']);

gulp.task('watch', function () {
  gulp.watch('./_sass/**/*.scss', ['sass']);
  gulp.watch(['./**/*.html','./**/*.yml', './**/*.markdown', '!./_site/**'], ['jekyll']);
  gulp.watch(['./**/*.js', '!./_site/**', '!./node_modules/**'], ['js']);
});

gulp.task('jekyll', function (cb){
 var spawn = require('child_process').spawn;
 var jekyll = spawn('jekyll', ['build'], {stdio: 'inherit'});
 jekyll.on('exit', function(code) {
   cb(code === 0 ? null : 'ERROR: Jekyll process exited with code: '+code);
 });
});

gulp.task('default', function() {});
