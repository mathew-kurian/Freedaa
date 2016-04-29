/* eslint strict: 0 */

'use strict';

const mozjpeg = require('imagemin-mozjpeg');
const autoprefixer = require('autoprefixer');
const config = require('config');

module.exports = grunt => {
  require('load-grunt-tasks')(grunt);
  require('./tasks/grunt-filetransform')(grunt);

  const gruntConfig = {
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
          style: 'compressed',
          sourcemap: 'none'
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
    imagemin: {
      dist: {
        options: {
          optimizationLevel: 4,
          svgoPlugins: [{removeViewBox: false}],
          use: [mozjpeg()]
        },
        files: [{
          expand: true,
          cwd: 'resources/images',
          src: ['**/*.{png,jpg,gif}'],
          dest: 'public/images'
        }]
      }
    },
    pug: {
      dist: {
        options: {
          data: {config: JSON.stringify(config.get('Client'))},
          optimizationLevel: 3
        },
        files: [{
          expand: true,
          cwd: 'views/',
          src: ['**/*.pug'],
          dest: 'public/',
          ext: '.html'
        }]
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
      build: ['public/', './package.noDevDeps.json'],
      compiled: ['./**/*.compiled.js', './**/*.compiled.js.map']
    },
    filetransform: {
      babel: {
        options: {
          transformer: require('./tasks/babel-cli'),
          extSrc: '.es6',
          extDest: '.compiled.js',
          env: 'server'
        },
        files: [{
          expand: true,
          src: ['**/*.es6', '!**/node_modules/**'],
          ext: '.compiled.js'
        }]
      }
    },
    concurrent: {
      clean: ['clean:build', 'clean:compiled'],
      build: ['imagemin', 'browserify:dist', 'filetransform:babel', ['sass:dist', 'postcss:dist'], 'pug:dist'],
      'build-production': ['imagemin', ['browserify:dist'], 'compile',
        ['sass:dist', 'postcss:dist'], 'pug:dist']
    }
  };

  grunt.initConfig(gruntConfig);

  grunt.registerTask('compile', [
    'clean:compiled',
    'filetransform:babel'
  ]);

  grunt.registerTask('styles', [
    'sass:dist',
    'postcss:dist'
  ]);

  grunt.registerTask('build', [
    'concurrent:clean',
    'copy:dist',
    'concurrent:build'
  ]);

  grunt.registerTask('production', [
    'copy:dist',
    'concurrent:build-production'
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
