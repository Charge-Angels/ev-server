import { Action, AuthorizationActions, AuthorizationContext, AuthorizationFilter, Entity, SiteAreaAuthorizationActions } from '../../../../types/Authorization';
import { Car, CarCatalog } from '../../../../types/Car';
import { CarCatalogDataResult, CarDataResult, CompanyDataResult, SiteAreaDataResult, SiteDataResult, TagDataResult, UserDataResult } from '../../../../types/DataResult';
import { HttpAssignAssetsToSiteAreaRequest, HttpSiteAreaRequest, HttpSiteAreasRequest } from '../../../../types/requests/HttpSiteAreaRequest';
import { HttpCarCatalogRequest, HttpCarCatalogsRequest, HttpCarRequest, HttpCarsRequest } from '../../../../types/requests/HttpCarRequest';
import { HttpChargingStationRequest, HttpChargingStationsRequest } from '../../../../types/requests/HttpChargingStationRequest';
import { HttpCompaniesRequest, HttpCompanyRequest } from '../../../../types/requests/HttpCompanyRequest';
import { HttpSiteAssignUsersRequest, HttpSiteRequest, HttpSiteUsersRequest } from '../../../../types/requests/HttpSiteRequest';
import { HttpTagRequest, HttpTagsRequest } from '../../../../types/requests/HttpTagRequest';
import { HttpUserAssignSitesRequest, HttpUserRequest, HttpUserSitesRequest, HttpUsersRequest } from '../../../../types/requests/HttpUserRequest';
import User, { UserRole } from '../../../../types/User';

import AppAuthError from '../../../../exception/AppAuthError';
import AssetStorage from '../../../../storage/mongodb/AssetStorage';
import Authorizations from '../../../../authorization/Authorizations';
import Company from '../../../../types/Company';
import Constants from '../../../../utils/Constants';
import DynamicAuthorizationFactory from '../../../../authorization/DynamicAuthorizationFactory';
import { EntityDataType } from '../../../../types/GlobalType';
import { HTTPAuthError } from '../../../../types/HTTPError';
import { HttpAssetsRequest } from '../../../../types/requests/HttpAssetRequest';
import { ServerAction } from '../../../../types/Server';
import Site from '../../../../types/Site';
import SiteArea from '../../../../types/SiteArea';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import Tag from '../../../../types/Tag';
import Tenant from '../../../../types/Tenant';
import TenantComponents from '../../../../types/TenantComponents';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import _ from 'lodash';

const MODULE_NAME = 'AuthorizationService';

export default class AuthorizationService {
  public static canPerformAction(authActions: AuthorizationActions | SiteAreaAuthorizationActions, action: Action): boolean {
    switch (action) {
      case Action.READ:
        return authActions.canRead;
      case Action.UPDATE:
        return authActions.canUpdate;
      case Action.CREATE:
        return authActions.canCreate;
      case Action.DELETE:
        return authActions.canDelete;
      case Action.ASSIGN_CHARGING_STATIONS_TO_SITE_AREA:
        return (authActions as SiteAreaAuthorizationActions).canAssignChargingStations;
      case Action.UNASSIGN_CHARGING_STATIONS_TO_SITE_AREA:
        return (authActions as SiteAreaAuthorizationActions).canUnassignChargingStations;
      case Action.ASSIGN_ASSETS_TO_SITE_AREA:
        return (authActions as SiteAreaAuthorizationActions).canAssignAssets;
      case Action.UNASSIGN_ASSETS_TO_SITE_AREA:
        return (authActions as SiteAreaAuthorizationActions).canUnassignAssets;
      default:
        return false;
    }
  }

