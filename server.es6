import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import compression from 'compression';
import config from 'config';
import morgan from 'morgan';
import basic from './routes/basic.es6';
import post from './routes/post.es6';
import facebook from './routes/facebook.es6';
import './core/controllers/chatbot.es6';
import './models/index.es6';
import {TraceError} from './libs/utils.es6';

global.TraceError = TraceError;

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(morgan('tiny'));
app.use(compression());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', basic);
app.use('/post', post);
app.use('/facebook', facebook);

app.listen(config.get('Port'), () => {
  console.log('Listening on ' + config.get('Port'));
});

process.on('uncaughtException', err => {
  console.log(err);
  process.exit(1);
});
