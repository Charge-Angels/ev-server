import { Action, Entity } from '../../types/Authorization';
import { Adapter, Room, SocketId } from 'socket.io-adapter';
import { Server, Socket } from 'socket.io';
import SingleChangeNotification, { NotificationData } from '../../types/SingleChangeNotification';
import express, { NextFunction, Request, Response } from 'express';

import AuthService from './v1/service/AuthService';
import CentralRestServerService from './CentralRestServerService';
import CentralSystemRestServiceConfiguration from '../../types/configuration/CentralSystemRestServiceConfiguration';
import ChangeNotification from '../../types/ChangeNotification';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import ExpressUtils from '../ExpressUtils';
import Logging from '../../utils/Logging';
import { default as RouterV1 } from './v1/router/GlobalRouter';
import { default as RouterV2 } from './v2/router/GlobalRouter';
import { ServerAction } from '../../types/Server';
import { ServerUtils } from '../ServerUtils';
import UserToken from '../../types/UserToken';
import Utils from '../../utils/Utils';
import cluster from 'cluster';
import http from 'http';
import jwtAuth from 'socketio-jwt-auth';
import sanitize from 'express-sanitizer';

const MODULE_NAME = 'CentralRestServer';

export default class CentralRestServer {
  private static centralSystemRestConfig: CentralSystemRestServiceConfiguration;
  private static restHttpServer: http.Server;
  private static socketIOServer: Server;
  private static changeNotifications: ChangeNotification[] = [];
  private static singleChangeNotifications: SingleChangeNotification[] = [];
  private expressApplication: express.Application;

  // Create the rest server
  constructor(centralSystemRestConfig: CentralSystemRestServiceConfiguration) {
    // Keep params
    CentralRestServer.centralSystemRestConfig = centralSystemRestConfig;
    // Initialize express app
    this.expressApplication = ExpressUtils.initApplication('2mb', centralSystemRestConfig.debug);
    // Mount express-sanitizer middleware
    this.expressApplication.use(sanitize());
    // Authentication
    this.expressApplication.use(AuthService.initialize());
    // Routers
    this.expressApplication.use('/v1', new RouterV1().buildRoutes());
    this.expressApplication.use('/v2', new RouterV2().buildRoutes());
    // Secured API
    this.expressApplication.all('/client/api/:action',
      AuthService.authenticate(),
      CentralRestServerService.restServiceSecured.bind(this));
    // Util API
    this.expressApplication.all('/client/util/:action', CentralRestServerService.restServiceUtil.bind(this));
    // Workaround URL encoding issue
    this.expressApplication.all('/client%2Futil%2FFirmwareDownload%3FFileName%3Dr7_update_3.3.0.12_d4.epk', async (req: Request, res: Response, next: NextFunction) => {
      req.url = decodeURIComponent(req.originalUrl);
      req.params.action = 'FirmwareDownload';
      req.query.FileName = 'r7_update_3.3.0.12_d4.epk';
      await CentralRestServerService.restServiceUtil(req, res, next);
    });
    // Post init
    ExpressUtils.postInitApplication(this.expressApplication);
    // Create HTTP server to serve the express app
    CentralRestServer.restHttpServer = ServerUtils.createHttpServer(CentralRestServer.centralSystemRestConfig, this.expressApplication);
  }

