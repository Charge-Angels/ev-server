import ChargingStation, { Connector } from '../../types/ChargingStation';
import { OICPActionType, OICPPushEvseDataCpoSend } from '../../types/oicp/OICPEvseData';
import { OICPAuthorizeStartCpoReceive, OICPAuthorizeStartCpoSend, OICPAuthorizeStopCpoReceive, OICPAuthorizeStopCpoSend } from '../../types/oicp/OICPAuthorize';
import { OICPChargingNotification, OICPErrorClass, OICPStatusCode } from '../../types/oicp/OICPStatusCode';
import { OICPChargingNotificationEndCpoSend, OICPChargingNotificationErrorCpoSend, OICPChargingNotificationProgressCpoSend, OICPChargingNotificationStartCpoSend } from '../../types/oicp/OICPChargingNotifications';
import { OICPDefaultTagId, OICPIdentification, OICPSessionID } from '../../types/oicp/OICPIdentification';
import { OICPEvseDataRecord, OICPEvseStatusRecord, OICPOperatorEvseData, OICPOperatorEvseStatus } from '../../types/oicp/OICPEvse';
import { OICPSession, OICPSessionStatus } from '../../types/oicp/OICPSession';
import Transaction, { TransactionAction } from '../../types/Transaction';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { HTTPError } from '../../types/HTTPError';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { OCPILocationOptions } from '../../types/ocpi/OCPILocation';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import { OICPAcknowledgment } from '../../types/oicp/OICPAcknowledgment';
import { OICPAuthorizationStatus } from '../../types/oicp/OICPAuthentication';
import { OICPBatchSize } from '../../types/oicp/OICPGeneral';
import { OICPChargeDetailRecord } from '../../types/oicp/OICPChargeDetailRecord';
import OICPClient from './OICPClient';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import OICPEndpointStorage from '../../storage/mongodb/OICPEndpointStorage';
import OICPMapping from '../../server/oicp/oicp-services-impl/oicp-2.3.0/OICPMapping';
import { OICPPushEvseStatusCpoSend } from '../../types/oicp/OICPEvseStatus';
import { OICPResult } from '../../types/oicp/OICPResult';
import { OICPRole } from '../../types/oicp/OICPRole';
import OICPUtils from '../../server/oicp/OICPUtils';
import { OicpSetting } from '../../types/Setting';
import { ServerAction } from '../../types/Server';
import SiteArea from '../../types/SiteArea';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import _ from 'lodash';

const MODULE_NAME = 'CpoOICPClient';

export default class CpoOICPClient extends OICPClient {


