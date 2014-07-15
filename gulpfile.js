var gulp = require('gulp'),
    mocha = require('gulp-mocha'),
    jshint = require('gulp-jshint');

/*****
 * JSHint task, lints the lib and test *.js files.
 *****/
gulp.task('jshint', function () {
    return gulp.src(['./lib/**/*.js', './test/**/*.js'])
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

/*****
 * Test task, runs mocha against unit test files.
 *****/
gulp.task('test', function () {
    return gulp.src('./test/unit/**/*.test.js', { read: false })
            .pipe(mocha({
                ui: 'bdd',
                reporter: 'spec'
            }));
});

/*****
 * Default task, runs jshint and test tasks.
 *****/
gulp.task('default', ['jshint', 'test']);

/*****
 * CI test task, runs jshint and test tasks.
 *****/
gulp.task('testci', ['jshint', 'test']);
