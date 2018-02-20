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

const gulp = require('gulp-help')(require('gulp'), {
  description: false,
  hideDepsMessage: true,
  hideEmpty: true
});
const gutil = require('gulp-util');

const autoprefixer = require('gulp-autoprefixer');
const awspublish = require('gulp-awspublish');
const cleanCSS = require('gulp-clean-css');
const concat = require('gulp-concat');
const eslint = require('gulp-eslint');
const exif = require('exif-parser');
const fs = require('fs');
const glob = require('glob');
const gulpicon = require('gulpicon/tasks/gulpicon');
const gulpiconConfig = require('./_icons/config.js');
const gulpiconFiles = glob.sync('./_icons/*.svg');
const imagemin = require('gulp-imagemin');
const imgsize = require('image-size');
const merge = require('deepmerge');
const mergeStream = require('merge-stream');
const recursiveReadSync = require('recursive-readdir-sync');
const resize = require('gulp-image-resize');
const rename = require('gulp-rename');
const runSequence = require('run-sequence');
const sass = require('gulp-sass');
const uglify = require('gulp-uglify');
const yaml = require('js-yaml');

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
const walkPhotos = (path, index) => {
  const directory = fs.readdirSync(path);

  // Directory is going to be an array of album directories
  for (var i = 0; i < directory.length; i++) {
    // This is the directory name from Lightroom ('2015-12-31 New Years Eve' style)
    const album = directory[i];

    // This is the directory shortname Gulp is using for image output.
    const dirname = album.replace(/[a-z]/g, '').replace(/ /, '-').replace(/\s/g, '');

    // This will be the image contents and any subdirectories
    const photos = recursiveReadSync(path + '/' + album);
    const contains = [];

    for (var j = 0; j < photos.length; j++) {
      // recursiveReadSync returns the path relative to the CWD, not just the name
      // like fs.readdirSync so this will be /source/Photography/.../whatever.img
      const photo = photos[j];

      // So split on / and take the last component for the filename.
      const file = photo.split('/').pop();

      // Original images are sometimes in subdirectories by day or activity, which
      // is why we recused the whole thing. Don't try to get stats on a directory,
      // just skip it.
      if (fs.statSync(photo).isDirectory()) { continue; }

      const dimensions = imgsize(photo);

      const photoBuffer = fs.readFileSync(photo);
      const exifParser = exif.create(photoBuffer);
      const exifResult = exifParser.parse();

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
        // EXIF shutter speed is written in decimal seconds, which isn't how that is
        // actually written. For times over 1 second, write as is with an "s" to signify
        // full seconds. Otherwise, turn it into a fraction 1/x which is what people
        // will be used to seeing. Yay math.
        shutter: (exifResult.tags.ExposureTime > 1 ? (exifResult.tags.ExposureTime + 's') : ('1/' + (1 / exifResult.tags.ExposureTime))) || null,
        iso: exifResult.tags.ISO || null,
        date: exifResult.tags.DateTimeOriginal || null
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
  for (var album in index) {
    if (!index.hasOwnProperty(album)) { continue; }
    index[album].contents = index[album].contents.sort((a, b) => {
      if (a.date < b.date) { return -1; }
      if (a.date > b.date) { return 1; }
      return 0;
    });
  }
};

gulp.task('index', 'Scan for new and deleted photos and albums, merge with the index', () => {
  let index = {};
  const generatedIndex = {};
  try {
    index = fs.readFileSync('source/index.yml', {encoding: 'utf8'});
    index = yaml.safeLoad(index);
  }
  catch (e) {
    if (e.code === 'ENOENT') {
      gutil.log('No original index found; will create one.');
    }
    else {
      throw e;
    }
  }
  walkPhotos('source/Photography', generatedIndex);
  const mergedIndex = merge(index, generatedIndex);

  fs.writeFileSync('source/index.yml', yaml.safeDump(mergedIndex));
});

gulp.task('photos', 'Rebuild all image derivatives: original, medium, thumb, mini. WARNING: ~30 minutes', () => {
  return gulp.src('source/Photography/**/*.jpg')
    .pipe(rename((path) => {
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
    .pipe(gulp.dest('_site/photo/thumb/'));
});

gulp.task('prime-posts', 'Create stub post files for any albums that don\'t have them already', () => {
  let index = {};
  try {
    index = fs.readFileSync('source/index.yml', {encoding: 'utf8'});
    index = yaml.safeLoad(index);
  }
  catch (e) {
    throw e;
  }

  for (var album in index) {
    if (!index.hasOwnProperty(album)) { continue; }

    const postFile = '_posts/' + album + '.markdown';
    const postContent = ['---', ('title: ' + index[album].title), 'location:', '---', ''].join('\n');
    try {
      fs.writeFileSync(postFile, postContent, {flag: 'wx'});
    }
    catch (e) {
      // This will fail EEXIST if the file already exists, which is fine so
      // "fail" silently in that case because it means I already wrote the
      // post. Throw any actual errors though.
      if (e.code !== 'EEXIST') {
        throw e;
      }
      else {
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

gulp.task('sass', 'Compile Sass to CSS', () => {
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

gulp.task('js-photoswipe', false, () => {
  return gulp.src(['./node_modules/photoswipe/dist/*.js', '_js/photoswipe.tsp.js'])
    .pipe(concat('photoswipe.all.js'))
    .pipe(uglify({mangle: false}))
    .pipe(gulp.dest('./_site/js'));
});

gulp.task('js-photoswipe-assets', false, () => {
  return gulp.src(['./node_modules/photoswipe/dist/default-skin/*.png', './node_modules/photoswipe/dist/default-skin/*.svg', './node_modules/photoswipe/dist/default-skin/*.gif'])
    .pipe(gulp.dest('./_site/css'));
});

gulp.task('js-all', false, () => {
  return gulp.src([
    './_js/lazyload.js',
    './node_modules/fg-loadcss/src/loadCSS.js',
    './node_modules/fg-loadcss/src/cssrelpreload.js'
  ])
    .pipe(concat('all.js'))
    .pipe(uglify({mangle: false}))
    .pipe(gulp.dest('./_site/js'));
});

gulp.task('lint', 'Lint all non-vendor JS', () => {
  return gulp.src(['gulpfile.js', '_js/**/*.js', '!node_modules/**'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('js', 'JS/Photoswipe aggregation/minify, custom JS linting', ['js-photoswipe', 'js-photoswipe-assets', 'js-all', 'lint']);

gulp.task('icons', false, gulpicon(gulpiconFiles, gulpiconConfig));

gulp.task('favicons', 'Copy favicons into position', () => {
  return gulp.src(['./_favicon/*.*'])
  .pipe(gulp.dest('./_site/'));
});

gulp.task('graphics', 'Compress site graphics and aggregate icons', ['icons', 'favicons'], () => {
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

gulp.task('jekyll', 'Run jekyll build', (cb) => {
  const spawn = require('child_process').spawn;
  const jekyll = spawn('jekyll', ['build'], {stdio: 'inherit'});
  jekyll.on('exit', (code) => {
    cb(code === 0 ? null : 'ERROR: Jekyll process exited with code: ' + code);
  });
});

gulp.task('htaccess', 'Update/install .htaccess files', () => {
  const root = gulp.src('./_htaccess/root').pipe(rename('.htaccess')).pipe(gulp.dest('./_site/'));
  const photo = gulp.src('./_htaccess/photo').pipe(rename('.htaccess')).pipe(gulp.dest('./_site/photo/'));

  return mergeStream(root, photo);
});


gulp.task('update', 'Add/remove photos and albums: index, photos, prime-posts, and jekyll. WARNING: ~30 minutes.', (cb) => {
  runSequence(['index', 'photos'], 'prime-posts', 'jekyll', cb);
});

gulp.task('build', 'Run all site-generating tasks: sass, js, graphics, icons, htaccess then jekyll', (cb) => {
  runSequence(['sass', 'js', 'graphics', 'icons', 'htaccess'], 'jekyll', cb);
});

gulp.task('publish-s3', 'Sync the site to S3', (cb) => {
  // create a new publisher using S3 options
  // http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property
  var publisher = awspublish.create({
    region: 'us-west-1',
    params: {
      Bucket: 'tsmithphotos'
    }
  });

  // define custom headers
  var headers = {
    'Cache-Control': 'max-age=2592000, no-transform, public'
  };

  // @TODO: Uhhh, I wrote a lot of htaccess files for this that aren't needed
  // on S3. I could drop that stuff.
  return gulp.src(['./_site/**/*.*', '!./_site/**/.htaccess'])
    // publisher will add Content-Length, Content-Type and headers specified above
    // If not specified it will set x-amz-acl to public-read by default
    .pipe(publisher.publish(headers))

    .pipe(publisher.sync())

    // create a cache file to speed up consecutive uploads
    .pipe(publisher.cache())

     // print upload updates to console
    .pipe(awspublish.reporter());
});

gulp.task('publish', 'Build the site and publish to S3', (cb) => {
  runSequence('update', 'build', 'publish-s3', cb);
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

gulp.task('watch', 'Watch-run sass, jekyll, js, graphics, and icons tasks', () => {
  gulp.watch('./_sass/**/*.scss', ['sass']);
  gulp.watch(['./*.*', './**/*.html', './**/*.yml', './**/*.markdown', './**/.*.md', '!./_site/**'], ['jekyll']);
  gulp.watch(['./**/*.js', '!./_site/**', '!./node_modules/**'], ['js']);
  gulp.watch(['./_gfx/**/*.*'], ['graphics']);
  gulp.watch(['./_icons/**/*.*'], ['icons']);
});
