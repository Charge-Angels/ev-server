import * as http from 'http';
import { Action } from '../../../types/Authorization';
import uuid from 'uuid/v4';
import WebSocket, { OPEN } from 'ws';
import BackendError from '../../../exception/BackendError';
import OCPPError from '../../../exception/OcppError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import JsonCentralSystemServer from './JsonCentralSystemServer';

const MODULE_NAME = 'WSConnection';
export default class WSConnection {
  public code: string;
  public message: string;
  public details: string;
  protected initialized: boolean;
  protected wsServer: JsonCentralSystemServer;
  private readonly url: string;
  private readonly ip: string;
  private readonly wsConnection: WebSocket;
  private req: http.IncomingMessage;
  private _requests: any = {};
  private tenantIsValid: boolean;
  private readonly chargingStationID: string;
  private readonly tenantID: string;
  private readonly token: string;

  constructor(wsConnection: WebSocket, req: http.IncomingMessage, wsServer: JsonCentralSystemServer) {
    // Init
    this.url = req.url.trim().replace(/\b(\?|&).*/, ''); // Filter trailing URL parameters
    this.ip = Utils.getRequestIP(req);
    this.wsConnection = wsConnection;
    this.req = req;
    this.initialized = false;
    this.wsServer = wsServer;

    // Default
    this.tenantIsValid = false;
    // Check URL: remove starting and trailing '/'
    if (this.url.endsWith('/')) {
      // Remove '/'
      this.url = this.url.substring(0, this.url.length - 1);
    }
    if (this.url.startsWith('/')) {
      // Remove '/'
      this.url = this.url.substring(1, this.url.length);
    }
    // Parse URL: should like /OCPP16/TENANTID/TOKEN/CHARGEBOXID
    // We support previous format for existing charging station without token /OCPP16/TENANTID/CHARGEBOXID
    const splittedURL = this.getURL().split('/');
    if (splittedURL.length === 4) {
      // URL /OCPP16/TENANTID/TOKEN/CHARGEBOXID
      this.tenantID = splittedURL[1];
      this.token = splittedURL[2];
      this.chargingStationID = splittedURL[3];
    } else if (splittedURL.length === 3) {
      // URL /OCPP16/TENANTID/CHARGEBOXID
      this.tenantID = splittedURL[1];
      this.chargingStationID = splittedURL[2];
    } else {
      // Error
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'constructor',
        message: `The URL '${req.url}' is invalid (/OCPPxx/TENANT_ID/CHARGEBOX_ID)`
      });
    }

    if (!Utils.isChargingStationIDValid(this.chargingStationID)) {
      throw new BackendError({
        source: this.chargingStationID,
        module: MODULE_NAME,
        method: 'constructor',
        message: 'The Charging Station ID is invalid'
      });
    }
    // Handle incoming messages
    this.wsConnection.onmessage = this.onMessage.bind(this);
    // Handle Error on Socket
    this.wsConnection.onerror = this.onError.bind(this);
    // Handle Socket close
    this.wsConnection.onclose = this.onClose.bind(this);
  }

  public async initialize() {
    try {
      // Check Tenant?
      await Utils.checkTenant(this.tenantID);
      // Ok
      this.tenantIsValid = true;
      // Cloud Foundry?
      if (Configuration.isCloudFoundry()) {
        // Yes: Save the CF App and Instance ID to call the Charging Station from the Rest server
        const chargingStation = await ChargingStationStorage.getChargingStation(this.tenantID, this.getChargingStationID());
        // Found?
        if (chargingStation) {
          // Update CF Instance
          chargingStation.cfApplicationIDAndInstanceIndex = Configuration.getCFApplicationIDAndInstanceIndex();
          // Save it
          await ChargingStationStorage.saveChargingStation(Action.WS_CONNECTION, this.tenantID, chargingStation);
        }
      }
    } catch (error) {
      // Custom Error
      Logging.logException(error, Action.WS_CONNECTION , this.getChargingStationID(), 'WSConnection', 'initialize', this.tenantID);
      throw new BackendError({
        source: this.getChargingStationID(),
        action: Action.WS_CONNECTION,
        module: MODULE_NAME, method: 'initialize',
        message: `Invalid Tenant '${this.tenantID}' in URL '${this.getURL()}'`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  public onError(event: Event) {
  }

  public onClose(closeEvent: CloseEvent) {
  }

  public async onMessage(messageEvent: MessageEvent) {
    // Parse the message
    const [messageType, messageId, commandName, commandPayload, errorDetails] = JSON.parse(messageEvent.data);
    try {
      // Initialize: done in the message as init could be lengthy and first message may be lost
      await this.initialize();

      // Check the Type of message
      switch (messageType) {
        // Incoming Message
        case Constants.OCPP_JSON_CALL_MESSAGE:
          // Process the call
          await this.handleRequest(messageId, commandName, commandPayload);
          break;
        // Outcome Message
        case Constants.OCPP_JSON_CALL_RESULT_MESSAGE:
          // Respond
          // eslint-disable-next-line no-case-declarations
          let responseCallback: Function;
          if (Utils.isIterable(this._requests[messageId])) {
            [responseCallback] = this._requests[messageId];
          } else {
            throw new BackendError({
              source: this.getChargingStationID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Response request for unknown message id ${messageId} is not iterable`,
              action: commandName
            });
          }
          if (!responseCallback) {
            // Error
            throw new BackendError({
              source: this.getChargingStationID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Response for unknown message id ${messageId}`,
              action: commandName
            });
          }
          delete this._requests[messageId];
          responseCallback(commandName);
          break;
        // Error Message
        case Constants.OCPP_JSON_CALL_ERROR_MESSAGE:
          // Log
          Logging.logError({
            tenantID: this.getTenantID(),
            module: MODULE_NAME,
            method: 'sendMessage',
            action: Action.WS_ERROR,
            message: `Error occured when calling the command '${commandName}'`,
            detailedMessages: [messageType, messageId, commandName, commandPayload, errorDetails]
          });
          if (!this._requests[messageId]) {
            // Error
            throw new BackendError({
              source: this.getChargingStationID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Error for unknown message id ${messageId}`,
              action: commandName
            });
          }
          // eslint-disable-next-line no-case-declarations
          let rejectCallback: Function;
          if (Utils.isIterable(this._requests[messageId])) {
            [, rejectCallback] = this._requests[messageId];
          } else {
            throw new BackendError({
              source: this.getChargingStationID(),
              module: MODULE_NAME,
              method: 'onMessage',
              message: `Error request for unknown message id ${messageId} is not iterable`,
              action: commandName
            });
          }
          delete this._requests[messageId];

          rejectCallback(new OCPPError({
            source: this.getChargingStationID(),
            module: MODULE_NAME,
            method: 'onMessage',
            code: commandName,
            message: commandPayload,
            detailedMessages: { errorDetails }
          }));
          break;
        // Error
        default:
          // Error
          throw new BackendError({
            source: this.getChargingStationID(),
            module: MODULE_NAME,
            method: 'onMessage',
            message: `Wrong message type ${messageType}`,
            action: commandName
          });
      }
    } catch (error) {
      // Log
      Logging.logException(error, commandName, this.getChargingStationID(), MODULE_NAME, 'onMessage', this.getTenantID());
      // Send error
      await this.sendError(messageId, error);
    }
  }

  public async handleRequest(messageId, commandName, commandPayload) {
    // To implement in sub-class
  }

  public getWSConnection() {
    return this.wsConnection;
  }

  public getWSServer() {
    return this.wsServer;
  }

  public getURL(): string {
    return this.url;
  }

  public getIP(): string {
    return this.ip;
  }

  public async send(command, messageType = Constants.OCPP_JSON_CALL_MESSAGE) {
    // Send Message
    return this.sendMessage(uuid(), command, messageType);
  }

  public async sendError(messageId, err) {
    // Check exception: only OCPP error are accepted
    const error = (err instanceof OCPPError ? err : new OCPPError({
      source: this.getChargingStationID(),
      module: MODULE_NAME,
      method: 'sendError',
      code: Constants.OCPP_ERROR_INTERNAL_ERROR,
      message: err.message
    }));
    // Send error
    return this.sendMessage(messageId, error, Constants.OCPP_JSON_CALL_ERROR_MESSAGE);
  }

  public async sendMessage(messageId, command, messageType = Constants.OCPP_JSON_CALL_RESULT_MESSAGE, commandName = ''): Promise<any> {
    // Send a message through WSConnection
    const self = this;
    // Create a promise
    // eslint-disable-next-line no-undef
    return await new Promise((resolve, reject) => {
      let messageToSend;
      // Type of message
      switch (messageType) {
        // Request
        case Constants.OCPP_JSON_CALL_MESSAGE:
          // Build request
          this._requests[messageId] = [responseCallback, rejectCallback];
          messageToSend = JSON.stringify([messageType, messageId, commandName, command]);
          break;
        // Response
        case Constants.OCPP_JSON_CALL_RESULT_MESSAGE:
          // Build response
          messageToSend = JSON.stringify([messageType, messageId, command]);
          break;
        // Error Message
        case Constants.OCPP_JSON_CALL_ERROR_MESSAGE:
          // Build Message
          // eslint-disable-next-line no-case-declarations
          const {
            code,
            message,
            details
          } = command;
          messageToSend = JSON.stringify([messageType, messageId, code, message, details]);
          break;
      }
      // Check if wsConnection in ready
      if (this.isWSConnectionOpen()) {
        // Yes: Send Message
        this.wsConnection.send(messageToSend);
      } else {
        // Reject it
        return rejectCallback(`Web socket closed for Message ID '${messageId}' with content '${messageToSend}' (${TenantStorage.getTenant(this.tenantID).then((tenant) => tenant.name)})`);
      }
      // Request?
      if (messageType !== Constants.OCPP_JSON_CALL_MESSAGE) {
        // Yes: send Ok
        resolve();
      } else {
        // Send timeout
        setTimeout(() => rejectCallback(`Timeout for Message ID '${messageId}' with content '${messageToSend} (${TenantStorage.getTenant(this.tenantID).then((tenant) => tenant.name)}`), Constants.OCPP_SOCKET_TIMEOUT);
      }

      // Function that will receive the request's response
      function responseCallback(payload) {
        // Send the response
        resolve(payload);
      }

      // Function that will receive the request's rejection
      function rejectCallback(reason) {
        // Build Exception
        self._requests[messageId] = [() => {}, () => {}];
        const error = reason instanceof OCPPError ? reason : new Error(reason);
        // Send error
        reject(error);
      }
    });
  }

  public getChargingStationID(): string {
    return this.chargingStationID;
  }

  public getTenantID(): string {
    // Check
    if (this.isTenantValid()) {
      // Ok verified
      return this.tenantID;
    }
    // No go to the master tenant
    return Constants.DEFAULT_TENANT;
  }

  public getToken(): string {
    return this.token;
  }

  public getID(): string {
    return `${this.getTenantID()}~${this.getChargingStationID()}}`;
  }

  public isTenantValid(): boolean {
    return this.tenantIsValid;
  }

  public isWSConnectionOpen(): boolean {
    return this.wsConnection.readyState === OPEN;
  }
}
