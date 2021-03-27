import express, { NextFunction, Request, Response } from 'express';

import { AddressInfo } from 'net';
import CFLog from 'cf-nodejs-logging-support';
import CentralSystemServerConfiguration from '../types/configuration/CentralSystemServer';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import { StatusCodes } from 'http-status-codes';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Utils from '../utils/Utils';
import bodyParser from 'body-parser';
import bodyParserXml from 'body-parser-xml';
import cluster from 'cluster';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import http from 'http';
import https from 'https';
import jwt from 'jsonwebtoken';
import locale from 'locale';
import morgan from 'morgan';

bodyParserXml(bodyParser);

export default class ExpressTools {
  public static initApplication(bodyLimit = '1mb', debug = false): express.Application {
    const app = express();
    // Secure the application
    app.use(helmet());
    // Cross origin headers
    app.use(cors());
    // Body parser
    app.use(bodyParser.json({
      limit: bodyLimit
    }));
    app.use(bodyParser.urlencoded({
      extended: false,
      limit: bodyLimit
    }));
    // Debug
    if (debug || Utils.isDevelopmentEnv()) {
      app.use(morgan((tokens, req: Request, res: Response) =>
        [
          tokens.method(req, res),
          tokens.url(req, res), '-',
          tokens.status(req, res), '-',
          tokens['response-time'](req, res) + 'ms', '-',
          tokens.res(req, res, 'content-length') / 1024 + 'Kb',
        ].join(' ')
      ));
    }
    app.use(hpp());
    app.use(bodyParser['xml']({
      limit: bodyLimit
    }));
    // Health Check Handling
    if (Configuration.getHealthCheckConfig().enabled) {
      app.get('/health-check', ExpressTools.healthCheckService.bind(this));
    }
    // Use
    app.use(locale(Constants.SUPPORTED_LOCALES));
    // Check Cloud Foundry
    if (Configuration.isCloudFoundry()) {
      // Bind to express app
      app.use(CFLog.logNetwork);
    }
    // Log Express Request
    app.use(this.logExpressRequest.bind(this));
    return app;
  }

  public static async logExpressRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Decode the Token
    const decodedToken = this.getDecodedTokenFromHttpRequest(req);
    // Get the Tenant
    const tenantID = await this.retrieveTenantFromHttpRequest(req, decodedToken);
    req['tenantID'] = tenantID;
    await Logging.logExpressRequest(tenantID, decodedToken, req, res, next);
  }

  public static postInitApplication(app: express.Application): void {
    // Log Express Response
    app.use(Logging.logExpressResponse.bind(this));
    // Error Handling
    app.use(Logging.logExpressError.bind(this));
  }

  public static createHttpServer(serverConfig: CentralSystemServerConfiguration, expressApp: express.Application): http.Server {
    let server: http.Server;
    // Create the HTTP server
    if (serverConfig.protocol === 'https') {
      // Create the options
      const options: https.ServerOptions = {};
      // Set the keys
      // FIXME: read certificates directly from config.json file. In the future: config for OICP in default tenant
      if (serverConfig.sslKey && serverConfig.sslCert) {
        options.key = serverConfig.sslKey;
        options.cert = serverConfig.sslCert;
      }
      // pragma options.requestCert = true; // TODO: Test on QA System: Reject incoming requests without valid certificate (OICP: accept only requests from Hubject)
      // options.rejectUnauthorized = true; // TODO: Test on QA System

      // Intermediate cert?
      if (serverConfig.sslCa) {
        // Array?
        if (Array.isArray(serverConfig.sslCa)) {
          options.ca = [];
          // Add all
          for (let i = 0; i < serverConfig.sslCa.length; i++) {
            // FIXME: read certificates directly from config.json file. In the future: config for OICP in default tenant
            if (serverConfig.sslCa[i]) {
              options.ca.push(serverConfig.sslCa[i]);
            }
          }
        } else {
          // Add one
          options.ca = serverConfig.sslCa;
        }
      }
      // Https server
      server = https.createServer(options, expressApp);
    } else {
      // Http server
      server = http.createServer(expressApp);
    }
    return server;
  }

  public static startServer(serverConfig: CentralSystemServerConfiguration, httpServer: http.Server, serverName: string, serverModuleName: string, listenCb?: () => void, listen = true): void {
    /**
     * Default listen callback
     */
    function defaultListenCb(): void {
      // Log
      const logMsg = `${serverName} Server listening on '${serverConfig.protocol}://${ExpressTools.getHttpServerAddress(httpServer)}:${ExpressTools.getHttpServerPort(httpServer)}' ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: serverModuleName, method: 'startServer',
        action: ServerAction.STARTUP,
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
    }
    let cb: () => void;
    if (listenCb && typeof listenCb === 'function') {
      cb = listenCb;
    } else {
      cb = defaultListenCb;
    }
    // Log
    // eslint-disable-next-line no-console
    console.log(`Starting ${serverName} Server ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}...`);

    // Listen
    if (serverConfig.host && serverConfig.port && listen) {
      httpServer.listen(serverConfig.port, serverConfig.host, cb);
    } else if (!serverConfig.host && serverConfig.port && listen) {
      httpServer.listen(serverConfig.port, cb);
    } else if (listen) {
      // eslint-disable-next-line no-console
      console.log(`Fail to start ${serverName} Server listening ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}, missing required port configuration`);
    }
  }

  public static healthCheckService(req: Request, res: Response, next: NextFunction): void {
    res.sendStatus(StatusCodes.OK);
  }

  private static getHttpServerPort(httpServer: http.Server): number {
    return (httpServer.address() as AddressInfo).port;
  }

  private static getHttpServerAddress(httpServer: http.Server): string {
    return (httpServer.address() as AddressInfo).address;
  }

  private static getDecodedTokenFromHttpRequest(req: Request): string | { [key: string]: any; } {
    // Retrieve Tenant ID from JWT token if available
    try {
      if (req.headers?.authorization.startsWith('Bearer')) {
        // Decode the token (REST)
        try {
          return jwt.decode(req.headers.authorization.slice(7));
        } catch (error) {
          // Try Base 64 decoding (OCPI)
          return JSON.parse(Buffer.from(req.headers.authorization.slice(7), 'base64').toString());
        }
      }
    } catch (error) {
      // Do nothing
    }
  }

  private static async retrieveTenantFromHttpRequest(req: Request, decodedToken: any): Promise<string> {
    // Try from Token
    if (decodedToken) {
      // REST
      if (Utils.objectHasProperty(decodedToken, 'tenantID')) {
        return decodedToken.tenantID;
      }
      // OCPI
      if (Utils.objectHasProperty(decodedToken, 'tid')) {
        const tenant = await TenantStorage.getTenantBySubdomain(decodedToken.tid);
        if (tenant) {
          return tenant.id;
        }
      }
    }
    // Try from body
    if (req.body?.tenant !== '') {
      const tenant = await TenantStorage.getTenantBySubdomain(req.body.tenant);
      if (tenant) {
        return tenant.id;
      }
    }
    // Try from host header
    if (req.headers?.host) {
      const hostParts = req.headers.host.split('.');
      if (hostParts.length > 1) {
        // Try with the first param
        const tenant = await TenantStorage.getTenantBySubdomain(hostParts[0]);
        if (tenant) {
          return tenant.id;
        }
      }
    }
    return Constants.DEFAULT_TENANT;
  }
}
