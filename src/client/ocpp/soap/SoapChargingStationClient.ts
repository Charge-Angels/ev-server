import { soap } from 'strong-soap';
import { Action } from '../../../types/Authorization';
import ChargingStation from '../../../types/ChargingStation';
import global from '../../../types/GlobalType';
import { OCPPChangeAvailabilityCommandParam, OCPPChangeAvailabilityCommandResult, OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPClearCacheCommandResult, OCPPClearChargingProfileCommandParam, OCPPClearChargingProfileCommandResult, OCPPGetCompositeScheduleCommandParam, OCPPGetCompositeScheduleCommandResult, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPGetDiagnosticsCommandParam, OCPPGetDiagnosticsCommandResult, OCPPRemoteStartTransactionCommandParam, OCPPRemoteStartTransactionCommandResult, OCPPRemoteStopTransactionCommandParam, OCPPRemoteStopTransactionCommandResult, OCPPResetCommandParam, OCPPResetCommandResult, OCPPSetChargingProfileCommandParam, OCPPSetChargingProfileCommandResult, OCPPUnlockConnectorCommandParam, OCPPUnlockConnectorCommandResult, OCPPUpdateFirmwareCommandParam } from '../../../types/ocpp/OCPPClient';
import Configuration from '../../../utils/Configuration';
import Logging from '../../../utils/Logging';
import ChargingStationClient from '../ChargingStationClient';

// Default Module name
const MODULE_NAME = 'SoapChargingStationClient';

// Get the config
const _wsdlEndpointConfig = Configuration.getWSDLEndpointConfig();
export default class SoapChargingStationClient extends ChargingStationClient {
  public transactionId: number;
  public error: any;
  public result: any;
  public envelope: any;
  public tagID: string;
  public connectorID: any;
  public type: any;
  public keys: any;
  public key: any;
  public value: any;
  private chargingStation: ChargingStation;
  private tenantID: string;
  private client: any;

  private constructor(tenantID: string, chargingStation: ChargingStation) {
    super();
    // Keep the Charging Station
    this.chargingStation = chargingStation;
    this.tenantID = tenantID;
  }

  static async getChargingStationClient(tenantID: string, chargingStation: ChargingStation): Promise<SoapChargingStationClient> {
    const scsc = new SoapChargingStationClient(tenantID, chargingStation);
    return await new Promise((fulfill, reject) => {
      let chargingStationWdsl = null;
      // Read the WSDL client files
      switch (scsc.chargingStation.ocppVersion) {
        // OCPP V1.2
        case '1.2':
          chargingStationWdsl = `${global.appRoot}/assets/server/ocpp/wsdl/OCPPChargePointService12.wsdl`;
          break;
        case '1.5':
          chargingStationWdsl = `${global.appRoot}/assets/server/ocpp/wsdl/OCPPChargePointService15.wsdl`;
          break;
        case '1.6':
          chargingStationWdsl = `${global.appRoot}/assets/server/ocpp/wsdl/OCPPChargePointService16.wsdl`;
          break;
        default:
          // Log
          Logging.logError({
            tenantID: scsc.tenantID,
            module: MODULE_NAME, method: 'constructor',
            message: `OCPP version ${scsc.chargingStation.ocppVersion} not supported`
          });
          reject(`OCPP version ${scsc.chargingStation.ocppVersion} not supported`);
      }
      // Client options
      const options: any = {};
      // Create client
      soap.createClient(chargingStationWdsl, options, (error, client) => {
        if (error) {
          // Log
          Logging.logError({
            tenantID: scsc.tenantID,
            source: scsc.chargingStation.id,
            module: MODULE_NAME, method: 'constructor',
            message: `Error when creating SOAP client: ${error.toString()}`,
            detailedMessages: { error: error.message, stack: error.stack }
          });
          reject(`Error when creating SOAP client for charging station with ID ${scsc.chargingStation.id}: ${error.message}`);
        } else {
          // Keep
          scsc.client = client;
          // Set endpoint
          scsc.client.setEndpoint(scsc.chargingStation.chargingStationURL);
          // Ok
          fulfill(scsc);
        }
      });
    });
  }

