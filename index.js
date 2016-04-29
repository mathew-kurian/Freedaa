#!/usr/bin/env node

process.env.BABEL_ENV = 'server';

require('babel-register');

require('./server.es6');
