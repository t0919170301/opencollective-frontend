require('../env');

const http = require('http');
const path = require('path');

const next = require('next');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cloudflareIps = require('cloudflare-ip/ips.json');

const intl = require('./intl');
const logger = require('./logger');
const loggerMiddleware = require('./logger-middleware');
const routes = require('./routes');

const server = express();

server.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'].concat(cloudflareIps));

const env = process.env.NODE_ENV;
const dev = env === 'development';

const app = next({ dev, dir: path.dirname(__dirname) });

const port = process.env.PORT;

app.prepare().then(() => {
  server.use(loggerMiddleware.logger);

  server.use(helmet());

  server.use(cookieParser());

  server.use(intl.middleware());

  server.use(routes(server, app));
  server.use(loggerMiddleware.errorLogger);

  if (env === 'e2e' || process.env.E2E_TEST) {
    // eslint-disable-next-line node/no-unpublished-require
    require('@cypress/code-coverage/middleware/express')(server);
  }

  const httpServer = http.createServer(server);

  httpServer.on('error', err => {
    logger.error(`Can't start server on http://localhost:${port} in ${env} environment. %s`, err);
  });

  httpServer.listen(port, () => {
    logger.info(`Ready on http://localhost:${port} in ${env} environment`);
  });
});