  async startSocketIO(): Promise<void> {
    // Log
    const logMsg = `Starting REST SocketIO Server ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}...`;
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: MODULE_NAME, method: 'startSocketIO',
      action: ServerAction.STARTUP,
      message: logMsg
    });
    // eslint-disable-next-line no-console
    console.log(logMsg);
    // Init Socket IO Server
    CentralRestServer.socketIOServer = new Server(CentralRestServer.restHttpServer, {
      cors: {
        origin: true,
        methods: ['GET', 'POST']
      }
    });
    CentralRestServer.socketIOServer.use(jwtAuth.authenticate({ secret: Configuration.getCentralSystemRestServiceConfig().userTokenKey }, (payload, done) => {
      if (payload) {
        return done(null, payload);
      }
      return done(null, false, 'SocketIO client is trying to connect without a token');
    }));
    // Handle Socket IO connection
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    CentralRestServer.socketIOServer.on('connect', async (socket: Socket): Promise<void> => {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'startSocketIO',
        action: ServerAction.SOCKET_IO,
        message: 'SocketIO client is trying to connect from ' + socket.handshake.headers['origin'],
        detailedMessages: { socketIOid: socket.id, socketIOHandshake: socket.handshake }
      });
      const userToken: UserToken = socket.request['user'];
      if (!userToken || !userToken['logged_in']) {
        CentralRestServer.centralSystemRestConfig.debug && console.error('SocketIO client is trying to connect without token from ' + socket.handshake.headers['origin']);
        await Logging.logWarning({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'startSocketIO',
          action: ServerAction.SOCKET_IO,
          message: 'SocketIO client is trying to connect without token from ' + socket.handshake.headers['origin'],
          detailedMessages: { socketIOid: socket.id, socketIOHandshake: socket.handshake }
        });
        socket.disconnect(true);
      } else {
        // Connection authenticated event to client
        socket.emit('authenticated', {
          message: 'SocketIO client is authenticated',
        });
        // Join Tenant Room
        try {
          await socket.join(userToken.tenantID);
          CentralRestServer.centralSystemRestConfig.debug && console.log(`${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO client is connected on room '${userToken.tenantID}'`);
          await Logging.logDebug({
            tenantID: userToken.tenantID,
            module: MODULE_NAME, method: 'startSocketIO',
            action: ServerAction.SOCKET_IO,
            user: userToken.id,
            message: `${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO client is connected on room '${userToken.tenantID}'`,
            detailedMessages: { socketIOid: socket.id, socketIOHandshake: socket.handshake }
          });
        } catch (error) {
          CentralRestServer.centralSystemRestConfig.debug && console.error(`${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO error when trying to join a room: ${error}`);
          await Logging.logError({
            tenantID: userToken.tenantID,
            module: MODULE_NAME, method: 'startSocketIO',
            action: ServerAction.SOCKET_IO,
            user: userToken.id,
            message: `${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO error when trying to join a room '${userToken.tenantID}': ${error}`,
            detailedMessages: { error, socketIOid: socket.id, socketIOHandshake: socket.handshake }
          });
          socket.disconnect(true);
        }
        // Handle Socket IO disconnection
        socket.on('disconnect', (reason: string) => {
          CentralRestServer.centralSystemRestConfig.debug && console.log(`${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO client is disconnected: ${reason}`);
          void Logging.logDebug({
            tenantID: userToken.tenantID,
            module: MODULE_NAME, method: 'startSocketIO',
            action: ServerAction.SOCKET_IO,
            user: userToken.id,
            message: `${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO client is disconnected: ${reason}`,
            detailedMessages: { socketIOid: socket.id, socketIOHandshake: socket.handshake }
          });
        });
      }
    });

    // Check and send notification change for single record
    setInterval(() => {
      // Send
      while (!Utils.isEmptyArray(CentralRestServer.singleChangeNotifications)) {
        const notification = CentralRestServer.singleChangeNotifications.shift();
        CentralRestServer.socketIOServer.to(notification.tenantID).emit(notification.entity, notification);
      }
    }, CentralRestServer.centralSystemRestConfig.socketIOSingleNotificationIntervalSecs * 1000);

    // Check and send notification change for list
    setInterval(() => {
      // Send
      while (!Utils.isEmptyArray(CentralRestServer.changeNotifications)) {
        const notification = CentralRestServer.changeNotifications.shift();
        CentralRestServer.socketIOServer.to(notification.tenantID).emit(notification.entity, notification);
      }
    }, CentralRestServer.centralSystemRestConfig.socketIOListNotificationIntervalSecs * 1000);
  }

  // Start the server
  start(): void {
    ServerUtils.startHttpServer(CentralRestServer.centralSystemRestConfig, CentralRestServer.restHttpServer, MODULE_NAME, 'REST');
  }

  public notifyUser(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.USER,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.USERS,
      'action': action
    });
  }

  public notifyTag(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TAG,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TAGS,
      'action': action
    });
  }

  public notifyTenant(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    // FIXME?: code that duplicate notification
    this.addSingleChangeNotificationInBuffer({
      'tenantID': data.id,
      'entity': Entity.TENANT,
      'action': action,
      'data': data
    });
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TENANT,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TENANTS,
      'action': action
    });
  }

  public notifySite(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.SITE,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.SITES,
      'action': action
    });
  }

  public notifySiteArea(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.SITE_AREA,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.SITE_AREAS,
      'action': action
    });
  }

  public notifyCompany(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.COMPANY,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.COMPANIES,
      'action': action
    });
  }

  public notifyAsset(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.ASSET,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.ASSETS,
      'action': action
    });
  }

  public notifyTransaction(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TRANSACTION,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TRANSACTIONS,
      'action': action
    });
  }

  public notifyChargingStation(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CHARGING_STATION,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CHARGING_STATIONS,
      'action': action
    });
  }

  public notifyLogging(tenantID: string, action: Action): void {
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.LOGGINGS,
      'action': action
    });
  }

  public notifyRegistrationToken(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.REGISTRATION_TOKEN,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.REGISTRATION_TOKENS,
      'action': action
    });
  }

  public notifyInvoice(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.INVOICE,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.INVOICES,
      'action': action
    });
  }

  public notifyCar(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CAR,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CARS,
      'action': action
    });
  }

  public notifyCarCatalog(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CAR_CATALOG,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CAR_CATALOGS,
      'action': action
    });
  }

  public notifyChargingProfile(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CHARGING_PROFILE,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CHARGING_PROFILES,
      'action': action
    });
  }

  public notifyOcpiEndpoint(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.OCPI_ENDPOINT,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.OCPI_ENDPOINTS,
      'action': action
    });
  }

  public notifyAsyncTaskEndpoint(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.ASYNC_TASK,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.ASYNC_TASKS,
      'action': action
    });
  }

  private addChangeNotificationInBuffer(notification: ChangeNotification) {
    let dups = false;
    if (this.hasSocketIOClients(notification.tenantID)) {
      // Handle dups in buffer
      for (const currentNotification of CentralRestServer.changeNotifications.slice().reverse()) {
        // Same notification
        if (JSON.stringify(currentNotification) === JSON.stringify(notification)) {
          dups = true;
          break;
        }
      }
      if (!dups) {
        // Add it
        CentralRestServer.changeNotifications.push(notification);
      }
    }
  }

  private addSingleChangeNotificationInBuffer(notification: SingleChangeNotification) {
    let dups = false;
    if (this.hasSocketIOClients(notification.tenantID)) {
      // Handle dups in buffer
      for (const currentNotification of CentralRestServer.singleChangeNotifications.slice().reverse()) {
        // Same notification
        if (JSON.stringify(currentNotification) === JSON.stringify(notification)) {
          dups = true;
          break;
        }
      }
      if (!dups) {
        // Add it
        CentralRestServer.singleChangeNotifications.push(notification);
      }
    }
  }

  private hasSocketIOClients(roomID: Room): boolean {
    const adapter: Adapter = CentralRestServer.socketIOServer.sockets.adapter;
    const rooms: Map<Room, Set<SocketId>> = adapter.rooms;
    if (rooms.has(roomID)) {
      return rooms.get(roomID).size > 0;
    }
    return false;
  }
}
