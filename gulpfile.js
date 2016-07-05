var gulp = require('gulp');

var rename = require("gulp-rename");

gulp.task('images-fullsize', function() {
  return gulp.src('source/Photography/**/*.jpg')
    .pipe(rename(function (path) {
      // Sometimes I use subdirectories within albums to denote days, squash em
      // @TODO: Technically this could lead to collisions, but it is unlikely because the
      // cameras both don't cycle until 9999 so only if 10,000 were taken in a day.
      path.dirname = path.dirname.split('/')[0];
    }))
    .pipe(gulp.dest('_site/photo/original/'));
});

gulp.task('default', function() {});
