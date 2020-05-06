import { Action, Entity } from '../../../types/Authorization';
import ChargingStation, { Command, OCPPParams, StaticLimitAmps } from '../../../types/ChargingStation';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { HttpChargingStationCommandRequest, HttpIsAuthorizedRequest } from '../../../types/requests/HttpChargingStationRequest';
import { NextFunction, Request, Response } from 'express';
import { OCPPConfigurationStatus, OCPPStatus } from '../../../types/ocpp/OCPPClient';

import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import BackendError from '../../../exception/BackendError';
import { ChargingProfile } from '../../../types/ChargingProfile';
import ChargingStationClientFactory from '../../../client/ocpp/ChargingStationClientFactory';
import { ChargingStationInErrorType } from '../../../types/InError';
import ChargingStationSecurity from './security/ChargingStationSecurity';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ChargingStationVendorFactory from '../../../integration/charging-station-vendor/ChargingStationVendorFactory';
import Constants from '../../../utils/Constants';
import { DataResult } from '../../../types/DataResult';
import I18nManager from '../../../utils/I18nManager';
import LockingHelper from '../../../locking/LockingHelper';
import LockingManager from '../../../locking/LockingManager';
import Logging from '../../../utils/Logging';
import OCPPStorage from '../../../storage/mongodb/OCPPStorage';
import OCPPUtils from '../../ocpp/utils/OCPPUtils';
import { ServerAction } from '../../../types/Server';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import SmartChargingFactory from '../../../integration/smart-charging/SmartChargingFactory';
import TenantComponents from '../../../types/TenantComponents';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import UserToken from '../../../types/UserToken';
import Utils from '../../../utils/Utils';
import UtilsService from './UtilsService';
import fs from 'fs';
import sanitize from 'mongo-sanitize';

const MODULE_NAME = 'ChargingStationService';

export default class ChargingStationService {

  public static async handleAssignChargingStationsToSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.CHARGING_STATION, MODULE_NAME, 'handleAssignChargingStationsToSiteArea');
    // Filter
    const filteredRequest = ChargingStationSecurity.filterAssignChargingStationsToSiteAreaRequest(req.body);
    // Check mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.siteAreaID, MODULE_NAME, 'handleAssignChargingStationsToSiteArea', req.user);
    if (!filteredRequest.chargingStationIDs || (filteredRequest.chargingStationIDs && filteredRequest.chargingStationIDs.length <= 0)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Charging Station\'s IDs must be provided',
        module: MODULE_NAME,
        method: 'handleAssignChargingStationsToSiteArea',
        user: req.user
      });
    }
    // Get the Site Area (before auth to get siteID)
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
    UtilsService.assertObjectExists(action, siteArea, `Site Area '${filteredRequest.siteAreaID}' doesn't exist anymore.`,
      MODULE_NAME, 'handleAssignChargingStationsToSiteArea', req.user);
    // Check auth
    if (!Authorizations.canUpdateSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SITE_AREA,
        module: MODULE_NAME,
        method: 'handleAssignChargingStationsToSiteArea',
        value: filteredRequest.siteAreaID
      });
    }
    // Get Charging Stations
    for (const chargingStationID of filteredRequest.chargingStationIDs) {
      // Check the charging station
      const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, chargingStationID);
      UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${chargingStationID}' doesn't exist anymore.`,
        MODULE_NAME, 'handleAssignChargingStationsToSiteArea', req.user);
      // Check auth
      if (!Authorizations.canUpdateChargingStation(req.user, siteArea.siteID)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.UPDATE,
          entity: Entity.CHARGING_STATION,
          module: MODULE_NAME,
          method: 'handleAssignChargingStationsToSiteArea',
          value: chargingStationID
        });
      }
    }
    // Save
    if (action === ServerAction.ADD_CHARGING_STATION_TO_SITE_AREA) {
      await ChargingStationStorage.addChargingStationsToSiteArea(req.user.tenantID, filteredRequest.siteAreaID, filteredRequest.chargingStationIDs);
    } else {
      await ChargingStationStorage.removeChargingStationsFromSiteArea(req.user.tenantID, filteredRequest.siteAreaID, filteredRequest.chargingStationIDs);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME,
      method: 'handleAssignChargingStationsToSiteArea',
      message: 'Site Area\'s Charging Stations have been assigned successfully',
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateChargingStationParams(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationParamsUpdateRequest(req.body);
    // Check existence
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.id);
    // Check
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${filteredRequest.id}' doesn't exist.`,
      MODULE_NAME, 'handleAssignChargingStationsToSiteArea', req.user);
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
        module: MODULE_NAME,
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
    // Update Private property
    if (Utils.objectHasProperty(filteredRequest, 'private')) {
      chargingStation.private = filteredRequest.private;
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
    await ChargingStationStorage.saveChargingStation(req.user.tenantID, chargingStation);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id, action: action,
      user: req.user, module: MODULE_NAME,
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

  public static async handleChargingStationLimitPower(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationLimitPowerRequest(req.body);
    // Check
    if (filteredRequest.ampLimitValue < StaticLimitAmps.MIN_LIMIT) {
      throw new AppError({
        source: filteredRequest.chargeBoxID,
        action: action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Limitation to ${filteredRequest.ampLimitValue}A is too low, min required is ${StaticLimitAmps.MIN_LIMIT}A`,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Check existence
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    // Check
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${filteredRequest.chargeBoxID}' doesn't exist.`,
      MODULE_NAME, 'handleChargingStationLimitPower', req.user);
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
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        value: chargingStation.id
      });
    }
    // Check if limit is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportStaticLimitationForChargingStation) {
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        message: 'Charging Station does not support power limitation',
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Get the Vendor instance
    const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
    if (!chargingStationVendor) {
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for limiting the charge`,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        user: req.user
      });
    }
    // Check Charging Profile
    const chargingProfiles = await ChargingStationStorage.getChargingProfiles(req.user.tenantID,
      { chargingStationID: chargingStation.id, connectorID: 0 },
      Constants.DB_PARAMS_MAX_LIMIT);
    const updatedChargingProfiles: ChargingProfile[] = Utils.cloneJSonDocument(chargingProfiles.result) as ChargingProfile[];
    for (let index = 0; index < updatedChargingProfiles.length; index++) {
      const updatedChargingProfile = updatedChargingProfiles[index];
      let planHasBeenAdjusted = false;
      // Check schedules
      if (updatedChargingProfile.profile && updatedChargingProfile.profile.chargingSchedule &&
        updatedChargingProfile.profile.chargingSchedule.chargingSchedulePeriod) {
        for (const chargingSchedulePeriod of updatedChargingProfile.profile.chargingSchedule.chargingSchedulePeriod) {
          // Check the limit max is beyond the new values
          if (chargingSchedulePeriod.limit > filteredRequest.ampLimitValue) {
            // Adjust it
            planHasBeenAdjusted = true;
            chargingSchedulePeriod.limit = filteredRequest.ampLimitValue;
          }
        }
      }
      // Charging plan updated?
      if (planHasBeenAdjusted) {
        // Check Force Update?
        if (!filteredRequest.forceUpdateChargingPlan) {
          throw new AppError({
            source: chargingStation.id,
            action: action,
            user: req.user,
            errorCode: HTTPError.GENERAL_ERROR,
            message: `Cannot change the current limitation to ${filteredRequest.ampLimitValue}A because of an existing charging plan!`,
            module: MODULE_NAME, method: 'handleChargingStationLimitPower',
            detailedMessages: { result: chargingProfiles.result[index] }
          });
        }
        // Log
        Logging.logWarning({
          tenantID: req.user.tenantID,
          source: chargingStation.id,
          action: action,
          user: req.user,
          module: MODULE_NAME, method: 'handleChargingStationLimitPower',
          message: `Adjust the Charging Plan power limit to ${filteredRequest.ampLimitValue}A`,
          detailedMessages: { chargingProfile: chargingProfiles.result[index] }
        });
        // Apply & Save charging plan
        await OCPPUtils.setAndSaveChargingProfile(req.user.tenantID, updatedChargingProfile, req.user);
        break;
      }
    }
    // Call the limitation
    const result = await chargingStationVendor.setPowerLimitation(
      req.user.tenantID, chargingStation, filteredRequest.connectorId, filteredRequest.ampLimitValue);
    if (result.status !== OCPPConfigurationStatus.ACCEPTED && result.status !== OCPPConfigurationStatus.REBOOT_REQUIRED) {
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.LIMIT_POWER_ERROR,
        module: MODULE_NAME, method: 'handleChargingStationLimitPower',
        message: `Cannot limit the charger's power to ${filteredRequest.ampLimitValue}A: '${result.status}'`,
        detailedMessages: { result },
        user: req.user
      });
    }
    Logging.logInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id,
      action: action,
      user: req.user,
      module: MODULE_NAME, method: 'handleChargingStationLimitPower',
      message: `The charger's power limit has been successfully set to ${filteredRequest.ampLimitValue}A`,
      detailedMessages: { result }
    });
    // Ok
    res.json({ status: result.status });
    next();
  }

  public static async handleGetChargingProfiles(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationProfilesRequest(req.query);
    // Check
    UtilsService.assertIdIsProvided(action, filteredRequest.ChargeBoxID, MODULE_NAME, 'handleGetChargingProfiles', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CHARGING_STATION,
        module: MODULE_NAME,
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

  public static async handleTriggerSmartCharging(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if Component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.SMART_CHARGING,
      Action.UPDATE, Entity.SITE_AREA, MODULE_NAME, 'handleTriggerSmartCharging');
    // Filter
    const filteredRequest = ChargingStationSecurity.filterTriggerSmartCharging(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.siteAreaID, MODULE_NAME, 'handleTriggerSmartCharging', req.user);
    // Get Site Area
    const siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
    UtilsService.assertObjectExists(action, siteArea, `Site Area '${filteredRequest.siteAreaID}' doesn't exist anymore.`,
      MODULE_NAME, 'handleTriggerSmartCharging', req.user);
    // Check auth
    if (!Authorizations.canUpdateSiteArea(req.user, siteArea.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SITE_AREA,
        module: MODULE_NAME,
        method: 'handleAssignAssetsToSiteArea',
        value: filteredRequest.siteAreaID
      });
    }
    // Call Smart Charging
    const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.user.tenantID);
    if (!smartCharging) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Smart Charging service is not configured',
        module: MODULE_NAME, method: 'handleTriggerSmartCharging',
        action: action,
        user: req.user
      });
    }
    const siteAreaLock = await LockingHelper.createAndAquireExclusiveLockForSiteArea(req.user.tenantID, siteArea);
    if (siteAreaLock) {
      try {
        // Call
        const actionsResponse = await smartCharging.computeAndApplyChargingProfiles(siteArea);
        if (actionsResponse && actionsResponse.inError > 0) {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            action: action,
            errorCode: HTTPError.GENERAL_ERROR,
            module: MODULE_NAME, method: 'handleTriggerSmartCharging',
            user: req.user,
            message: 'Error occurred while triggering the smart charging',
          });
        }
      } finally {
        // Release lock
        await LockingManager.release(siteAreaLock);
      }
    }
    // Ok
    // FIXME: handle failure to take the lock in the response sent
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateChargingProfile(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingProfileUpdateRequest(req.body);
    // Check Mandatory fields
    Utils.checkIfChargingProfileIsValid(filteredRequest, req);
    // Check existence
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargingStationID);
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${req.body.ChargingStationID}' doesn't exist.`,
      MODULE_NAME, 'handleUpdateChargingProfile', req.user);
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
        module: MODULE_NAME,
        method: 'handleUpdateChargingProfile',
        value: chargingStation.id
      });
    }
    // Check if Charging Profile is supported
    if (!chargingStation.capabilities || !chargingStation.capabilities.supportChargingProfiles) {
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
        user: req.user,
        module: MODULE_NAME, method: 'handleUpdateChargingProfile',
        message: `Charging Station '${chargingStation.id}' does not support Charging Profiles`,
      });
    }
    // Apply & Save charging plan
    await OCPPUtils.setAndSaveChargingProfile(req.user.tenantID, filteredRequest, req.user);
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteChargingProfile(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check existence
    const chargingProfileID = ChargingStationSecurity.filterChargingProfileRequestByID(req.query);
    // Get Profile
    const chargingProfile = await ChargingStationStorage.getChargingProfile(req.user.tenantID, chargingProfileID);
    UtilsService.assertObjectExists(action, chargingProfile, `Charging Profile ID '${chargingProfileID}' doesn't exist.`,
      MODULE_NAME, 'handleDeleteChargingProfile', req.user);
    // Get Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, chargingProfile.chargingStationID);
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${chargingProfile.chargingStationID}' doesn't exist.`,
      MODULE_NAME, 'handleDeleteChargingProfile', req.user);
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
        action: Action.UPDATE,
        entity: Entity.CHARGING_STATION,
        module: MODULE_NAME, method: 'handleDeleteChargingProfile',
        value: chargingStation.id
      });
    }
    try {
      // Delete
      await OCPPUtils.clearAndDeleteChargingProfile(req.user.tenantID, chargingProfile);
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: action,
        errorCode: HTTPError.CLEAR_CHARGING_PROFILE_NOT_SUCCESSFUL,
        message: 'Error occurred while clearing Charging Profile',
        module: MODULE_NAME, method: 'handleDeleteChargingProfile',
        user: req.user, actionOnUser: req.user,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingStationOcppParameters(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationOcppParametersRequest(req.query);
    // Check
    UtilsService.assertIdIsProvided(action, filteredRequest.ChargeBoxID, MODULE_NAME, 'handleGetChargingStationOcppParameters', req.user);
    // Get the Charging Station`
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ChargeBoxID);
    // Found?
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${filteredRequest.ChargeBoxID}' doesn't exist anymore.`,
      MODULE_NAME, 'handleAssignChargingStationsToSiteArea', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CHARGING_STATION,
        module: MODULE_NAME,
        method: 'handleGetChargingStationOcppParameters',
        value: chargingStation.id
      });
    }
    // Get the Parameters
    const parameters = await ChargingStationStorage.getOcppParameters(req.user.tenantID, chargingStation.id);
    // Return the result
    res.json(parameters);
    next();
  }

  public static async handleRequestChargingStationOcppParameters(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterRequestChargingStationOcppParametersRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.chargeBoxID, MODULE_NAME, 'handleRequestChargingStationOcppParameters', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CHARGING_STATION,
        module: MODULE_NAME,
        method: 'handleRequestChargingStationOcppParameters',
        value: filteredRequest.chargeBoxID
      });
    }
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    // Found?
    UtilsService.assertObjectExists(action, chargingStation, `ChargingStation '${filteredRequest.chargeBoxID}' doesn't exist anymore.`,
      MODULE_NAME, 'handleRequestChargingStationOcppParameters', req.user);
    // Get the Config
    const result = await OCPPUtils.requestAndSaveChargingStationOcppParameters(
      req.user.tenantID, chargingStation, filteredRequest.forceUpdateOCPPParamsFromTemplate);
    // Ok
    res.json(result);
    next();
  }

  public static async handleDeleteChargingStation(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const chargingStationID = ChargingStationSecurity.filterChargingStationRequestByID(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, chargingStationID, MODULE_NAME,
      'handleDeleteChargingStation', req.user);
    // Get
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, chargingStationID);
    // Check
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station with ID '${chargingStationID}' does not exist`,
      MODULE_NAME, 'handleDeleteChargingStation', req.user);

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
        module: MODULE_NAME,
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
        module: MODULE_NAME,
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
            module: MODULE_NAME,
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
      await ChargingStationStorage.saveChargingStation(req.user.tenantID, chargingStation);
    } else {
      // Delete physically
      await ChargingStationStorage.deleteChargingStation(req.user.tenantID, chargingStation.id);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteChargingStation',
      message: `Charging Station '${chargingStation.id}' has been deleted successfully`,
      action: action,
      detailedMessages: { chargingStation }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetChargingStation(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationRequest(req.query);
    // Check
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetChargingStation', req.user);
    // Check auth
    if (!Authorizations.canReadChargingStation(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CHARGING_STATION,
        module: MODULE_NAME,
        method: 'handleGetChargingStation',
        value: filteredRequest.ID
      });
    }
    // Query charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ID);
    // Check
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetChargingStation', req.user);
    // Deleted?
    if (chargingStation.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `ChargingStation with ID '${filteredRequest.ID}' is logically deleted`,
        module: MODULE_NAME,
        method: 'handleGetChargingStation',
        user: req.user
      });
    }
    res.json(
      // Filter
      ChargingStationSecurity.filterChargingStationResponse(
        chargingStation, req.user, Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION))
    );
    next();
  }

  public static async handleGetChargingStations(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    res.json(await ChargingStationService.getChargingStations(req));
    next();
  }

  public static async handleChargingStationsOCPPParamsExport(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
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
          module: MODULE_NAME,
          method: 'handleChargingStationsOCPPParamsExport',
        });
      }
    }
    const ocppParams: OCPPParams[] = [];
    for (const chargingStation of chargingStations.result) {
      const ocppParameters = await ChargingStationStorage.getOcppParameters(req.user.tenantID, chargingStation.id);
      // Get OCPP Params
      ocppParams.push({
        params: ocppParameters.result,
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

  public static async handleGetChargingStationsExport(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
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

  public static async handleGetChargingStationsInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CHARGING_STATIONS,
        module: MODULE_NAME,
        method: 'handleGetChargingStations'
      });
    }
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationsRequest(req.query);
    // Check component
    if (filteredRequest.SiteID) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
        Action.READ, Entity.CHARGING_STATIONS, MODULE_NAME, 'handleGetChargingStations');
    }
    let errorType;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      // Get the Site Area
      errorType = (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') :
        [ChargingStationInErrorType.MISSING_SETTINGS, ChargingStationInErrorType.CONNECTION_BROKEN,
          ChargingStationInErrorType.CONNECTOR_ERROR, ChargingStationInErrorType.MISSING_SITE_AREA]);
    } else {
      errorType = (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') :
        [ChargingStationInErrorType.MISSING_SETTINGS, ChargingStationInErrorType.CONNECTION_BROKEN,
          ChargingStationInErrorType.CONNECTOR_ERROR]);
    }
    // Get Charging Stations
    const chargingStations = await ChargingStationStorage.getChargingStationsInError(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteIDs: Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        errorType
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      }
    );
    // Build the result
    ChargingStationSecurity.filterChargingStationsResponse(chargingStations, req.user,
      Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION));
    // Return
    res.json(chargingStations);
    next();
  }

  public static async handleGetStatusNotifications(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CHARGING_STATIONS,
        module: MODULE_NAME,
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

  public static async handleGetBootNotifications(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListChargingStations(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CHARGING_STATIONS,
        module: MODULE_NAME,
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

  public static async handleGetFirmware(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = ChargingStationSecurity.filterChargingStationGetFirmwareRequest(req.query);
    if (!filteredRequest.FileName) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The firmware FileName is mandatory',
        module: MODULE_NAME,
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
        action: action,
        message: `Firmware '${filteredRequest.FileName}' has not been found!`,
        module: MODULE_NAME, method: 'handleGetFirmware',
        detailedMessages: { error: error.message, stack: error.stack },
      });
      res.sendStatus(404);
    });
    // End of download
    bucketStream.on('end', () => {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: action,
        message: `Firmware '${filteredRequest.FileName}' has been downloaded with success`,
        module: MODULE_NAME, method: 'handleGetFirmware',
      });
      res.end();
    });
  }

  public static async handleAction(action: ServerAction, command: Command, req: Request, res: Response, next: NextFunction) {
    // Filter - Type is hacked because code below is. Would need approval to change code structure.
    const filteredRequest: HttpChargingStationCommandRequest =
      ChargingStationSecurity.filterChargingStationActionRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.chargeBoxID, MODULE_NAME, 'handleAction', req.user);
    // Get the Charging station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.chargeBoxID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`,
      MODULE_NAME, 'handleAction', req.user);
    let result;
    // Remote Stop Transaction / Unlock Connector
    if (command === Command.REMOTE_STOP_TRANSACTION) {
      // Check Transaction ID
      if (!filteredRequest.args || !filteredRequest.args.transactionId) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Transaction ID is mandatory',
          module: MODULE_NAME,
          method: 'handleAction',
          user: req.user,
          action: action,
        });
      }
      // Get Transaction
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.args.transactionId);
      UtilsService.assertObjectExists(action, transaction, `Transaction ID '${filteredRequest.args.transactionId}' does not exist`,
        MODULE_NAME, 'handleAction', req.user);
      // Add connector ID
      filteredRequest.args.connectorId = transaction.connectorId;
      // Check Tag ID
      if (!req.user.tagIDs || req.user.tagIDs.length === 0) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.USER_NO_BADGE_ERROR,
          message: 'The user does not have any badge',
          module: MODULE_NAME,
          method: 'handleAction',
          user: req.user,
          action: action,
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
      result = await this.handleChargingStationCommand(
        req.user.tenantID, req.user, chargingStation, action, command, filteredRequest.args);
      // Remote Start Transaction
    } else if (command === Command.REMOTE_START_TRANSACTION) {
      // Check Tag ID
      if (!filteredRequest.args || !filteredRequest.args.tagID) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.USER_NO_BADGE_ERROR,
          message: 'The user does not have any badge',
          module: MODULE_NAME,
          method: 'handleAction',
          user: req.user,
          action: action,
        });
      }
      // Check if user is authorized
      await Authorizations.isAuthorizedToStartTransaction(
        req.user.tenantID, chargingStation, filteredRequest.args.tagID);
      // Ok: Execute it
      result = await this.handleChargingStationCommand(
        req.user.tenantID, req.user, chargingStation, action, command, filteredRequest.args);
    } else if (command === Command.GET_COMPOSITE_SCHEDULE) {
      // Check auth
      if (!Authorizations.canPerformActionOnChargingStation(req.user, command as unknown as Action, chargingStation)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: command as unknown as Action,
          entity: Entity.CHARGING_STATION,
          module: MODULE_NAME, method: 'handleAction',
          value: chargingStation.id
        });
      }
      // Get the Vendor instance
      const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
      if (!chargingStationVendor) {
        throw new AppError({
          source: chargingStation.id,
          action: action,
          errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
          message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for limiting the charge`,
          module: MODULE_NAME, method: 'handleAction',
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
          module: MODULE_NAME, method: 'handleAction',
          value: chargingStation.id
        });
      }
      // Execute it
      result = await this.handleChargingStationCommand(
        req.user.tenantID, req.user, chargingStation, action, command, filteredRequest.args);
    }
    // Return
    res.json(result);
    next();
  }

  public static async handleCheckSmartChargingConnection(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if Component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.SMART_CHARGING,
      Action.CHECK_CONNECTION, Entity.CHARGING_STATION, MODULE_NAME, 'handleCheckSmartChargingConnection');
    // Check auth
    if (!Authorizations.canReadSetting(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        entity: Entity.SETTING,
        action: Action.UPDATE,
        module: MODULE_NAME,
        method: 'handleCheckSmartChargingConnection'
      });
    }
    // Get implementation
    const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.user.tenantID);
    if (!smartCharging) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Smart Charging service is not configured',
        module: MODULE_NAME, method: 'handleCheckSmartChargingConnection',
        action: action,
        user: req.user
      });
    }
    // Check
    await smartCharging.checkConnection();
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
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
            module: MODULE_NAME,
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
            module: MODULE_NAME,
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
        module: MODULE_NAME,
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
        module: MODULE_NAME,
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
        module: MODULE_NAME,
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
        connectorStatuses: (filteredRequest.ConnectorStatus ? filteredRequest.ConnectorStatus.split('|') : null),
        connectorTypes: (filteredRequest.ConnectorType ? filteredRequest.ConnectorType.split('|') : null),
        issuer: filteredRequest.Issuer,
        siteIDs: Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
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
        chargingStations, req.user, Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION));
    }
    return chargingStations;
  }

  private static convertOCPPParamsToCSV(configurations: OCPPParams[]): string {
    let csv = `Charging Station${Constants.CSV_SEPARATOR}Name${Constants.CSV_SEPARATOR}Value${Constants.CSV_SEPARATOR}Site Area${Constants.CSV_SEPARATOR}Site\r\n`;
    for (const config of configurations) {
      for (const param of config.params) {
        csv += `${config.chargingStationName}` + Constants.CSV_SEPARATOR;
        csv += `${param.key}` + Constants.CSV_SEPARATOR;
        csv += `${Utils.replaceSpecialCharsInCSVValueParam(param.value)}` + Constants.CSV_SEPARATOR;
        csv += `${config.siteAreaName}` + Constants.CSV_SEPARATOR;
        csv += `${config.siteName}\r\n`;
      }
    }
    return csv;
  }

  private static convertToCSV(loggedUser: UserToken, chargingStations: ChargingStation[]): string {
    const i18nManager = new I18nManager(loggedUser.locale);
    let csv = `Name${Constants.CSV_SEPARATOR}Created On${Constants.CSV_SEPARATOR}Number of Connectors${Constants.CSV_SEPARATOR}Site Area${Constants.CSV_SEPARATOR}Latitude${Constants.CSV_SEPARATOR}Longitude${Constants.CSV_SEPARATOR}Charge Point S/N${Constants.CSV_SEPARATOR}Model${Constants.CSV_SEPARATOR}Charge Box S/N${Constants.CSV_SEPARATOR}Vendor${Constants.CSV_SEPARATOR}Firmware Version${Constants.CSV_SEPARATOR}OCPP Version${Constants.CSV_SEPARATOR}OCPP Protocol${Constants.CSV_SEPARATOR}Last Heartbeat${Constants.CSV_SEPARATOR}Last Reboot${Constants.CSV_SEPARATOR}Maximum Power (Watt)${Constants.CSV_SEPARATOR}Can Charge In Parallel${Constants.CSV_SEPARATOR}Power Limit Unit\r\n`;
    for (const chargingStation of chargingStations) {
      csv += `${chargingStation.id}` + Constants.CSV_SEPARATOR;
      csv += `${i18nManager.formatDateTime(chargingStation.createdOn, 'L')} ${i18nManager.formatDateTime(chargingStation.createdOn, 'LT')}` + Constants.CSV_SEPARATOR;
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
      csv += `${chargingStation.ocppVersion}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.ocppProtocol}` + Constants.CSV_SEPARATOR;
      csv += `${i18nManager.formatDateTime(chargingStation.lastHeartBeat, 'L')} ${i18nManager.formatDateTime(chargingStation.lastHeartBeat, 'LT')}` + Constants.CSV_SEPARATOR;
      csv += `${i18nManager.formatDateTime(chargingStation.lastReboot, 'L')} ${i18nManager.formatDateTime(chargingStation.lastReboot, 'LT')}` + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.maximumPower}` + Constants.CSV_SEPARATOR;
      csv += (!chargingStation.cannotChargeInParallel ? 'yes' : 'no') + Constants.CSV_SEPARATOR;
      csv += `${chargingStation.powerLimitUnit}\r\n`;
    }
    return csv;
  }

  private static async handleChargingStationCommand(tenantID: string, user: UserToken, chargingStation: ChargingStation,
    action: ServerAction, command: Command, params: any): Promise<any> {
    let result: any;
    // Get the OCPP Client
    const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenantID, chargingStation);
    if (!chargingStationClient) {
      throw new BackendError({
        source: chargingStation.id,
        action: action,
        module: MODULE_NAME, method: 'handleChargingStationCommand',
        message: 'Charging Station is not connected to the backend',
      });
    }
    try {
      // Handle Requests
      switch (command) {
        // Reset
        case Command.RESET:
          result = await chargingStationClient.reset({ type: params.type });
          break;
        // Clear cache
        case Command.CLEAR_CACHE:
          result = await chargingStationClient.clearCache();
          break;
        // Get Configuration
        case Command.GET_CONFIGURATION:
          result = await chargingStationClient.getConfiguration({ key: params.key });
          break;
        // Set Configuration
        case Command.CHANGE_CONFIGURATION:
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
                source: chargingStation.id,
                user: user,
                action: action,
                module: MODULE_NAME, method: 'handleChargingStationCommand',
                message: `Reboot is required due to change of param '${params.key}' to '${params.value}'`,
                detailedMessages: { result }
              });
            }
            // Refresh Configuration
            await OCPPUtils.requestAndSaveChargingStationOcppParameters(tenantID, chargingStation);
            // Check update with Vendor
            const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
            if (chargingStationVendor) {
              await chargingStationVendor.checkUpdateOfOCPPParams(tenantID, chargingStation, params.key, params.value);
            }
          }
          break;
        // Unlock Connector
        case Command.UNLOCK_CONNECTOR:
          result = await chargingStationClient.unlockConnector({ connectorId: params.connectorId });
          break;
        // Start Transaction
        case Command.REMOTE_START_TRANSACTION:
          result = await chargingStationClient.remoteStartTransaction({
            connectorId: params.connectorId,
            idTag: params.tagID
          });
          break;
        // Stop Transaction
        case Command.REMOTE_STOP_TRANSACTION:
          result = await chargingStationClient.remoteStopTransaction({
            transactionId: params.transactionId
          });
          break;
        // Change availability
        case Command.CHANGE_AVAILABILITY:
          result = await chargingStationClient.changeAvailability({
            connectorId: params.connectorId,
            type: params.type
          });
          break;
        // Get diagnostic
        case Command.GET_DIAGNOSTICS:
          result = await chargingStationClient.getDiagnostics({
            location: params.location,
            retries: params.retries,
            retryInterval: params.retryInterval,
            startTime: params.startTime,
            stopTime: params.stopTime
          });
          break;
        // Update Firmware
        case Command.UPDATE_FIRMWARE:
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
            tenantID: tenantID,
            source: chargingStation.id,
            user: user,
            module: MODULE_NAME, method: 'handleChargingStationCommand',
            action: action,
            message: `OCPP Command '${command}' has failed`,
            detailedMessages: { params, result }
          });
        } else {
          // OCPP Command with no status
          Logging.logInfo({
            tenantID: tenantID,
            source: chargingStation.id,
            user: user,
            module: MODULE_NAME, method: 'handleChargingStationCommand',
            action: action,
            message: `OCPP Command '${command}' has been executed successfully`,
            detailedMessages: { params, result }
          });
        }
        return result;
      }
      // Throw error
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Unknown OCPP command '${command}'`,
        module: MODULE_NAME,
        method: 'handleChargingStationCommand',
        user: user,
      });
    } catch (error) {
      throw new AppError({
        source: chargingStation.id,
        action: action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `OCPP Command '${command}' has failed`,
        module: MODULE_NAME, method: 'handleChargingStationCommand',
        user: user,
        detailedMessages: { error: error.message, stack: error.stack, params }
      });
    }
  }
}
