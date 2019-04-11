const AbstractTenantEntity = require('./AbstractTenantEntity');
const ChargingStationClient = require('../client/ChargingStationClient');
const Utils = require('../utils/Utils');
const Logging = require('../utils/Logging');
const User = require('./User');
const Transaction = require('./Transaction');
const SiteArea = require('./SiteArea');
const Constants = require('../utils/Constants');
const Database = require('../utils/Database');
const moment = require('moment-timezone');
const Configuration = require('../utils/Configuration');
const NotificationHandler = require('../notification/NotificationHandler');
const Authorizations = require('../authorization/Authorizations');
const BackendError = require('../exception/BackendError');
const ChargingStationStorage = require('../storage/mongodb/ChargingStationStorage');
const SiteAreaStorage = require('../storage/mongodb/SiteAreaStorage');
const momentDurationFormatSetup = require("moment-duration-format");
const _configChargingStation = Configuration.getChargingStationConfig();
const tzlookup = require("tz-lookup");

momentDurationFormatSetup(moment);

class ChargingStation extends AbstractTenantEntity {
  constructor(tenantID, chargingStation) {
    super(tenantID);
    // Set it
    Database.updateChargingStation(chargingStation, this._model);
  }

  static getChargingStation(tenantID, id) {
    return ChargingStationStorage.getChargingStation(tenantID, id);
  }

  static getChargingStations(tenantID, params, limit, skip, sort) {
    return ChargingStationStorage.getChargingStations(tenantID, params, limit, skip, sort)
  }

  static getChargingStationsInError(tenantID, params, limit, skip, sort) {
    return ChargingStationStorage.getChargingStationsInError(tenantID, params, limit, skip, sort)
  }

  static addChargingStationsToSiteArea(tenantID, siteAreaID, chargingStationIDs) {
    return ChargingStationStorage.addChargingStationsToSiteArea(tenantID, siteAreaID, chargingStationIDs);
  }

  static removeChargingStationsFromSiteArea(tenantID, siteAreaID, chargingStationIDs) {
    return ChargingStationStorage.removeChargingStationsFromSiteArea(tenantID, siteAreaID, chargingStationIDs);
  }

  static getStatusNotifications(tenantID, params, limit, skip, sort) {
    return ChargingStationStorage.getStatusNotifications(tenantID, params, limit, skip, sort)
  }

  static getBootNotifications(tenantID, params, limit, skip, sort) {
    return ChargingStationStorage.getBootNotifications(tenantID, params, limit, skip, sort)
  }

  handleAction(action, params = {}) {
    // Handle Client Requests
    switch (action) {
      // Reset
      case 'Reset':
        return this.requestReset(params);

      // Clear cache
      case 'ClearCache':
        return this.requestClearCache();

      // Get Configuration
      case 'GetConfiguration':
        return this.requestGetConfiguration(params);

      // Set Configuration
      case 'ChangeConfiguration':
        // Change the config
        return this.requestChangeConfiguration(params);

      // Unlock Connector
      case 'UnlockConnector':
        return this.requestUnlockConnector(params);

      // Start Transaction
      case 'StartTransaction':
        return this.requestStartTransaction(params);

      // Stop Transaction
      case 'StopTransaction':
        return this.requestStopTransaction(params);

      case 'SetChargingProfile':
        return this.requestSetChargingProfile(params);
      case 'GetCompositeSchedule':
        return this.requestGetCompositeSchedule(params);

      case 'GetDiagnostics':
        return this.requestGetDiagnostics(params);

      case 'UpdateFirmware':
        return this.requestUpdateFirmware(params);

      case 'ChangeAvailability':
        return this.requestChangeAvailability(params);

      case 'ClearChargingProfile':
        return this.requestClearChargingProfile(params);

      // Not Exists!
      default:
        throw new BackendError(this.getID(), `Unhandled action ${action}`, "ChargingStation", "handleAction");
    }
  }

  getID() {
    return this._model.id;
  }

  setSiteArea(siteArea) {
    if (siteArea) {
      this._model.siteArea = siteArea.getModel();
      this._model.siteAreaID = siteArea.getID();
    } else {
      this._model.siteArea = null;
    }
  }

  async getSiteArea(withSite = false) {
    if (this._model.siteArea) {
      return new SiteArea(this.getTenantID(), this._model.siteArea);
    } else if (this._model.siteAreaID) {
      // Get from DB
      const siteArea = await SiteAreaStorage.getSiteArea(this.getTenantID(), this._model.siteAreaID, false, withSite);
      // Set it
      this.setSiteArea(siteArea);
      // Return
      return siteArea;
    }
  }

  getSiteAreaID() {
    return this._model.siteAreaID;
  }

  setSiteAreaID(siteAreaID) {
    this._model.siteAreaID = siteAreaID;
  }

  getChargePointVendor() {
    return this._model.chargePointVendor;
  }

  setChargePointVendor(chargePointVendor) {
    this._model.chargePointVendor = chargePointVendor;
  }

  getChargePointModel() {
    return this._model.chargePointModel;
  }

  setChargePointModel(chargePointModel) {
    this._model.chargePointModel = chargePointModel;
  }

  getCFApplicationIDAndInstanceIndex() {
    return this._model.cfApplicationIDAndInstanceIndex;
  }

  setCFApplicationIDAndInstanceIndex(cfApplicationIDAndInstanceIndex) {
    this._model.cfApplicationIDAndInstanceIndex = cfApplicationIDAndInstanceIndex;
  }

  getChargePointSerialNumber() {
    return this._model.chargePointSerialNumber;
  }

  setChargePointSerialNumber(chargePointSerialNumber) {
    this._model.chargePointSerialNumber = chargePointSerialNumber;
  }

  getChargeBoxSerialNumber() {
    return this._model.chargeBoxSerialNumber;
  }

  setChargeBoxSerialNumber(chargeBoxSerialNumber) {
    this._model.chargeBoxSerialNumber = chargeBoxSerialNumber;
  }

  setInactive(inactive) {
    this._model.inactive = inactive;
  }

  isInactive() {
    return this._model.inactive;
  }

  getNumberOfConnectedPhase() {
    return this._model.numberOfConnectedPhase;
  }

  setNumberOfConnectedPhase(numberOfConnectedPhase) {
    this._model.numberOfConnectedPhase = numberOfConnectedPhase;
  }

  getMaximumPower() {
    return this._model.maximumPower;
  }

  setMaximumPower(maximumPower) {
    this._model.maximumPower = maximumPower;
  }

  setCannotChargeInParallel(cannotChargeInParallel) {
    this._model.cannotChargeInParallel = cannotChargeInParallel;
  }

  setPowerLimitUnit(powerLimitUnit) {
    this._model.powerLimitUnit = powerLimitUnit;
  }

  getPowerLimitUnit() {
    return this._model.powerLimitUnit;
  }

  setLatitude(latitude) {
    this._model.latitude = latitude;
  }

  getLatitude() {
    return this._model.latitude;
  }

  setLongitude(longitude) {
    this._model.longitude = longitude;
  }

