import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import https from 'https';
import http from 'http';
import config from 'config';
import compression from 'compression';
import {Router, Middleware} from 'scribe-js';
import * as fs from 'fs';

const app = express();
const ssl = {
  key: fs.readFileSync(config.get('Server.sslKey')),
  cert: fs.readFileSync(config.get('Server.sslCert')),
  ca: fs.readFileSync(config.get('Server.sslCa')),
  rejectUnauthorized: config.get('Server.httpsRejectUnauthorized')
};

const server = config.get('Server.protocol') === 'https' ? https.createServer(ssl, app) : http.createServer(app);

app.set('views', path.join(__dirname, 'views'));  // points app to location of the views
app.set('view engine', 'jade');                   // sets the view engine to jade

// console access
app.use(new Middleware.ExpressRequestLogger(console).getMiddleware());
app.use('/scribe', new Router.Viewer(console).getRouter());

// compress gzip
app.use(compression());

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'))); // points app to public directory for static files

export default server;
