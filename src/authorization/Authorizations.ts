import SourceMap from 'source-map-support';
import AppAuthError from '../exception/AppAuthError';
import AppError from '../exception/AppError';
import AuthorizationsDefinition from './AuthorizationsDefinition';
import BackendError from '../exception/BackendError';
import ChargingStation from '../entity/ChargingStation';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import NotificationHandler from '../notification/NotificationHandler';
import Site from '../types/Site';
import SiteArea from '../types/SiteArea';
import SiteStorage from '../storage/mongodb/SiteStorage';
import Tenant from '../entity/Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Transaction from '../entity/Transaction';
import User from '../types/User';
import UserStorage from '../storage/mongodb/UserStorage';
import Utils from '../utils/Utils';
import UserService from '../server/rest/service/UserService';

SourceMap.install();

export default class Authorizations {

  private static configuration: any;

  public static canRefundTransaction(loggedUser: any, transaction: any) {
    let userId;
    if (transaction.getUserJson()) {
      userId = transaction.getUserJson().id;
    }
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
      Constants.ACTION_REFUND_TRANSACTION, { 'UserID': userId });
  }

  public static canStartTransaction(user: User, chargingStation: ChargingStation) {
    // Can perform stop?
    if (!Authorizations.canPerformActionOnChargingStation(
      user,
      chargingStation.getModel(),
      Constants.ACTION_REMOTE_START_TRANSACTION)) {
      // ꓘO
      return false;
    }
    // OK
    return true;
  }

  public static canStopTransaction(user: User, chargingStation: any) {
    // Can perform stop?
    if (!Authorizations.canPerformActionOnChargingStation(
      user,
      chargingStation.getModel(),
      Constants.ACTION_REMOTE_STOP_TRANSACTION)) {
      // ꓘO
      return false;
    }
    // Ok
    return true;
  }

  public static getAuthorizedEntityIDsFromLoggedUser(entityName: any, loggedUser: any) {
    switch (entityName) {
      case Constants.ENTITY_COMPANY:
        return loggedUser.companies;
      case Constants.ENTITY_SITE:
        return loggedUser.sites;
    }
  }

  public static async getAuthorizedEntities(tenantID: string, user: User) {
    if (!Authorizations.isAdmin(user.role)) {
      // Get User's site
      const sites = (await UserStorage.getSites(tenantID, {userID: user.id}, {limit: 0, skip: 0})).result.map(siteuser => siteuser.site);
      
      const siteIDs = sites.map(site => site.id);
      const companyIDs = [... new Set(sites.map(site => site.companyID))]
      
      // Get User's Site Admin
      const sitesAdmin = await UserStorage.getSites(
        tenantID, { userID: user.id, siteAdmin: true },
        { limit: Constants.NO_LIMIT, skip: 0 }
      );

      const siteAdminIDs = sitesAdmin.result.map(siteuser => siteuser.site.id);

      return {
        companies: companyIDs,
        sites: siteIDs,
        sitesAdmin: siteAdminIDs
      };
    }
    return {};
  }

  public static async getConnectorActionAuthorizations(tenantID: string, user: User, chargingStation: any, connector: any, siteArea: SiteArea, site: Site) {
    const tenant: Tenant|null = await Tenant.getTenant(tenantID);
    if (!tenant) {
      throw new BackendError('Authorizations.ts#getConnectorActionAuthorizations', 'Tenant null');
    }
    const isOrgCompActive = tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
    if (isOrgCompActive && (!siteArea || !site)) {
      throw new AppError(
        chargingStation.getID(),
        `Site area and site not provided for Charging Station '${chargingStation.getID()}'!`, Constants.HTTP_GENERAL_ERROR,
        'Authorizations', 'getConnectorActionAuthorizations',
        user
      );
    }
    // Set default value
    let isUserAssignedToSite = false;
    let accessControlEnable = true;
    let userAllowedToStopAllTransactions = false;
    let isSameUserAsTransaction = false;
    if (isOrgCompActive) {
      // Acces Control Enabled?
      accessControlEnable = siteArea.accessControl;
      // Allow to stop all transactions
      userAllowedToStopAllTransactions = site.allowAllUsersToStopTransactions;
      // Check if User belongs to the charging station Site
      isUserAssignedToSite = await SiteStorage.siteHasUser(tenantID, site.id, user.id);
    }
    if (connector.activeTransactionID > 0) {
      // Get Transaction
      const transaction = await Transaction.getTransaction(tenantID, connector.activeTransactionID);
      if (!transaction) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Transaction ID '${connector.activeTransactionID}' does not exist`,
          Constants.HTTP_AUTH_ERROR, 'Authorizations', 'getConnectorActionAuthorizations');
      }
      // Check if transaction user is the same as request user
      isSameUserAsTransaction = transaction.getUserID() === user.id;
    }

    // Prepare default authorizations
    const result = {
      'isStartAuthorized': Authorizations.canStartTransaction(user, chargingStation),
      'isStopAuthorized': Authorizations.canStopTransaction(user, chargingStation),
      'isTransactionDisplayAuthorized': false
    };
    if (user.role === Constants.ROLE_ADMIN) {
      // An admin has all authorizations except for site where he is not assigned and in case site management is not active
      const defaultAuthorization = (isOrgCompActive && isUserAssignedToSite) || (!isOrgCompActive);
      result.isStartAuthorized = result.isStartAuthorized && defaultAuthorization;
      result.isStopAuthorized = result.isStopAuthorized && defaultAuthorization;
      result.isTransactionDisplayAuthorized = defaultAuthorization;
    }
    if (user.role === Constants.ROLE_DEMO) {
      // Demon user can never start nor stop transaction and can display details only for assigned site
      const defaultAuthorization = (isOrgCompActive && isUserAssignedToSite) || (!isOrgCompActive);
      result.isStartAuthorized = false;
      result.isStopAuthorized = false;
      result.isTransactionDisplayAuthorized = defaultAuthorization;
    }
    if (user.role === Constants.ROLE_BASIC) {
      // Basic user can start a transaction if he is assigned to the site or site management is not active
      result.isStartAuthorized = result.isStartAuthorized &&
        (isOrgCompActive && isUserAssignedToSite) || (!isOrgCompActive);
      // Basic user can start a transaction if he is assigned to the site or site management is not active
      result.isStopAuthorized = result.isStopAuthorized &&
        // Site Management is active  and user assigned to site and anyone allowed to stop or same user as transaction
        // Or access control disable
        (isOrgCompActive && isUserAssignedToSite &&
          (userAllowedToStopAllTransactions || isSameUserAsTransaction || !accessControlEnable)) ||
        // Site management inactive and badge access control and user identical to transaction
        (!isOrgCompActive && accessControlEnable && isSameUserAsTransaction) ||
        // Site management inactive and no badge access control
        (!isOrgCompActive && !accessControlEnable);
      result.isTransactionDisplayAuthorized =
        // Site Management is active  and user assigned to site and same user as transaction
        // Or access control disable
        (isOrgCompActive && isUserAssignedToSite &&
          (isSameUserAsTransaction || !accessControlEnable)) ||
        // Site management inactive and badge access control and user identical to transaction
        (!isOrgCompActive && accessControlEnable && isSameUserAsTransaction) ||
        // Site management inactive and no badge access control
        (!isOrgCompActive && !accessControlEnable);
    }
    return result;
  }

  public static async isTagIDAuthorizedOnChargingStation(chargingStation: ChargingStation, tagID: any, action: any) {
    let site: Site, siteArea: SiteArea;
    // Get the Organization component
    const tenant = await TenantStorage.getTenant(chargingStation.getTenantID());
    const isOrgCompActive = await tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
    // Org component enabled?
    if (isOrgCompActive) {
      // Site Area -----------------------------------------------
      siteArea = await chargingStation.getSiteArea();
      // Site is mandatory
      if (!siteArea) {
        // Reject Site Not Found
        throw new AppError(
          chargingStation.getID(),
          `Charging Station '${chargingStation.getID()}' is not assigned to a Site Area!`,
          Constants.HTTP_AUTH_CHARGER_WITH_NO_SITE_AREA_ERROR,
          'Authorizations', '_checkAndGetUserOnChargingStation');
      }

      // Access Control Enabled?
      if (!siteArea.accessControl) {
        // No control
        return;
      }
      // Site -----------------------------------------------------
      // TODO consider changing structure of CS->SA->S entirely; It's a little inconvenient that sometimes CS includes SA with includes S, which can also include SA, but not always
      site = siteArea.site ? siteArea.site : (siteArea.siteID ? await SiteStorage.getSite(chargingStation.getTenantID(), siteArea.siteID) : null);

      if (!site) {
        // Reject Site Not Found
        throw new AppError(
          chargingStation.getID(),
          `Site Area '${siteArea.name}' is not assigned to a Site!`,
          Constants.HTTP_AUTH_SITE_AREA_WITH_NO_SITE_ERROR,
          'Authorizations', 'checkAndGetUserOnChargingStation');
      }
    }
    // Get user
    let user: User = null;
    // Get the user
    if (tagID) {
      user = await Authorizations.checkAndGetUserTagIDOnChargingStation(
        chargingStation, tagID, action);
    }
    // Found?
    if (user) {
      // Check Authorization
      await Authorizations._checkAndGetUserOnChargingStation(
        chargingStation, user, isOrgCompActive, site, action);
    }
    return user;
  }

  public static async isTagIDsAuthorizedOnChargingStation(chargingStation: ChargingStation, tagId: any, transactionTagId: any, action: any) {
    let user: User, alternateUser: User;
    // Check if same user
    if (tagId !== transactionTagId) {
      // No: Check alternate user
      alternateUser = await Authorizations.isTagIDAuthorizedOnChargingStation(
        chargingStation, tagId, action);
      // Anonymous?
      if (alternateUser) {
        // Get the user
        user = await UserStorage.getUserByTagId(chargingStation.getTenantID(), transactionTagId);
        // Not Check if Alternate User belongs to a Site --------------------------------
        // Organization component active?
        const tenant = await TenantStorage.getTenant(chargingStation.getTenantID());
        const isOrgCompActive = await tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
        if (isOrgCompActive) {
          // Get the site (site existence is already checked by isTagIDAuthorizedOnChargingStation())
          const site: Site = await chargingStation.getSite();
          // Check if the site allows to stop the transaction of another user
          if (!Authorizations.isAdmin(alternateUser.role) &&
            !site.allowAllUsersToStopTransactions) {
            // Reject the User
            throw new BackendError(
              chargingStation.getID(),
              `User '${Utils.buildUserFullName(alternateUser)}' is not allowed to perform 'Stop Transaction' on User '${Utils.buildUserFullName(user)}' on Site '${site.name}'!`,
              'Authorizations', 'isTagIDsAuthorizedOnChargingStation', action,
              (alternateUser ? alternateUser : null), (user ? user : null));
          }
        } else {
          // Only Admins can stop a transaction when org is not active
          if (!Authorizations.isAdmin(alternateUser.role)) {
            // Reject the User
            throw new BackendError(
              chargingStation.getID(),
              `User '${Utils.buildUserFullName(alternateUser)}' is not allowed to perform 'Stop Transaction' on User '${Utils.buildUserFullName(user)}'!`,
              'Authorizations', 'isTagIDsAuthorizedOnChargingStation', action,
              (alternateUser ? alternateUser : null), (user ? user : null));
          }
        }
      }
    } else {
      // Check user
      user = await Authorizations.isTagIDAuthorizedOnChargingStation(
        chargingStation, transactionTagId, action);
    }
    return { user, alternateUser };
  }

  public static async _checkAndGetUserOnChargingStation(chargingStation: any, user: User, isOrgCompActive: boolean, site: Site, action: string) {
    // Check User status
    if (user.status !== Constants.USER_STATUS_ACTIVE) {
      // Reject but save ok
      throw new AppError(
        chargingStation.getID(),
        `${Utils.buildUserFullName(user)} is '${UserService.getStatusDescription(user.status)}'`, Constants.HTTP_GENERAL_ERROR,
        'Authorizations', '_checkAndGetUserOnChargingStation',
        user);
    }

    // Check if User belongs to a Site ------------------------------------------
    // Org component enabled?
    if (isOrgCompActive) {
      const foundUser = await SiteStorage.siteHasUser(chargingStation.getTenantID(), site.id, user.id);
      // User not found and Access Control Enabled?
      if (!foundUser) {
        // Yes: Reject the User
        throw new AppError(
          chargingStation.getID(),
          `User is not assigned to the site '${site.name}'!`,
          Constants.HTTP_AUTH_USER_WITH_NO_SITE_ERROR,
          'Authorizations', '_checkAndGetUserOnChargingStation',
          user);
      }
    }
    // Authorized?
    if (!Authorizations.canPerformActionOnChargingStation(user, chargingStation.getModel(), action)) {
      // Not Authorized!
      throw new AppAuthError(
        action,
        Constants.ENTITY_CHARGING_STATION,
        chargingStation.getID(),
        Constants.HTTP_GENERAL_ERROR, 'Authorizations', '_checkAndGetUserOnChargingStation',
        user);
    }
  }

  public static canListLogging(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGINGS, Constants.ACTION_LIST);
  }

  public static canReadLogging(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGING, Constants.ACTION_READ);
  }

  public static canListTransactions(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS, Constants.ACTION_LIST);
  }

  public static canListTransactionsInError(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS, Constants.ACTION_LIST);
  }

  public static canReadTransaction(loggedUser: any, transaction: Transaction): boolean {
    if (transaction.getUserJson() && transaction.getUserJson().id) {
      return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_READ,
        { 'user': transaction.getUserJson().id, 'owner': loggedUser.id });
    }
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_READ);
  }

  public static canUpdateTransaction(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_UPDATE);
  }

  public static canDeleteTransaction(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_DELETE);
  }

  public static canListChargingStations(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATIONS, Constants.ACTION_LIST);
  }

  public static canPerformActionOnChargingStation(loggedUser: any, chargingStation: any, action: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, action);
  }

  public static canReadChargingStation(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_READ);
  }

  public static canUpdateChargingStation(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_UPDATE);
  }

  public static canDeleteChargingStation(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_DELETE);
  }

  public static canListUsers(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USERS, Constants.ACTION_LIST);
  }

  public static canReadUser(loggedUser: any, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_READ,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canCreateUser(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_CREATE);
  }

  public static canUpdateUser(loggedUser: any, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_UPDATE,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canDeleteUser(loggedUser: any, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_DELETE,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canListSites(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITES, Constants.ACTION_LIST);
  }

  public static canReadSite(loggedUser: any, siteId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_READ,
      { 'site': siteId, 'sites': loggedUser.sites });
  }

  public static canCreateSite(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_CREATE);
  }

  public static canUpdateSite(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_UPDATE);
  }

  public static canDeleteSite(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_DELETE);
  }

  public static canListSettings(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTINGS, Constants.ACTION_LIST);
  }

  public static canReadSetting(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_READ);
  }

  public static canDeleteSetting(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_DELETE);
  }

  public static canCreateSetting(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_CREATE);
  }

  public static canUpdateSetting(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_UPDATE);
  }

  public static canListOcpiEndpoints(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINTS, Constants.ACTION_LIST);
  }

  public static canReadOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_READ);
  }

  public static canDeleteOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_DELETE);
  }

  public static canCreateOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_CREATE);
  }

  public static canUpdateOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_UPDATE);
  }

  public static canPingOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_PING);
  }

  public static canSendEVSEStatusesOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_SEND_EVSE_STATUSES);
  }

  public static canRegisterOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_REGISTER);
  }

  public static canGenerateLocalTokenOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_GENERATE_LOCAL_TOKEN);
  }

  public static canListVehicles(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLES, Constants.ACTION_LIST);
  }

  public static canReadVehicle(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_READ);
  }

  public static canCreateVehicle(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_CREATE);
  }

  public static canUpdateVehicle(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_UPDATE);
  }

  public static canDeleteVehicle(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_DELETE);
  }

  public static canListVehicleManufacturers(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURERS, Constants.ACTION_LIST);
  }

  public static canReadVehicleManufacturer(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_READ);
  }

  public static canCreateVehicleManufacturer(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_CREATE);
  }

  public static canUpdateVehicleManufacturer(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_UPDATE);
  }

  public static canDeleteVehicleManufacturer(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_DELETE);
  }

  public static canListSiteAreas(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREAS, Constants.ACTION_LIST);
  }

  public static canReadSiteArea(loggedUser: any, siteAreaID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_READ) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_READ,
        { 'site': siteAreaID, 'sites': loggedUser.sites });
  }

  public static canCreateSiteArea(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_CREATE) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_CREATE);
  }

  public static canUpdateSiteArea(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_UPDATE) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_UPDATE);
  }

  public static canDeleteSiteArea(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_DELETE) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_DELETE);
  }

  public static canListCompanies(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANIES, Constants.ACTION_LIST);
  }

  public static canReadCompany(loggedUser: any, companyId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_READ,
      { 'company': companyId, 'companies': loggedUser.companies });
  }

  public static canCreateCompany(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_CREATE);
  }

  public static canUpdateCompany(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_UPDATE);
  }

  public static canDeleteCompany(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_DELETE);
  }

  public static canListTenants(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANTS, Constants.ACTION_LIST);
  }

  public static canReadTenant(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_READ);
  }

  public static canCreateTenant(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_CREATE);
  }

  public static canUpdateTenant(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_UPDATE);
  }

  public static canDeleteTenant(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_DELETE);
  }

  public static canCreateConnection(loggedUser): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_CREATE,
      { 'owner': loggedUser.id });
  }

  public static canDeleteConnection(loggedUser, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_DELETE,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canReadConnection(loggedUser, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_READ,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canListConnections(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTIONS, Constants.ACTION_LIST);
  }

  public static canReadPricing(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING, Constants.ACTION_READ);
  }

  public static canUpdatePricing(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING, Constants.ACTION_UPDATE);
  }

  public static isSuperAdmin(userRole: string): boolean {
    return userRole === Constants.ROLE_SUPER_ADMIN;
  }

  public static isAdmin(userRole: string): boolean {
    return userRole === Constants.ROLE_ADMIN;
  }

  public static isBasic(userRole: string): boolean {
    return userRole === Constants.ROLE_BASIC;
  }

  public static isDemo(userRole: string): boolean {
    return userRole === Constants.ROLE_DEMO;
  }

  public static async getUserScopes(tenantID: string, user: User): Promise<ReadonlyArray<string>> {
    // Get the sites where the user is marked Site Admin
    const sitesAdmin = await UserStorage.getSites(tenantID,
      { userID: user.id, siteAdmin: true },
      { limit: Constants.NO_LIMIT, skip: 0 }
    );
    // Get the group from User's role
    const groups = Authorizations.getAuthGroupsFromUser(user.role, sitesAdmin.result.map(siteuser => siteuser.site));
    // Return the scopes
    return AuthorizationsDefinition.getInstance().getScopes(groups);
  }

  private static async checkAndGetUserTagIDOnChargingStation(chargingStation: any, tagID: string, action: string) {
    // Get the user
    let user = await UserStorage.getUserByTagId(chargingStation.getTenantID(), tagID);
    // Found?
    if (!user) {
      // Create an empty user

      const newUser: User = {
        name: 'Unknown',
        firstName: 'User',
        status: Constants.USER_STATUS_INACTIVE,
        role: Constants.ROLE_BASIC,
        email: tagID + '@chargeangels.fr',
        tagIDs: [tagID],
        ...UserStorage.getEmptyUser()
      };
      
      // Save the user
      await UserStorage.saveUser(chargingStation.getTenantID(), user);
      
      // Notify
      NotificationHandler.sendUnknownUserBadged(
        chargingStation.getTenantID(),
        Utils.generateGUID(),
        chargingStation.getModel(),
        {
          'chargeBoxID': chargingStation.getID(),
          'badgeId': tagID,
          'evseDashboardURL': Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain()),
          'evseDashboardUserURL': await Utils.buildEvseUserURL(chargingStation.getTenantID(), user, '#inerror')
        }
      );
      // Not authorized
      throw new AppError(
        chargingStation.getID(),
        `User with Tag ID '${tagID}' not found but saved as inactive user`, Constants.HTTP_GENERAL_ERROR,
        'Authorizations', '_checkAndGetUserTagIDOnChargingStation', user
      );
    } else {
      // USer Exists: Check User Deleted?
      if (user.status === Constants.USER_STATUS_DELETED) {
        // Yes: Restore it!
        user.deleted = false;
        // Set default user's value
        user.status = Constants.USER_STATUS_INACTIVE;
        user.name = 'Unknown';
        user.firstName = 'User';
        user.email = tagID + '@chargeangels.fr';
        user.phone = '';
        user.mobile = '';
        user.notificationsActive = true;
        user.image = '';
        user.iNumber = '';
        user.costCenter = '';
        // Log
        Logging.logSecurityInfo({
          tenantID: chargingStation.getTenantID(), user: user,
          module: 'Authorizations', method: '_checkAndGetUserTagIDOnChargingStation',
          message: `User with ID '${user.id}' has been restored`,
          action: action
        });
        // Save
        await UserStorage.saveUser(chargingStation.getTenantID(), user);
      }
    }
    return user;
  }

  private static getConfiguration() {
    if (!Authorizations.configuration) {
      Authorizations.configuration = Configuration.getAuthorizationConfig();
    }
    return Authorizations.configuration;
  }

  private static getAuthGroupsFromUser(userRole: string, sitesAdmins: ReadonlyArray<Site>): ReadonlyArray<string> {
    const groups: Array<string> = [];
    switch (userRole) {
      case Constants.ROLE_ADMIN:
        groups.push('admin');
        break;
      case Constants.ROLE_SUPER_ADMIN:
        groups.push('superAdmin');
        break;
      case Constants.ROLE_BASIC:
        groups.push('basic');
        // Check Site Admin
        if (sitesAdmins && sitesAdmins.length > 0) {
          groups.push('siteAdmin');
        }
        break;
      case Constants.ROLE_DEMO:
        groups.push('demo');
        break;
    }
    return groups;
  }

  private static canPerformAction(loggedUser, resource, action, context?): boolean {
    // Get the groups
    const groups = Authorizations.getAuthGroupsFromUser(loggedUser.role, loggedUser.sitesAdmin);
    // Check
    const authorized = AuthorizationsDefinition.getInstance().can(groups, resource, action, context);
    if (!authorized && Authorizations.getConfiguration().debug) {
      Logging.logSecurityInfo({
        tenantID: loggedUser.tenantID, user: loggedUser,
        module: 'Authorizations', method: 'canPerformAction',
        message: `Role ${loggedUser.role} Cannot ${action} on ${resource} with context ${JSON.stringify(context)}`,
        action: 'Authorizations'
      });
    }
    return authorized;
  }
}
