/* eslint strict: 0, global-require: 0 */

'use strict';

const autoprefixer = require('autoprefixer');

module.exports = grunt => {
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    uglify: {
      options: {
        banner: '/*! Grunt Uglify <%= grunt.template.today(\'yyyy-mm-dd\') %> */ ',
        compress: {
          drop_console: false
        },
        mangle: {keep_fnames: true, keep_fargs: true}
      },
      dist: {
        files: [{
          expand: true,
          cwd: 'public/scripts',
          src: ['**/*.js'],
          dest: 'public/scripts',
          ext: '.min.js'
        }]
      }
    },
    sass: {
      dev: {
        options: {
          style: 'expanded'
        },
        files: [{
          expand: true,
          cwd: 'resources/styles',
          src: ['*.scss'],
          dest: 'public/styles',
          ext: '.min.css'
        }]
      },
      dist: {
        options: {
          style: 'compressed'
        },
        files: [{
          expand: true,
          cwd: 'resources/styles',
          src: ['*.scss'],
          dest: 'public/styles',
          ext: '.min.css'
        }]
      }
    },
    browserify: {
      dist: {
        options: {
          transform: [['babelify', {env: 'client'}]],
          browserifyOptions: {
            debug: false, // source mapping
            ignoreMTime: true
          }
        },
        files: [{
          expand: true,
          cwd: 'asr/',
          src: ['**/Bootstrap.js', 'Bootstrap.js', '**/Bootstrap.js', 'Bootstrap.js'],
          dest: 'public/scripts',
          ext: '.min.js'
        }]
      },
      dev: {
        options: {
          watch: true,
          keepAlive: true,
          transform: [['babelify', {env: 'client'}]],
          browserifyOptions: {
            debug: true, // source mapping
            ignoreMTime: true
          }
        },
        files: [{
          expand: true,
          cwd: 'asr/',
          src: ['**/Bootstrap.js', 'Bootstrap.js', '**/Bootstrap.js', 'Bootstrap.js'],
          dest: 'public/scripts',
          ext: '.min.js' // NOTE mimic uglifyjs has been run
        }]
      }
    },
    postcss: {
      options: {
        map: false,
        processors: [
          autoprefixer({browsers: ['> 1%']})
        ]
      },
      dist: {
        src: 'public/styles/*.css'
      }
    },
    copy: {
      dist: {
        files: [
          {expand: true, cwd: 'resources/root', src: ['**/*'], dest: 'public/'},
          {expand: true, cwd: 'resources/fonts', src: ['**/*'], dest: 'public/fonts'},
          {expand: true, cwd: 'resources/images', src: ['**/*'], dest: 'public/images'},
          {expand: true, cwd: 'resources/audio', src: ['**/*'], dest: 'public/audio'},
          {expand: true, cwd: 'resources/videos', src: ['**/*'], dest: 'public/videos'},
          {expand: true, cwd: 'resources/scripts', src: ['**/*'], dest: 'public/scripts'}
        ]
      }
    },
    watch: {
      sass: {
        files: ['resources/styles/*.scss', 'resources/styles/**/*.scss'],
        tasks: ['sass:dev'],
        options: {
          spawn: false
        }
      }
    },
    clean: {
      build: ['public/']
    }
  });

  grunt.registerTask('styles', [
    'sass:dist',
    'postcss:dist'
  ]);

  grunt.registerTask('build', [
    'clean:build',
    'copy:dist',
    'browserify:dist',
    'sass:dist',
    'postcss:dist'
  ]);

  grunt.registerTask('default', 'build');

  grunt.registerTask('watch-scripts', [
    'browserify:dev'
  ]);

  grunt.registerTask('watch-styles', [
    'sass:dev',
    'watch:sass'
  ]);
};
