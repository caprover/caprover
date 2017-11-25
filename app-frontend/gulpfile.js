var gulp = require('gulp'),
    usemin = require('gulp-usemin'),
    wrap = require('gulp-wrap'),
    connect = require('gulp-connect'),
    watch = require('gulp-watch'),
    minifyCss = require('gulp-cssnano'),
    minifyJs = require('gulp-uglify'),
    concat = require('gulp-concat'),
    less = require('gulp-less'),
    rename = require('gulp-rename'),
    minifyHTML = require('gulp-htmlmin');


DIST_DIRECTORY = '../app-backend/dist'

var paths = {
    scripts: 'src/js/**/*.*',
    styles: 'src/less/**/*.*',
    images: 'src/img/**/*.*',
    templates: 'src/templates/**/*.html',
    oneclickapps: 'src/oneclick-apps/*.js',
    index: 'src/index.html',
    bower_fonts: 'src/components/**/*.{ttf,woff,woff2,eof,svg}',
    custom_fonts: 'src/fonts/**/*.{ttf,woff,woff2,eof,svg}'
};

/**
 * Handle bower components from index
 */
gulp.task('usemin', function() {
    return gulp.src(paths.index)
        .pipe(usemin({
            js: [minifyJs(), 'concat'],
            css: [minifyCss({keepSpecialComments: 0}), 'concat'],
        }))
        .pipe(gulp.dest(DIST_DIRECTORY+'/'));
});

/**
 * Copy assets
 */
gulp.task('build-assets', ['copy-bower_fonts','copy-custom_fonts']);

gulp.task('copy-bower_fonts', function() {
    return gulp.src(paths.bower_fonts)
        .pipe(rename({
            dirname: '/fonts'
        }))
        .pipe(gulp.dest(DIST_DIRECTORY+'/lib'));
});

gulp.task('copy-custom_fonts', function() {
    return gulp.src(paths.custom_fonts)
        .pipe(rename({
            dirname: '/fonts'
        }))
        .pipe(gulp.dest(DIST_DIRECTORY+''));
});

/**
 * Handle custom files
 */
gulp.task('build-custom', ['custom-images', 'custom-js', 'custom-less', 'custom-templates', 'custom-oneclick-apps']);

gulp.task('custom-images', function() {
    return gulp.src(paths.images)
        .pipe(gulp.dest(DIST_DIRECTORY+'/img'));
});

gulp.task('custom-js', function() {
    return gulp.src(paths.scripts)
	//.pipe(minifyJs())
        .pipe(concat('dashboard.min.js'))
        .pipe(gulp.dest(DIST_DIRECTORY+'/js'));
});

gulp.task('custom-less', function() {
    return gulp.src(paths.styles)
        .pipe(less())
        .pipe(concat('rdash-custom.css'))
        .pipe(gulp.dest(DIST_DIRECTORY+'/css'));
});

gulp.task('custom-templates', function() {
    return gulp.src(paths.templates)
        .pipe(minifyHTML())
        .pipe(gulp.dest(DIST_DIRECTORY+'/templates'));
});

gulp.task('custom-oneclick-apps', function() {
    return gulp.src(paths.oneclickapps)
        .pipe(gulp.dest(DIST_DIRECTORY+'/oneclick-apps'));

});

/**
 * Watch custom files
 */
gulp.task('watch', function() {
    gulp.watch([paths.images], ['custom-images']);
    gulp.watch([paths.styles], ['custom-less']);
    gulp.watch([paths.scripts], ['custom-js']);
    gulp.watch([paths.templates], ['custom-templates']);
    gulp.watch([paths.oneclickapps], ['custom-oneclick-apps']);
    gulp.watch([paths.index], ['usemin']);
});

/**
 * Live reload server
 */
gulp.task('webserver', function() {
    connect.server({
        root: DIST_DIRECTORY+'',
        livereload: true,
        port: 8888
    });
});

gulp.task('livereload', function() {
    gulp.src([DIST_DIRECTORY+'/**/*.*'])
        .pipe(watch([DIST_DIRECTORY+'/**/*.*']))
        .pipe(connect.reload());
});

/**
 * Gulp tasks
 */
gulp.task('build', ['usemin', 'build-assets', 'build-custom']);
gulp.task('default', ['build', 'webserver', 'livereload', 'watch']);
