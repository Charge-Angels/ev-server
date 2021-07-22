import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Asset from '../../../../types/Asset';
import AssetFactory from '../../../../integration/asset/AssetFactory';
import { AssetInErrorType } from '../../../../types/InError';
import AssetSecurity from './security/AssetSecurity';
import AssetStorage from '../../../../storage/mongodb/AssetStorage';
import AssetValidator from '../validator/AssetValidator';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import Consumption from '../../../../types/Consumption';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import Logging from '../../../../utils/Logging';
import OCPPUtils from '../../../../server/ocpp/utils/OCPPUtils';
import { ServerAction } from '../../../../types/Server';
import SiteArea from '../../../../types/SiteArea';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import { StatusCodes } from 'http-status-codes';
import TenantComponents from '../../../../types/TenantComponents';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment';

const MODULE_NAME = 'AssetService';

export default class AssetService {

  public static async handleGetAssetConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.LIST, Entity.ASSETS, MODULE_NAME, 'handleGetAssetConsumption');
    // Filter
    const filteredRequest = AssetSecurity.filterAssetConsumptionRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.AssetID, MODULE_NAME,
      'handleGetAssetConsumption', req.user);
    // Check auth
    if (!await Authorizations.canReadAsset(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.ASSET,
        module: MODULE_NAME, method: 'handleGetAsset',
        value: filteredRequest.AssetID
      });
    }
    // Get it
    const asset = await AssetStorage.getAsset(req.tenant, filteredRequest.AssetID, {},
      [ 'id', 'name' ]
    );
    UtilsService.assertObjectExists(action, asset, `Asset ID '${filteredRequest.AssetID}' does not exist`,
      MODULE_NAME, 'handleGetAssetConsumption', req.user);
    // Check dates
    if (!filteredRequest.StartDate || !filteredRequest.EndDate) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Start date and end date must be provided',
        module: MODULE_NAME, method: 'handleGetAssetConsumption',
        user: req.user,
        action: action
      });
    }
    // Check dates order
    if (filteredRequest.StartDate && filteredRequest.EndDate &&
        moment(filteredRequest.StartDate).isAfter(moment(filteredRequest.EndDate))) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The requested start date '${filteredRequest.StartDate.toISOString()}' is after the end date '${filteredRequest.EndDate.toISOString()}' `,
        module: MODULE_NAME, method: 'handleGetAssetConsumption',
        user: req.user,
        action: action
      });
    }
    // Get the ConsumptionValues
    const consumptions = await ConsumptionStorage.getAssetConsumptions(req.user.tenantID, {
      assetID: filteredRequest.AssetID,
      startDate: filteredRequest.StartDate,
      endDate: filteredRequest.EndDate
    }, [ 'startedAt', 'instantWatts', 'instantAmps', 'limitWatts', 'limitAmps', 'endedAt', 'stateOfCharge' ]);
    // Assign
    asset.values = consumptions;
    // Return
    res.json(asset);
    next();
  }

  public static async handleCreateAssetConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.CREATE_CONSUMPTION, Entity.ASSETS, MODULE_NAME, 'handleCreateAssetConsumption');
    // Validate request
    const filteredRequest = AssetValidator.getInstance().validateCreateAssetConsumption({ ...req.params, ...req.body });
    UtilsService.assertIdIsProvided(action, filteredRequest.assetID, MODULE_NAME,
      'handleCreateAssetConsumption', req.user);
    // Check auth
    if (!await Authorizations.canCreateAssetConsumption(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE_CONSUMPTION, entity: Entity.ASSET,
        module: MODULE_NAME, method: 'handleCreateAssetConsumption',
        value: filteredRequest.assetID
      });
    }
    // Get Asset
    const asset = await AssetStorage.getAsset(req.tenant, filteredRequest.assetID, { withSiteArea: true });
    UtilsService.assertObjectExists(action, asset, `Asset ID '${filteredRequest.assetID}' does not exist`,
      MODULE_NAME, 'handleCreateAssetConsumption', req.user);
    // Check if connection ID exists
    if (!Utils.isNullOrUndefined(asset.connectionID)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The asset '${asset.name}' has a defined connection. The push API can not be used`,
        module: MODULE_NAME, method: 'handleCreateAssetConsumption',
        user: req.user,
        action: action
      });
    }
    // Check dates order
    if (filteredRequest.startedAt && filteredRequest.endedAt &&
        !moment(filteredRequest.endedAt).isAfter(moment(filteredRequest.startedAt))) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The requested start date '${moment(filteredRequest.startedAt).toISOString()}' is after the end date '${moment(filteredRequest.endedAt).toISOString()}' `,
        module: MODULE_NAME, method: 'handleCreateAssetConsumption',
        user: req.user,
        action: action
      });
    }
    // Get latest consumption and check dates
    const lastConsumption = await ConsumptionStorage.getLastAssetConsumption(req.tenant, { assetID: filteredRequest.assetID });
    if (!Utils.isNullOrUndefined(lastConsumption)) {
      if (moment(filteredRequest.startedAt).isBefore(moment(lastConsumption.endedAt))) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `The start date '${moment(filteredRequest.startedAt).toISOString()}' of the pushed consumption is before the end date '${moment(lastConsumption.endedAt).toISOString()}' of the latest asset consumption`,
          module: MODULE_NAME, method: 'handleCreateAssetConsumption',
          user: req.user,
          action: action
        });
      }
    }
    // Add site area
    const consumptionToSave: Consumption = {
      ...filteredRequest,
      siteAreaID: asset.siteAreaID,
      siteID: asset.siteArea.siteID,
    };
    // Check consumption
    if (Utils.isNullOrUndefined(consumptionToSave.consumptionWh)) {
      const timePeriod = moment(consumptionToSave.endedAt).diff(moment(consumptionToSave.startedAt), 'minutes');
      consumptionToSave.consumptionWh = Utils.createDecimal(consumptionToSave.instantWatts).mul(Utils.createDecimal(timePeriod).div(60)).toNumber();
    }
    // Add Amps
    if (Utils.isNullOrUndefined(consumptionToSave.instantAmps)) {
      consumptionToSave.instantAmps = Utils.createDecimal(consumptionToSave.instantWatts).div(asset.siteArea.voltage).toNumber();
    }
    // Add site limitation
    await OCPPUtils.addSiteLimitationToConsumption(req.tenant, asset.siteArea, consumptionToSave);
    // Save consumption
    await ConsumptionStorage.saveConsumption(req.user.tenantID, consumptionToSave);
    // Assign to asset
    asset.currentConsumptionWh = filteredRequest.consumptionWh;
    asset.currentInstantAmps = filteredRequest.instantAmps;
    asset.currentInstantAmpsL1 = filteredRequest.instantAmpsL1;
    asset.currentInstantAmpsL2 = filteredRequest.instantAmpsL2;
    asset.currentInstantAmpsL3 = filteredRequest.instantAmpsL3;
    asset.currentInstantVolts = filteredRequest.instantVolts;
    asset.currentInstantVoltsL1 = filteredRequest.instantVoltsL1;
    asset.currentInstantVoltsL2 = filteredRequest.instantVoltsL2;
    asset.currentInstantVoltsL3 = filteredRequest.instantVoltsL3;
    asset.currentInstantWatts = filteredRequest.instantWatts;
    asset.currentInstantWattsL1 = filteredRequest.instantWattsL1;
    asset.currentInstantWattsL2 = filteredRequest.instantWattsL2;
    asset.currentInstantWattsL3 = filteredRequest.instantWattsL3;
    asset.currentStateOfCharge = filteredRequest.stateOfCharge;
    asset.lastConsumption = { timestamp: consumptionToSave.endedAt, value: consumptionToSave.consumptionWh };
    // Save Asset
    await AssetStorage.saveAsset(req.tenant, asset);
    // Create response
    res.status(StatusCodes.CREATED).json(Object.assign({ consumption: consumptionToSave }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }


  public static async handleCheckAssetConnection(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.CHECK_CONNECTION, Entity.ASSET, MODULE_NAME, 'handleCheckAssetConnection');
    // Filter request
    const filteredRequest = AssetSecurity.filterAssetRequestByID(req.query);
    // Get asset connection type
    const assetImpl = await AssetFactory.getAssetImpl(req.tenant, filteredRequest);
    // Asset has unknown connection type
    if (!assetImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset service is not configured',
        module: MODULE_NAME, method: 'handleCheckAssetConnection',
        action: action,
        user: req.user
      });
    }
    // Is authorized to check connection ?
    if (!await Authorizations.canCheckAssetConnection(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CHECK_CONNECTION, entity: Entity.ASSET,
        module: MODULE_NAME, method: 'handleCheckAssetConnection'
      });
    }
    try {
      // Check connection
      await assetImpl.checkConnection();
      // Success
      res.json(Object.assign({ connectionIsValid: true }, Constants.REST_RESPONSE_SUCCESS));
    } catch (error) {
      // KO
      await Logging.logError({
        tenantID: req.user.tenantID,
        user: req.user,
        module: MODULE_NAME, method: 'handleCheckAssetConnection',
        message: 'Asset connection failed',
        action: action,
        detailedMessages: { error: error.stack }
      });
      // Create fail response
      res.json(Object.assign({ connectionIsValid: false }, Constants.REST_RESPONSE_SUCCESS));
    }
    next();
  }

  public static async handleRetrieveConsumption(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.RETRIEVE_CONSUMPTION, Entity.ASSET, MODULE_NAME, 'handleRetrieveConsumption');
    // Is authorized to check connection ?
    if (!await Authorizations.canRetrieveAssetConsumption(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.ASSET, action: Action.RETRIEVE_CONSUMPTION,
        module: MODULE_NAME, method: 'handleRetrieveConsumption'
      });
    }
    // Filter request
    const assetID = AssetSecurity.filterAssetRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, assetID, MODULE_NAME, 'handleRetrieveConsumption', req.user);
    // Get
    const asset = await AssetStorage.getAsset(req.tenant, assetID);
    UtilsService.assertObjectExists(action, asset, `Asset ID '${assetID}' does not exist`,
      MODULE_NAME, 'handleRetrieveConsumption', req.user);
    // Dynamic asset ?
    if (!asset.dynamicAsset) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        module: MODULE_NAME, method: 'handleRetrieveConsumption',
        action: action,
        user: req.user,
        message: 'This Asset is not dynamic, no consumption can be retrieved',
        detailedMessages: { asset }
      });
    }
    // Uses Push API
    if (asset.usesPushAPI) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        module: MODULE_NAME, method: 'handleRetrieveConsumption',
        action: action,
        user: req.user,
        message: 'This Asset is using the push API, no consumption can be retrieved',
        detailedMessages: { asset }
      });
    }
    // Get asset factory
    const assetImpl = await AssetFactory.getAssetImpl(req.tenant, asset.connectionID);
    if (!assetImpl) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Asset service is not configured',
        module: MODULE_NAME, method: 'handleRetrieveConsumption',
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION
      });
    }
    // Retrieve consumption
    const consumptions = await assetImpl.retrieveConsumptions(asset, true);
    if (!Utils.isEmptyArray(consumptions)) {
      const consumption = consumptions[0];
      // Assign
      if (consumption) {
        // Do not save last consumption on manual call to not disturb refresh interval (no consumption is created here)
        asset.currentConsumptionWh = consumption.currentConsumptionWh;
        asset.currentInstantAmps = consumption.currentInstantAmps;
        asset.currentInstantAmpsL1 = consumption.currentInstantAmpsL1;
        asset.currentInstantAmpsL2 = consumption.currentInstantAmpsL2;
        asset.currentInstantAmpsL3 = consumption.currentInstantAmpsL3;
        asset.currentInstantVolts = consumption.currentInstantVolts;
        asset.currentInstantVoltsL1 = consumption.currentInstantVoltsL1;
        asset.currentInstantVoltsL2 = consumption.currentInstantVoltsL2;
        asset.currentInstantVoltsL3 = consumption.currentInstantVoltsL3;
        asset.currentInstantWatts = consumption.currentInstantWatts;
        asset.currentInstantWattsL1 = consumption.currentInstantWattsL1;
        asset.currentInstantWattsL2 = consumption.currentInstantWattsL2;
        asset.currentInstantWattsL3 = consumption.currentInstantWattsL3;
        asset.currentStateOfCharge = consumption.currentStateOfCharge;
        // Save Asset
        await AssetStorage.saveAsset(req.tenant, asset);
      }
    } else {
      // TODO: Return a specific HTTP code to tell the user that the consumption cannot be retrieved
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetAssetsInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.LIST, Entity.ASSETS, MODULE_NAME, 'handleGetAssetsInError');
    // Check auth
    if (!await Authorizations.canListAssetsInError(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.IN_ERROR, entity: Entity.ASSETS,
        module: MODULE_NAME, method: 'handleGetAssetsInError'
      });
    }
    // Filter
    const filteredRequest = AssetSecurity.filterAssetsRequest(req.query);
    // Build error type
    const errorType = (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : [AssetInErrorType.MISSING_SITE_AREA]);
    // Get the assets
    const assets = await AssetStorage.getAssetsInError(req.tenant,
      {
        issuer: filteredRequest.Issuer,
        search: filteredRequest.Search,
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        errorType
      },
      { limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      [ 'id', 'name', 'errorCodeDetails', 'errorCode' ]
    );
    res.json(assets);
    next();
  }

  public static async handleDeleteAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.DELETE, Entity.ASSET, MODULE_NAME, 'handleDeleteAsset');
    // Filter
    const filteredRequest = AssetSecurity.filterAssetRequest(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleDeleteAsset', req.user);
    // Check auth
    if (!await Authorizations.canDeleteAsset(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.DELETE, entity: Entity.ASSET,
        module: MODULE_NAME, method: 'handleDeleteAsset',
        value: filteredRequest.ID
      });
    }
    // Get
    const asset = await AssetStorage.getAsset(req.tenant, filteredRequest.ID,
      { withSiteArea: filteredRequest.WithSiteArea });
    // Found?
    UtilsService.assertObjectExists(action, asset, `Asset ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDeleteAsset', req.user);
    if (!asset.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Asset '${asset.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleUpdateAsset',
        user: req.user,
        action: action
      });
    }
    // Delete
    await AssetStorage.deleteAsset(req.tenant, asset.id);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME, method: 'handleDeleteAsset',
      message: `Asset '${asset.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { asset }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.READ, Entity.ASSET, MODULE_NAME, 'handleGetAsset');
    // Filter
    const filteredRequest = AssetSecurity.filterAssetRequest(req.query);
    // ID is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetAsset', req.user);
    // Check auth
    if (!await Authorizations.canReadAsset(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.ASSET,
        module: MODULE_NAME, method: 'handleGetAsset',
        value: filteredRequest.ID
      });
    }
    // Get it
    const asset = await AssetStorage.getAsset(req.tenant, filteredRequest.ID,
      { withSiteArea: filteredRequest.WithSiteArea });
    UtilsService.assertObjectExists(action, asset, `Asset ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetAsset', req.user);
    res.json(asset);
    next();
  }

  public static async handleGetAssetImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = AssetSecurity.filterAssetImageRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetAssetImage', req.user);
    // Get it
    const assetImage = await AssetStorage.getAssetImage(req.tenant, filteredRequest.ID);
    // Return
    if (assetImage?.image) {
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      // Remove encoding header
      if (assetImage.image.startsWith('data:image/')) {
        header = assetImage.image.substring(5, assetImage.image.indexOf(';'));
        encoding = assetImage.image.substring(assetImage.image.indexOf(';') + 1, assetImage.image.indexOf(',')) as BufferEncoding;
        assetImage.image = assetImage.image.substring(assetImage.image.indexOf(',') + 1);
      }
      res.setHeader('content-type', header);
      res.send(assetImage.image ? Buffer.from(assetImage.image, encoding) : null);
    } else {
      res.send(null);
    }
    next();
  }

  public static async handleGetAssets(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.LIST, Entity.ASSETS, MODULE_NAME, 'handleGetAssets');
    // Check auth
    if (!await Authorizations.canListAssets(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.ASSETS,
        module: MODULE_NAME, method: 'handleGetAssets'
      });
    }
    // Filter
    const filteredRequest = AssetSecurity.filterAssetsRequest(req.query);
    // Get authorization filters
    const authorizationAssetsFilters = await AuthorizationService.checkAndGetAssetsAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationAssetsFilters.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the assets
    const assets = await AssetStorage.getAssets(req.tenant,
      {
        search: filteredRequest.Search,
        issuer: filteredRequest.Issuer,
        siteAreaIDs: (filteredRequest.SiteAreaID ? filteredRequest.SiteAreaID.split('|') : null),
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        withSiteArea: filteredRequest.WithSiteArea,
        withNoSiteArea: filteredRequest.WithNoSiteArea,
        dynamicOnly: filteredRequest.DynamicOnly,
        ...authorizationAssetsFilters.filters
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.SortFields, onlyRecordCount: filteredRequest.OnlyRecordCount },
      authorizationAssetsFilters.projectFields
    );
    res.json(assets);
    next();
  }

  public static async handleCreateAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.CREATE, Entity.ASSET, MODULE_NAME, 'handleCreateAsset');
    // Check auth
    if (!await Authorizations.canCreateAsset(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.ASSET,
        module: MODULE_NAME, method: 'handleCreateAsset'
      });
    }
    // Filter
    const filteredRequest = AssetSecurity.filterAssetCreateRequest(req.body);
    // Check Asset
    UtilsService.checkIfAssetValid(filteredRequest, req);
    // Check Site Area
    let siteArea: SiteArea = null;
    if (filteredRequest.siteAreaID) {
      siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
      UtilsService.assertObjectExists(action, siteArea, `Site Area ID '${filteredRequest.siteAreaID}' does not exist`,
        MODULE_NAME, 'handleCreateAsset', req.user);
    }
    // Create asset
    const newAsset: Asset = {
      name: filteredRequest.name,
      siteAreaID: filteredRequest.siteAreaID,
      siteID: siteArea ? siteArea.siteID : null,
      issuer: true,
      assetType: filteredRequest.assetType,
      excludeFromSmartCharging: filteredRequest.excludeFromSmartCharging,
      fluctuationPercent: filteredRequest.fluctuationPercent,
      staticValueWatt: filteredRequest.staticValueWatt,
      coordinates: filteredRequest.coordinates,
      image: filteredRequest.image,
      dynamicAsset: filteredRequest.dynamicAsset,
      usesPushAPI: filteredRequest.usesPushAPI,
      connectionID: filteredRequest.connectionID,
      meterID: filteredRequest.meterID,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Asset;
    // Save
    newAsset.id = await AssetStorage.saveAsset(req.tenant, newAsset);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME, method: 'handleCreateAsset',
      message: `Asset '${newAsset.id}' has been created successfully`,
      action: action,
      detailedMessages: { asset: newAsset }
    });
    // Ok
    res.json(Object.assign({ id: newAsset.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateAsset(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ASSET,
      Action.UPDATE, Entity.ASSET, MODULE_NAME, 'handleUpdateAsset');
    // Filter
    const filteredRequest = AssetSecurity.filterAssetUpdateRequest(req.body);
    // Check auth
    if (!await Authorizations.canUpdateAsset(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        entity: Entity.ASSET, action: Action.UPDATE,
        module: MODULE_NAME, method: 'handleUpdateAsset',
        value: filteredRequest.id
      });
    }
    // Check Site Area
    let siteArea: SiteArea = null;
    if (filteredRequest.siteAreaID) {
      siteArea = await SiteAreaStorage.getSiteArea(req.user.tenantID, filteredRequest.siteAreaID);
      UtilsService.assertObjectExists(action, siteArea, `Site Area ID '${filteredRequest.siteAreaID}' does not exist`,
        MODULE_NAME, 'handleUpdateAsset', req.user);
    }
    // Check email
    const asset = await AssetStorage.getAsset(req.tenant, filteredRequest.id);
    // Check
    UtilsService.assertObjectExists(action, asset, `Site Area ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateAsset', req.user);
    if (!asset.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Asset '${asset.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleUpdateAsset',
        user: req.user,
        action: action
      });
    }
    // Check Mandatory fields
    UtilsService.checkIfAssetValid(filteredRequest, req);
    // Update
    asset.name = filteredRequest.name;
    asset.siteAreaID = filteredRequest.siteAreaID;
    asset.siteID = siteArea ? siteArea.siteID : null,
    asset.assetType = filteredRequest.assetType;
    asset.excludeFromSmartCharging = filteredRequest.excludeFromSmartCharging;
    asset.variationThresholdPercent = filteredRequest.variationThresholdPercent;
    asset.fluctuationPercent = filteredRequest.fluctuationPercent;
    asset.staticValueWatt = filteredRequest.staticValueWatt;
    asset.coordinates = filteredRequest.coordinates;
    asset.image = filteredRequest.image;
    asset.dynamicAsset = filteredRequest.dynamicAsset;
    asset.usesPushAPI = filteredRequest.usesPushAPI;
    asset.connectionID = filteredRequest.connectionID;
    asset.meterID = filteredRequest.meterID;
    asset.lastChangedBy = { 'id': req.user.id };
    asset.lastChangedOn = new Date();
    // Update Asset
    await AssetStorage.saveAsset(req.tenant, asset);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME, method: 'handleUpdateAsset',
      message: `Asset '${asset.name}' has been updated successfully`,
      action: action,
      detailedMessages: { asset }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
