import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import SiteArea, { SiteAreaValueTypes, SiteAreaValues } from '../../../../types/SiteArea';

import { ActionsResponse } from '../../../../types/GlobalType';
import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import { ChargingProfilePurposeType } from '../../../../types/ChargingProfile';
import Constants from '../../../../utils/Constants';
import Consumption from '../../../../types/Consumption';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import OCPPUtils from '../../../ocpp/utils/OCPPUtils';
import { ServerAction } from '../../../../types/Server';
import { SiteAreaDataResult } from '../../../../types/DataResult';
import SiteAreaSecurity from './security/SiteAreaSecurity';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SmartChargingFactory from '../../../../integration/smart-charging/SmartChargingFactory';
import TenantComponents from '../../../../types/TenantComponents';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment';

const MODULE_NAME = 'SiteAreaService';

export default class SiteAreaService {
  public static async handleAssignAssetsToSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.UPDATE, Entity.ASSET, MODULE_NAME, 'handleAssignAssetsToSiteArea');
    // Filter request
    const filteredRequest = SiteAreaSecurity.filterAssignAssetsToSiteAreaRequest(req.body);
    // Check and Get Site Area
    const authAction = action === ServerAction.ADD_ASSET_TO_SITE_AREA ? Action.ASSIGN_ASSETS_TO_SITE_AREA : Action.UNASSIGN_ASSETS_TO_SITE_AREA;
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.siteAreaID, authAction, action);
    // Check and Get Assets
    const assets = await UtilsService.checkSiteAreaAssetsAuthorization(
      req.tenant, req.user, siteArea, filteredRequest.assetIDs, action);
    // Save
    if (action === ServerAction.ADD_ASSET_TO_SITE_AREA) {
      await SiteAreaStorage.addAssetsToSiteArea(req.user.tenantID, siteArea, assets.map((asset) => asset.id));
    } else {
      await SiteAreaStorage.removeAssetsFromSiteArea(req.user.tenantID, filteredRequest.siteAreaID, assets.map((asset) => asset.id));
    }
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME,
      method: 'handleAssignAssetsToSiteArea',
      message: 'Site Area\'s Assets have been assigned successfully',
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleAssignChargingStationsToSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.CHARGING_STATION, MODULE_NAME, 'handleAssignChargingStationsToSiteArea');
    // Filter request
    const filteredRequest = SiteAreaSecurity.filterAssignChargingStationsToSiteAreaRequest(req.body);
    // Check and Get Site Area
    const authAction = action === ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA ? Action.ASSIGN_CHARGING_STATIONS_TO_SITE_AREA : Action.UNASSIGN_CHARGING_STATIONS_TO_SITE_AREA;
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.siteAreaID, authAction, action, null, { withSite: true });
    // Check and Get Charging Stations
    const chargingStations = await UtilsService.checkSiteAreaChargingStationsAuthorization(
      req.tenant, req.user, siteArea, filteredRequest.chargingStationIDs, action);
    // Check if Charging Station has 3 phases on 1 phase Site Area
    if (siteArea.numberOfPhases === 1) {
      for (const chargingStation of chargingStations) {
        for (const connector of chargingStation.connectors) {
          const chargePoint = Utils.getChargePointFromID(chargingStation, connector.chargePointID);
          const numberOfConnectedPhase = Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connector.connectorId);
          if (numberOfConnectedPhase !== 1 && action === ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA) {
            throw new AppError({
              source: Constants.CENTRAL_SERVER,
              action: action,
              errorCode: HTTPError.THREE_PHASE_CHARGER_ON_SINGLE_PHASE_SITE_AREA,
              message: `Error occurred while assigning charging station: '${chargingStation.id}'. Charging Station is not single phased`,
              module: MODULE_NAME, method: 'handleAssignChargingStationsToSiteArea',
              user: req.user
            });
          }
        }
      }
    }
    // Save
    if (action === ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA) {
      await SiteAreaStorage.addChargingStationsToSiteArea(
        req.user.tenantID, siteArea, chargingStations.map((chargingStation) => chargingStation.id));
    } else {
      await SiteAreaStorage.removeChargingStationsFromSiteArea(
        req.user.tenantID, filteredRequest.siteAreaID, chargingStations.map((chargingStation) => chargingStation.id));
    }
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME, method: 'handleAssignChargingStationsToSiteArea',
      message: 'Site Area\'s Charging Stations have been assigned successfully',
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.SITE_AREA, MODULE_NAME, 'handleDeleteSiteArea');
    // Filter request
    const siteAreaID = SiteAreaSecurity.filterSiteAreaRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, siteAreaID, MODULE_NAME, 'handleDeleteSiteArea', req.user);
    // Check and Get Site Area
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, siteAreaID, Action.DELETE, action);
    // Delete
    await SiteAreaStorage.deleteSiteArea(req.user.tenantID, siteArea.id);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteSiteArea',
      message: `Site Area '${siteArea.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { siteArea }
    }
    );
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.SITE_AREA, MODULE_NAME, 'handleGetSiteArea');
    // Filter request
    const filteredRequest = SiteAreaSecurity.filterSiteAreaRequest(req.query);
    // Check and Get Site Area
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, null, {
        withSite: filteredRequest.WithSite,
        withChargingStations: filteredRequest.WithChargingStations,
        withImage: true,
      }, true);
    // Return
    res.json(siteArea);
    next();
  }

  public static async handleGetSiteAreaImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = SiteAreaSecurity.filterSiteImageRequest(req.query);
    // Check mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetSiteAreaImage', req.user);
    // Get it
    const siteAreaImage = await SiteAreaStorage.getSiteAreaImage(filteredRequest.TenantID, filteredRequest.ID);
    // Return
    if (siteAreaImage?.image) {
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      // Remove encoding header
      if (siteAreaImage.image.startsWith('data:image/')) {
        header = siteAreaImage.image.substring(5, siteAreaImage.image.indexOf(';'));
        encoding = siteAreaImage.image.substring(siteAreaImage.image.indexOf(';') + 1, siteAreaImage.image.indexOf(',')) as BufferEncoding;
        siteAreaImage.image = siteAreaImage.image.substring(siteAreaImage.image.indexOf(',') + 1);
      }
      res.setHeader('content-type', header);
      res.send(siteAreaImage.image ? Buffer.from(siteAreaImage.image, encoding) : null);
    } else {
      res.send(null);
    }
    next();
  }

  public static async handleGetSiteAreas(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.SITE_AREAS, MODULE_NAME, 'handleGetSiteAreas');
    // Filter
    const filteredRequest = SiteAreaSecurity.filterSiteAreasRequest(req.query);
    // Check dynamic auth
    const authorizationSiteAreasFilter = await AuthorizationService.checkAndGetSiteAreasAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationSiteAreasFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the SiteAreas
    const siteAreas = await SiteAreaStorage.getSiteAreas(req.user.tenantID,
      {
        issuer: filteredRequest.Issuer,
        search: filteredRequest.Search,
        withSite: filteredRequest.WithSite,
        withChargingStations: filteredRequest.WithChargeBoxes,
        withAvailableChargingStations: filteredRequest.WithAvailableChargers,
        locCoordinates: filteredRequest.LocCoordinates,
        locMaxDistanceMeters: filteredRequest.LocMaxDistanceMeters,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        companyIDs: (filteredRequest.CompanyID ? filteredRequest.CompanyID.split('|') : null),
        ...authorizationSiteAreasFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationSiteAreasFilter.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addSiteAreasAuthorizations(req.tenant, req.user, siteAreas as SiteAreaDataResult,
      authorizationSiteAreasFilter);
    // Return
    res.json(siteAreas);
    next();
  }

  public static async handleGetSiteAreaConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.SITE_AREAS, MODULE_NAME, 'handleGetSiteAreaConsumption');
    // Filter request
    const filteredRequest = SiteAreaSecurity.filterSiteAreaConsumptionRequest(req.query);
    // Check dates
    if (!filteredRequest.StartDate || !filteredRequest.EndDate) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Start date and end date must be provided',
        module: MODULE_NAME, method: 'handleGetSiteAreaConsumption',
        user: req.user,
        action: action
      });
    }
    if (filteredRequest.StartDate && filteredRequest.EndDate &&
        moment(filteredRequest.StartDate).isAfter(moment(filteredRequest.EndDate))) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The requested start date '${filteredRequest.StartDate.toISOString()}' is after the end date '${filteredRequest.EndDate.toISOString()}' `,
        module: MODULE_NAME, method: 'handleGetSiteAreaConsumption',
        user: req.user,
        action: action
      });
    }
    // Check and Get Site Area
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.SiteAreaID, Action.READ, action);
    // Get the ConsumptionValues
    const consumptions = await ConsumptionStorage.getSiteAreaConsumptions(req.user.tenantID, {
      siteAreaID: filteredRequest.SiteAreaID,
      startDate: filteredRequest.StartDate,
      endDate: filteredRequest.EndDate,
    }, ['startedAt', 'instantAmps', 'instantWatts', 'limitAmps', 'limitWatts']);
    // Assign
    siteArea.values = consumptions;
    // Return
    res.json(siteArea);
    next();
  }

  public static async handleCreateSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.CREATE, Entity.SITE_AREAS, MODULE_NAME, 'handleCreateSiteArea');
    // Filter request
    const filteredRequest = SiteAreaSecurity.filterSiteAreaCreateRequest(req.body);
    // Check request data is valid
    UtilsService.checkIfSiteAreaValid(filteredRequest, req);
    // Check auth
    const authorizationFilters = await AuthorizationService.checkAndGetSiteAreaAuthorizations(req.tenant, req.user,
      {}, Action.CREATE, filteredRequest as SiteArea);
    if (!authorizationFilters.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.SITE_AREA,
        module: MODULE_NAME, method: 'handleCreateSiteArea'
      });
    }
    // Check Site auth
    await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.READ,
      action);
    // Create Site Area
    const newSiteArea: SiteArea = {
      ...filteredRequest,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as SiteArea;
    // Save
    newSiteArea.id = await SiteAreaStorage.saveSiteArea(req.user.tenantID, newSiteArea, true);
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateSiteArea',
      message: `Site Area '${newSiteArea.name}' has been created successfully`,
      action: action,
      detailedMessages: { siteArea: newSiteArea }
    });
    // Ok
    res.json(Object.assign({ id: newSiteArea.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSiteArea(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE_AREA, MODULE_NAME, 'handleUpdateSiteArea');
    // Filter request
    const filteredRequest = SiteAreaSecurity.filterSiteAreaUpdateRequest(req.body);
    // Check Mandatory fields
    UtilsService.checkIfSiteAreaValid(filteredRequest, req);
    // Check and Get SiteArea
    const siteArea = await UtilsService.checkAndGetSiteAreaAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest as SiteArea, {
        withChargingStations: true,
      }, false, true);
    // Check Site auth
    await UtilsService.checkAndGetSiteAuthorization(
      req.tenant, req.user, filteredRequest.siteID, Action.READ, action);
    // Update
    siteArea.name = filteredRequest.name;
    siteArea.address = filteredRequest.address;
    siteArea.maximumPower = filteredRequest.maximumPower;
    siteArea.voltage = filteredRequest.voltage;
    if (Utils.objectHasProperty(filteredRequest, 'image')) {
      siteArea.image = filteredRequest.image;
    }
    if (filteredRequest.smartCharging && filteredRequest.numberOfPhases === 1) {
      for (const chargingStation of siteArea.chargingStations) {
        for (const connector of chargingStation.connectors) {
          const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
          if (numberOfPhases !== 1) {
            throw new AppError({
              source: Constants.CENTRAL_SERVER,
              action: action,
              errorCode: HTTPError.THREE_PHASE_CHARGER_ON_SINGLE_PHASE_SITE_AREA,
              message: `Error occurred while updating SiteArea.'${chargingStation.id}' is not single phased`,
              module: MODULE_NAME, method: 'handleUpdateSiteArea',
              user: req.user
            });
          }
        }
      }
    }
    siteArea.numberOfPhases = filteredRequest.numberOfPhases;
    let actionsResponse: ActionsResponse;
    if (siteArea.smartCharging && !filteredRequest.smartCharging) {
      actionsResponse = await OCPPUtils.clearAndDeleteChargingProfilesForSiteArea(
        req.tenant, siteArea,
        { profilePurposeType: ChargingProfilePurposeType.TX_PROFILE });
    }
    siteArea.smartCharging = filteredRequest.smartCharging;
    siteArea.accessControl = filteredRequest.accessControl;
    siteArea.siteID = filteredRequest.siteID;
    siteArea.lastChangedBy = { 'id': req.user.id };
    siteArea.lastChangedOn = new Date();
    // Save
    await SiteAreaStorage.saveSiteArea(req.user.tenantID, siteArea, Utils.objectHasProperty(filteredRequest, 'image'));
    // Retrigger Smart Charging
    if (filteredRequest.smartCharging) {
      // FIXME: the lock acquisition can wait for 30s before timeout and the whole code execution timeout at 3s
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(async () => {
        const siteAreaLock = await LockingHelper.acquireSiteAreaSmartChargingLock(req.user.tenantID, siteArea, 30);
        if (siteAreaLock) {
          try {
            const smartCharging = await SmartChargingFactory.getSmartChargingImpl(req.tenant);
            if (smartCharging) {
              await smartCharging.computeAndApplyChargingProfiles(siteArea);
            }
          } catch (error) {
            await Logging.logError({
              tenantID: req.user.tenantID,
              source: Constants.CENTRAL_SERVER,
              module: MODULE_NAME, method: 'handleUpdateSiteArea',
              action: action,
              message: 'An error occurred while trying to call smart charging',
              detailedMessages: { error: error.stack }
            });
          } finally {
            // Release lock
            await LockingManager.release(siteAreaLock);
          }
        }
      }, Constants.DELAY_SMART_CHARGING_EXECUTION_MILLIS);
    }
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateSiteArea',
      message: `Site Area '${siteArea.name}' has been updated successfully`,
      action: action,
      detailedMessages: { siteArea }
    });
    if (actionsResponse && actionsResponse.inError > 0) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: action,
        errorCode: HTTPError.CLEAR_CHARGING_PROFILE_NOT_SUCCESSFUL,
        message: 'Error occurred while clearing Charging Profiles for Site Area',
        module: MODULE_NAME, method: 'handleUpdateSiteArea',
        user: req.user, actionOnUser: req.user
      });
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
