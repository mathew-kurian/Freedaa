import config from 'config';
import mongoose from 'mongoose';
import Promise from 'bluebird';

mongoose.Promise = Promise;
mongoose.connect(config.get('MongoDB'));

import './post.es6';
import './user.es6';
