import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import sanitize from 'mongo-sanitize';
import Authorizations from '../../../authorization/Authorizations';
import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import ChargingStationVendorFactory from '../../../integration/charging-station-vendor/ChargingStationVendorFactory';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import { Action, Entity } from '../../../types/Authorization';
import ChargingStation, { OCPPParams, StaticLimitAmps } from '../../../types/ChargingStation';
import { DataResult } from '../../../types/DataResult';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { ChargingStationInErrorType } from '../../../types/InError';
import { OCPPChargingProfileStatus, OCPPChargingStationCommand, OCPPClearChargingProfileStatus, OCPPConfigurationStatus, OCPPStatus, OCPPClearChargingProfileCommandResult, OCPPSetChargingProfileCommandResult } from '../../../types/ocpp/OCPPClient';
import { HttpChargingStationCommandRequest, HttpIsAuthorizedRequest } from '../../../types/requests/HttpChargingStationRequest';
import TenantComponents from '../../../types/TenantComponents';
import User from '../../../types/User';
import UserToken from '../../../types/UserToken';
import Constants from '../../../utils/Constants';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import OCPPUtils from '../../ocpp/utils/OCPPUtils';
import ChargingStationSecurity from './security/ChargingStationSecurity';
import UtilsService from './UtilsService';

export default class ChargingStationService {