  getLongitude() {
    return this._model.longitude;
  }

  getTimezone() {
    if (this._model.latitude && this._model.longitude) {
      return tzlookup(this._model.latitude, this._model.longitude);
    }
  }

  canChargeInParallel() {
    return !this._model.cannotChargeInParallel;
  }

  getFirmwareVersion() {
    return this._model.firmwareVersion;
  }

  setFirmwareVersion(firmwareVersion) {
    this._model.firmwareVersion = firmwareVersion;
  }

  getIccid() {
    return this._model.iccid;
  }

  setIccid(iccid) {
    this._model.iccid = iccid;
  }

  getImsi() {
    return this._model.imsi;
  }

  setImsi(imsi) {
    this._model.imsi = imsi;
  }

  getMeterType() {
    return this._model.meterType;
  }

  setMeterType(meterType) {
    this._model.meterType = meterType;
  }

  getMeterSerialNumber() {
    return this._model.meterSerialNumber;
  }

  setMeterSerialNumber(meterSerialNumber) {
    this._model.meterSerialNumber = meterSerialNumber;
  }

  getCreatedBy() {
    if (this._model.createdBy) {
      return new User(this.getTenantID(), this._model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this._model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn) {
    this._model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this._model.lastChangedBy) {
      return new User(this.getTenantID(), this._model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this._model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this._model.lastChangedOn = lastChangedOn;
  }

  getEndPoint() {
    return this._model.endpoint;
  }

  setEndPoint(endpoint) {
    this._model.endpoint = endpoint;
  }

  getChargingStationURL() {
    return this._model.chargingStationURL;
  }

  setChargingStationURL(chargingStationURL) {
    this._model.chargingStationURL = chargingStationURL;
  }

  getOcppVersion() {
    return this._model.ocppVersion;
  }

  setOcppVersion(ocppVersion) {
    this._model.ocppVersion = ocppVersion;
  }

  getOcppProtocol() {
    return this._model.ocppProtocol;
  }

  setOcppProtocol(ocppProtocol) {
    this._model.ocppProtocol = ocppProtocol;
  }

  getChargingStationClient() {
    // Get the client
    return ChargingStationClient.getChargingStationClient(this);
  }

  getLastHeartBeat() {
    return this._model.lastHeartBeat;
  }

  setLastHeartBeat(lastHeartBeat) {
    this._model.lastHeartBeat = lastHeartBeat;
  }

  getConnectors() {
    return this._model.connectors;
  }

  getConnector(identifier) {
    if (identifier !== undefined && this._model.connectors) {
      for (const connector of this._model.connectors) {
        if (connector.connectorId === identifier) {
          return connector;
        }
      }
    }
    return undefined;
  }

  setConnectors(connectors) {
    this._model.connectors = connectors;
  }

  getLastReboot() {
    return this._model.lastReboot;
  }

  setLastReboot(lastReboot) {
    this._model.lastReboot = lastReboot;
  }

  save() {
    // Init Connectors
    if (!this.getConnectors()) {
      this.setConnectors([]);
    }
    // Save
    return ChargingStationStorage.saveChargingStation(this.getTenantID(), this.getModel());
  }

  saveHeartBeat() {
    // Save
    return ChargingStationStorage.saveChargingStationHeartBeat(this.getTenantID(), this.getModel());
  }

  saveChargingStationSiteArea() {
    // Save
    return ChargingStationStorage.saveChargingStationSiteArea(this.getTenantID(), this.getModel());
  }

  async handleStatusNotification(statusNotification) {
    // Check props
    this._checkStatusNotificationProps(statusNotification);
    // Set Header
    statusNotification.chargeBoxID = this.getID();
    statusNotification.timezone = this.getTimezone();
    // Handle connectorId = 0 case => Currently status is distributed to each individual connectors
    if (statusNotification.connectorId === 0) {
      // Log
      Logging.logWarning({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation',
        method: 'handleStatusNotification', action: 'StatusNotification',
        message: `Connector ID equals to '0' with status '${statusNotification.status}' - '${statusNotification.errorCode}' - '${statusNotification.info}'`
      });
      // Get the connectors
      const connectors = this.getConnectors();
      // Update ALL connectors
      for (let i = 0; i < connectors.length; i++) {
        // update message with proper connectorId
        statusNotification.connectorId = connectors[i].connectorId;
        // Update
        await this._updateConnectorStatus(statusNotification, true);
      }
    } else {
      // update only the given connectorId
      await this._updateConnectorStatus(statusNotification, false);
    }
  }

  _checkStatusNotificationProps(statusNotification) {
    // Check non mandatory timestamp
    if (!statusNotification.timestamp) {
      // Create
      statusNotification.timestamp = new Date().toISOString();
    }
    // Check
    statusNotification.connectorId = Utils.convertToInt(statusNotification.connectorId);
  }

  async _updateConnectorStatus(statusNotification, bothConnectorsUpdated) {
    // Get it
    const connector = this.getConnector(statusNotification.connectorId);
    if (!connector) {
      // Does not exist: Create
      connector = { connectorId: i + 1, currentConsumption: 0, status: 'Unknown', power: 0 };
      // Add
      this.getConnectors().push(connector);
      // Update Connector's Power
      this._updateConnectorsPower();
    }
    // Check if status has changed
    if (connector.status === statusNotification.status &&
        connector.errorCode === statusNotification.errorCode) {
      // No Change: Do not save it
      Logging.logWarning({
        tenantID: this.getTenantID(), source: this.getID(),
        module: 'ChargingStation', method: 'handleStatusNotification', action: 'StatusNotification',
        message: `Status on Connector '${statusNotification.connectorId}' has not changed then not saved: '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}''`
      });
      return;
    }
    // Set connector data
    connector.connectorId = statusNotification.connectorId;
    connector.status = statusNotification.status;
    connector.errorCode = statusNotification.errorCode;
    connector.info = (statusNotification.info ? statusNotification.info : '');
    connector.vendorErrorCode = (statusNotification.vendorErrorCode ? statusNotification.vendorErrorCode : '');
    // Save Status Notification
    await ChargingStationStorage.saveStatusNotification(this.getTenantID(), statusNotification);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(), source: this.getID(),
      module: 'ChargingStation', method: 'handleStatusNotification', action: 'StatusNotification',
      message: `Connector '${statusNotification.connectorId}' status '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : 'N/A')}' has been saved`
    });
    // Handle connector is available but a transaction is ongoing (ABB bug)!!!
    this._checkStatusNotificationOngoingTransaction(statusNotification, connector, bothConnectorsUpdated);
    // Notify admins
    this._notifyStatusNotification(statusNotification);
    // Save Connector
    await ChargingStationStorage.saveChargingStationConnector(this.getTenantID(), this.getModel(), statusNotification.connectorId);
  }

  async _notifyStatusNotification(statusNotification) {
    // Faulted?
    if (statusNotification.status === Constants.CONN_STATUS_FAULTED) {
      // Log
      Logging.logError({
        tenantID: this.getTenantID(), source: this.getID(), module: 'ChargingStation',
        method: '_notifyStatusNotification', action: 'StatusNotification',
        message: `Error on Connector '${statusNotification.connectorId}': '${statusNotification.status}' - '${statusNotification.errorCode}' - '${(statusNotification.info ? statusNotification.info : "N/A")}'`
      });
      // Send Notification
      NotificationHandler.sendChargingStationStatusError(
        this.getTenantID(),
        Utils.generateGUID(),
        this.getModel(),
        {
          'chargeBoxID': this.getID(),
          'connectorId': statusNotification.connectorId,
          'error': `${statusNotification.status} - ${statusNotification.errorCode} - ${(statusNotification.info ? statusNotification.info : "N/A")}`,
          'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain()),
          'evseDashboardChargingStationURL': await Utils.buildEvseChargingStationURL(this, statusNotification.connectorId)
        },
        {
          'connectorId': statusNotification.connectorId,
          'error': `${statusNotification.status} - ${statusNotification.errorCode} - ${statusNotification.info}`,
        }
      );
    }
  }

  async _checkStatusNotificationOngoingTransaction(statusNotification, connector, bothConnectorsUpdated) {
    // Check the status
    if (!bothConnectorsUpdated &&
        connector.activeTransactionID > 0 &&
        (statusNotification.status === Constants.CONN_STATUS_AVAILABLE || statusNotification.status === Constants.CONN_STATUS_FINISHING)) {
      // Cleanup connector transaction data
      this._cleanupConnectorTransactionInfo(statusNotification.connectorId);
      // Check transaction
      const activeTransaction = await Transaction.getActiveTransaction(this.getTenantID(), this.getID(), statusNotification.connectorId);
      // Found?
      if (activeTransaction) {
        // Has consumption?
        if (activeTransaction.getCurrentTotalConsumption() <= 0) {
          // No consumption: delete
          Logging.logError({
            tenantID: this.getTenantID(),
            source: this.getID(), module: 'ChargingStation', method: '_checkStatusNotificationOngoingTransaction',
            action: 'StartTransaction', actionOnUser: activeTransaction.getUserID(),
            message: `Pending Transaction ID '${activeTransaction.getID()}' has been deleted on Connector '${activeTransaction.getConnectorId()}'`
          });
          // Delete
          await activeTransaction.delete();
        } else {
          // Has consumption: close it!
          Logging.logWarning({
            tenantID: this.getTenantID(),
            source: this.getID(), module: 'ChargingStation', method: '_checkStatusNotificationOngoingTransaction',
            action: 'StatusNotification', actionOnUser: activeTransaction.getUserID(),
            message: `Active Transaction ID '${activeTransaction.getID()}' has been closed on Connector '${activeTransaction.getConnectorId()}'`
          });
          // Stop
          await activeTransaction.stopTransaction(activeTransaction.getUserID(), activeTransaction.getTagID(),
            activeTransaction.getLastMeterValue().value + 1, new Date(statusNotification.timestamp));
          // Save Transaction
          await activeTransaction.save();
        }
        // Clean up connector
        await this._checkAndFreeConnector(activeTransaction.getConnectorId(), true);
      }
    }
  }

  async _updateConnectorsPower() {
    let voltageRerefence = 0;
    let current = 0;
    let nbPhase = 0;
    let power = 0;
    let totalPower = 0;

    // Only for Schneider
    if (this.getChargePointVendor() === 'Schneider Electric') {
      // Get the configuration
      const configuration = await this.getConfiguration();
      // Config Provided?
      if (configuration && configuration.configuration) {
        // Search for params
        for (let i = 0; i < configuration.configuration.length; i++) {
          // Check
          switch (configuration.configuration[i].key) {
            // Voltage
            case 'voltagererefence':
              // Get the meter interval
              voltageRerefence = parseInt(configuration.configuration[i].value);
              break;

            // Current
            case 'currentpb1':
              // Get the meter interval
              current = parseInt(configuration.configuration[i].value);
              break;

            // Nb Phase
            case 'nbphase':
              // Get the meter interval
              nbPhase = parseInt(configuration.configuration[i].value);
              break;
          }
        }
        // Override?
        if (this.getNumberOfConnectedPhase()) {
          // Yes
          nbPhase = this.getNumberOfConnectedPhase();
        }
        // Compute it
        if (voltageRerefence && current && nbPhase) {
          // One Phase?
          if (nbPhase == 1) {
            power = Math.floor(230 * current);
          } else {
            power = Math.floor(400 * current * Math.sqrt(nbPhase));
          }
        }
      }
      // Set Power
      for (const connector of this.getConnectors()) {
        if (connector) {
          connector.power = power;
          totalPower += power;
        }
      }
      // Set total power
      if (totalPower && !this.getMaximumPower()) {
        // Set
        this.setMaximumPower(totalPower);
      }
    }
  }

  async handleBootNotification(bootNotification) {
    // Set the Station ID
    bootNotification.chargeBoxID = this.getID();
    // Send Notification
    NotificationHandler.sendChargingStationRegistered(
      this.getTenantID(),
      Utils.generateGUID(),
      this.getModel(),
      {
        'chargeBoxID': this.getID(),
        'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain()),
        'evseDashboardChargingStationURL': await Utils.buildEvseChargingStationURL(this)
      }
    );
    // Save Boot Notification
    await ChargingStationStorage.saveBootNotification(this.getTenantID(), bootNotification);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(),
      module: 'ChargingStation', method: 'handleBootNotification',
      action: 'BootNotification', message: `Boot notification saved`
    });
    // Handle the get of configuration later on
    setTimeout(() => {
      // Get config and save it
      this.requestAndSaveConfiguration();
    }, 3000);
  }

  async handleHeartBeat() {
    // Set Heartbeat
    this.setLastHeartBeat(new Date());
    // Save
    await this.saveHeartBeat();
    // Update Charger Max Power?
    if (!this.getMaximumPower()) {
      // Yes
      await this._updateConnectorsPower();
      // Save Charger
      await this.save();
    }
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(),
      module: 'ChargingStation', method: 'handleHeartBeat',
      action: 'Heartbeat', message: `Heartbeat saved`
    });
  }

  async requestAndSaveConfiguration() {
    let configuration = null;
    try {
      // In case of error. the boot should no be denied
      configuration = await this.requestGetConfiguration({});
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation',
        method: 'requestAndSaveConfiguration', action: 'RequestConfiguration',
        message: `Command sent with success`,
        detailedMessages: configuration
      });
      // Override with Conf
      configuration = {
        'configuration': configuration.configurationKey
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(this.getTenantID(), 'RequestConfiguration', error);
    }
    // Set default?
    if (!configuration) {
      // Check if there is an already existing config
      const existingConfiguration = await this.getConfiguration();
      if (!existingConfiguration) {
        // No config at all: Set default OCCP configuration
        configuration = {
          'configuration': [
            {'key': 'AllowOfflineTxForUnknownId', 'readonly': false, 'value': null},
            {'key': 'AuthorizationCacheEnabled', 'readonly': false, 'value': null},
            {'key': 'AuthorizeRemoteTxRequests', 'readonly': false, 'value': null},
            {'key': 'BlinkRepeat', 'readonly': false, 'value': null},
            {'key': 'ClockAlignedDataInterval', 'readonly': false, 'value': null},
            {'key': 'ConnectionTimeOut', 'readonly': false, 'value': null},
            {'key': 'GetConfigurationMaxKeys', 'readonly': false, 'value': null},
            {'key': 'HeartbeatInterval', 'readonly': false, 'value': null},
            {'key': 'LightIntensity', 'readonly': false, 'value': null},
            {'key': 'LocalAuthorizeOffline', 'readonly': false, 'value': null},
            {'key': 'LocalPreAuthorize', 'readonly': false, 'value': null},
            {'key': 'MaxEnergyOnInvalidId', 'readonly': false, 'value': null},
            {'key': 'MeterValuesAlignedData', 'readonly': false, 'value': null},
            {'key': 'MeterValuesAlignedDataMaxLength', 'readonly': false, 'value': null},
            {'key': 'MeterValuesSampledData', 'readonly': false, 'value': null},
            {'key': 'MeterValuesSampledDataMaxLength', 'readonly': false, 'value': null},
            {'key': 'MeterValueSampleInterval', 'readonly': false, 'value': null},
            {'key': 'MinimumStatusDuration', 'readonly': false, 'value': null},
            {'key': 'NumberOfConnectors', 'readonly': false, 'value': null},
            {'key': 'ResetRetries', 'readonly': false, 'value': null},
            {'key': 'ConnectorPhaseRotation', 'readonly': false, 'value': null},
            {'key': 'ConnectorPhaseRotationMaxLength', 'readonly': false, 'value': null},
            {'key': 'StopTransactionOnEVSideDisconnect', 'readonly': false, 'value': null},
            {'key': 'StopTransactionOnInvalidId', 'readonly': false, 'value': null},
            {'key': 'StopTxnAlignedData', 'readonly': false, 'value': null},
            {'key': 'StopTxnAlignedDataMaxLength', 'readonly': false, 'value': null},
            {'key': 'StopTxnSampledData', 'readonly': false, 'value': null},
            {'key': 'StopTxnSampledDataMaxLength', 'readonly': false, 'value': null},
            {'key': 'SupportedFeatureProfiles', 'readonly': false, 'value': null},
            {'key': 'SupportedFeatureProfilesMaxLength', 'readonly': false, 'value': null},
            {'key': 'TransactionMessageAttempts', 'readonly': false, 'value': null},
            {'key': 'TransactionMessageRetryInterval', 'readonly': false, 'value': null},
            {'key': 'UnlockConnectorOnEVSideDisconnect', 'readonly': false, 'value': null},
            {'key': 'WebSocketPingInterval', 'readonly': false, 'value': null},
            {'key': 'LocalAuthListEnabled', 'readonly': false, 'value': null},
            {'key': 'LocalAuthListMaxLength', 'readonly': false, 'value': null},
            {'key': 'SendLocalListMaxLength', 'readonly': false, 'value': null},
            {'key': 'ReserveConnectorZeroSupported', 'readonly': false, 'value': null},
            {'key': 'ChargeProfileMaxStackLevel', 'readonly': false, 'value': null},
            {'key': 'ChargingScheduleAllowedChargingRateUnit', 'readonly': false, 'value': null},
            {'key': 'ChargingScheduleMaxPeriods', 'readonly': false, 'value': null},
            {'key': 'ConnectorSwitch3to1PhaseSupported', 'readonly': false, 'value': null},
            {'key': 'MaxChargingProfilesInstalled', 'readonly': false, 'value': null}
          ]
        };
      } else {
        // Set default
        configuration = existingConfiguration;
      }
    }
    // Save it
    await this.saveConfiguration(configuration);
    // Ok
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestAndSaveConfiguration', action: 'RequestConfiguration',
      message: `Configuration has been saved`
    });
    // Update connector power
    await this._updateConnectorsPower();
    // Ok
    return {status: 'Accepted'};
  }

  async updateChargingStationConsumption(transaction) {
    // Get the connector
    const connector = this.getConnector(transaction.getConnectorId());
    // Active transaction?
    if (transaction.isActive()) {
      // Set consumption
      connector.currentConsumption = transaction.getCurrentConsumption();
      connector.totalConsumption = transaction.getCurrentTotalConsumption();
      connector.currentStateOfCharge = transaction.getCurrentStateOfCharge();
      // Set Transaction ID
      connector.activeTransactionID = transaction.getID();
      // Update Heartbeat
      this.setLastHeartBeat(new Date());
      // Handle End Of charge
      this.checkNotificationEndOfCharge(transaction);
    } else {
      // Cleanup connector transaction data
      this._cleanupConnectorTransactionInfo(transaction.getConnectorId());
    }
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'updateChargingStationConsumption', action: 'ChargingStationConsumption',
      message: `Connector '${connector.connectorId}' - Consumption ${connector.currentConsumption}, Total: ${connector.totalConsumption}, SoC: ${connector.currentStateOfCharge}`
    });
  }

  async checkNotificationEndOfCharge(transaction) {
    // Transaction in progress?
    if (transaction && transaction.isActive()) {
      // Has consumption?
      if (transaction.hasMultipleConsumptions()) {
        // --------------------------------------------------------------------
        // Notification End of charge
        // --------------------------------------------------------------------
        if (_configChargingStation.notifEndOfChargeEnabled && (transaction.getCurrentTotalInactivitySecs() > 60 || transaction.getCurrentStateOfCharge() === 100)) {
          // Notify User?
          if (transaction.getUserJson()) {
            // Send Notification
            NotificationHandler.sendEndOfCharge(
              this.getTenantID(),
              transaction.getID() + '-EOC',
              transaction.getUserJson(),
              this.getModel(),
              {
                'user': transaction.getUserJson(),
                'chargingBoxID': this.getID(),
                'connectorId': transaction.getConnectorId(),
                'totalConsumption': (transaction.getCurrentTotalConsumption() / 1000).toLocaleString(
                  (transaction.getUserJson().locale ? transaction.getUserJson().locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
                  {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
                'stateOfCharge': transaction.getCurrentStateOfCharge(),
                'totalDuration': this._buildCurrentTransactionDuration(transaction),
                'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(this, transaction.getConnectorId(), transaction.getID()),
                'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain())
              },
              transaction.getUserJson().locale,
              {
                'transactionId': transaction.getID(),
                'connectorId': transaction.getConnectorId()
              }
            );
          }
          // Check the SoC (Optimal Charge)
        } else if (_configChargingStation.notifBeforeEndOfChargeEnabled &&
          transaction.getCurrentStateOfCharge() >= _configChargingStation.notifBeforeEndOfChargePercent) {
          // Notify User?
          if (transaction.getUserJson()) {
            // Notifcation Before End Of Charge
            NotificationHandler.sendOptimalChargeReached(
              this.getTenantID(),
              transaction.getID() + '-OCR',
              transaction.getUserJson(),
              this.getModel(),
              {
                'user': transaction.getUserJson(),
                'chargingBoxID': this.getID(),
                'connectorId': transaction.getConnectorId(),
                'totalConsumption': (transaction.getCurrentTotalConsumption() / 1000).toLocaleString(
                  (transaction.getUserJson().locale ? transaction.getUserJson().locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
                  {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
                'stateOfCharge': transaction.getCurrentStateOfCharge(),
                'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(this, transaction.getConnectorId(), transaction.getID()),
                'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain())
              },
              transaction.getUserJson().locale,
              {
                'transactionId': transaction.getID(),
                'connectorId': transaction.getConnectorId()
              }
            );
          }
        }
      }
    }
  }

  // Build Inactivity
  _buildTransactionInactivity(transaction, i18nHourShort = 'h') {
    // Get total
    const totalInactivitySecs = transaction.getTotalInactivitySecs()
    // None?
    if (totalInactivitySecs === 0) {
      return `0${i18nHourShort}00 (0%)`;
    }
    // Build the inactivity percentage
    const totalInactivityPercent = Math.round((totalInactivitySecs * 100) / transaction.getTotalDurationSecs());
    // Format
    return moment.duration(totalInactivitySecs, "s").format(`h[${i18nHourShort}]mm`, {trim: false}) + ` (${totalInactivityPercent}%)`;
  }

  // Build duration
  _buildCurrentTransactionDuration(transaction) {
    return moment.duration(transaction.getCurrentTotalDurationSecs(), "s").format(`h[h]mm`, {trim: false});
  }

  // Build duration
  _buildTransactionDuration(transaction) {
    return moment.duration(transaction.getTotalDurationSecs(), "s").format(`h[h]mm`, {trim: false});
  }

  async handleMeterValues(meterValues) {
    // Check params
    this._checkMeterValuesProps(meterValues);
    // Normalize Meter Values
    const newMeterValues = this._normalizeMeterValues(meterValues)
    // Handle charger specificities
    this._checkMeterValuesCharger(newMeterValues);
    // No Values
    if (newMeterValues.values.length == 0) {
      Logging.logDebug({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleMeterValues',
        action: 'MeterValues', message: `No MeterValue to save (clocks only)`,
        detailedMessages: meterValues
      });
      // Process values
    } else {
      // Get the transaction
      const transaction = await Transaction.getTransaction(this.getTenantID(), meterValues.transactionId);
      // Handle Meter Values
      await transaction.updateWithMeterValues(newMeterValues, this.getTimezone());
      // Save Transaction
      await transaction.save();
      // Update Charging Station Consumption
      await this.updateChargingStationConsumption(transaction);
      // Save Charging Station
      await this.save();
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(), source: this.getID(),
        module: 'ChargingStation', method: 'handleMeterValues', action: 'MeterValues',
        message: `MeterValue have been saved for Transaction ID '${meterValues.transactionId}'`,
        detailedMessages: meterValues
      });
    }
  }

  _checkMeterValuesCharger(newMeterValues) {
    // Clean up Sample.Clock meter value
    if (this.getChargePointVendor() !== 'ABB' || this.getOcppVersion() !== Constants.OCPP_VERSION_15) {
      // Filter Sample.Clock meter value for all chargers except ABB using OCPP 1.5
      newMeterValues.values = newMeterValues.values.filter(value => value.attribute.context !== 'Sample.Clock');
    }
  }

  _checkMeterValuesProps(meterValues) {
    // Convert
    meterValues.connectorId = Utils.convertToInt(meterValues.connectorId);
    // Check Connector ID
    if (meterValues.connectorId === 0) {
      // BUG KEBA: Connector ID must be > 0 according OCPP
      Logging.logWarning({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: '_checkMeterValuesProps',
        action: 'MeterValues', message: `Connector ID cannot be equal to '0' and has been reset to '1'`
      });
      // Set to 1 (KEBA has only one connector)
      meterValues.connectorId = 1;
    }    
    // Check if the transaction ID matches
    const chargerTransactionId = this.getConnector(meterValues.connectorId).activeTransactionID;
    // Transaction is provided in MeterValue?
    if (meterValues.hasOwnProperty('transactionId')) {
      // Yes: Check Transaction ID (ABB)
      if (parseInt(meterValues.transactionId) !== parseInt(chargerTransactionId)) {
        // Check if valid
        if (parseInt(chargerTransactionId) > 0) {
          // No: Log that the transaction ID will be reused
          Logging.logWarning({
            tenantID: this.getTenantID(), source: this.getID(),
            module: 'ChargingStation', method: '_checkMeterValuesProps', action: 'MeterValues',
            message: `Transaction ID '${meterValues.transactionId}' not found but retrieved from StartTransaction '${chargerTransactionId}'`
          });
        }
        // Always assign, even if equals to 0
        meterValues.transactionId = chargerTransactionId;
      }
      // Transaction is not provided: check if there is a transaction assigned on the connector
    } else if (parseInt(chargerTransactionId) > 0) {
      // Yes: Use Connector's Transaction ID
      Logging.logWarning({
        tenantID: this.getTenantID(), source: this.getID(),
        module: 'ChargingStation', method: '_checkMeterValuesProps', action: 'MeterValues',
        message: `Transaction ID is not provided but retrieved from StartTransaction '${chargerTransactionId}'`
      });
      // Override it
      meterValues.transactionId = chargerTransactionId;
    }
    // Check Transaction ID
    if (!meterValues.hasOwnProperty('transactionId') || parseInt(meterValues.transactionId) === 0) {
      // Wrong Transaction ID!
      throw new BackendError(this.getID(),
        `Transaction ID '${chargerTransactionId}' is invalid on Connector '${meterValues.connectorId}', Meter Values not saved`,
        "ChargingStation", "_checkMeterValuesProps");
    }
  }

  _normalizeMeterValues(meterValues) {
    // Create the model
    const newMeterValues = {};
    newMeterValues.values = [];
    newMeterValues.chargeBoxID = this.getID();
    // OCPP 1.6
    if (this.getOcppVersion() === Constants.OCPP_VERSION_16) {
      meterValues.values = meterValues.meterValue;
    }
    // Only one value?
    if (!Array.isArray(meterValues.values)) {
      // Make it an array
      meterValues.values = [meterValues.values];
    }
    // Process the Meter Values
    for (const value of meterValues.values) {
      const newMeterValue = {};
      // Set the Meter Value header
      newMeterValue.chargeBoxID = newMeterValues.chargeBoxID;
      newMeterValue.connectorId = meterValues.connectorId;
      newMeterValue.transactionId = meterValues.transactionId;
      newMeterValue.timestamp = value.timestamp;
      // OCPP 1.6
      if (this.getOcppVersion() === Constants.OCPP_VERSION_16) {
        // Multiple Values?
        if (Array.isArray(value.sampledValue)) {
          // Create one record per value
          for (const sampledValue of value.sampledValue) {
            // Clone
            const newLocalMeterValue = JSON.parse(JSON.stringify(newMeterValue));
            // Add Attributes
            newLocalMeterValue.attribute = this._buildMeterValueAttributes(sampledValue);
            // Set the value
            newLocalMeterValue.value = parseInt(sampledValue.value);
            // Add
            newMeterValues.values.push(newLocalMeterValue);
          }
        } else {
          // Clone
          const newLocalMeterValue = JSON.parse(JSON.stringify(newMeterValue));
          // Add Attributes
          newLocalMeterValue.attribute = this._buildMeterValueAttributes(sampledValue);
          // Add
          newMeterValues.values.push(newLocalMeterValue);
        }
      // OCPP < 1.6
      } else if (value.value) {
        // OCPP 1.2
        if (value.value.$value) {
          // Set
          newMeterValue.value = value.value.$value;
          newMeterValue.attribute = value.value.attributes;
      // OCPP 1.5
      } else {
          newMeterValue.value = parseInt(value.value);
        }
        // Add
        newMeterValues.values.push(newMeterValue);
      }
    }
    return newMeterValues;
  }

  _buildMeterValueAttributes(sampledValue) {
    return {
      context: (sampledValue.context ? sampledValue.context : Constants.METER_VALUE_CTX_SAMPLE_PERIODIC),
      format: (sampledValue.format ? sampledValue.format : Constants.METER_VALUE_FORMAT_RAW),
      measurand: (sampledValue.measurand ? sampledValue.measurand : Constants.METER_VALUE_MEASURAND_IMPREG),
      location: (sampledValue.location ? sampledValue.location : Constants.METER_VALUE_LOCATION_OUTLET),
      unit: (sampledValue.unit ? sampledValue.unit : Constants.METER_VALUE_UNIT_WH),
      phase: (sampledValue.phase ? sampledValue.phase : '')
    }
  }

  saveConfiguration(configuration) {
    // Set the charger ID
    configuration.chargeBoxID = this.getID();
    configuration.timestamp = new Date();

    // Save config
    return ChargingStationStorage.saveConfiguration(this.getTenantID(), configuration);
  }

  setDeleted(deleted) {
    this._model.deleted = deleted;
  }

  isDeleted() {
    return this._model.deleted;
  }

  async delete() {
    // Check if the user has a transaction
    const result = await this.hasAtLeastOneTransaction();
    if (result) {
      // Delete logically
      // Set deleted
      this.setDeleted(true);
      // Delete
      await this.save();
    } else {
      // Delete physically
      await ChargingStationStorage.deleteChargingStation(this.getTenantID(), this.getID());
    }
  }

  async handleDataTransfer(dataTransfer) {
    // Set the charger ID
    dataTransfer.chargeBoxID = this.getID();
    dataTransfer.timestamp = new Date();
    // Save it
    await ChargingStationStorage.saveDataTransfer(this.getTenantID(), dataTransfer);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'CharingStation', method: 'handleDataTransfer',
      action: 'DataTransfer', message: `Data Transfer has been saved`
    });
  }

  async handleDiagnosticsStatusNotification(diagnosticsStatusNotification) {
    // Set the charger ID
    diagnosticsStatusNotification.chargeBoxID = this.getID();
    diagnosticsStatusNotification.timestamp = new Date();
    // Save it
    await ChargingStationStorage.saveDiagnosticsStatusNotification(this.getTenantID(), diagnosticsStatusNotification);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation', method: 'handleDiagnosticsStatusNotification',
      action: 'DiagnosticsStatusNotification', message: `Diagnostics Status Notification has been saved`
    });
  }

  async handleFirmwareStatusNotification(firmwareStatusNotification) {
    // Set the charger ID
    firmwareStatusNotification.chargeBoxID = this.getID();
    firmwareStatusNotification.timestamp = new Date();
    // Save it
    await ChargingStationStorage.saveFirmwareStatusNotification(this.getTenantID(), firmwareStatusNotification);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation', method: 'handleFirmwareStatusNotification',
      action: 'FirmwareStatusNotification', message: `Firmware Status Notification has been saved`
    });
  }

  async handleAuthorize(authorize) {
    // Set header
    authorize.chargeBoxID = this.getID();
    authorize.timestamp = new Date();
    authorize.timezone = this.getTimezone();
    // Check
    authorize.user = await Authorizations.isTagIDAuthorizedOnChargingStation(this, authorize.idTag, Constants.ACTION_AUTHORIZE);
    // Save
    await ChargingStationStorage.saveAuthorize(this.getTenantID(), authorize);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation', method: 'handleAuthorize',
      action: 'Authorize', user: (authorize.user ? authorize.user.getModel() : null),
      message: `User has been authorized to use Charging Station`
    });
  }

  /**
   *
   * @returns {Promise<Site>}
   */
  async getSite() {
    // Get Site Area
    const siteArea = await this.getSiteArea();
    // Check Site Area
    if (!siteArea) {
      return null;
    }
    // Get Site
    const site = await siteArea.getSite();
    return site;
  }

  async getCompany() {
    // Get the Site
    const site = await this.getSite();
    // Check Site
    if (!site) {
      return null;
    }
    // Get the Company
    const company = await site.getCompany();
    return company;
  }

  _checkStartTransactionProps(startTransaction) {
    // Check the timestamp
    if (!startTransaction.hasOwnProperty("timestamp")) {
        // BUG EBEE: Timestamp is mandatory according OCPP
      throw new BackendError(this.getID(),
        `The 'timestamp' property has not been provided`,
        "ChargingStation", "_checkStartTransactionProps", "StartTransaction");
    }
    // Check the meter start
    if (!startTransaction.hasOwnProperty("meterStart")) {
      // BUG EBEE: MeterStart is mandatory according OCPP
      throw new BackendError(this.getID(),
        `The 'meterStart' property has not been provided`,
        "ChargingStation", "_checkStartTransactionProps", "StartTransaction");
    }
    // Check Tag ID
    if (!startTransaction.idTag) {
      throw new BackendError(this.getID(),
        `The Badge ID is mandatory`,
        "ChargingStation", "_checkStartTransactionProps", "StartTransaction");
    }
    // Check Connector ID
    if (!this.getConnector(transaction.getConnectorId())) {
      throw new BackendError(this.getID(),
        `The Connector ID is invalid: '${transaction.getConnectorId()}'`,
        "ChargingStation", "_checkStartTransactionProps", "StartTransaction");
    }
  }

  async handleStartTransaction(startTransaction) {
    // Check params
    this._checkStartTransactionProps(startTransaction);
    // Set the header
    startTransaction.chargeBoxID = this.getID();
    startTransaction.tagID = startTransaction.idTag;
    startTransaction.timezone = this.getTimezone();
    // Get the Organization component
    const isOrgCompActive = await this.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
    // Check Authorization with Tag ID
    const user = await Authorizations.isTagIDAuthorizedOnChargingStation(
      this, startTransaction.tagID, Constants.ACTION_START_TRANSACTION);
    if (user) {
      // Set the user
      startTransaction.user = user.getModel();
    }
    // Check Org
    if (isOrganizationComponentActive) {
      // Set the Site ID
      startTransaction.siteAreaID = this.getSiteAreaID();
      // Get the Site
      const site = await this.getSite();
      // Set
      if (site) {
        startTransaction.siteID = site.getID();
      }      
    }
    // Create
    let transaction = new Transaction(this.getTenantID(), startTransaction);
    // Start Transactions
    await transaction.startTransaction(user);
    // Cleanup ongoing transactions
    await Transaction.cleanupRemainingActiveTransactions(this.getTenantID(), this.getID(), transaction.getConnectorId());
    // Save
    transaction = await transaction.save();
    // Lock the other connectors?
    if (!this.canChargeInParallel()) {
      // Yes
      this.lockAllConnectors();
    }
    // Clean up connector transaction info
    this._cleanupConnectorTransactionInfo(transaction.getConnectorId());
    // Set active transaction
    this.getConnector(transaction.getConnectorId()).activeTransactionID = transaction.getID();
    // Update Heartbeat
    this.setLastHeartBeat(new Date());
    // Save
    await this.save();
    // Log
    if (user) {
      // Notify
      NotificationHandler.sendTransactionStarted(
        this.getTenantID(),
        transaction.getID(),
        user.getModel(),
        this.getModel(),
        {
          'user': user.getModel(),
          'chargingBoxID': this.getID(),
          'connectorId': transaction.getConnectorId(),
          'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain()),
          'evseDashboardChargingStationURL':
            await Utils.buildEvseTransactionURL(this, transaction.getConnectorId(), transaction.getID())
        },
        user.getLocale(),
        {
          'transactionId': transaction.getID(),
          'connectorId': transaction.getConnectorId()
        }
      );
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(),
        source: this.getID(), module: 'ChargingStation', method: 'handleStartTransaction',
        action: 'StartTransaction', user: user.getModel(),
        message: `Transaction ID '${transaction.getID()}' has been started on Connector '${transaction.getConnectorId()}'`
      });
    } else {
      // Log
      Logging.logInfo({
        tenantID: this.getTenantID(), source: this.getID(),
        module: 'ChargingStation', method: 'handleStartTransaction', action: 'StartTransaction',
        message: `Transaction ID '${transaction.getID()}' has been started by an anonymous user on Connector '${transaction.getConnectorId()}'`
      });
    }
    // Return
    return transaction;
  }

  _cleanupConnectorTransactionInfo(connectorId) {
    const connector = this.getConnector(connectorId);
    // Clear
    connector.currentConsumption = 0;
    connector.totalConsumption = 0;
    connector.currentStateOfCharge = 0;
    connector.activeTransactionID = 0;
  }

  lockAllConnectors() {
    this.getConnectors().forEach(async (connector) => {
      // Check
      if (connector.status === Constants.CONN_STATUS_AVAILABLE) {
        // Check OCPP Version
        if (this.getOcppVersion() === Constants.OCPP_VERSION_15) {
          // Set OCPP 1.5 Occupied
          connector.status = Constants.CONN_STATUS_OCCUPIED;
        } else {
          // Set OCPP 1.6 Unavailable
          connector.status = Constants.CONN_STATUS_UNAVAILABLE;
        }
      }
    });
  }

  _getStopTransactionTagId(stopTransaction, transaction) {
    // Stopped Remotely?
    if (transaction.isRemotelyStopped()) {
      // Yes: Get the diff from now
      const secs = moment.duration(moment().diff(
        moment(transaction.getRemoteStop().timestamp))).asSeconds();
      // In a minute
      if (secs < 60) {
        // Return tag that remotely stopped the transaction
        return transaction.getRemoteStop().tagID;
      }
    }
    // Already provided?
    if (stopTransaction.idTag) {
      // Return tag that stopped the transaction
      return stopTransaction.idTag
    }
    // Default: return tag that started the transaction
    return transaction.getTagID();
  }

  async _checkAndFreeConnector(connectorId, saveOtherConnectors = false) {
    // Cleanup connector transaction data
    this._cleanupConnectorTransactionInfo(connectorId);
    // Check if Charger can charge in //
    if (!this.canChargeInParallel()) {
      // Set all the other connectors to Available
      this.getConnectors().forEach(async (connector) => {
        // Only other Occupied connectors
        if ((connector.status === Constants.CONN_STATUS_OCCUPIED ||
             connector.status === Constants.CONN_STATUS_UNAVAILABLE) &&
            connector.connectorId !== connectorId) {
          // Set connector Available again
          connector.status = Constants.CONN_STATUS_AVAILABLE;
          // Save other updated connectors?
          if (saveOtherConnectors) {
            await ChargingStationStorage.saveChargingStationConnector(this.getTenantID(), this.getModel(), connector.connectorId);
          }
        }
      });
    }
  }

  async handleStopTransaction(stopTransaction, isSoftStop = false) {
    // Check props
    this._checkStopTransactionProps(stopTransaction);
    // Set header
    stopTransaction.chargeBoxID = this.getID();
    // Get the transaction
    let transaction = await Transaction.getTransaction(this.getTenantID(), stopTransaction.transactionId);
    if (!transaction) {
      // Wrong Transaction ID!
      throw new BackendError(this.getID(),
        `Transaction ID '${stopTransaction.transactionId}' does not exist`,
        "ChargingStation", "handleStopTransaction", "StopTransaction");
    }
    let user = null;
    // Get the TagID that stopped the transaction
    const tagId = this._getStopTransactionTagId(stopTransaction, transaction);
    // Check if same user
    if (tagId !== transaction.getTagID()) {
      // Check alternate user
      user = await Authorizations.isTagIDAuthorizedOnChargingStation(
        this, tagId, Constants.ACTION_STOP_TRANSACTION);
      // Not anonymous?
      if (user) {
        // Check if Alternate User belongs to a Site --------------------------------
        // Organization component active?
        const isOrgCompActive = await chargingStation.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
        if (isOrgCompActive) {
          // Get the site (site existence is already checked by isTagIDAuthorizedOnChargingStation())
          const site = await this.getSite();
          // Check if the site allows to stop the transaction of another user
          if (!Authorizations.isAdmin(user.getModel()) &&
              !site.isAllowAllUsersToStopTransactionsEnabled()) {
            // Get the Transaction user
            transactionUser = transaction.getUser();
              // Reject the User
            throw new BackendError(
              chargingStation.getID(),
              `User '${user.getFullName()}' is not allowed to perform '${action}' on User '${transactionUser.getFullName()}' on Site '${site.getName()}'!`,
              "ChargingStation", "handleStopTransaction", "StopTransaction",
              user.getModel(), transactionUser.getModel());
          }
        }
      }
    } else {
      // Check user
      user = await Authorizations.isTagIDAuthorizedOnChargingStation(
        this, transaction.getTagID(), Constants.ACTION_STOP_TRANSACTION);
    }
    // Check if the transaction has already been stopped
    if (!transaction.isActive()) {
      throw new BackendError(this.getID(),
        `Transaction ID '${stopTransaction.transactionId}' has already been stopped`,
        "ChargingStation", "handleStopTransaction", "StopTransaction", user.getModel());
    }
    // Check and free the connector
    await this._checkAndFreeConnector(transaction.getConnectorId(), false);
    // Update Heartbeat
    this.setLastHeartBeat(new Date());
    // Save Charger
    await this.save();
    // Soft Stop?
    if (isSoftStop) {
      // Yes: Add the latest Meter Value
      if (transaction.getLastMeterValue()) {
        stopTransaction.meterStop = transaction.getLastMeterValue().value;
      } else {
        stopTransaction.meterStop = 0;
      }
    }
    // Stop
    await transaction.stopTransaction(user.getID(), tagId, stopTransaction.meterStop, new Date(stopTransaction.timestamp), this.getTimezone());
    // Save the transaction
    transaction = await transaction.save();
    // Notify User
    this._notifyStopTransaction(user, users, transaction);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation', method: 'handleStopTransaction',
      action: 'StopTransaction', user: user.getModel(), actionOnUser: users.user.getModel(),
      message: `Transaction ID '${transaction.getID()}' has been stopped`
    });
    // Return
    return transaction;
  }

  _checkStopTransactionProps(stopTransaction) {
  }

  async _notifyStopTransaction(user, users, transaction) {
    // User provided?
    if (user) {
      // Send Notification
      NotificationHandler.sendEndOfSession(
        this.getTenantID(),
        transaction.getID() + '-EOS',
        user.getModel(),
        this.getModel(),
        {
          'user': user.getModel(),
          'alternateUser': (user.getID() != users.alternateUser.getID() ? users.alternateUser.getModel() : null),
          'chargingBoxID': this.getID(),
          'connectorId': transaction.getConnectorId(),
          'totalConsumption': (transaction.getTotalConsumption() / 1000).toLocaleString(
            (user.getLocale() ? user.getLocale().replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-')),
            {minimumIntegerDigits: 1, minimumFractionDigits: 0, maximumFractionDigits: 2}),
          'totalDuration': this._buildTransactionDuration(transaction),
          'totalInactivity': this._buildTransactionInactivity(transaction),
          'stateOfCharge': transaction.getEndStateOfCharge(),
          'evseDashboardChargingStationURL': await Utils.buildEvseTransactionURL(this, transaction.getConnectorId(), transaction.getID()),
          'evseDashboardURL': Utils.buildEvseURL((await this.getTenant()).getSubdomain())
        },
        user.getLocale(),
        {
          'transactionId': transaction.getID(),
          'connectorId': transaction.getConnectorId()
        }
      );
    }
  }

  // Restart the charger
  async requestReset(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Restart
    const result = await chargingStationClient.reset(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestReset', action: 'Reset',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Stop Transaction
  async requestStopTransaction(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Stop Transaction
    const result = await chargingStationClient.remoteStopTransaction(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestStopTransaction', action: 'StopTransaction',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Start Transaction
  async requestStartTransaction(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Start Transaction
    const result = await chargingStationClient.startTransaction(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestStartTransaction', action: 'StartTransaction',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Set Charging Profile
  async requestSetChargingProfile(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Set Charging Profile
    const result = await chargingStationClient.setChargingProfile(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestSetChargingProfile', action: 'SetChargingProfile',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Clear Profiles
  async requestClearChargingProfile(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Clear Profiles
    const result = await chargingStationClient.clearChargingProfile(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestClearChargingProfiles', action: 'ClearChargingProfile',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  async requestGetDiagnostics(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Get Diagnostics
    const result = await chargingStationClient.getDiagnostics(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestGetDiagnostics', action: 'GetDiagnostics',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  async requestUpdateFirmware(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Update Firmware
    const result = await chargingStationClient.updateFirmware(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestUpdateFirmware', action: 'UpdateFirmware',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  async requestChangeAvailability(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Change Availibility
    const result = await chargingStationClient.changeAvailability(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestChangeAvailability', action: 'ChangeAvailability',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  async requestGenericOCPPCommand(commandName, params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Set Charging Profile
    const result = await chargingStationClient.genericOCPPCommand(commandName, params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestGenericOCPPCommand', action: 'GenericOCPPCommand',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Retrieve Composite Schedule (Charging power limitation)
  async requestGetCompositeSchedule(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Set Charging Profile
    const result = await chargingStationClient.getCompositeSchedule(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestSetChargingProfile', action: 'SetChargingProfile',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Clear the cache
  async requestClearCache() {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Clear
    const result = await chargingStationClient.clearCache();
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestClearCache', action: 'ClearCache',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Get the configuration for the EVSE
  async requestGetConfiguration(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Get config
    const result = await chargingStationClient.getConfiguration(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestGetConfiguration', action: 'GetConfiguration',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  // Get the configuration for the EVSE
  async requestChangeConfiguration(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Get config
    const result = await chargingStationClient.changeConfiguration(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestChangeConfiguration', action: 'ChangeConfiguration',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Request the new Configuration?
    if (result.status !== 'Accepted') {
      // Error
      throw new BackendError(this.getID(), `Cannot set the configuration param ${params.key} with value ${params.value} to ${this.getID()}`,
        "ChargingStation", "requestChangeConfiguration")
    }
    // Update
    await this.requestAndSaveConfiguration();
    // Return
    return result;
  }

  // Unlock connector
  async requestUnlockConnector(params) {
    // Get the client
    const chargingStationClient = await this.getChargingStationClient();
    // Get config
    const result = await chargingStationClient.unlockConnector(params);
    // Log
    Logging.logInfo({
      tenantID: this.getTenantID(),
      source: this.getID(), module: 'ChargingStation',
      method: 'requestUnlockConnector', action: 'UnlockConnector',
      message: `Command sent with success`,
      detailedMessages: result
    });
    // Return
    return result;
  }

  getConfiguration() {
    return ChargingStationStorage.getConfiguration(this.getTenantID(), this.getID());
  }

  getConfigurationParamValue(paramName) {
    return ChargingStationStorage.getConfigurationParamValue(this.getTenantID(), this.getID(), paramName);
  }

  async hasAtLeastOneTransaction() {
    // Get the consumption
    const transactions = await Transaction.getTransactions(this.getTenantID(), {'chargeBoxID': this.getID()}, 1);
    // Return
    return (transactions.count > 0);
  }

  async getTransactions(connectorId, startDateTime, endDateTime, withChargeBoxes = false) {
    // Get the consumption
    const transactions = await Transaction.getTransactions(this.getTenantID(),
      {
        'chargeBoxID': this.getID(), 'connectorId': connectorId, 'startDateTime': startDateTime,
        'endDateTime': endDateTime, 'withChargeBoxes': withChargeBoxes
      },
      Constants.NO_LIMIT);
    // Return list of transactions
    return transactions;
  }
}

module.exports = ChargingStation;