  constructor(tenant: Tenant, settings: OicpSetting, oicpEndpoint: OICPEndpoint) {
    super(tenant, settings, oicpEndpoint, OICPRole.CPO);
    if (oicpEndpoint.role !== OICPRole.CPO) {
      throw new BackendError({
        message: `CpoOicpClient requires Oicp Endpoint with role ${OICPRole.CPO}`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
  }

  public async startSession(chargingStation: ChargingStation, transaction: Transaction, sessionId: OICPSessionID, identification: OICPIdentification): Promise<void> {
    let siteArea: SiteArea;
    if (!chargingStation.siteArea) {
      siteArea = await SiteAreaStorage.getSiteArea(this.tenant.id, chargingStation.siteAreaID);
    } else {
      siteArea = chargingStation.siteArea;
    }
    const options: OCPILocationOptions = {
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_SESSIONS),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_SESSIONS),
      addChargeBoxID: true
    };
    const oicpEvse = OICPMapping.getEvseByConnectorId(this.tenant, siteArea, chargingStation, transaction.connectorId, options);
    const oicpSession = {
      id: sessionId,
      start_datetime: transaction.timestamp,
      kwh: 0,
      identification: identification,
      evse: oicpEvse,
      currency: this.settings.currency,
      status: OICPSessionStatus.PENDING,
      total_cost: transaction.currentCumulatedPrice > 0 ? transaction.currentCumulatedPrice : 0,
      last_updated: transaction.timestamp,
      meterValueInBetween: [],
    } as OICPSession;
    transaction.oicpData = {
      session: oicpSession
    };
    // Log
    await Logging.logDebug({
      tenantID: this.tenant.id,
      user: transaction.user,
      action: ServerAction.OICP_PUSH_SESSIONS,
      message: `Start OICP Transaction ID (ID '${transaction.id}')`,
      module: MODULE_NAME, method: 'startSession',
      detailedMessages: { payload: oicpSession }
    });
  }

  public async updateSession(transaction: Transaction): Promise<void> {
    if (!transaction.oicpData || !transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: 'OICP Session not started',
        module: MODULE_NAME, method: 'updateSession',
        user: transaction.user
      });
    }
    transaction.oicpData.session.kwh = Utils.createDecimal(transaction.currentTotalConsumptionWh).div(1000).toNumber();
    transaction.oicpData.session.last_updated = transaction.currentTimestamp;
    transaction.oicpData.session.total_cost = transaction.currentCumulatedPrice > 0 ? transaction.currentCumulatedPrice : 0;
    transaction.oicpData.session.currency = this.settings.currency;
    if (transaction.lastConsumption && transaction.lastConsumption.value) {
      transaction.oicpData.session.meterValueInBetween.push(transaction.lastConsumption.value);
    }
    const sessionUpdate: Partial<OICPSession> = {
      kwh: transaction.oicpData.session.kwh,
      last_updated: transaction.oicpData.session.last_updated,
      currency: transaction.oicpData.session.currency,
      total_cost: transaction.oicpData.session.total_cost > 0 ? transaction.oicpData.session.total_cost : 0,
      status: transaction.oicpData.session.status
    };
    // Log
    await Logging.logDebug({
      tenantID: this.tenant.id,
      user: transaction.user,
      action: ServerAction.OICP_PUSH_SESSIONS,
      message: 'OICP Session update',
      module: MODULE_NAME, method: 'updateSession',
      detailedMessages: { payload: sessionUpdate }
    });
    // Call Hubject
    let response;
    if (transaction.oicpData.session.status === OICPSessionStatus.PENDING) {
      // Send start notification to Hubject when actual energy flow starts
      response = await this.sendChargingNotificationStart(transaction);
      transaction.oicpData.session.status = OICPSessionStatus.ACTIVE;
    } else {
      // Send progress notification
      response = await this.sendChargingNotificationProgress(transaction);
    }
    if (response) {
      await Logging.logDebug({
        tenantID: this.tenant.id,
        user: transaction.user,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `Update Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') response received from Hubject`,
        module: MODULE_NAME, method: 'updateSession',
        detailedMessages: { response: response }
      });
    }
  }

  public async stopSession(transaction: Transaction): Promise<void> {
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'stopSession',
        user: transaction.user
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'stopSession',
        user: transaction.user
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `OICP Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') not yet stopped`,
        module: MODULE_NAME, method: 'stopSession',
        user: transaction.user
      });
    }
    transaction.oicpData.session.kwh = Utils.createDecimal(transaction.stop.totalConsumptionWh).div(1000).toNumber();
    transaction.oicpData.session.total_cost = transaction.stop.roundedPrice > 0 ? transaction.stop.roundedPrice : 0;
    transaction.oicpData.session.end_datetime = transaction.stop.timestamp;
    transaction.oicpData.session.last_updated = transaction.stop.timestamp;
    transaction.oicpData.session.status = OICPSessionStatus.COMPLETED;
    if (transaction.lastConsumption?.value) {
      transaction.oicpData.session.meterValueInBetween.push(transaction.lastConsumption.value);
    }
    // Log
    await Logging.logDebug({
      tenantID: this.tenant.id,
      user: transaction.user,
      action: ServerAction.OICP_PUSH_SESSIONS,
      message: `Stop OICP Transaction ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') to Hubject`,
      module: MODULE_NAME, method: 'stopSession',
      detailedMessages: { payload: transaction.oicpData.session }
    });
    // Call Hubject
    await this.sendChargingNotificationEnd(transaction);
    if (transaction.tagID !== OICPDefaultTagId.RemoteIdentification) {
      const response = await this.authorizeStop(transaction);
      await Logging.logDebug({
        tenantID: this.tenant.id,
        user: transaction.user,
        action: ServerAction.OICP_PUSH_SESSIONS,
        message: `Push OICP Transaction ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') response retrieved from Hubject`,
        module: MODULE_NAME, method: 'stopSession',
        detailedMessages: { response: response }
      });
    }
  }

  /**
   * Send all EVSEs
   *
   * @param processAllEVSEs
   * @param actionType
   */
  public async sendEVSEs(processAllEVSEs = true, actionType?: OICPActionType): Promise<OICPResult> {
    if (!actionType) {
      actionType = OICPActionType.FULL_LOAD;
    }
    if (!processAllEVSEs) {
      actionType = OICPActionType.INSERT;
    }
    // Result
    const result = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      objectIDsInFailure: []
    } as OICPResult;
    // Perfs trace
    const startTime = new Date().getTime();
    // Define get option
    const options: OCPILocationOptions = {
      addChargeBoxID: true,
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_EVSE_DATA),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_EVSE_DATA)
    };
    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();
    // Get all charging stations from tenant
    // TODO: Perfs/Memory issue in Prod: that does not scale with 100k charging stations, use pagination
    const chargingStations = await OICPMapping.getAllChargingStations(this.tenant, 0, 0);
    // Convert (public) charging stations to OICP EVSEs
    const evses = OICPMapping.convertChargingStationsToEVSEs(this.tenant, chargingStations, options);
    let evsesToProcess: OICPEvseDataRecord[] = [];
    let chargeBoxIDsToProcessFromInput = [];
    // Check if all EVSEs should be processed - in case of delta send - process only following EVSEs:
    //    - EVSEs (ChargingStations) in error from previous push
    //    - EVSEs (ChargingStations) with status notification from latest pushDate
    if (processAllEVSEs) {
      evsesToProcess = evses;
      chargeBoxIDsToProcessFromInput = evsesToProcess.map((evse) => evse.ChargingStationID);
    } else {
      let chargeBoxIDsToProcess = [];
      // Get ChargingStation in Failure from previous run
      chargeBoxIDsToProcess.push(...this.getChargeBoxIDsInFailure());
      // Get ChargingStation with new status notification
      chargeBoxIDsToProcess.push(...await this.getChargeBoxIDsWithNewStatusNotifications());
      // Remove duplicates
      chargeBoxIDsToProcess = _.uniq(chargeBoxIDsToProcess);
      // Loop through EVSE
      for (const evse of evses) {
        if (evse) {
          // Check if Charging Station should be processed
          if (!processAllEVSEs && !chargeBoxIDsToProcess.includes(evse.ChargingStationID)) {
            continue;
          }
          // Process
          evsesToProcess.push(evse);
          chargeBoxIDsToProcessFromInput.push(evse.ChargingStationID);
        }
      }
    }
    // Only one post request to Hubject for multiple EVSEs
    result.total = evsesToProcess.length;
    if (evsesToProcess.length > OICPBatchSize.EVSE_DATA) {
      // In case of multiple batches:
      // delete all EVSEs on Hubject by overwriting with empty array
      // set action type to insert to avoid overwriting each batch with a full load request
      await this.pushEvseData([], OICPActionType.FULL_LOAD);
      actionType = OICPActionType.INSERT;
    }
    if (evsesToProcess) {
      // Process it if not empty
      do {
        // Send EVSEs in batches to avoid maxBodyLength limit of request.
        const evseBatch = evsesToProcess.splice(0, OICPBatchSize.EVSE_DATA);
        const evseIDBatch = chargeBoxIDsToProcessFromInput.splice(0, OICPBatchSize.EVSE_DATA);
        try {
          await this.pushEvseData(evseBatch, actionType);
          result.success += evseBatch.length;
        } catch (error) {
          result.failure += evseBatch.length;
          result.objectIDsInFailure.push(...evseIDBatch);
          result.logs.push(
            `Failed to update the EVSEs from tenant '${this.tenant.id}': ${String(error.message)}`
          );
        }
      } while (!Utils.isEmptyArray(evsesToProcess));
      if (result.failure > 0) {
        // Send notification to admins
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationHandler.sendOICPPatchChargingStationsError(
          this.tenant.id,
          {
            evseDashboardURL: Utils.buildEvseURL(this.tenant.subdomain)
          }
        );
      }
    }
    // Save result in oicp endpoint
    this.oicpEndpoint.lastPatchJobOn = startDate;
    // Set result
    if (result) {
      this.oicpEndpoint.lastPatchJobResult = {
        successNbr: result.success,
        failureNbr: result.failure,
        totalNbr: result.total,
        chargeBoxIDsInFailure: _.uniq(result.objectIDsInFailure),
        chargeBoxIDsInSuccess: _.uniq(result.objectIDsInFailure)
      };
    } else {
      this.oicpEndpoint.lastPatchJobResult = {
        successNbr: 0,
        failureNbr: 0,
        totalNbr: 0,
        chargeBoxIDsInFailure: [],
        chargeBoxIDsInSuccess: []
      };
    }
    // Save
    const executionDurationSecs = Utils.createDecimal(new Date().getTime()).minus(startTime).div(1000).toNumber();
    await OICPEndpointStorage.saveOicpEndpoint(this.tenant.id, this.oicpEndpoint);
    await Logging.logOicpResult(this.tenant.id, ServerAction.OICP_PUSH_EVSE_DATA,
      MODULE_NAME, 'sendEVSEs', result,
      `{{inSuccess}} EVSE(s) were successfully patched in ${executionDurationSecs}s`,
      `{{inError}} EVSE(s) failed to be patched in ${executionDurationSecs}s`,
      `{{inSuccess}} EVSE(s) were successfully patched and {{inError}} failed to be patched in ${executionDurationSecs}s`,
      'No EVSE has been patched'
    );
    return result;
  }

  /**
   * Send all EVSE Statuses
   *
   * @param processAllEVSEs
   * @param actionType
   */
  public async sendEVSEStatuses(processAllEVSEs = true, actionType?: OICPActionType): Promise<OICPResult> {
    if (!actionType) {
      actionType = OICPActionType.FULL_LOAD;
    }
    if (!processAllEVSEs) {
      actionType = OICPActionType.INSERT;
    }
    // Result
    const result = {
      success: 0,
      failure: 0,
      total: 0,
      logs: [],
      objectIDsInFailure: []
    } as OICPResult;
    // Perfs trace
    const startTime = new Date().getTime();
    // Define get option
    const options: OCPILocationOptions = {
      addChargeBoxID: true,
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_EVSE_STATUSES),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_EVSE_STATUSES)
    };
    // Get timestamp before starting process - to be saved in DB at the end of the process
    const startDate = new Date();
    // Get all charging stations from tenant
    // TODO: Perfs/Memory issue in Prod: that does not scale with 100k charging stations, use pagination
    const chargingStations = await OICPMapping.getAllChargingStations(this.tenant, 0, 0);
    // Convert (public) charging stations to OICP EVSE Statuses
    const evseStatuses = OICPMapping.convertChargingStationsToEvseStatuses(this.tenant, chargingStations, options);
    let evseStatusesToProcess: OICPEvseStatusRecord[] = [];
    let chargeBoxIDsToProcessFromInput = [];
    // Check if all EVSE Statuses should be processed - in case of delta send - process only following EVSEs:
    //    - EVSEs (ChargingStations) in error from previous push
    //    - EVSEs (ChargingStations) with status notification from latest pushDate
    if (processAllEVSEs) {
      evseStatusesToProcess = evseStatuses;
      chargeBoxIDsToProcessFromInput = evseStatusesToProcess.map((evseStatus) => evseStatus.ChargingStationID);
    } else {
      let chargeBoxIDsToProcess = [];
      // Get ChargingStation in Failure from previous run
      chargeBoxIDsToProcess.push(...this.getChargeBoxIDsInFailure());
      // Get ChargingStation with new status notification
      chargeBoxIDsToProcess.push(...await this.getChargeBoxIDsWithNewStatusNotifications());
      // Remove duplicates
      chargeBoxIDsToProcess = _.uniq(chargeBoxIDsToProcess);
      // Loop through EVSE statuses
      for (const evseStatus of evseStatuses) {
        if (evseStatus) {
          // Check if Charging Station should be processed
          if (!processAllEVSEs && !chargeBoxIDsToProcess.includes(evseStatus.ChargingStationID)) {
            continue;
          }
          // Process
          evseStatusesToProcess.push(evseStatus);
          chargeBoxIDsToProcessFromInput.push(evseStatus.ChargingStationID);
        }
      }
    }
    // Only one post request for multiple EVSE Statuses
    result.total = evseStatusesToProcess.length;
    if (evseStatusesToProcess) {
      try {
        await this.pushEvseStatus(evseStatusesToProcess, actionType);
        result.success = result.total;
      } catch (error) {
        result.failure = result.total;
        result.objectIDsInFailure.push(...chargeBoxIDsToProcessFromInput);
        result.logs.push(
          `Failed to update the EVSE Statuses from tenant '${this.tenant.id}': ${String(error.message)}`
        );
      }
      if (result.failure > 0) {
        // Send notification to admins
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NotificationHandler.sendOICPPatchChargingStationsStatusesError(
          this.tenant.id,
          {
            evseDashboardURL: Utils.buildEvseURL(this.tenant.subdomain)
          }
        );
      }
    }
    // Save result in oicp endpoint
    this.oicpEndpoint.lastPatchJobOn = startDate;
    // Set result
    if (result) {
      this.oicpEndpoint.lastPatchJobResult = {
        successNbr: result.success,
        failureNbr: result.failure,
        totalNbr: result.total,
        chargeBoxIDsInFailure: _.uniq(result.objectIDsInFailure),
        chargeBoxIDsInSuccess: _.uniq(result.objectIDsInFailure)
      };
    } else {
      this.oicpEndpoint.lastPatchJobResult = {
        successNbr: 0,
        failureNbr: 0,
        totalNbr: 0,
        chargeBoxIDsInFailure: [],
        chargeBoxIDsInSuccess: []
      };
    }
    // Save
    const executionDurationSecs = (new Date().getTime() - startTime) / 1000;
    await OICPEndpointStorage.saveOicpEndpoint(this.tenant.id, this.oicpEndpoint);
    await Logging.logOicpResult(this.tenant.id, ServerAction.OICP_PUSH_EVSE_STATUSES,
      MODULE_NAME, 'sendEVSEStatuses', result,
      `{{inSuccess}} EVSE Status(es) were successfully patched in ${executionDurationSecs}s`,
      `{{inError}} EVSE Status(es) failed to be patched in ${executionDurationSecs}s`,
      `{{inSuccess}} EVSE Status(es) were successfully patched and {{inError}} failed to be patched in ${executionDurationSecs}s`,
      'No EVSE Status has been patched'
    );
    return result;
  }

  /**
   * Update EVSE Status
   *
   * @param chargingStation
   * @param connector
   */
  public async updateEVSEStatus(chargingStation: ChargingStation, connector: Connector): Promise<OICPAcknowledgment> {
    if (!chargingStation.siteAreaID && !chargingStation.siteArea) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: 'Charging Station must be associated to a site area',
        module: MODULE_NAME, method: 'updateEVSEStatus',
      });
    }
    if (!chargingStation.issuer) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: 'Only charging Station issued locally can be exposed to Hubject',
        module: MODULE_NAME, method: 'updateEVSEStatus',
      });
    }
    if (!chargingStation.public) {
      throw new BackendError({
        source: chargingStation.id,
        action: ServerAction.OICP_UPDATE_EVSE_STATUS,
        message: 'Private charging Station cannot be exposed to Hubject',
        module: MODULE_NAME, method: 'updateEVSEStatus',
      });
    }
    // Define get option
    const options: OCPILocationOptions = {
      addChargeBoxID: true,
      countryID: this.getLocalCountryCode(ServerAction.OICP_PUSH_EVSE_STATUSES),
      partyID: this.getLocalPartyID(ServerAction.OICP_PUSH_EVSE_STATUSES)
    };
    const evseStatus = OICPMapping.convertConnector2EvseStatus(this.tenant, chargingStation, connector, options);
    const response = await this.pushEvseStatus([evseStatus], OICPActionType.UPDATE);
    return response;
  }

  /**
   * Push EVSE
   *
   * @param evses
   * @param actionType
   */
  public async pushEvseData(evses: OICPEvseDataRecord[], actionType: OICPActionType): Promise<OICPAcknowledgment> {
    this.axiosInstance.defaults.httpsAgent = await this.getHttpsAgent(ServerAction.OICP_CREATE_AXIOS_INSTANCE);
    let pushEvseDataResponse: OICPAcknowledgment;
    let requestError: any;
    // Check for input parameter
    if (!evses) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSE_DATA,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'pushEvseData',
      });
    }
    // Get EVSE endpoint url
    const fullUrl = this.getEndpointUrl('evses', ServerAction.OICP_PUSH_EVSE_DATA);
    // Build payload
    const operatorEvseData: OICPOperatorEvseData = {} as OICPOperatorEvseData;
    operatorEvseData.OperatorID = this.getOperatorID(ServerAction.OICP_PUSH_EVSE_DATA);
    operatorEvseData.OperatorName = this.tenant.name;
    operatorEvseData.EvseDataRecord = evses;
    const payload: OICPPushEvseDataCpoSend = {} as OICPPushEvseDataCpoSend;
    payload.ActionType = actionType;
    payload.OperatorEvseData = operatorEvseData;
    // Log
    await Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_EVSE_DATA,
      message: `Push EVSEs from tenant: ${this.tenant.id}`,
      module: MODULE_NAME, method: 'pushEvseData',
      detailedMessages: { payload }
    });
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      pushEvseDataResponse = response.data;
    } catch (error) {
      pushEvseDataResponse = error.response?.data;
      requestError = error;
    }
    if (!pushEvseDataResponse?.Result || pushEvseDataResponse?.Result !== true) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSE_DATA,
        message: `'pushEvseData' Error: '${pushEvseDataResponse?.StatusCode?.AdditionalInfo ? pushEvseDataResponse?.StatusCode?.AdditionalInfo : pushEvseDataResponse?.StatusCode?.Description}' '${String(requestError?.message)}`,
        module: MODULE_NAME, method: 'pushEvseData',
        detailedMessages: {
          response: pushEvseDataResponse,
          error: requestError?.message,
          stack: requestError?.stack,
          payload: payload
        }
      });
    }
    return pushEvseDataResponse;
  }

  /**
   * Push EVSE Status
   *
   * @param evseStatuses
   * @param actionType
   */
  public async pushEvseStatus(evseStatuses: OICPEvseStatusRecord[], actionType: OICPActionType): Promise<OICPAcknowledgment> {
    this.axiosInstance.defaults.httpsAgent = await this.getHttpsAgent(ServerAction.OICP_CREATE_AXIOS_INSTANCE);
    let pushEvseStatusResponse: OICPAcknowledgment;
    let requestError: any;
    // Check for input parameter
    if (!evseStatuses) {
      throw new BackendError({
        action: ServerAction.OICP_PUSH_EVSE_STATUSES,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'pushEvseStatus',
      });
    }
    // Get EVSE Status endpoint url
    const fullUrl = this.getEndpointUrl('statuses', ServerAction.OICP_PUSH_EVSE_STATUSES);
    // Build payload
    const operatorEvseStatus: OICPOperatorEvseStatus = {} as OICPOperatorEvseStatus;
    operatorEvseStatus.OperatorID = this.getOperatorID(ServerAction.OICP_PUSH_EVSE_STATUSES);
    operatorEvseStatus.OperatorName = this.tenant.name;
    operatorEvseStatus.EvseStatusRecord = evseStatuses;
    const payload: OICPPushEvseStatusCpoSend = {} as OICPPushEvseStatusCpoSend;
    payload.ActionType = actionType;
    payload.OperatorEvseStatus = operatorEvseStatus;
    // Log
    await Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_EVSE_STATUSES,
      message: `Push EVSE statuses from tenant: ${this.tenant.id}`,
      module: MODULE_NAME, method: 'pushEvseStatus',
      detailedMessages: { payload }
    });
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      pushEvseStatusResponse = response.data;
    } catch (error) {
      pushEvseStatusResponse = error.response?.data;
      requestError = error;
    }
    if (!pushEvseStatusResponse?.Result || pushEvseStatusResponse?.Result !== true) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_PUSH_EVSE_STATUSES,
        message: `'pushEvseStatus' Error: '${pushEvseStatusResponse?.StatusCode?.AdditionalInfo ? pushEvseStatusResponse?.StatusCode?.AdditionalInfo : pushEvseStatusResponse?.StatusCode?.Description}' '${String(requestError?.message)}`,
        module: MODULE_NAME, method: 'pushEvseStatus',
        detailedMessages: {
          response: pushEvseStatusResponse,
          error: requestError?.message,
          stack: requestError?.stack,
          payload: payload
        }
      });
    }
    return pushEvseStatusResponse;
  }

  /**
   * ERoaming Authorize Start
   *
   * @param tagID
   * @param transactionId
   */
  public async authorizeStart(tagID: string, transactionId?: number): Promise<OICPAuthorizeStartCpoReceive> {
    this.axiosInstance.defaults.httpsAgent = await this.getHttpsAgent(ServerAction.OICP_CREATE_AXIOS_INSTANCE);
    let authorizeResponse: OICPAuthorizeStartCpoReceive;
    let requestError: any;
    if (!tagID) {
      throw new BackendError({
        action: ServerAction.OICP_AUTHORIZE_START,
        message: 'No Tag ID for OICP Authorization',
        module: MODULE_NAME, method: 'authorizeStart'
      });
    }
    const identification = OICPUtils.convertTagID2OICPIdentification(tagID);
    // Get authorize start endpoint url
    const fullUrl = this.getEndpointUrl('authorizeStart', ServerAction.OICP_AUTHORIZE_START);
    // Build payload
    const payload: OICPAuthorizeStartCpoSend = {} as OICPAuthorizeStartCpoSend;
    payload.SessionID; // Optional
    if (transactionId) {
      payload.CPOPartnerSessionID = String(transactionId); // Optional
    }
    payload.EMPPartnerSessionID; // Optional
    payload.EvseID; // Optional
    payload.Identification = identification;
    payload.PartnerProductID; // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_AUTHORIZE_START);
    // Log
    await Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_AUTHORIZE_START,
      message: 'Start Authorization',
      module: MODULE_NAME, method: 'authorizeStart',
      detailedMessages: { payload }
    });
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      authorizeResponse = response.data;
    } catch (error) {
      authorizeResponse = error.response?.data;
      requestError = error;
    }
    if (requestError) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_AUTHORIZE_START,
        message: `'authorizeStart' Error: '${authorizeResponse?.StatusCode?.AdditionalInfo ? authorizeResponse?.StatusCode?.AdditionalInfo : authorizeResponse?.StatusCode?.Description}' '${String(requestError?.message)}`,
        module: MODULE_NAME, method: 'authorizeStart',
        detailedMessages: {
          response: authorizeResponse,
          error: requestError?.message,
          stack: requestError?.stack,
          payload: payload
        }
      });
    }
    if (authorizeResponse?.AuthorizationStatus !== OICPAuthorizationStatus.Authorized) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_AUTHORIZE_START,
        module: MODULE_NAME, method: 'authorizeStart',
        message: `User with Authorization '${tagID}' cannot ${TransactionAction.START} Transaction through OICP protocol due to missing Authorization`,
        detailedMessages: {
          response: authorizeResponse
        }
      });
    } else {
      // Log
      await Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.OICP_AUTHORIZE_START,
        message: `User with Authorization '${tagID}' authorized through OICP protocol`,
        module: MODULE_NAME, method: 'authorizeStart',
        detailedMessages: { authorizeResponse }
      });
    }
    return authorizeResponse;
  }

  /**
   * ERoaming Authorize Stop
   *
   * @param transaction
   */
  public async authorizeStop(transaction: Transaction): Promise<OICPAuthorizeStopCpoReceive> {
    const user = transaction.user;
    let authorizeResponse: OICPAuthorizeStopCpoReceive;
    let requestError: any;
    // Check for input parameter
    if (!transaction.oicpData.session) {
      throw new BackendError({
        action: ServerAction.OICP_AUTHORIZE_STOP,
        message: 'Invalid parameters',
        module: MODULE_NAME, method: 'authorizeStop',
        user: transaction.user
      });
    }
    // Get authorize stop endpoint url
    const fullUrl = this.getEndpointUrl('authorizeStop', ServerAction.OICP_AUTHORIZE_STOP);
    // Build payload
    const payload: OICPAuthorizeStopCpoSend = {} as OICPAuthorizeStopCpoSend;
    payload.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      payload.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    payload.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_AUTHORIZE_STOP);
    payload.EvseID = transaction.oicpData.session.evse.EvseID; // Optional
    payload.Identification = transaction.oicpData.session.identification;
    // Log
    await Logging.logDebug({
      tenantID: this.tenant.id,
      user: user,
      action: ServerAction.OICP_AUTHORIZE_STOP,
      message: 'Stop Authorization',
      module: MODULE_NAME, method: 'authorizeStop',
      detailedMessages: { payload }
    });
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      authorizeResponse = response.data;
    } catch (error) {
      authorizeResponse = error.response?.data;
      requestError = error;
    }
    if (requestError) {
      await Logging.logError({
        tenantID: this.tenant.id,
        user: user,
        action: ServerAction.OICP_AUTHORIZE_STOP,
        message: `'authorizeStop' Error: '${authorizeResponse?.StatusCode?.AdditionalInfo ? authorizeResponse?.StatusCode?.AdditionalInfo : authorizeResponse?.StatusCode?.Description}' '${String(requestError?.message)}'`,
        module: MODULE_NAME, method: 'authorizeStop',
        detailedMessages: {
          response: authorizeResponse,
          error: requestError?.message,
          stack: requestError?.stack,
          payload: payload
        }
      });
    }
    if (authorizeResponse?.AuthorizationStatus !== OICPAuthorizationStatus.Authorized) {
      await Logging.logError({
        tenantID: this.tenant.id,
        user: user,
        action: ServerAction.OICP_AUTHORIZE_STOP,
        module: MODULE_NAME, method: 'authorizeStop',
        message: `User '${user.id}' cannot ${TransactionAction.STOP} Transaction through OICP protocol due to missing Authorization`,
        detailedMessages: {
          response: authorizeResponse
        }
      });
    } else {
      // Log
      await Logging.logInfo({
        tenantID: this.tenant.id,
        user: user,
        action: ServerAction.OICP_AUTHORIZE_STOP,
        message: `'authorizeStop': '${authorizeResponse?.AuthorizationStatus}'`,
        module: MODULE_NAME, method: 'authorizeStop',
        detailedMessages: { authorizeResponse }
      });
    }
    return authorizeResponse;
  }

  /**
   * ERoaming Push Charge Detail Record
   *
   * @param transaction
   */
  public async pushCdr(transaction: Transaction): Promise<OICPAcknowledgment> {
    let pushCdrResponse: OICPAcknowledgment;
    let requestError: any;
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_CDRS,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'pushCdr',
        user: transaction.user
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_CDRS,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'pushCdr',
        user: transaction.user
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_PUSH_CDRS,
        message: `OICP Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') not stopped`,
        module: MODULE_NAME, method: 'pushCdr',
        user: transaction.user
      });
    }
    // Get CDR endpoint url
    const fullUrl = this.getEndpointUrl('cdr', ServerAction.OICP_PUSH_CDRS);
    const cdr: OICPChargeDetailRecord = {} as OICPChargeDetailRecord;
    cdr.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      cdr.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    cdr.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    cdr.EvseID = transaction.oicpData.session.evse.EvseID;
    cdr.Identification = transaction.oicpData.session.identification;
    cdr.ChargingStart = transaction.timestamp;
    cdr.ChargingEnd = transaction.stop.timestamp;
    cdr.SessionStart = transaction.oicpData.session.start_datetime;
    cdr.SessionEnd = transaction.oicpData.session.end_datetime;
    cdr.MeterValueStart = Utils.convertWattHourToKiloWattHour(transaction.meterStart, 3); // Optional
    cdr.MeterValueEnd = Utils.convertWattHourToKiloWattHour(transaction.stop.meterStop, 3); // Optional
    if (!Utils.isEmptyArray(transaction.oicpData.session.meterValueInBetween)) {
      cdr.MeterValueInBetween = {
        meterValues: transaction.oicpData.session.meterValueInBetween.map(
          (wattHour) => Utils.convertWattHourToKiloWattHour(wattHour, 3))
      }; // Optional
    }
    cdr.ConsumedEnergy = Utils.convertWattHourToKiloWattHour(transaction.stop.totalConsumptionWh, 3); // In kW.h
    cdr.SignedMeteringValues; // Optional
    cdr.CalibrationLawVerificationInfo; // Optional
    cdr.HubOperatorID; // Optional
    cdr.HubProviderID; // Optional
    transaction.oicpData.cdr = cdr;
    const payload: OICPChargeDetailRecord = transaction.oicpData.cdr;
    // Log
    await Logging.logDebug({
      tenantID: this.tenant.id,
      user: transaction.user,
      action: ServerAction.OICP_PUSH_CDRS,
      message: `Post CDR of OICP Transaction ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') at ${fullUrl}`,
      module: MODULE_NAME, method: 'pushCdr',
      detailedMessages: { payload: transaction.oicpData.cdr }
    });
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      pushCdrResponse = response.data;
    } catch (error) {
      pushCdrResponse = error.response?.data;
      requestError = error;
    }
    if (!pushCdrResponse?.Result || pushCdrResponse?.Result !== true) {
      await Logging.logError({
        tenantID: this.tenant.id,
        user: transaction.user,
        action: ServerAction.OICP_PUSH_CDRS,
        message: `'pushCdr' Error: '${pushCdrResponse?.StatusCode?.AdditionalInfo ? pushCdrResponse?.StatusCode?.AdditionalInfo : pushCdrResponse?.StatusCode?.Description}' '${String(requestError?.message)}`,
        module: MODULE_NAME, method: 'pushCdr',
        detailedMessages: {
          response: pushCdrResponse,
          error: requestError?.message,
          stack: requestError?.stack,
          payload: payload
        }
      });
    } else {
      await Logging.logInfo({
        tenantID: this.tenant.id,
        user: transaction.user,
        action: ServerAction.OICP_PUSH_CDRS,
        message: `Push CDR of OICP Transaction ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') response retrieved from ${fullUrl}`,
        module: MODULE_NAME, method: 'pushCdr',
        detailedMessages: { response: pushCdrResponse }
      });
    }
    return pushCdrResponse;
  }

  /**
   * Send Charging Notification Start
   *
   * @param transaction
   */
  public async sendChargingNotificationStart(transaction: Transaction): Promise<OICPAcknowledgment> {
    let notificationStartResponse: OICPAcknowledgment;
    let requestError: any;
    // Check for input parameter
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationStart',
        user: transaction.user
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationStart',
        user: transaction.user
      });
    }
    // Get notification endpoint url
    const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START);
    // Build payload
    const payload: OICPChargingNotificationStartCpoSend = {} as OICPChargingNotificationStartCpoSend;
    payload.Type = OICPChargingNotification.Start;
    payload.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      payload.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    payload.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    payload.Identification = transaction.oicpData.session.identification; // Optional
    payload.EvseID = transaction.oicpData.session.evse.EvseID;
    payload.ChargingStart = transaction.timestamp;
    payload.SessionStart = transaction.oicpData.session.start_datetime; // Optional
    payload.MeterValueStart = Utils.convertWattHourToKiloWattHour(transaction.meterStart, 3); // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START); // Optional
    payload.PartnerProductID; // Optional
    // Log
    await Logging.logDebug({
      tenantID: this.tenant.id,
      user: transaction.user,
      action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START,
      message: `Send Charging Notification Start for EVSE: ${payload.EvseID}`,
      module: MODULE_NAME, method: 'sendChargingNotificationStart',
      detailedMessages: { payload }
    });
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      notificationStartResponse = response.data;
    } catch (error) {
      notificationStartResponse = error.response?.data;
      requestError = error;
    }
    if (!notificationStartResponse?.Result || notificationStartResponse?.Result !== true) {
      await Logging.logWarning({
        tenantID: this.tenant.id,
        user: transaction.user,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_START,
        message: `'sendChargingNotificationStart' Error: '${notificationStartResponse?.StatusCode?.AdditionalInfo ? notificationStartResponse?.StatusCode?.AdditionalInfo : notificationStartResponse?.StatusCode?.Description}' '${String(requestError?.message)}`,
        module: MODULE_NAME, method: 'sendChargingNotificationStart',
        detailedMessages: {
          response: notificationStartResponse,
          error: requestError?.message,
          stack: requestError?.stack,
          payload: payload
        }
      });
    }
    return notificationStartResponse;
  }

  /**
   * Send Charging Notification Progress
   *
   * @param transaction
   */
  public async sendChargingNotificationProgress(transaction: Transaction): Promise<OICPAcknowledgment> {
    if (this.checkProgressUpdateInterval(transaction)) {
      let notificationProgressResponse: OICPAcknowledgment;
      let requestError: any;
      // Check for input parameter
      if (!transaction.oicpData) {
        throw new BackendError({
          source: transaction.chargeBoxID,
          action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS,
          message: `OICP data does not exists on Session ID '${transaction.id}'`,
          module: MODULE_NAME, method: 'sendChargingNotificationProgress',
          user: transaction.user
        });
      }
      if (!transaction.oicpData.session) {
        throw new BackendError({
          source: transaction.chargeBoxID,
          action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS,
          message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
          module: MODULE_NAME, method: 'sendChargingNotificationProgress',
          user: transaction.user
        });
      }
      // Get notification endpoint url
      const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS);
      // Build payload
      const payload: OICPChargingNotificationProgressCpoSend = {} as OICPChargingNotificationProgressCpoSend;
      payload.Type = OICPChargingNotification.Progress;
      payload.SessionID = transaction.oicpData.session.id;
      if (transaction.id) {
        payload.CPOPartnerSessionID = String(transaction.id); // Optional
      }
      payload.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
      payload.Identification = transaction.oicpData.session.identification; // Optional
      payload.EvseID = transaction.oicpData.session.evse.EvseID;
      payload.ChargingStart = transaction.timestamp;
      payload.EventOccurred = transaction.currentTimestamp;
      payload.ChargingDuration = Utils.createDecimal(transaction.currentTimestamp.getTime()).minus(transaction.timestamp.getTime()).toNumber(); // Optional Duration in milliseconds (Integer). Charging Duration = EventOccurred - Charging Duration. Same as transaction.currentTotalDurationSecs * 1000?
      payload.SessionStart = transaction.oicpData.session.start_datetime; // Optional
      payload.ConsumedEnergyProgress = Utils.convertWattHourToKiloWattHour(transaction.currentTotalConsumptionWh, 3); // In kW.h Optional
      payload.MeterValueStart = Utils.convertWattHourToKiloWattHour(transaction.meterStart, 3); // Optional
      payload.OperatorID = this.getOperatorID(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS); // Optional
      payload.PartnerProductID; // Optional
      // Log
      await Logging.logDebug({
        tenantID: this.tenant.id,
        user: transaction.user,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS,
        message: `Send Charging Notification Progress for EVSE: ${payload.EvseID}`,
        module: MODULE_NAME, method: 'sendChargingNotificationProgress',
        detailedMessages: { payload }
      });
      // Call Hubject
      try {
        const response = await this.axiosInstance.post(fullUrl, payload);
        notificationProgressResponse = response.data;
      } catch (error) {
        notificationProgressResponse = error.response?.data;
        requestError = error;
      }
      transaction.oicpData.session.last_progress_notification = new Date();
      if (!notificationProgressResponse?.Result || notificationProgressResponse?.Result !== true) {
        await Logging.logWarning({
          tenantID: this.tenant.id,
          user: transaction.user,
          action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_PROGRESS,
          message: `'sendChargingNotificationProgress' Error: '${notificationProgressResponse?.StatusCode?.AdditionalInfo ? notificationProgressResponse?.StatusCode?.AdditionalInfo : notificationProgressResponse?.StatusCode?.Description}' '${String(requestError?.message)}`,
          module: MODULE_NAME, method: 'sendChargingNotificationProgress',
          detailedMessages: {
            response: notificationProgressResponse,
            payload: payload,
            error: requestError?.message,
            stack: requestError?.stack
          }
        });
      }
      return notificationProgressResponse;
    }
  }

  /**
   * Send Charging Notification End
   *
   * @param transaction
   */
  public async sendChargingNotificationEnd(transaction: Transaction): Promise<OICPAcknowledgment> {
    let notificationEndResponse: OICPAcknowledgment;
    let requestError: any;
    // Check for input parameter
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
        user: transaction.user
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
        user: transaction.user
      });
    }
    if (!transaction.stop) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: `OICP Session ID '${transaction.oicpData.session.id}' (ID '${transaction.id}') not stopped`,
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
        user: transaction.user
      });
    }
    // Get notification endpoint url
    const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END);
    // Build payload
    const payload: OICPChargingNotificationEndCpoSend = {} as OICPChargingNotificationEndCpoSend;
    payload.Type = OICPChargingNotification.End;
    payload.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      payload.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    payload.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    payload.Identification = transaction.oicpData.session.identification; // Optional
    payload.EvseID = transaction.oicpData.session.evse.EvseID;
    payload.ChargingStart = transaction.timestamp; // Optional
    payload.ChargingEnd = transaction.stop.timestamp;
    payload.SessionStart = transaction.oicpData.session.start_datetime; // Optional
    payload.SessionEnd = transaction.oicpData.session.end_datetime; // Optional
    payload.ConsumedEnergy = Utils.convertWattHourToKiloWattHour(transaction.stop.totalConsumptionWh, 3);
    payload.MeterValueStart = Utils.convertWattHourToKiloWattHour(transaction.meterStart, 3); // Optional. kw or kWh?
    payload.MeterValueEnd = Utils.convertWattHourToKiloWattHour(transaction.stop.meterStop, 3); // Optional. kW or kWh?
    payload.MeterValueInBetween = {
      meterValues: transaction.oicpData.session.meterValueInBetween.map(
        (wattHour) => Utils.convertWattHourToKiloWattHour(wattHour, 3))
    }; // Optional
    payload.OperatorID = this.getOperatorID(ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END); // Optional
    payload.PartnerProductID; // Optional
    payload.PenaltyTimeStart = transaction.stop.timestamp; // Optional
    // Log
    await Logging.logDebug({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
      message: `Send Charging Notification End for EVSE: ${payload.EvseID}`,
      module: MODULE_NAME, method: 'sendChargingNotificationEnd',
      detailedMessages: { payload }
    });
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      notificationEndResponse = response.data;
    } catch (error) {
      notificationEndResponse = error.response?.data;
      requestError = error;
    }
    if (!notificationEndResponse?.Result || notificationEndResponse?.Result !== true) {
      await Logging.logWarning({
        tenantID: this.tenant.id,
        user: transaction.user,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_END,
        message: `'sendChargingNotificationEnd' Error: '${notificationEndResponse?.StatusCode?.AdditionalInfo ? notificationEndResponse?.StatusCode?.AdditionalInfo : notificationEndResponse?.StatusCode?.Description}' '${String(requestError?.message)}`,
        module: MODULE_NAME, method: 'sendChargingNotificationEnd',
        detailedMessages: {
          response: notificationEndResponse,
          error: requestError?.message,
          stack: requestError?.stack,
          payload: payload
        }
      });
    }
    return notificationEndResponse;
  }

  /**
   * Send Charging Notification Error
   *
   * @param transaction
   * @param error
   * @param errorAdditionalInfo
   */
  public async sendChargingNotificationError(transaction: Transaction, error: OICPErrorClass, errorAdditionalInfo?: string): Promise<OICPAcknowledgment> {
    let notificationErrorResponse: OICPAcknowledgment;
    let requestError: any;
    // Check for input parameter
    if (!transaction.oicpData) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR,
        message: `OICP data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationError',
        user: transaction.user
      });
    }
    if (!transaction.oicpData.session) {
      throw new BackendError({
        source: transaction.chargeBoxID,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR,
        message: `OICP Session data does not exists on Session ID '${transaction.id}'`,
        module: MODULE_NAME, method: 'sendChargingNotificationError',
        user: transaction.user
      });
    }
    // Get notification endpoint url
    const fullUrl = this.getEndpointUrl('notifications', ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR);
    // Build payload
    const payload: OICPChargingNotificationErrorCpoSend = {} as OICPChargingNotificationErrorCpoSend;
    payload.Type = OICPChargingNotification.Error;
    payload.SessionID = transaction.oicpData.session.id;
    if (transaction.id) {
      payload.CPOPartnerSessionID = String(transaction.id); // Optional
    }
    payload.EMPPartnerSessionID = transaction.oicpData.session.empPartnerSessionID; // Optional
    payload.Identification = transaction.oicpData.session.identification; // Optional
    payload.EvseID = transaction.oicpData.session.evse.EvseID;
    payload.ErrorType = error;
    payload.ErrorAdditionalInfo = errorAdditionalInfo; // Optional
    // Log
    await Logging.logDebug({
      tenantID: this.tenant.id,
      user: transaction.user,
      action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR,
      message: `Send Charging Notification Error for EVSE: ${payload.EvseID}`,
      module: MODULE_NAME, method: 'sendChargingNotificationError',
      detailedMessages: { payload }
    });
    // Call Hubject
    try {
      const response = await this.axiosInstance.post(fullUrl, payload);
      notificationErrorResponse = response.data;
    } catch (err) {
      notificationErrorResponse = err.response?.data;
      requestError = err;
    }
    if (!notificationErrorResponse?.Result || notificationErrorResponse?.Result !== true) {
      await Logging.logWarning({
        tenantID: this.tenant.id,
        user: transaction.user,
        action: ServerAction.OICP_SEND_CHARGING_NOTIFICATION_ERROR,
        message: `'sendChargingNotificationError' Error: '${notificationErrorResponse?.StatusCode?.AdditionalInfo ? notificationErrorResponse?.StatusCode?.AdditionalInfo : notificationErrorResponse?.StatusCode?.Description}' '${String(requestError?.message)}`,
        module: MODULE_NAME, method: 'sendChargingNotificationError',
        detailedMessages: {
          response: notificationErrorResponse,
          error: requestError?.message,
          stack: requestError?.stack,
          payload: payload
        }
      });
    }
    return notificationErrorResponse;
  }

  /**
   * Ping OICP Endpoint
   */
  public async ping(): Promise<any> {
    const pingResult: any = {};
    // Try to access base Url (GET .../versions)
    // Access versions API
    try {
      // Get versions
      const response = await this.pingEvseEndpoint();
      // Check response
      if (!response.Result || !(response.StatusCode.Code === OICPStatusCode.Code000)) {
        pingResult.statusCode = StatusCodes.PRECONDITION_FAILED;
        pingResult.statusText = `Invalid response from POST ${this.getEndpointUrl('evses',ServerAction.OICP_PUSH_EVSE_DATA)}`;
      } else {
        pingResult.statusCode = response.StatusCode.Code;
        pingResult.statusText = response.StatusCode.Description;
      }
    } catch (error) {
      pingResult.message = error.message;
      pingResult.statusCode = (error.response) ? error.response.status : HTTPError.GENERAL_ERROR;
    }
    // Return result
    return pingResult;
  }

  /**
   * POST to EVSE Endpoint without EVSEs
   */
  private async pingEvseEndpoint(): Promise<any> {
    await Logging.logInfo({
      tenantID: this.tenant.id,
      action: ServerAction.OICP_PUSH_EVSE_DATA,
      message: `Ping Hubject at ${this.getEndpointUrl('evses',ServerAction.OICP_PUSH_EVSE_DATA)}`,
      module: MODULE_NAME, method: 'pingEvseEndpoint'
    });
    const response = await this.pushEvseData([], OICPActionType.INSERT);
    return response;
  }

  // Get ChargeBoxIDs in failure from previous job
  private getChargeBoxIDsInFailure(): string[] {
    if (this.oicpEndpoint.lastPatchJobResult && this.oicpEndpoint.lastPatchJobResult.chargeBoxIDsInFailure) {
      return this.oicpEndpoint.lastPatchJobResult.chargeBoxIDsInFailure;
    }
    return [];
  }

  private checkProgressUpdateInterval(transaction: Transaction): boolean {
    // Hubject restriction: "Progress Notification can be sent only at interval of at least 300 seconds." (5 Minutes)
    let lastProgressUpdate = 0;
    if (transaction.oicpData.session.last_progress_notification) {
      const currentTime = new Date().getTime();
      const lastProgressUpdateTime = transaction.oicpData.session.last_progress_notification.getTime();
      lastProgressUpdate = ((currentTime - lastProgressUpdateTime) / 1000); // Difference in seconds
    }
    if (lastProgressUpdate >= Constants.OICP_PROGRESS_NOTIFICATION_MAX_INTERVAL || lastProgressUpdate === 0) {
      return true;
    }
    return false;
  }

  // Get ChargeBoxIds with new status notifications
  private async getChargeBoxIDsWithNewStatusNotifications(): Promise<string[]> {
    // Get last job
    const lastPatchJobOn = this.oicpEndpoint.lastPatchJobOn ? this.oicpEndpoint.lastPatchJobOn : new Date();
    // Build params
    const params = { 'dateFrom': lastPatchJobOn };
    // Get last status notifications
    const statusNotificationsResult = await OCPPStorage.getStatusNotifications(this.tenant.id, params, Constants.DB_PARAMS_MAX_LIMIT);
    // Loop through notifications
    if (statusNotificationsResult.count > 0) {
      return statusNotificationsResult.result.map((statusNotification) => statusNotification.chargeBoxID);
    }
    return [];
  }
}