  public static async handleAssignChargingStationsToSiteArea(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.CHARGING_STATION, 'ChargingStationService', 'handleAssignChargingStationsToSiteArea');
    // Filter
    const filteredRequest = ChargingStationSecurity.filterAssignChargingStationsToSiteAreaRequest(req.body);
    // Check mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.siteAreaID, 'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);
    if (!filteredRequest.chargingStationIDs || (filteredRequest.chargingStationIDs && filteredRequest.chargingStationIDs.length <= 0)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Charging Station\'s IDs must be provided',
        module: 'ChargingStationService',
        method: 'handleAssignChargingStationsToSiteArea',
        user: req.user
      });
    }
    // Get the Site Area (before auth to get siteID)
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
    UtilsService.assertObjectExists(action, siteArea, `Site Area '${filteredRequest.siteAreaID}' doesn't exist anymore.`,
      'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);
    // Check auth
    if (!Authorizations.canUpdateSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SITE_AREA,
        module: 'ChargingStationService',
        method: 'handleAssignChargingStationsToSiteArea',
        value: filteredRequest.siteAreaID
      });
    }
    // Get Charging Stations
    for (const chargingStationID of filteredRequest.chargingStationIDs) {
      // Check the charging station
      const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, chargingStationID);
      UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${chargingStationID}' doesn't exist anymore.`,
        'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);
      // Check auth
      if (!Authorizations.canUpdateChargingStation(req.user, siteArea.siteID)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.UPDATE,
          entity: Entity.CHARGING_STATION,
          module: 'ChargingStationService',
          method: 'handleAssignChargingStationsToSiteArea',
          value: chargingStationID
        });
      }
    }
    // Save
    if (action === Action.ADD_CHARGING_STATION_TO_SITE_AREA) {
      await ChargingStationStorage.addChargingStationsToSiteArea(req.user.tenantID, filteredRequest.siteAreaID, filteredRequest.chargingStationIDs);
    } else {
      await ChargingStationStorage.removeChargingStationsFromSiteArea(req.user.tenantID, filteredRequest.siteAreaID, filteredRequest.chargingStationIDs);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: 'ChargingStationService',
      method: 'handleAssignChargingStationsToSiteArea',
      message: 'Site Area\'s Charging Stations have been assigned successfully',
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateChargingStationParams(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationParamsUpdateRequest(req.body);
    // Check existence
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.id);
    // Check
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${filteredRequest.id}' doesn't exist.`,
      'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check Auth
    if (!Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.CHARGING_STATION,
        module: 'ChargingStationService',
        method: 'handleUpdateChargingStationParams',
        value: chargingStation.id
      });
    }
    // Update URL
    if (filteredRequest.chargingStationURL) {
      chargingStation.chargingStationURL = filteredRequest.chargingStationURL;
    }
    // Update Power Max
    if (Utils.objectHasProperty(filteredRequest, 'maximumPower')) {
      chargingStation.maximumPower = filteredRequest.maximumPower;
    }
    // Update Current Type
    if (Utils.objectHasProperty(filteredRequest, 'currentType')) {
      chargingStation.currentType = filteredRequest.currentType;
    }
    // Update Cannot Charge in Parallel
    if (Utils.objectHasProperty(filteredRequest, 'cannotChargeInParallel')) {
      chargingStation.cannotChargeInParallel = filteredRequest.cannotChargeInParallel;
    }
    // Update Site Area
    if (filteredRequest.siteArea) {
      chargingStation.siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteArea.id);
      chargingStation.siteAreaID = chargingStation.siteArea.id;
    } else {
      chargingStation.siteAreaID = null;
    }
    // Update Site Area
    if (Utils.objectHasProperty(filteredRequest, 'powerLimitUnit')) {
      chargingStation.powerLimitUnit = filteredRequest.powerLimitUnit;
    }
    if (filteredRequest.coordinates && filteredRequest.coordinates.length === 2) {
      chargingStation.coordinates = [
        sanitize(filteredRequest.coordinates[0]),
        sanitize(filteredRequest.coordinates[1])
      ];
    }
    // Update Connectors
    if (filteredRequest.connectors) {
      const chargerConnectors = chargingStation.connectors;
      // Assign to Charging Station's connector
      for (const connector of filteredRequest.connectors) {
        // Set
        chargerConnectors[connector.connectorId - 1].power = connector.power;
        chargerConnectors[connector.connectorId - 1].type = connector.type;
        chargerConnectors[connector.connectorId - 1].voltage = connector.voltage;
        chargerConnectors[connector.connectorId - 1].amperage = connector.amperage;
        chargerConnectors[connector.connectorId - 1].currentType = connector.currentType;
        chargerConnectors[connector.connectorId - 1].numberOfConnectedPhase = connector.numberOfConnectedPhase;
      }
    }
    // Update timestamp
    chargingStation.lastChangedBy = { 'id': req.user.id };
    chargingStation.lastChangedOn = new Date();
    // Update
    await ChargingStationStorage.saveChargingStation(action, req.user.tenantID, chargingStation);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id, action: action,
      user: req.user, module: 'ChargingStationService',
      method: 'handleUpdateChargingStationParams',
      message: 'Parameters have been updated successfully',
      detailedMessages: {
        'chargingStationURL': chargingStation.chargingStationURL
      }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleChargingStationLimitPower(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationLimitPowerRequest(req.body);
    // Check
    if (filteredRequest.ampLimitValue < StaticLimitAmps.MIN_LIMIT) {
      throw new AppError({
        source: filteredRequest.chargeBoxID,
        action: Action.POWER_LIMITATION,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Limitation to ${filteredRequest.ampLimitValue} Amps is too low, min required is ${StaticLimitAmps.MIN_LIMIT} Amps`,
        module: 'ChargingStationService', method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Check existence
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    // Check
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${filteredRequest.chargeBoxID}' doesn't exist.`,
      'ChargingStationService', 'handleChargingStationLimitPower', req.user);
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check Auth
    if (!Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.POWER_LIMITATION,
        entity: Entity.CHARGING_STATION,
        module: 'ChargingStationService', method: 'handleChargingStationLimitPower',
        value: chargingStation.id
      });
    }
    // Check if limit is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportStaticLimitationForChargingStation) {
      throw new AppError({
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        message: 'Charging Station does not support power limitation',
        module: 'ChargingStationService', method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Get the Vendor instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorInstance(chargingStation);
    if (!chargingStationVendor) {
      throw new AppError({
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for limiting the charge`,
        module: 'ChargingStationService', method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Call the limitation
    const result = await chargingStationVendor.setPowerLimitation(
      req.user.tenantID, chargingStation, filteredRequest.connectorId, filteredRequest.ampLimitValue);
    if (result.status !== OCPPConfigurationStatus.ACCEPTED) {
      throw new AppError({
        source: chargingStation.id,
        action: Action.POWER_LIMITATION,
        errorCode: HTTPError.LIMIT_POWER_ERROR,
        module: 'ChargingStationService', method: 'handleChargingStationLimitPower',
        message: `Cannot limit the charger's power: '${result.status}'`,
        detailedMessages: result,
        user: req.user
      });
    }
    Logging.logInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id,
      action: Action.POWER_LIMITATION,
      user: req.user,
      module: 'ChargingStationService', method: 'handleChargingStationLimitPower',
      message: `The charger's power limit has been successfully set to ${filteredRequest.ampLimitValue} Amps`,
      detailedMessages: result
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingProfiles(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationProfilesRequest(req.query);
    // Check
    UtilsService.assertIdIsProvided(action, filteredRequest.ChargeBoxID, 'ChargingStationService', 'handleGetChargingProfiles', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.GET_CHARGING_PROFILE,
        entity: Entity.CHARGING_STATION,
        module: 'ChargingStationService',
        method: 'handleGetChargingProfiles',
        value: filteredRequest.ChargeBoxID
      });
    }
    const chargingProfiles = await ChargingStationStorage.getChargingProfiles(req.user.tenantID,
      { chargingStationID: filteredRequest.ChargeBoxID, connectorID: filteredRequest.ConnectorID },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
    res.json(chargingProfiles);
    next();
  }

  public static async handleUpdateChargingProfile(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingProfileUpdateRequest(req.body);
    // Check Mandatory fields
    Utils.checkIfChargingProfileIsValid(filteredRequest, req);
    // Check existence
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargingStationID);
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${req.body.ChargingStationID}' doesn't exist.`,
      'ChargingStationService', 'handleUpdateChargingProfile', req.user);
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check Auth
    if (!Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.SET_CHARGING_PROFILE,
        entity: Entity.CHARGING_STATION,
        module: 'ChargingStationService',
        method: 'handleUpdateChargingProfile',
        value: chargingStation.id
      });
    }
    // Check if charging profile is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new AppError({
        source: chargingStation.id,
        action: Action.SET_CHARGING_PROFILE,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        user: req.user,
        module: 'ChargingStationService', method: 'handleUpdateChargingProfile',
        message: `Charging Station '${chargingStation.id}' does not support charging profiles`,
      });
    }
    // Get Vendor Instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorInstance(chargingStation);
    if (!chargingStationVendor) {
      throw new AppError({
        source: chargingStation.id,
        action: Action.SET_CHARGING_PROFILE,
        user: req.user,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        module: 'ChargingStationService', method: 'handleUpdateChargingProfile',
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for setting a charging profile`,
      });
    }
    // Set charging profile
    const result = await chargingStationVendor.setChargingProfile(req.user.tenantID, chargingStation, filteredRequest);
    // Check for Array
    let resultStatus = OCPPChargingProfileStatus.ACCEPTED;
    if (Array.isArray(result)) {
      for (const oneResult of result as OCPPSetChargingProfileCommandResult[]) {
        if (oneResult.status !== OCPPChargingProfileStatus.ACCEPTED) {
          resultStatus = oneResult.status;
          break;
        }
      }
    } else {
      resultStatus = (result as OCPPSetChargingProfileCommandResult).status;
    }
    if (resultStatus !== OCPPChargingProfileStatus.ACCEPTED) {
      throw new AppError({
        source: chargingStation.id,
        action: Action.SET_CHARGING_PROFILE,
        user: req.user,
        errorCode: HTTPError.SET_CHARGING_PROFILE_ERROR,
        module: 'ChargingStationService', method: 'handleUpdateChargingProfile',
        message: `Cannot set the Charging Station's charging profile!`,
        detailedMessages: result,
      });
    }
    // Save
    await ChargingStationStorage.saveChargingProfile(req.user.tenantID, filteredRequest);
    // Log
    Logging.logInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id,
      action: action,
      user: req.user,
      module: 'ChargingStationService', method: 'handleUpdateChargingProfile',
      message: 'Charging Profile has been successfully set',
      detailedMessages: { chargingProfile: filteredRequest }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteChargingProfile(action: Action, req: Request, res: Response, next: NextFunction) {
    // Check existence
    const chargingProfileID = ChargingStationSecurity.filterChargingProfileRequestByID(req.query);
    // Get Profile
    const chargingProfile = await ChargingStationStorage.getChargingProfile(req.user.tenantID, chargingProfileID);
    UtilsService.assertObjectExists(action, chargingProfile, `Charging Profile ID '${chargingProfileID}' doesn't exist.`,
      'ChargingStationService', 'handleDeleteChargingProfile', req.user);
    // Get Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, chargingProfile.chargingStationID);
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${chargingProfile.chargingStationID}' doesn't exist.`,
      'ChargingStationService', 'handleDeleteChargingProfile', req.user);
    // Check Component
    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check Auth
    if (!Authorizations.canUpdateChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.SET_CHARGING_PROFILE,
        entity: Entity.CHARGING_STATION,
        module: 'ChargingStationService', method: 'handleDeleteChargingProfile',
        value: chargingStation.id
      });
    }
    // Check if charging profile is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new AppError({
        source: chargingStation.id,
        action: Action.SET_CHARGING_PROFILE,
        user: req.user,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        module: 'ChargingStationService', method: 'handleDeleteChargingProfile',
        message: `Charging Station '${chargingStation.id}' does not support the charging profiles`,
      });
    }
    // Get Vendor Instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorInstance(chargingStation);
    if (!chargingStationVendor) {
      throw new AppError({
        source: chargingStation.id,
        action: Action.SET_CHARGING_PROFILE,
        user: req.user,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        module: 'ChargingStationService', method: 'handleDeleteChargingProfile',
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for setting a charging profile`,
      });
    }
    // Clear charging profile
    const result = await chargingStationVendor.clearChargingProfile(req.user.tenantID, chargingStation, chargingProfile);
    // Check for Array
    let resultStatus = OCPPClearChargingProfileStatus.ACCEPTED;
    if (Array.isArray(result)) {
      for (const oneResult of result as OCPPClearChargingProfileCommandResult[]) {
        if (oneResult.status !== OCPPClearChargingProfileStatus.ACCEPTED) {
          resultStatus = oneResult.status;
          break;
        }
      }
    } else {
      resultStatus = (result as OCPPClearChargingProfileCommandResult).status;
    }
    if (resultStatus !== OCPPClearChargingProfileStatus.ACCEPTED) {
      throw new AppError({
        source: chargingStation.id,
        action: Action.SET_CHARGING_PROFILE,
        user: req.user,
        errorCode: HTTPError.SET_CHARGING_PROFILE_ERROR,
        message: `Cannot clear the Charging Station's charging profiles!`,
        module: 'ChargingStationService', method: 'handleDeleteChargingProfile',
        detailedMessages: result,
      });
    }
    // Delete
    await ChargingStationStorage.deleteChargingProfile(req.user.tenantID, chargingProfile.id);
    // Log
    Logging.logInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id,
      action: action,
      user: req.user,
      module: 'ChargingStationService', method: 'handleDeleteChargingProfile',
      message: 'Charging Profile has been deleted successfully',
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingStationConfiguration(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationConfigurationRequest(req.query);
    // Check
    UtilsService.assertIdIsProvided(action, filteredRequest.ChargeBoxID, 'ChargingStationService', 'handleGetChargingStationConfiguration', req.user);
    // Get the Charging Station`
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ChargeBoxID);
    // Found?
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${filteredRequest.ChargeBoxID}' doesn't exist anymore.`,
      'ChargingStationService', 'handleAssignChargingStationsToSiteArea', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CHARGING_STATION,
        module: 'ChargingStationService',
        method: 'handleGetChargingStationConfiguration',
        value: chargingStation.id
      });
    }
    // Get the Config
    const configuration = await ChargingStationStorage.getConfiguration(req.user.tenantID, chargingStation.id);
    // Return the result
    res.json(configuration);
    next();
  }

  public static async handleRequestChargingStationConfiguration(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterRequestChargingStationConfigurationRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.chargeBoxID, 'ChargingStationService', 'handleRequestChargingStationConfiguration', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CHARGING_STATION,
        module: 'ChargingStationService',
        method: 'handleRequestChargingStationConfiguration',
        value: filteredRequest.chargeBoxID
      });
    }
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    // Found?
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${filteredRequest.chargeBoxID}' doesn't exist anymore.`,
      'ChargingStationService', 'handleRequestChargingStationConfiguration', req.user);
    // Get the Config
    const result = await OCPPUtils.requestAndSaveChargingStationOcppConfiguration(
      req.user.tenantID, chargingStation, filteredRequest.forceUpdateOCPPParamsFromTemplate);
    // Ok
    res.json(result);
    next();
  }

  public static async handleDeleteChargingStation(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const chargingStationID = ChargingStationSecurity.filterChargingStationRequestByID(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, chargingStationID, 'ChargingStationService',
      'handleDeleteChargingStation', req.user);
    // Get
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, chargingStationID);
    // Check
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station with ID '${chargingStationID}' does not exist`,
      'ChargingStationService', 'handleDeleteChargingStation', req.user);

    let siteID = null;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, chargingStation.siteAreaID);
      siteID = siteArea ? siteArea.siteID : null;
    }
    // Check auth
    if (!Authorizations.canDeleteChargingStation(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE,
        entity: Entity.CHARGING_STATION,
        module: 'ChargingStationService',
        method: 'handleDeleteChargingStation',
        value: chargingStationID
      });
    }
    // Deleted
    if (chargingStation.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: action,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `Charging Station with ID '${chargingStationID}' is already deleted`,
        module: 'ChargingStationService',
        method: 'handleDeleteChargingStation',
        user: req.user
      });
    }
    for (const connector of chargingStation.connectors) {
      if (connector && connector.activeTransactionID) {
        const transaction = await TransactionStorage.getTransaction(req.user.tenantID, connector.activeTransactionID);
        if (transaction && !transaction.stop) {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            action: action,
            errorCode: HTTPError.EXISTING_TRANSACTION_ERROR,
            message: `Charging Station '${chargingStation.id}' can't be deleted due to existing active transactions`,
            module: 'ChargingStationService',
            method: 'handleDeleteChargingStation',
            user: req.user
          });
        } else {
          OCPPUtils.checkAndFreeChargingStationConnector(chargingStation, connector.connectorId);
        }
      }
    }
    // Remove Site Area
    chargingStation.siteArea = null;
    chargingStation.siteAreaID = null;
    // Set as deleted
    chargingStation.deleted = true;
    // Check if charging station has had transactions
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID,
      { chargeBoxIDs: [chargingStation.id] }, Constants.DB_PARAMS_COUNT_ONLY);
    if (transactions.count > 0) {
      // Delete logically
      await ChargingStationStorage.saveChargingStation(action, req.user.tenantID, chargingStation);
    } else {
      // Delete physically
      await ChargingStationStorage.deleteChargingStation(req.user.tenantID, chargingStation.id);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'ChargingStationService', method: 'handleDeleteChargingStation',
      message: `Charging Station '${chargingStation.id}' has been deleted successfully`,
      action: action, detailedMessages: chargingStation
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingStation(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationRequest(req.query);
    // Check
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, 'ChargingStationService', 'handleGetChargingStation', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CHARGING_STATION,
        module: 'ChargingStationService',
        method: 'handleGetChargingStation',
        value: filteredRequest.ID
      });
    }
    // Query charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ID);
    // Check
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station '${filteredRequest.ID}' does not exist`,
      'ChargingStationService', 'handleGetChargingStation', req.user);
    // Deleted?
    if (chargingStation.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `ChargingStation with ID '${filteredRequest.ID}' is logically deleted`,
        module: 'ChargingStationService',
        method: 'handleGetChargingStation',
        user: req.user
      });
    }
    res.json(
      // Filter
      ChargingStationSecurity.filterChargingStationResponse(
        chargingStation, req.user, req.user.activeComponents.includes(TenantComponents.ORGANIZATION))
    );
    next();
  }

  public static async handleGetChargingStations(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    res.json(await ChargingStationService.getChargingStations(req));
    next();
  }

  public static async handleChargingStationsOCPPParamsExport(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Always with site
    req.query.WithSite = true;
    // Get Charging Stations
    const chargingStations = await ChargingStationService.getChargingStations(req);
    for (const chargingStation of chargingStations.result) {
      // Check all chargers
      if (!Authorizations.canExportParams(req.user, chargingStation.siteArea.site.id)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.EXPORT_PARAMS,
          entity: Entity.CHARGING_STATION,
          module: 'ChargingStationService',
          method: 'handleChargingStationsOCPPParamsExport',
        });
      }
    }
    const ocppParams: OCPPParams[] = [];
    for (const chargingStation of chargingStations.result) {
      // Get OCPP Params
      ocppParams.push({
        params: await ChargingStationStorage.getConfiguration(req.user.tenantID, chargingStation.id),
        siteName: chargingStation.siteArea.site.name,
        siteAreaName: chargingStation.siteArea.name,
        chargingStationName: chargingStation.id
      });
    }
    const dataToExport = ChargingStationService.convertOCPPParamsToCSV(ocppParams);
    // Build export
    const filename = 'exported-occp-params.csv';
    fs.writeFile(filename, dataToExport, (err) => {
      if (err) {
        throw err;
      }
      res.download(filename, (err2) => {
        if (err2) {
          throw err2;
        }
        fs.unlink(filename, (err3) => {
          if (err3) {
            throw err3;
          }
        });
      });
    });
  }

  public static async handleGetChargingStationsExport(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get Charging Stations
    const chargingStations = await ChargingStationService.getChargingStations(req);
    // Build export
    const filename = 'exported-charging-stations.csv';
    fs.writeFile(filename, ChargingStationService.convertToCSV(req.user, chargingStations.result), (err) => {
      if (err) {
        throw err;
      }
      res.download(filename, (err2) => {
        if (err2) {
          throw err2;
        }
        fs.unlink(filename, (err3) => {
          if (err3) {
            throw err3;
          }
        });
      });
    });
  }

  public static async handleGetChargingStationsInError(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CHARGING_STATIONS,
        module: 'ChargingStationService',
        method: 'handleGetChargingStations'
      });
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationsRequest(req.query);
    // Check component
    if (filteredRequest.SiteID) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
        Action.READ, Entity.CHARGING_STATIONS, 'ChargingStationService', 'handleGetChargingStations');
    }
    let _errorType = [];
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      _errorType = (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : [ChargingStationInErrorType.MISSING_SETTINGS, ChargingStationInErrorType.CONNECTION_BROKEN, ChargingStationInErrorType.CONNECTOR_ERROR, ChargingStationInErrorType.MISSING_SITE_AREA]);
    } else {
      _errorType = (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : [ChargingStationInErrorType.MISSING_SETTINGS, ChargingStationInErrorType.CONNECTION_BROKEN, ChargingStationInErrorType.CONNECTOR_ERROR]);
    }
    // Get Charging Stations
    const chargingStations = await ChargingStationStorage.getChargingStationsInError(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteIDs: Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        siteAreaID: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        errorType: _errorType
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      }
    );
    // Build the result
    ChargingStationSecurity.filterChargingStationsResponse(chargingStations, req.user, req.user.activeComponents.includes(TenantComponents.ORGANIZATION));
    // Return
    res.json(chargingStations);
    next();
  }

  public static async handleGetStatusNotifications(action: Action, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CHARGING_STATIONS,
        module: 'ChargingStationService',
        method: 'handleGetStatusNotifications'
      });
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterNotificationsRequest(req.query);
    // Get all Status Notifications
    const statusNotifications = await OCPPStorage.getStatusNotifications(req.user.tenantID, {},
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort });
    // Set
    statusNotifications.result = ChargingStationSecurity.filterStatusNotificationsResponse(statusNotifications.result, req.user);
    // Return
    res.json(statusNotifications);
    next();
  }

  public static async handleGetBootNotifications(action: Action, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CHARGING_STATIONS,
        module: 'ChargingStationService',
        method: 'handleGetBootNotifications'
      });
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterNotificationsRequest(req.query);
    // Get all Status Notifications
    const bootNotifications = await OCPPStorage.getBootNotifications(req.user.tenantID, {},
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort });
    // Set
    bootNotifications.result = ChargingStationSecurity.filterBootNotificationsResponse(bootNotifications.result, req.user);
    // Return
    res.json(bootNotifications);
    next();
  }

  public static async handleGetFirmware(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationGetFirmwareRequest(req.query);
    if (!filteredRequest.FileName) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The firmware FileName is mandatory',
        module: 'ChargingStationService',
        method: 'handleGetFirmware'
      });
    }
    // Open a download stream and pipe it in the response
    const bucketStream = ChargingStationStorage.getChargingStationFirmware(filteredRequest.FileName);
    // Set headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=' + filteredRequest.FileName);
    // Write chunks
    bucketStream.on('data', (chunk) => {
      res.write(chunk);
    });
    // Handle Errors
    bucketStream.on('error', (error) => {
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        action: 'FirmwareDownload',
        message: `Firmware '${filteredRequest.FileName}' has not been found!`,
        module: 'ChargingStationService', method: 'handleGetFirmware',
        detailedMessages: error,
      });
      res.sendStatus(404);
    });
    // End of download
    bucketStream.on('end', () => {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: 'FirmwareDownload',
        message: `Firmware '${filteredRequest.FileName}' has been downloaded with success`,
        module: 'ChargingStationService', method: 'handleGetFirmware',
      });
      res.end();
    });
  }

  public static async handleAction(command: OCPPChargingStationCommand|Action, req: Request, res: Response, next: NextFunction) {
    // Filter - Type is hacked because code below is. Would need approval to change code structure.
    const filteredRequest: HttpChargingStationCommandRequest =
      ChargingStationSecurity.filterChargingStationActionRequest(req.body);
    UtilsService.assertIdIsProvided(command as Action, filteredRequest.chargeBoxID, 'ChargingStationService', 'handleAction', req.user);
    // Get the Charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    UtilsService.assertObjectExists(command as Action, chargingStation, `Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`,
      'ChargingStationService', 'handleAction', req.user);
    let result;
    // Remote Stop Transaction / Unlock Connector
    if (command === OCPPChargingStationCommand.REMOTE_STOP_TRANSACTION) {
      // Check Transaction ID
      if (!filteredRequest.args || !filteredRequest.args.transactionId) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Transaction ID is mandatory',
          module: 'ChargingStationService',
          method: 'handleAction',
          user: req.user,
          action: command as unknown as Action,
        });
      }
      // Get Transaction
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.args.transactionId);
      UtilsService.assertObjectExists(command as unknown as Action, transaction, `Transaction ID '${filteredRequest.args.transactionId}' does not exist`,
        'ChargingStationService', 'handleAction', req.user);
      // Add connector ID
      filteredRequest.args.connectorId = transaction.connectorId;
      // Check Tag ID
      if (!req.user.tagIDs || req.user.tagIDs.length === 0) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.USER_NO_BADGE_ERROR,
          message: 'The user does not have any badge',
          module: 'ChargingStationService',
          method: 'handleAction',
          user: req.user,
          action: command as unknown as Action,
        });
      }
      // Check if user is authorized
      await Authorizations.isAuthorizedToStopTransaction(
        req.user.tenantID, chargingStation, transaction, req.user.tagIDs[0]);
      // Set the tag ID to handle the Stop Transaction afterwards
      transaction.remotestop = {
        timestamp: new Date(),
        tagID: req.user.tagIDs[0],
        userID: req.user.id
      };
      // Save Transaction
      await TransactionStorage.saveTransaction(req.user.tenantID, transaction);
      // Ok: Execute it
      result = await this.handleChargingStationCommand(req.user.tenantID, req.user, chargingStation, command, filteredRequest.args);
      // Remote Start Transaction
    } else if (command === OCPPChargingStationCommand.REMOTE_START_TRANSACTION) {
      // Check Tag ID
      if (!filteredRequest.args || !filteredRequest.args.tagID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.USER_NO_BADGE_ERROR,
          message: 'The user does not have any badge',
          module: 'ChargingStationService',
          method: 'handleAction',
          user: req.user,
          action: command as unknown as Action,
        });
      }
      // Check if user is authorized
      await Authorizations.isAuthorizedToStartTransaction(
        req.user.tenantID, chargingStation, filteredRequest.args.tagID);
      // Ok: Execute it
      result = await this.handleChargingStationCommand(req.user.tenantID, req.user, chargingStation, command, filteredRequest.args);
    } else if (command === OCPPChargingStationCommand.GET_COMPOSITE_SCHEDULE) {
      // Check auth
      if (!Authorizations.canPerformActionOnChargingStation(req.user, command as unknown as Action, chargingStation)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: command as unknown as Action,
          entity: Entity.CHARGING_STATION,
          module: 'ChargingStationService', method: 'handleAction',
          value: chargingStation.id
        });
      }
      // Get the Vendor instance
      const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorInstance(chargingStation);
      if (!chargingStationVendor) {
        throw new AppError({
          source: chargingStation.id,
          action: Action.POWER_LIMITATION,
          errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
          message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for limiting the charge`,
          module: 'ChargingStationService', method: 'handleChargingStationLimitPower',
          user: req.user
        });
      }
      // Get composite schedule
      result = await chargingStationVendor.getCompositeSchedule(
        req.user.tenantID, chargingStation, filteredRequest.args.connectorId, filteredRequest.args.duration);
    } else {
      // Check auth
      if (!Authorizations.canPerformActionOnChargingStation(req.user, command as unknown as Action, chargingStation)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: command as unknown as Action,
          entity: Entity.CHARGING_STATION,
          module: 'ChargingStationService', method: 'handleAction',
          value: chargingStation.id
        });
      }
      // Execute it
      result = await this.handleChargingStationCommand(req.user.tenantID, req.user, chargingStation, command as OCPPChargingStationCommand, filteredRequest.args);
    }
    // Return
    res.json(result);
    next();
  }

  public static async handleIsAuthorized(action: Action, req: Request, res: Response, next: NextFunction) {
    let user: User;
    // Default
    let result = [{ 'IsAuthorized': false }];
    // Filter
    const filteredRequest = ChargingStationSecurity.filterIsAuthorizedRequest(req.query);
    // Check
    if (!filteredRequest.Action) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: 'The Action is mandatory',
        module: 'ChargingStationService',
        method: 'handleIsAuthorized',
        user: req.user,
        action: action
      });
    }
    let chargingStation: ChargingStation = null;
    // Action
    switch (filteredRequest.Action) {
      // Hack for mobile app not sending the RemoteStopTransaction yet
      case 'StopTransaction':
      case 'RemoteStopTransaction':
        // Check
        if (!filteredRequest.Arg1) {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
            message: 'The Charging Station ID is mandatory',
            module: 'ChargingStationService',
            method: 'handleIsAuthorized',
            user: req.user,
            action: action
          });
        }
        // Get the Charging station
        chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.Arg1);
        // Found?
        if (!chargingStation) {
          // Not Found!
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
            message: `Charging Station with ID '${filteredRequest.Arg1}' does not exist`,
            module: 'ChargingStationService',
            method: 'handleIsAuthorized',
            user: req.user,
            action: action
          });
        }
        // Check
        if (!filteredRequest.Arg2) {
          const results = [];
          // Check authorization for each connectors
          for (let index = 0; index < chargingStation.connectors.length; index++) {
            const foundConnector = chargingStation.connectors.find((connector) => connector.connectorId === index + 1);
            const tempResult = { 'IsAuthorized': false };
            if (foundConnector && foundConnector.activeTransactionID) {
              tempResult.IsAuthorized = await ChargingStationService.isStopTransactionAuthorized(
                filteredRequest, chargingStation, foundConnector.activeTransactionID, req.user);
            }
            results.push(tempResult);
          }
          // Return table of result (will be in the connector order)
          result = results;
        } else {
          result[0].IsAuthorized = await ChargingStationService.isStopTransactionAuthorized(
            filteredRequest, chargingStation, Utils.convertToInt(filteredRequest.Arg2), req.user);
        }
        break;
      // Action on connectors of a Charging Station
      case 'ConnectorsAction':
        // Arg1 contains the Charging Station ID
        // Check
        if (!filteredRequest.Arg1) {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
            message: 'The Charging Station ID is mandatory',
            module: 'ChargingStationService',
            method: 'handleIsAuthorized',
            user: req.user,
            action: action
          });
        }
        // Get the Charging station
        chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.Arg1);
        // Found?
        if (!chargingStation) {
          // Not Found!
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
            message: `Charging Station with ID '${filteredRequest.Arg1}' does not exist`,
            module: 'ChargingStationService',
            method: 'handleIsAuthorized',
            user: req.user,
            action: action
          });
        }

        user = await UserStorage.getUser(req.user.tenantID, req.user.id);
        // Found?
        if (!user) {
          // Not Found!
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
            message: `User with ID '${filteredRequest.Arg1}' does not exist`,
            module: 'ChargingStationService',
            method: 'handleIsAuthorized',
            user: req.user,
            action: action
          });
        }
        result = await ChargingStationService.checkConnectorsActionAuthorizations(req.user.tenantID, req.user, chargingStation);
        break;
    }
    // Return the result
    res.json(result.length === 1 ? result[0] : result);
    next();
  }

  private static async checkConnectorsActionAuthorizations(tenantID: string, user: UserToken, chargingStation: ChargingStation) {
    const results = [];
    if (Utils.isComponentActiveFromToken(user, TenantComponents.ORGANIZATION)) {
      try {
        // Site is mandatory
        if (!chargingStation.siteArea) {
          throw new AppError({
            source: chargingStation.id,
            errorCode: HTTPError.CHARGER_WITH_NO_SITE_AREA_ERROR,
            message: `Charging Station '${chargingStation.id}' is not assigned to a Site Area!`,
            module: 'ChargingStationService',
            method: 'checkConnectorsActionAuthorizations',
            user: user
          });
        }

        // Site -----------------------------------------------------
        chargingStation.siteArea.site = await SiteStorage.getSite(tenantID, chargingStation.siteArea.siteID);
        if (!chargingStation.siteArea.site) {
          throw new AppError({
            source: chargingStation.id,
            errorCode: HTTPError.SITE_AREA_WITH_NO_SITE_ERROR,
            message: `Site Area '${chargingStation.siteArea.name}' is not assigned to a Site!`,
            module: 'ChargingStationService',
            method: 'checkConnectorsActionAuthorizations',
            user: user
          });
        }
      } catch (error) {
        // Problem with site assignment so do not allow any action
        for (let index = 0; index < chargingStation.connectors.length; index++) {
          results.push(
            {
              'isStartAuthorized': false,
              'isStopAuthorized': false,
              'isTransactionDisplayAuthorized': false
            }
          );
        }
        return results;
      }
    }
    // Check authorization for each connectors
    for (let index = 0; index < chargingStation.connectors.length; index++) {
      const foundConnector = chargingStation.connectors.find(
        (connector) => connector.connectorId === index + 1);
      if (foundConnector.activeTransactionID > 0) {
        const transaction = await TransactionStorage.getTransaction(user.tenantID, foundConnector.activeTransactionID);
        results.push({
          'isStartAuthorized': false,
          'isStopAuthorized': Authorizations.canStopTransaction(user, transaction),
          'isTransactionDisplayAuthorized': Authorizations.canReadTransaction(user, transaction),
        });
      } else {
        results.push({
          'isStartAuthorized': Authorizations.canStartTransaction(user, chargingStation),
          'isStopAuthorized': false,
          'isTransactionDisplayAuthorized': false,
        });
      }
    }
    return results;
  }

  private static async isStopTransactionAuthorized(filteredRequest: HttpIsAuthorizedRequest, chargingStation: ChargingStation, transactionId: number, user: UserToken) {
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(user.tenantID, transactionId);
    if (!transaction) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Transaction ID '${filteredRequest.Arg2}' does not exist`,
        module: 'ChargingStationService',
        method: 'isStopTransactionAuthorized',
        user: user
      });
    }
    // Check Charging Station
    if (transaction.chargeBoxID !== chargingStation.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: 565,
        message: `Transaction ID '${filteredRequest.Arg2}' has a Charging Station '${transaction.chargeBoxID}' that differs from '${chargingStation.id}'`,
        module: 'ChargingStationService',
        method: 'isStopTransactionAuthorized',
        user: user
      });
    }
    return Authorizations.canStopTransaction(user, transaction);
  }

  private static async getChargingStations(req: Request): Promise<DataResult<ChargingStation>> {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CHARGING_STATIONS,
        module: 'ChargingStationService',
        method: 'handleGetChargingStations',
      });
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationsRequest(req.query);
    // Get Charging Stations
    const chargingStations = await ChargingStationStorage.getChargingStations(req.user.tenantID,
      {
        search: filteredRequest.Search,
        withNoSiteArea: filteredRequest.WithNoSiteArea,
        withSite: filteredRequest.WithSite,
        connectorStatus: filteredRequest.ConnectorStatus,
        issuer: filteredRequest.Issuer,
        siteIDs: Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        siteAreaID: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        includeDeleted: filteredRequest.IncludeDeleted
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      }
    );
    // Build the result
    if (chargingStations.result && chargingStations.result.length > 0) {
      // Filter
      ChargingStationSecurity.filterChargingStationsResponse(
        chargingStations, req.user, req.user.activeComponents.includes(TenantComponents.ORGANIZATION));
    }
    return chargingStations;
  }

  private static convertOCPPParamsToCSV(configurations: OCPPParams[]): string {
    let csv = `Charging Station${Constants.CSV_SEPARATOR}Name${Constants.CSV_SEPARATOR}Value${Constants.CSV_SEPARATOR}Site Area${Constants.CSV_SEPARATOR}Site\r\n`;
    for (const config of configurations) {
      for (const params of config.params.configuration) {
        csv += `${config.chargingStationName}` + Constants.CSV_SEPARATOR;
        csv += `${params.key}` + Constants.CSV_SEPARATOR;
        csv += `${Utils.replaceSpecialCharsInCSVValueParam(params.value)}` + Constants.CSV_SEPARATOR;
        csv += `${config.siteAreaName}` + Constants.CSV_SEPARATOR;
        csv += `${config.siteName}\r\n`;
      }
    }
    return csv;
  }

  private static convertToCSV(loggedUser: UserToken, chargingStations: ChargingStation[]): string {
    I18nManager.switchLanguage(loggedUser.language);
    let csv = `Name${Constants.CSV_SEPARATOR}Created On${Constants.CSV_SEPARATOR}Number of Connectors${Constants.CSV_SEPARATOR}Site Area${Constants.CSV_SEPARATOR}Latitude${Constants.CSV_SEPARATOR}Longitude${Constants.CSV_SEPARATOR}Charge Point S/N${Constants.CSV_SEPARATOR}Model${Constants.CSV_SEPARATOR}Charge Box S/N${Constants.CSV_SEPARATOR}Vendor${Constants.CSV_SEPARATOR}Firmware Version${Constants.CSV_SEPARATOR}Firmware Status${Constants.CSV_SEPARATOR}OCPP Version${Constants.CSV_SEPARATOR}OCPP Protocol${Constants.CSV_SEPARATOR}Last Heartbeat${Constants.CSV_SEPARATOR}Last Reboot${Constants.CSV_SEPARATOR}Maximum Power (Watt)${Constants.CSV_SEPARATOR}Can Charge In Parallel${Constants.CSV_SEPARATOR}Power Limit Unit\r\n`;
    for (const chargingStation of chargingStations) {
      csv += `${chargingStation.id}` + Constants.CSV_SEPARATOR;
      csv += `${I18nManager.formatDateTime(chargingStation.createdOn, 'L')} ${I18nManager.formatDateTime(chargingStation.createdOn, 'LT')}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.connectors ? chargingStation.connectors.length : '0'}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.siteArea.name}` + Constants.CSV_SEPARATOR;
      if (chargingStation.coordinates && chargingStation.coordinates.length === 2) {
        csv += `${chargingStation.coordinates[1]}` + Constants.CSV_SEPARATOR;
        csv += `${chargingStation.coordinates[0]}` + Constants.CSV_SEPARATOR;
      } else {
        csv += `''${Constants.CSV_SEPARATOR}''`;
      }
      csv += `${chargingStation.chargePointSerialNumber}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.chargePointModel}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.chargeBoxSerialNumber}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.chargePointVendor}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.firmwareVersion}` + Constants.CSV_SEPARATOR;
      if (chargingStation.lastFirmwareStatus) {
        csv += `${chargingStation.lastFirmwareStatus}` + Constants.CSV_SEPARATOR;
      }
      csv += `${chargingStation.ocppVersion}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.ocppProtocol}` + Constants.CSV_SEPARATOR;
      csv += `${I18nManager.formatDateTime(chargingStation.lastHeartBeat, 'L')} ${I18nManager.formatDateTime(chargingStation.lastHeartBeat, 'LT')}` + Constants.CSV_SEPARATOR;
      csv += `${I18nManager.formatDateTime(chargingStation.lastReboot, 'L')} ${I18nManager.formatDateTime(chargingStation.lastReboot, 'LT')}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.maximumPower}` + Constants.CSV_SEPARATOR;
      csv += (!chargingStation.cannotChargeInParallel ? 'yes' : 'no') + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.powerLimitUnit}\r\n`;
    }
    return csv;
  }

  private static async handleChargingStationCommand(tenantID: string, user: UserToken, chargingStation: ChargingStation,
    command: OCPPChargingStationCommand, params: any): Promise<any> {
    let result: any;
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    try {
      // Handle Requests
      switch (command) {
        // Reset
        case OCPPChargingStationCommand.RESET:
          result = await chargingStationClient.reset({ type: params.type });
          break;
        // Clear cache
        case OCPPChargingStationCommand.CLEAR_CACHE:
          result = await chargingStationClient.clearCache();
          break;
        // Get Configuration
        case OCPPChargingStationCommand.GET_CONFIGURATION:
          result = await chargingStationClient.getConfiguration({ key: params.key });
          break;
        // Set Configuration
        case OCPPChargingStationCommand.CHANGE_CONFIGURATION:
          // Change the config
          result = await chargingStationClient.changeConfiguration({
            key: params.key,
            value: params.value
          });
          // Check
          if (result.status === OCPPConfigurationStatus.ACCEPTED ||
              result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
            // Reboot?
            if (result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
              Logging.logWarning({
                tenantID: tenantID,
                source: chargingStation.id, user: user, action: command,
                module: 'ChargingStationService', method: 'handleChargingStationCommand',
                message: `Reboot is required due to change of param '${params.key}' to '${params.value}'`,
                detailedMessages: result
              });
            }
            // Refresh Configuration
            await OCPPUtils.requestAndSaveChargingStationOcppConfiguration(tenantID, chargingStation);
            // Check update with Vendor
            const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorInstance(chargingStation);
            if (chargingStationVendor) {
              await chargingStationVendor.checkUpdateOfOCPPParams(tenantID, chargingStation, params.key, params.value);
            }
          }
          break;
        // Unlock Connector
        case OCPPChargingStationCommand.UNLOCK_CONNECTOR:
          result = await chargingStationClient.unlockConnector({ connectorId: params.connectorId });
          break;
        // Start Transaction
        case OCPPChargingStationCommand.REMOTE_START_TRANSACTION:
          result = await chargingStationClient.remoteStartTransaction({
            connectorId: params.connectorId,
            idTag: params.tagID
          });
          break;
        // Stop Transaction
        case OCPPChargingStationCommand.REMOTE_STOP_TRANSACTION:
          result = await chargingStationClient.remoteStopTransaction({
            transactionId: params.transactionId
          });
          break;
        // Change availability
        case OCPPChargingStationCommand.CHANGE_AVAILABILITY:
          result = await chargingStationClient.changeAvailability({
            connectorId: params.connectorId,
            type: params.type
          });
          break;
        // Get diagnostic
        case OCPPChargingStationCommand.GET_DIAGNOSTICS:
          result = await chargingStationClient.getDiagnostics({
            location: params.location,
            retries: params.retries,
            retryInterval: params.retryInterval,
            startTime: params.startTime,
            stopTime: params.stopTime
          });
          break;
        // Update Firmware
        case OCPPChargingStationCommand.UPDATE_FIRMWARE:
          result = await chargingStationClient.updateFirmware({
            location: params.location,
            retries: params.retries,
            retrieveDate: params.retrieveDate,
            retryInterval: params.retryInterval
          });
          break;
      }
      // Ok?
      if (result) {
        // OCPP Command with status
        if (Utils.objectHasProperty(result, 'status') && result.status !== OCPPStatus.ACCEPTED) {
          Logging.logError({
            tenantID: tenantID, source: chargingStation.id, user: user,
            module: 'ChargingStationService', method: 'handleChargingStationCommand',
            action: command,
            message: `OCPP Command '${command}' has failed`,
            detailedMessages: { params, result }
          });
        } else {
          // OCPP Command with no status
          Logging.logInfo({
            tenantID: tenantID, source: chargingStation.id, user: user,
            module: 'ChargingStationService', method: 'handleChargingStationCommand',
            action: command,
            message: `OCPP Command '${command}' has been executed successfully`,
            detailedMessages: { params, result }
          });
        }
        return result;
      }
      // Throw error
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: command as unknown as Action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Unknown OCPP command '${command}'`,
        module: 'ChargingStationService',
        method: 'handleChargingStationCommand',
        user: user,
      });
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: command as unknown as Action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `OCPP Command '${command}' has failed`,
        module: 'ChargingStationService',
        method: 'handleChargingStationCommand',
        user: user,
        detailedMessages: { params, error }
      });
    }
  }
}
