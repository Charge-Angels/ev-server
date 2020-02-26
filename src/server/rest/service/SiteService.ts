import { NextFunction, Request, Response } from 'express';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import CompanyStorage from '../../../storage/mongodb/CompanyStorage';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import Site from '../../../types/Site';
import TenantComponents from '../../../types/TenantComponents';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import SiteSecurity from './security/SiteSecurity';
import UserSecurity from './security/UserSecurity';
import UtilsService from './UtilsService';

export default class SiteService {

  public static async handleAddUsersToSite(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, 'SiteService', 'handleAddUsersToSite');
    // Filter
    const filteredRequest = SiteSecurity.filterAssignSiteUsers(req.body);
    // Check auth
    if (!Authorizations.canUpdateSite(req.user, filteredRequest.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SITE,
        module: 'SiteService',
        method: 'handleAddUsersToSite',
        value: filteredRequest.siteID
      });
    }
    UtilsService.assertIdIsProvided(action, filteredRequest.siteID, 'SiteSecurity', 'filterAssignSiteUsers', req.user);
    if (!filteredRequest.userIDs || (filteredRequest.userIDs && filteredRequest.userIDs.length <= 0)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The User\'s IDs must be provided',
        module: 'SiteService',
        method: 'filterAssignSiteUsers',
        user: req.user
      });
    }
    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
    if (!site) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The Site with ID '${filteredRequest.siteID}' does not exist`,
        module: 'SiteService',
        method: 'handleAddUsersToSite',
        user: req.user
      });
    }
    for (const userID of filteredRequest.userIDs) {
      // Check the user
      const user = await UserStorage.getUser(req.user.tenantID, userID);
      if (!user) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
          message: `The User with ID '${userID}' does not exist`,
          module: 'SiteService',
          method: 'handleAddUsersToSite',
          user: req.user
        });
      }
    }
    // Save
    await SiteStorage.addUsersToSite(req.user.tenantID, filteredRequest.siteID, filteredRequest.userIDs);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleAddUsersToSite',
      message: 'Site\'s Users have been added successfully', action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateSiteUserAdmin(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, 'SiteService', 'handleUpdateSiteUserAdmin');
    // Filter
    const filteredRequest = SiteSecurity.filterUpdateSiteUserAdminRequest(req.body);
    // Check
    if (!filteredRequest.userID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The User ID must be provided',
        module: 'SiteService',
        method: 'handleUpdateSiteUserAdmin',
        user: req.user
      });
    }
    if (!filteredRequest.siteID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Site ID must be provided',
        module: 'SiteService',
        method: 'handleUpdateSiteUserAdmin',
        user: req.user
      });
    }
    if (!Utils.objectHasProperty(filteredRequest, 'siteAdmin')) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Site Admin value must be provided',
        module: 'SiteService',
        method: 'handleUpdateSiteUserAdmin',
        user: req.user
      });
    }
    if (req.user.id === filteredRequest.userID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot change the site Admin on the logged user',
        module: 'SiteService',
        method: 'handleUpdateSiteUserAdmin',
        user: req.user,
        actionOnUser: filteredRequest.userID
      });
    }
    if (!Authorizations.canUpdateSite(req.user, filteredRequest.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SITE,
        module: 'SiteService',
        method: 'handleUpdateSiteUserAdmin',
        value: filteredRequest.siteID
      });
    }
    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
    if (!site) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The Site with ID '${filteredRequest.siteID}' does not exist`,
        module: 'SiteService',
        method: 'handleUpdateSiteUserAdmin',
        user: req.user,
        actionOnUser: filteredRequest.userID
      });
    }
    // Get the User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.userID);
    if (!user) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The User with ID '${filteredRequest.userID}' does not exist`,
        module: 'SiteService',
        method: 'handleUpdateSiteUserAdmin',
        user: req.user,
        actionOnUser: filteredRequest.userID
      });
    }
    // Check user
    if (!Authorizations.isBasic(user)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Only Users with Basic role can be Site Admin',
        module: 'SiteService',
        method: 'handleUpdateSiteUserAdmin',
        user: req.user,
        actionOnUser: filteredRequest.userID
      });
    }
    // Update
    await SiteStorage.updateSiteUserAdmin(req.user.tenantID, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteAdmin);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleUpdateSiteUserAdmin',
      message: `The User '${Utils.buildUserFullName(user)}' has been ${filteredRequest.siteAdmin ? 'assigned' : 'removed'} the Site Admin role on site '${site.name}'`,
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateSiteOwner(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.canCreateSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SITE,
        module: 'SiteService',
        method: 'handleUpdateSiteOwner'
      });
    }
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, 'SiteService', 'handleUpdateSiteOwner');
    // Filter
    const filteredRequest = SiteSecurity.filterUpdateSiteOwnerRequest(req.body);
    // Check
    if (!filteredRequest.userID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The User ID must be provided',
        module: 'SiteService',
        method: 'handleUpdateSiteOwner',
        user: req.user
      });
    }
    if (!filteredRequest.siteID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Site ID must be provided',
        module: 'SiteService',
        method: 'handleUpdateSiteOwner',
        user: req.user
      });
    }
    if (!Utils.objectHasProperty(filteredRequest, 'siteOwner')) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Site Owner value must be provided',
        module: 'SiteService',
        method: 'handleUpdateSiteUserOwner',
        user: req.user
      });
    }
    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
    if (!site) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The Site with ID '${filteredRequest.siteID}' does not exist`,
        module: 'SiteService',
        method: 'handleUpdateSiteUserOwner',
        user: req.user,
        actionOnUser: filteredRequest.userID
      });
    }
    // Get the User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.userID);
    if (!user) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The User with ID '${filteredRequest.userID}' does not exist`,
        module: 'SiteService',
        method: 'handleUpdateSiteUserOwner',
        user: req.user,
        actionOnUser: filteredRequest.userID
      });
    }
    // Update
    await SiteStorage.updateSiteOwner(req.user.tenantID, filteredRequest.siteID, filteredRequest.userID, filteredRequest.siteOwner);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleUpdateSiteUserOwner',
      message: `The User '${Utils.buildUserFullName(user)}' has been granted Site Owner on site '${site.name}'`,
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleRemoveUsersFromSite(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, 'SiteService', 'handleRemoveUsersFromSite');
    // Filter
    const filteredRequest = SiteSecurity.filterAssignSiteUsers(req.body);
    if (!Authorizations.canUpdateSite(req.user, filteredRequest.siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SITE,
        module: 'SiteService',
        method: 'handleRemoveUsersFromSite',
        value: filteredRequest.siteID
      });
    }
    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.siteID);
    if (!site) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The Site with ID '${filteredRequest.siteID}' does not exist`,
        module: 'SiteService',
        method: 'handleRemoveUsersFromSite',
        user: req.user
      });
    }
    // Get Users
    for (const userID of filteredRequest.userIDs) {
      // Check the user
      const user = await UserStorage.getUser(req.user.tenantID, userID);
      if (!user) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
          message: `The User with ID '${userID}' does not exist`,
          module: 'SiteService',
          method: 'handleRemoveUsersFromSite',
          user: req.user
        });
      }
    }
    // Save
    await SiteStorage.removeUsersFromSite(req.user.tenantID, filteredRequest.siteID, filteredRequest.userIDs);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleRemoveUsersFromSite',
      message: 'Site\'s Users have been removed successfully', action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetUsers(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, 'SiteService', 'handleGetUsersFromSite');
    // Filter
    const filteredRequest = SiteSecurity.filterSiteUsersRequest(req.query);
    // Check Mandatory fields
    if (!filteredRequest.SiteID) {
      // Not Found!
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Site\'s ID must be provided',
        module: 'SiteService',
        method: 'handleGetUsersFromSite',
        user: req.user
      });
    }
    // Get the Site
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.SiteID);
    if (!site) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The Site with ID '${filteredRequest.SiteID}' does not exist`,
        module: 'SiteService',
        method: 'handleGetUsersFromSite',
        user: req.user
      });
    }
    // Check auth
    if (!Authorizations.canUpdateSite(req.user, filteredRequest.SiteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SITE,
        module: 'SiteService',
        method: 'handleGetUsersFromSite',
        value: site.id
      });
    }
    // Get users
    const users = await SiteStorage.getUsers(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteID: filteredRequest.SiteID
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      ['user.id', 'user.name', 'user.firstName', 'user.email', 'user.role', 'siteAdmin', 'siteOwner', 'siteID']
    );
    // Filter
    users.result = users.result.map((siteuser) => ({
      siteID: siteuser.siteID,
      siteAdmin: siteuser.siteAdmin,
      siteOwner: siteuser.siteOwner,
      user: UserSecurity.filterUserResponse(siteuser.user, req.user)
    }));
    res.json(users);
    next();
  }

  public static async handleDeleteSite(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.SITE, 'SiteService', 'handleDeleteSite');
    // Filter
    const siteID = SiteSecurity.filterSiteRequestByID(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, siteID, 'SiteService', 'handleDeleteSite', req.user);
    // Check
    if (!Authorizations.canDeleteSite(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE,
        entity: Entity.SITE,
        module: 'SiteService',
        method: 'handleDeleteSite',
        value: siteID
      });
    }
    // Get
    const site = await SiteStorage.getSite(req.user.tenantID, siteID);
    UtilsService.assertObjectExists(action, site, `Site with ID '${siteID}' does not exist`, 'SiteService', 'handleDeleteSite', req.user);
    // Delete
    await SiteStorage.deleteSite(req.user.tenantID, site.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleDeleteSite',
      message: `Site '${site.name}' has been deleted successfully`,
      action: action, detailedMessages: site
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetSite(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.SITE, 'SiteService', 'handleGetSite');
    // Filter
    const filteredRequest = SiteSecurity.filterSiteRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, 'SiteService', 'handleGetSite', req.user);
    // Check auth
    if (!Authorizations.canReadSite(req.user, filteredRequest.ID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.SITE,
        module: 'SiteService',
        method: 'handleGetSite',
        value: filteredRequest.ID
      });
    }
    // Get it
    const site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.ID}' does not exist`, 'SiteService', 'handleGetSite', req.user);
    // Return
    res.json(
      // Filter
      SiteSecurity.filterSiteResponse(site, req.user)
    );
    next();
  }

  public static async handleGetSites(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.SITES, 'SiteService', 'handleGetSites');
    // Check auth
    if (!Authorizations.canListSites(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.SITES,
        module: 'SiteService',
        method: 'handleGetSites'
      });
    }
    // Filter
    const filteredRequest = SiteSecurity.filterSitesRequest(req.query);
    // Get the sites
    const sites = await SiteStorage.getSites(req.user.tenantID,
      {
        search: filteredRequest.Search,
        userID: filteredRequest.UserID,
        companyIDs: (filteredRequest.CompanyID ? filteredRequest.CompanyID.split('|') : null),
        siteIDs: Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        withCompany: filteredRequest.WithCompany,
        excludeSitesOfUserID: filteredRequest.ExcludeSitesOfUserID,
        withAvailableChargers: filteredRequest.WithAvailableChargers
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      ['id', 'name', 'address.coordinates', 'address.city', 'address.country', 'companyID', 'company.name',
        'autoUserSiteAssignment']
    );
    // Build the result
    if (sites.result && sites.result.length > 0) {
      // Filter
      SiteSecurity.filterSitesResponse(sites, req.user);
    }
    res.json(sites);
    next();
  }

  public static async handleGetSiteImage(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.SITE, 'SiteService', 'handleGetSiteImage');

    // Filter
    const siteID = SiteSecurity.filterSiteRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, siteID, 'SiteService', 'handleGetSiteImage', req.user);
    // Check auth
    if (!Authorizations.canReadSite(req.user, siteID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.SITE,
        module: 'SiteService',
        method: 'handleGetSiteImage',
        value: siteID
      });
    }
    // Get it
    const site = await SiteStorage.getSite(req.user.tenantID, siteID);
    UtilsService.assertObjectExists(action, site, `Site with ID '${siteID}' does not exist`, 'SiteService', 'handleGetSiteImage', req.user);
    // Get the image
    const siteImage = await SiteStorage.getSiteImage(req.user.tenantID, siteID);
    // Return
    res.json(siteImage);
    next();
  }

  public static async handleCreateSite(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.CREATE, Entity.SITE, 'SiteService', 'handleCreateSite');
    // Check auth
    if (!Authorizations.canCreateSite(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.SITE,
        module: 'SiteService',
        method: 'handleCreateSite'
      });
    }
    // Filter
    const filteredRequest = SiteSecurity.filterSiteCreateRequest(req.body);
    // Check
    Utils.checkIfSiteValid(filteredRequest, req);
    // Check Company
    const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.companyID);
    UtilsService.assertObjectExists(action, company, `Company ID '${filteredRequest.companyID}' does not exist`, 'SiteService', 'handleCreateSite', req.user);
    // Create site
    const site: Site = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Site;
    // Save
    site.id = await SiteStorage.saveSite(req.user.tenantID, site, true);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleCreateSite',
      message: `Site '${site.name}' has been created successfully`,
      action: action, detailedMessages: site
    });
    // Ok
    res.json(Object.assign({ id: site.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateSite(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITE, 'SiteService', 'handleUpdateSite');
    // Filter
    const filteredRequest = SiteSecurity.filterSiteUpdateRequest(req.body);
    // Check
    Utils.checkIfSiteValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canUpdateSite(req.user, filteredRequest.id)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.SITE,
        module: 'SiteService',
        method: 'handleUpdateSite',
        value: filteredRequest.id
      });
    }
    // Get Site
    const site: Site = await SiteStorage.getSite(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, site, `Site with ID '${filteredRequest.id}' does not exist`, 'SiteService', 'handleUpdateSite', req.user);
    // Update
    site.lastChangedBy = { 'id': req.user.id };
    site.lastChangedOn = new Date();
    // Save
    await SiteStorage.saveSite(req.user.tenantID, { ...site, ...filteredRequest }, true);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'SiteService', method: 'handleUpdateSite',
      message: `Site '${site.name}' has been updated successfully`,
      action: action, detailedMessages: site
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
