var gulp = require('gulp');
var path = require('path');
var gutil = require('gulp-util');

var config = require('../config');

var files = config.test.src
  .concat(config.lib.src)
  .concat(config.ui.src)
  .concat(config.lib.specs)
  .concat(config.ui.specs);

gulp.task('test', ['test:ci']);

gulp.task('test:ci', ['lint'], function (done) {
  var karma = require('karma').server;
  karma.start({
    configFile: path.join(config.project.path, 'karma.conf.js'),
    singleRun: true,
    files: files
  }, done);
});

gulp.task('test:server', ['lint'], function() {
  var karma = require('karma').server;
  karma.start({
    configFile: path.join(config.project.path, 'karma.conf.js'),
    browsers: ['Chrome'],
    files: files,
    reporters: ['progress'],
    autoWatch: true,
    singleRun: false
  }, function(code) {
    gutil.log('Karma has exited with ' + code);
    process.exit(code);
  });
});