  public static async checkAndGetSiteAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSiteRequest>, authAction: Action, entityData?: EntityDataType): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.SITE, userToken, filteredRequest, filteredRequest.ID ? { SiteID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addSitesAuthorizations(tenant: Tenant, userToken: UserToken, sites: SiteDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add canCreate flag to root
    sites.canCreate = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE, Action.CREATE,
      authorizationFilter);
    // Enrich
    for (const site of sites.result) {
      await AuthorizationService.addSiteAuthorizations(tenant, userToken, site, authorizationFilter);
    }
  }

  public static async addSiteAuthorizations(tenant: Tenant, userToken: UserToken, site: Site, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Enrich
    if (!site.issuer) {
      site.canRead = true;
      site.canUpdate = false;
      site.canDelete = false;
      site.canAssignUsers = false;
      site.canUnassignUsers = false;
    } else {
      site.canRead = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE, Action.READ, authorizationFilter, { SiteID: site.id }, site);
      site.canDelete = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE, Action.DELETE, authorizationFilter, { SiteID: site.id }, site);
      site.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE, Action.UPDATE, authorizationFilter, { SiteID: site.id }, site);
      site.canExportOCPPParams = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_AREA, Action.EXPORT_OCPP_PARAMS, authorizationFilter, { SiteID: site.id }, site);
      site.canGenerateQrCode = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_AREA, Action.GENERATE_QR, authorizationFilter, { SiteID: site.id }, site);
      site.canAssignUsers = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.USERS_SITES, Action.ASSIGN, authorizationFilter, { SiteID: site.id }, site);
      site.canUnassignUsers = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.USERS_SITES, Action.UNASSIGN, authorizationFilter, { SiteID: site.id }, site);
    }
  }

  public static async checkAndGetSitesAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSiteUsersRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.SITES, Action.LIST,
      authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async checkAndGetSiteUsersAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSiteUsersRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [ ],
      authorized: false,
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.USERS_SITES, Action.LIST,
      authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async checkAndGetUserSitesAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpUserSitesRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [
        'site.id', 'site.name', 'site.address.city', 'site.address.country', 'siteAdmin', 'siteOwner', 'userID'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(authorizationFilters.projectFields, filteredRequest.ProjectFields);
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdminsAndOwners(tenant, userToken, null, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAssignSiteUsersAuthorizations(tenant: Tenant, action: ServerAction, userToken: UserToken,
      filteredRequest: Partial<HttpSiteAssignUsersRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    const authAction = action === ServerAction.ADD_USERS_TO_SITE ? Action.ASSIGN : Action.UNASSIGN;
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.USERS_SITES, authAction,
      authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async checkAssignSiteAreaAssetsAuthorizations(tenant: Tenant, action: ServerAction, userToken: UserToken,
      siteArea: SiteArea, filteredRequest: Partial<HttpAssignAssetsToSiteAreaRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      // Get Site IDs for which user is admin from db
      const siteAdminSiteIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
      // Check Site
      if (!Utils.isEmptyArray(siteAdminSiteIDs) && siteAdminSiteIDs.includes(siteArea.siteID)) {
        // Site Authorized, now check Assets
        if (!Utils.isEmptyArray(filteredRequest.assetIDs)) {
          let foundInvalidAssetID = false;
          // Get Asset IDs already assigned to the site
          const assetIDs = await AuthorizationService.getAssignedAssetIDs(tenant, siteArea.siteID);
          // Check if any of the Assets we want to unassign are missing
          for (const assetID of filteredRequest.assetIDs) {
            switch (action) {
              case ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA:
                if (assetIDs.includes(assetID)) {
                  foundInvalidAssetID = true;
                }
                break;
              case ServerAction.REMOVE_CHARGING_STATIONS_FROM_SITE_AREA:
                if (!assetIDs.includes(assetID)) {
                  foundInvalidAssetID = true;
                }
                break;
            }
          }
          if (!foundInvalidAssetID) {
            authorizationFilters.authorized = true;
          }
        }
      }
    }
    return authorizationFilters;
  }

  public static async checkAndAssignUserSitesAuthorizations(
      tenant: Tenant, action: ServerAction, userToken: UserToken,
      filteredRequest: Partial<HttpUserAssignSitesRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check static & dynamic authorization
    const authAction = action === ServerAction.ADD_USERS_TO_SITE ? Action.ASSIGN : Action.UNASSIGN;
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.USERS_SITES, authAction,
      authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async checkAndGetUsersInErrorAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpUsersRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(
      tenant, userToken, Entity.USERS, Action.IN_ERROR, authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async addUsersAuthorizations(tenant: Tenant, userToken: UserToken, users: UserDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    users.canCreate = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.USER, Action.CREATE, authorizationFilter);
    // Enrich
    for (const user of users.result) {
      await AuthorizationService.addUserAuthorizations(tenant, userToken, user, authorizationFilter);
    }
  }

  public static async addUserAuthorizations(tenant: Tenant, userToken: UserToken, user: User, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Enrich
    if (!user.issuer) {
      user.canRead = true;
      user.canUpdate = false;
      user.canDelete = false;
    } else {
      user.canRead = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.USER, Action.READ, authorizationFilter, { UserID: user.id }, user);
      user.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.USER, Action.UPDATE, authorizationFilter, { UserID: user.id }, user);
      user.canDelete = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.USER, Action.DELETE, authorizationFilter, { UserID: user.id }, user);
    }
  }

  public static async checkAndGetUsersAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpUsersRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USERS, Action.LIST, authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async checkAndGetAssetsAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest?: HttpAssetsRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [ ],
      authorized: false,
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.ASSETS, Action.LIST, authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async checkAndGetUserAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpUserRequest>, authAction: Action, entityData?: EntityDataType): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.USER, userToken, filteredRequest, filteredRequest.ID ? { UserID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetTagsAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpTagsRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAGS, Action.LIST, authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async checkAndGetTagAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpTagRequest>, authAction: Action, entityData?: EntityDataType): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.TAG, userToken, filteredRequest, filteredRequest.ID ? { TagID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addTagsAuthorizations(tenant: Tenant, userToken: UserToken, tags: TagDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add canCreate flag to root
    tags.canCreate = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TAG, Action.CREATE, authorizationFilter);
    tags.canDelete = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TAG, Action.DELETE, authorizationFilter);
    tags.canImport = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TAGS, Action.IMPORT, authorizationFilter);
    tags.canExport = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TAGS, Action.EXPORT, authorizationFilter);
    // Enrich
    for (const tag of tags.result) {
      await AuthorizationService.addTagAuthorizations(tenant, userToken, tag, authorizationFilter);
    }
  }

  public static async addTagAuthorizations(tenant: Tenant, userToken: UserToken, tag: Tag, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Enrich
    if (!tag.issuer) {
      tag.canRead = true;
      // tag.canUpdate = false;
      tag.canDelete = false;
    } else {
      tag.canRead = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.TAG, Action.READ, authorizationFilter, { TagID: tag.id }, tag);
      tag.canDelete = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.TAG, Action.DELETE, authorizationFilter, { TagID: tag.id }, tag);
      tag.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.TAG, Action.UPDATE, authorizationFilter, { TagID: tag.id }, tag);
    }
  }

  public static async checkAndGetCompaniesAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpCompaniesRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.COMPANIES, Action.LIST,
      authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async addCompaniesAuthorizations(tenant: Tenant, userToken: UserToken, companies: CompanyDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add canCreate flag to root
    companies.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.COMPANY, Action.CREATE, authorizationFilter);
    // Enrich
    for (const company of companies.result) {
      await AuthorizationService.addCompanyAuthorizations(tenant, userToken, company, authorizationFilter);
    }
  }

  public static async addCompanyAuthorizations(tenant: Tenant, userToken: UserToken, company: Company, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Enrich
    if (!company.issuer) {
      company.canRead = true;
      company.canUpdate = false;
      company.canDelete = false;
    } else {
      company.canRead = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.COMPANY, Action.READ, authorizationFilter, { CompanyID: company.id }, company);
      company.canDelete = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.COMPANY, Action.DELETE, authorizationFilter, { CompanyID: company.id }, company);
      company.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.COMPANY, Action.UPDATE, authorizationFilter, { CompanyID: company.id }, company);
    }
  }

  public static async checkAndGetCompanyAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpCompanyRequest>, authAction: Action, entityData?: EntityDataType): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.COMPANY, userToken, filteredRequest, filteredRequest.ID ? { CompanyID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetSiteAreaAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSiteAreaRequest>, authAction: Action, entityData?: EntityDataType): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.SITE_AREA, userToken, filteredRequest, filteredRequest.ID ? { SiteAreaID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetSiteAreasAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSiteAreasRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE_AREAS, Action.LIST,
      authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async addSiteAreasAuthorizations(tenant: Tenant, userToken: UserToken, siteAreas: SiteAreaDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add canCreate flag to root
    siteAreas.canCreate = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE_AREA, Action.CREATE, authorizationFilter);
    // Enrich
    for (const siteArea of siteAreas.result) {
      await AuthorizationService.addSiteAreaAuthorizations(tenant, userToken, siteArea, authorizationFilter);
    }
  }

  public static async addSiteAreaAuthorizations(tenant: Tenant, userToken: UserToken, siteArea: SiteArea, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Enrich
    if (!siteArea.issuer) {
      siteArea.canRead = true;
      siteArea.canUpdate = false;
      siteArea.canDelete = false;
      siteArea.canAssignAssets = false;
      siteArea.canUnassignAssets = false;
      siteArea.canAssignChargingStations = false;
      siteArea.canUnassignChargingStations = false;
    } else {
      // Downcast & enhance filters with values needed in dynamic filters
      siteArea.canRead = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_AREA, Action.READ, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
      siteArea.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_AREA, Action.DELETE, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
      siteArea.canDelete = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_AREA, Action.UPDATE, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
      siteArea.canAssignAssets = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_AREA, Action.ASSIGN_ASSETS_TO_SITE_AREA, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
      siteArea.canUnassignAssets = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_AREA, Action.UNASSIGN_ASSETS_TO_SITE_AREA, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
      siteArea.canAssignChargingStations = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_AREA, Action.ASSIGN_CHARGING_STATIONS_TO_SITE_AREA, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
      siteArea.canUnassignChargingStations = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_AREA, Action.UNASSIGN_CHARGING_STATIONS_TO_SITE_AREA, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
      siteArea.canExportOCPPParams = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_AREA, Action.EXPORT_OCPP_PARAMS, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
      siteArea.canGenerateQrCode = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_AREA, Action.GENERATE_QR, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
    }
  }

  public static async checkAndGetChargingStationAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpChargingStationRequest>, entityData?: EntityDataType):Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [
        'id', 'inactive', 'public', 'chargingStationURL', 'issuer', 'maximumPower', 'excludeFromSmartCharging', 'lastReboot',
        'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.smartCharging', 'siteArea.siteID',
        'site.id', 'site.name', 'siteID', 'voltage', 'coordinates', 'forceInactive', 'manualConfiguration', 'firmwareUpdateStatus',
        'capabilities', 'endpoint', 'chargePointVendor', 'chargePointModel', 'ocppVersion', 'ocppProtocol', 'lastSeen',
        'firmwareVersion', 'currentIPAddress', 'ocppStandardParameters', 'ocppVendorParameters', 'connectors', 'chargePoints',
        'createdOn', 'chargeBoxSerialNumber', 'chargePointSerialNumber', 'powerLimitUnit'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authorizationFilters.projectFields, filteredRequest.ProjectFields);
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      // Check assigned Sites
      await AuthorizationService.checkAssignedSites(
        tenant, userToken, null, authorizationFilters);
    }
    return authorizationFilters;
  }

  public static async checkAndGetCarsAuthorizations(tenant: Tenant, userToken: UserToken, filteredRequest: Partial<HttpCarsRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [ ],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CARS, Action.LIST, authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async checkAndGetCarAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpCarRequest>, authAction: Action, entityData?: EntityDataType): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.CAR, userToken, filteredRequest, filteredRequest.ID ? { CarID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addCarsAuthorizations(tenant: Tenant, userToken: UserToken, cars: CarDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add canCreate flag to root
    cars.canCreate = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.CAR, Action.CREATE, authorizationFilter);
    // Enrich
    for (const car of cars.result) {
      await AuthorizationService.addCarAuthorizations(tenant, userToken, car, authorizationFilter);
    }
  }

  public static async addCarAuthorizations(tenant: Tenant, userToken: UserToken, car: Car, authorizationFilter: AuthorizationFilter): Promise<void> {
  // Enrich
    if (!car) {
      car.canRead = true;
      car.canUpdate = false;
      car.canDelete = false;
    } else {
      car.canRead = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.CAR, Action.READ, authorizationFilter, { CarID: car.id }, car);
      car.canDelete = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.CAR, Action.DELETE, authorizationFilter, { CarID: car.id }, car);
      car.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.CAR, Action.UPDATE, authorizationFilter, { CarID: car.id }, car);
    }
  }

  public static async checkAndGetCarCatalogsAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpCarCatalogsRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [ ],
      authorized: false
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(
      tenant, userToken, Entity.CAR_CATALOGS, Action.LIST, authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async checkAndGetCarCatalogAuthorizations(tenant: Tenant, userToken: UserToken, filteredRequest: Partial<HttpCarCatalogRequest>,
      authAction: Action, entityData?: EntityDataType): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.CAR_CATALOG, userToken, filteredRequest, filteredRequest.ID ? { CarCatalogID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addCarCatalogsAuthorizationActions(tenant: Tenant, userToken: UserToken, carCatalogs: CarCatalogDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add canSync flag to root
    carCatalogs.canSync = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.CAR_CATALOGS, Action.SYNCHRONIZE, authorizationFilter);
    // Enrich
    for (const carCatalog of carCatalogs.result) {
      await AuthorizationService.addCarCatalogAuthorizations(tenant, userToken, carCatalog, authorizationFilter);
    }
  }

  public static async addCarCatalogAuthorizations(tenant: Tenant, userToken: UserToken, carCatalog: CarCatalog, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Enrich
    if (!carCatalog) {
      carCatalog.canRead = true;
      carCatalog.canUpdate = false;
      carCatalog.canDelete = false;
    } else {
      carCatalog.canRead = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.CAR_CATALOG, Action.READ, authorizationFilter, { CarCatalogID: carCatalog.id }, carCatalog);
      carCatalog.canDelete = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.CAR_CATALOG, Action.DELETE, authorizationFilter, { CarCatalogID: carCatalog.id }, carCatalog);
      carCatalog.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.CAR_CATALOG, Action.UPDATE, authorizationFilter, { CarCatalogID: carCatalog.id }, carCatalog);
    }
  }


  public static async checkAndGetChargingStationsAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest?: HttpChargingStationsRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATIONS, Action.LIST, authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async getSiteAdminSiteIDs(tenantID: string, userToken: UserToken): Promise<string[]> {
    // Get the Sites where the user is Site Admin
    const userSites = await UserStorage.getUserSites(tenantID,
      {
        userIDs: [userToken.id],
        siteAdmin: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    return userSites.result.map((userSite) => userSite.siteID);
  }

  private static async getSiteOwnerSiteIDs(tenantID: string, userToken: UserToken): Promise<string[]> {
    // Get the Sites where the user is Site Owner
    const userSites = await UserStorage.getUserSites(tenantID,
      {
        userIDs: [userToken.id],
        siteOwner: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    return userSites.result.map((userSite) => userSite.siteID);
  }

  private static async getAssignedSiteIDs(tenant: Tenant, userToken: UserToken): Promise<string[]> {
    // Get the Sites assigned to the User
    const sites = await SiteStorage.getSites(tenant,
      {
        userID: userToken.id,
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    return sites.result.map((site) => site.id);
  }

  private static async getAssignedAssetIDs(tenant: Tenant, siteID: string): Promise<string[]> {
    // Get the Assets assigned to the Site
    const assets = await AssetStorage.getAssets(tenant,
      {
        siteIDs: [siteID],
        // TODO: Uncomment when the bug will be fixed: https://github.com/sap-labs-france/ev-dashboard/issues/2266
        // issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    return assets.result.map((asset) => asset.id);
  }

  private static async checkAssignedSites(tenant: Tenant, userToken: UserToken,
      filteredRequest: { SiteID?: string }, authorizationFilters: AuthorizationFilter): Promise<void> {
    if (userToken.role !== UserRole.ADMIN && userToken.role !== UserRole.SUPER_ADMIN) {
      if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
        // Get assigned Site IDs assigned to user from DB
        const siteIDs = await AuthorizationService.getAssignedSiteIDs(tenant, userToken);
        if (!Utils.isEmptyArray(siteIDs)) {
          // Force the filter
          authorizationFilters.filters.siteIDs = siteIDs;
          // Check if filter is provided
          if (filteredRequest?.SiteID) {
            const filteredSiteIDs = filteredRequest.SiteID.split('|');
            // Override
            authorizationFilters.filters.siteIDs = filteredSiteIDs.filter(
              (siteID) => authorizationFilters.filters.siteIDs.includes(siteID));
          }
        }
        if (!Utils.isEmptyArray(authorizationFilters.filters.siteIDs)) {
          authorizationFilters.authorized = true;
        }
      } else {
        authorizationFilters.authorized = true;
      }
    }
  }

  private static async checkAssignedSiteAdminsAndOwners(tenant: Tenant, userToken: UserToken,
      filteredRequest: { SiteID?: string }, authorizationFilters: AuthorizationFilter): Promise<void> {
    if (userToken.role !== UserRole.ADMIN && userToken.role !== UserRole.SUPER_ADMIN) {
      if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
        // Get Site IDs from Site Admin & Site Owner flag
        const siteAdminSiteIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
        const siteOwnerSiteIDs = await AuthorizationService.getSiteOwnerSiteIDs(tenant.id, userToken);
        const allSites = _.uniq([...siteAdminSiteIDs, ...siteOwnerSiteIDs]);
        if (!Utils.isEmptyArray(allSites)) {
          // Force the filters
          authorizationFilters.filters.siteIDs = allSites;
          // Check if filter is provided
          if (filteredRequest?.SiteID) {
            const filteredSiteIDs: string[] = filteredRequest.SiteID.split('|');
            // Override
            authorizationFilters.filters.siteIDs = filteredSiteIDs.filter(
              (filteredSiteID) => authorizationFilters.filters.siteIDs.includes(filteredSiteID));
          }
        }
        if (!Utils.isEmptyArray(authorizationFilters.filters.siteIDs)) {
          authorizationFilters.authorized = true;
        }
      } else {
        authorizationFilters.authorized = true;
      }
    }
  }

  private static filterProjectFields(authFields: string[], httpProjectField: string): string[] {
    let fields = authFields;
    // Only allow projected fields
    const httpProjectFields = UtilsService.httpFilterProjectToArray(httpProjectField);
    if (!Utils.isEmptyArray(httpProjectFields)) {
      fields = authFields.filter(
        (authField) => httpProjectFields.includes(authField));
    }
    // Remove '*'
    if (!Utils.isEmptyArray(fields)) {
      fields = fields.filter((field) => field !== '*');
    }
    return fields;
  }

  private static async processDynamicFilters(tenant: Tenant, userToken: UserToken, action: Action, entity: Entity,
      authorizationFilters: AuthorizationFilter, authorizationContext: AuthorizationContext,
      extraFilters?: Record<string, any>): Promise<void> {
    if (!Utils.isEmptyArray(authorizationContext.filters)) {
      // First array is an AND between filters
      for (let filtersToProcess of authorizationContext.filters) {
        authorizationFilters.authorized = false;
        // Array?
        if (!Array.isArray(filtersToProcess)) {
          filtersToProcess = [filtersToProcess];
        }
        let authorized = false;
        // Second array is an OR between filters
        for (const filterToProcess of filtersToProcess) {
          // Get the filter
          const dynamicFilter = await DynamicAuthorizationFactory.getDynamicFilter(
            tenant, userToken, filterToProcess, authorizationFilters.dataSources);
          if (!dynamicFilter) {
            // Filter not found -> Not authorized (all auth filter MUST work)
            throw new AppAuthError({
              errorCode: HTTPAuthError.FORBIDDEN,
              user: userToken,
              action, entity,
              module: MODULE_NAME, method: 'processDynamicFilters'
            });
          }
          // Process the filter
          dynamicFilter.processFilter(authorizationFilters, extraFilters);
          // Negate the filter
          if (dynamicFilter.isNegateFilter()) {
            authorizationFilters.authorized = !authorizationFilters.authorized;
          }
          authorized = authorized || authorizationFilters.authorized;
        }
        // Assign
        authorizationFilters.authorized = authorized;
        // Failed?
        if (!authorizationFilters.authorized) {
          return;
        }
      }
    }
  }

  private static processDynamicAsserts(tenant: Tenant, userToken: UserToken, action: Action, entity: Entity,
      authorizationFilters: AuthorizationFilter, authorizationContext: AuthorizationContext, entityData?: EntityDataType): void {
    if (entityData && !Utils.isEmptyArray(authorizationContext.asserts)) {
      // First array is an AND between assertions
      for (let assertsToProcess of authorizationContext.asserts) {
        authorizationFilters.authorized = false;
        // Array?
        if (!Array.isArray(assertsToProcess)) {
          assertsToProcess = [assertsToProcess];
        }
        let authorized = false;
        // Second array is an OR between assertions
        for (const assertToProcess of assertsToProcess) {
          // Get the assertion
          const dynamicAssert = DynamicAuthorizationFactory.getDynamicAssert(
            tenant, userToken, assertToProcess);
          if (!dynamicAssert) {
            // Assertion not found -> Not authorized (all auth filter MUST work)
            throw new AppAuthError({
              errorCode: HTTPAuthError.FORBIDDEN,
              user: userToken,
              action, entity,
              module: MODULE_NAME, method: 'processDynamicAsserts'
            });
          }
          // Process the assertion
          authorizationFilters.authorized = dynamicAssert.processAssert(entityData);
          // Negate the assertion
          if (dynamicAssert.isNegateAssert()) {
            authorizationFilters.authorized = !authorizationFilters.authorized;
          }
          authorized = authorized || authorizationFilters.authorized;
        }
        // Assign
        authorizationFilters.authorized = authorized;
        // Failed?
        if (!authorizationFilters.authorized) {
          return;
        }
      }
    }
  }

  private static async canPerformAuthorizationAction(tenant: Tenant, userToken: UserToken,
      entity: Entity, authAction: Action, authorizationFilters: AuthorizationFilter,
      filteredRequest?: Record<string, any>, entityData?: EntityDataType): Promise<boolean> {
    // Check static auth
    const authorizationContext: AuthorizationContext = {};
    const authResult = await Authorizations.can(userToken, entity, authAction, authorizationContext);
    authorizationFilters.authorized = authResult.authorized;
    if (!authorizationFilters.authorized) {
      return false;
    }
    // Process Dynamic Filters
    await AuthorizationService.processDynamicFilters(tenant, userToken, authAction, entity,
      authorizationFilters, authorizationContext, filteredRequest);
    // Process Dynamic Assertions
    if (authorizationFilters.authorized) {
      AuthorizationService.processDynamicAsserts(tenant, userToken, authAction, entity,
        authorizationFilters, authorizationContext, entityData);
    }
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authResult.fields, filteredRequest?.ProjectFields);
    return authorizationFilters.authorized;
  }

  private static async checkAndGetEntityAuthorizations(tenant: Tenant, entity: Entity, userToken: UserToken,
      filteredRequest: Record<string, any>, entityID: Record<string, any>,authAction: Action, entityData?: EntityDataType): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check Static Auths
    const authorizationContext: AuthorizationContext = {};
    const authResult = await Authorizations.can(userToken, entity, authAction, authorizationContext);
    authorizationFilters.authorized = authResult.authorized;
    if (!authorizationFilters.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: userToken,
        action: authAction, entity: entity,
        module: MODULE_NAME, method: 'checkAndGetEntityAuthorizations',
      });
    }
    // Process Dynamic Filters
    await AuthorizationService.processDynamicFilters(tenant, userToken, authAction, entity,
      authorizationFilters, authorizationContext, entityID);
    // Process Dynamic Assertions
    if (authorizationFilters.authorized) {
      AuthorizationService.processDynamicAsserts(tenant, userToken, authAction, entity,
        authorizationFilters, authorizationContext, entityData);
    }
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(authResult.fields,
      filteredRequest.ProjectFields);
    return authorizationFilters;
  }
}
