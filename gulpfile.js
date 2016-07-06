var gulp = require('gulp');

var fs = require('fs');
var imagemin = require('gulp-imagemin');
var resize = require('gulp-image-resize');
var rename = require("gulp-rename");

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

    // This will be the image contents
    var photos = fs.readdirSync(path + '/' + album);
    var contains = {};

    for (var j=0; j < photos.length; j++) {
      var photo = photos[j];
      contains[photo] = {
        filename: photo,
        width: 0,
        height: 0,
      };
    }

    index[dirname] = {
      title: album.replace(/.+? /, ''),
      date: album.split(/ /, 1)[0],
      contents: contains,
    };
  }
}

gulp.task('index', function() {
  var index = {};
  walkPhotos('source/Photography', index);
  console.log(index);
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

gulp.task('jekyll', function (cb){
 var spawn = require('child_process').spawn;
 var jekyll = spawn('jekyll', ['build'], {stdio: 'inherit'});
 jekyll.on('exit', function(code) {
   cb(code === 0 ? null : 'ERROR: Jekyll process exited with code: '+code);
 });
});

gulp.task('default', function() {});
