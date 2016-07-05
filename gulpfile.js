var gulp = require('gulp');

var imagemin = require('gulp-imagemin');
var resize = require('gulp-image-resize');
var rename = require("gulp-rename");

gulp.task('photos', function() {
  return gulp.src('source/Photography/**/*.jpg')
    .pipe(rename(function (path) {
      // Sometimes I use subdirectories within albums to denote days, squash em
      // @TODO: Technically this could lead to collisions, but it is unlikely because the
      // cameras both don't cycle until 9999 so only if 10,000 were taken in a day.
      path.dirname = path.dirname.split('/')[0];
    }))
    .pipe(imagemin({progressive: true}))
    .pipe(gulp.dest('_site/photo/original/'))
    .pipe(resize({width: 600, height: 600, crop: false, upscale: false}))
    .pipe(gulp.dest('_site/photo/medium/'))
    .pipe(resize({width: 200, height: 200, crop: true, upscale: false}))
    .pipe(gulp.dest('_site/photo/thumb/'))
    // @TODO: Can we do that thing Rupl used to do with blurry 10px images for a pre-load?
});

gulp.task('default', function() {});