  public async remoteStopTransaction(params: OCPPRemoteStopTransactionCommandParam): Promise<OCPPRemoteStopTransactionCommandResult> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Action.REMOTE_STOP_TRANSACTION);
    // Log
    Logging.logSendAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.REMOTE_STOP_TRANSACTION,
      [params, { headers: this.client.getSoapHeaders() }]);
    // Execute
    const { error, result, envelope } = await this.client.RemoteStopTransaction({
      'remoteStopTransactionRequest': params
    });
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        action: Action.REMOTE_STOP_TRANSACTION as unknown as Action,
        source: this.chargingStation.id,
        module: MODULE_NAME, method: 'remoteStopTransaction',
        message: `Error when trying to stop the transaction ID ${params.transactionId}: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.REMOTE_STOP_TRANSACTION, [
      { result },
      { envelope }
    ]);
    return result;
  }

  public async remoteStartTransaction(params: OCPPRemoteStartTransactionCommandParam): Promise<OCPPRemoteStartTransactionCommandResult> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Action.REMOTE_START_TRANSACTION);
    // Log
    Logging.logSendAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.REMOTE_START_TRANSACTION,
      [params, { headers: this.client.getSoapHeaders() }]
    );
    // Execute
    const { error, result, envelope } = await this.client.RemoteStartTransaction(params);
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        action: Action.REMOTE_START_TRANSACTION as unknown as Action,
        source: this.chargingStation.id,
        module: MODULE_NAME, method: 'remoteStartTransaction',
        message: `Error when trying to start a transaction: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(MODULE_NAME, this.tenantID,
      this.chargingStation.id, Action.REMOTE_START_TRANSACTION, [
        { result },
        { envelope }
      ]);
    return result;
  }

  public async unlockConnector(params: OCPPUnlockConnectorCommandParam): Promise<OCPPUnlockConnectorCommandResult> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Action.UNLOCK_CONNECTOR);
    // Log
    Logging.logSendAction(MODULE_NAME, this.tenantID, this.chargingStation.id,
      Action.UNLOCK_CONNECTOR, [params, { headers: this.client.getSoapHeaders() }]);
    // Execute
    const { error, result, envelope } = await this.client.UnlockConnector({
      'unlockConnectorRequest': params
    });
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        action: Action.UNLOCK_CONNECTOR as unknown as Action,
        source: this.chargingStation.id,
        module: MODULE_NAME, method: 'unlockConnector',
        message: `Error when trying to unlock the connector '${params.connectorId}': ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.UNLOCK_CONNECTOR, [
      { result },
      { envelope }
    ]);
    return result;
  }

  public async reset(params: OCPPResetCommandParam): Promise<OCPPResetCommandResult> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Action.RESET);
    // Log
    Logging.logSendAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.RESET,
      [params, { headers: this.client.getSoapHeaders() }]);
    // Execute
    const { error, result, envelope } = await this.client.Reset({
      'resetRequest': params
    });
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        action: Action.RESET as unknown as Action,
        source: this.chargingStation.id,
        module: MODULE_NAME, method: 'reset',
        message: `Error when trying to reboot: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      return error;
    }
    // Log
    Logging.logReturnedAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.RESET, [
      { result },
      { envelope }
    ]);
    return result;
  }

  public async clearCache(): Promise<OCPPClearCacheCommandResult> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Action.CLEAR_CACHE);
    // Log
    Logging.logSendAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.CLEAR_CACHE,
      { headers: this.client.getSoapHeaders() });
    // Execute
    const { error, result, envelope } = await this.client.ClearCache({ clearCacheRequest: {} });
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        action: Action.CLEAR_CACHE as unknown as Action,
        source: this.chargingStation.id,
        module: MODULE_NAME, method: 'clearCache',
        message: `Error when trying to clear the cache: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.CLEAR_CACHE, [
      { result },
      { envelope }
    ]);
    return result;
  }

  public async getConfiguration(params: OCPPGetConfigurationCommandParam): Promise<OCPPGetConfigurationCommandResult> {
    // Init SOAP Headers with the action
    this.initSoapHeaders(Action.GET_CONFIGURATION);
    // Log
    Logging.logSendAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.GET_CONFIGURATION,
      [params.key, { headers: this.client.getSoapHeaders() }]);
    // Set request
    const request: any = {
      'getConfigurationRequest': {}
    };
    // Key provided?
    if (params.key) {
      // Set the keys
      request.getConfigurationRequest.key = params.key;
    }
    // Execute
    const { error, result, envelope } = await this.client.GetConfiguration(request);
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        action: Action.GET_CONFIGURATION as unknown as Action,
        source: this.chargingStation.id,
        module: MODULE_NAME, method: 'getConfiguration',
        message: `Error when trying to get the configuration: ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.GET_CONFIGURATION, [
      { result },
      { envelope }
    ]);
    return result;
  }

  public async changeConfiguration(params: OCPPChangeConfigurationCommandParam): Promise<OCPPChangeConfigurationCommandResult> {
    const { key, value } = params;
    // Init SOAP Headers with the action
    this.initSoapHeaders(Action.CHANGE_CONFIGURATION);
    // Log
    Logging.logSendAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.CHANGE_CONFIGURATION, [{
      'key': key,
      'value': value
    }, { headers: this.client.getSoapHeaders() }]);
    // Execute
    const { error, result, envelope } = await this.client.ChangeConfiguration({
      'changeConfigurationRequest': {
        'key': key,
        'value': value
      }
    });
    if (error) {
      // Log
      Logging.logError({
        tenantID: this.tenantID,
        source: this.chargingStation.id,
        module: MODULE_NAME, method: 'changeConfiguration',
        action: Action.CHANGE_CONFIGURATION as unknown as Action,
        message: `Error when trying to change the configuration parameter '${key}' with value '${value}': ${error.toString()}`,
        detailedMessages: [
          { 'stack': error.stack },
          { result },
          { envelope }
        ]
      });
      throw error;
    }
    // Log
    Logging.logReturnedAction(MODULE_NAME, this.tenantID, this.chargingStation.id, Action.CHANGE_CONFIGURATION, [
      { result },
      { envelope }
    ]);
    return result;
  }

  public getChargingStation() {
    return this.chargingStation;
  }

  public setChargingProfile(params: OCPPSetChargingProfileCommandParam): Promise<OCPPSetChargingProfileCommandResult> {
    throw new Error('Method not implemented.');
  }

  public getCompositeSchedule(params: OCPPGetCompositeScheduleCommandParam): Promise<OCPPGetCompositeScheduleCommandResult> {
    throw new Error('Method not implemented.');
  }

  public clearChargingProfile(params: OCPPClearChargingProfileCommandParam): Promise<OCPPClearChargingProfileCommandResult> {
    throw new Error('Method not implemented.');
  }

  public changeAvailability(params: OCPPChangeAvailabilityCommandParam): Promise<OCPPChangeAvailabilityCommandResult> {
    throw new Error('Method not implemented.');
  }

  public getDiagnostics(params: OCPPGetDiagnosticsCommandParam): Promise<OCPPGetDiagnosticsCommandResult> {
    throw new Error('Method not implemented.');
  }

  public updateFirmware(params: OCPPUpdateFirmwareCommandParam): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private initSoapHeaders(action) {
    // Clear the SOAP Headers`
    this.client.clearSoapHeaders();
    // Add them
    this.client.addSoapHeader(`<h:chargeBoxIdentity xmlns:h="urn://Ocpp/Cp/2012/06/">${this.chargingStation.id}</h:chargeBoxIdentity>`);
    this.client.addSoapHeader('<a:MessageID xmlns:a="http://www.w3.org/2005/08/addressing">urn:uuid:589e13ae-1787-49f8-ab8b-4567327b23c6</a:MessageID>');
    this.client.addSoapHeader('<a:ReplyTo xmlns:a="http://www.w3.org/2005/08/addressing"><a:Address>http://www.w3.org/2005/08/addressing/anonymous</a:Address></a:ReplyTo>');
    this.client.addSoapHeader(`<a:To xmlns:a="http://www.w3.org/2005/08/addressing">${this.chargingStation.chargingStationURL}</a:To>`);
    this.client.addSoapHeader(`<a:Action xmlns:a="http://www.w3.org/2005/08/addressing">/${action}</a:Action>`);
    this.client.addSoapHeader(`<a:From xmlns:a="http://www.w3.org/2005/08/addressing"><a:Address>${_wsdlEndpointConfig.baseUrl}</a:Address></a:From>`);
  }
}
