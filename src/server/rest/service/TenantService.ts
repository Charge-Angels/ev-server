import { NextFunction, Request, Response } from 'express';
import HttpStatusCodes from 'http-status-codes';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import NotificationHandler from '../../../notification/NotificationHandler';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { SettingDB, SettingDBContent } from '../../../types/Setting';
import Tenant from '../../../types/Tenant';
import User, { UserRole } from '../../../types/User';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import TenantValidator from '../validation/TenantValidation';
import TenantSecurity from './security/TenantSecurity';
import UtilsService from './UtilsService';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';

const MODULE_NAME = 'TenantService';

export default class TenantService {

  public static async handleDeleteTenant(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const id = TenantSecurity.filterTenantRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, id, 'TenantService', 'handleDeleteTenant', req.user);
    // Check auth
    if (!Authorizations.canDeleteTenant(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE,
        entity: Entity.TENANT,
        module: MODULE_NAME,
        method: 'handleDeleteTenant',
        value: id
      });
    }
    // Get
    const tenant = await TenantStorage.getTenant(id);
    UtilsService.assertObjectExists(action, tenant, `Tenant with ID '${id}' does not exist`,
      'TenantService', 'handleDeleteTenant', req.user);
    // Check if current tenant
    if (tenant.id === req.user.tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `Your own tenant with id '${tenant.id}' cannot be deleted`,
        module: MODULE_NAME,
        method: 'handleDeleteTenant',
        user: req.user,
        action: action
      });
    }
    // Delete
    await TenantStorage.deleteTenant(tenant.id);
    // Remove collection
    await TenantStorage.deleteTenantDB(tenant.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleDeleteTenant',
      message: `Tenant '${tenant.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { tenant }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetTenant(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const tenantID = TenantSecurity.filterTenantRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, tenantID, 'TenantService', 'handleGetTenant', req.user);
    // Check auth
    if (!Authorizations.canReadTenant(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.TENANT,
        module: MODULE_NAME,
        method: 'handleGetTenant',
        value: tenantID
      });
    }
    // Get it
    const tenant = await TenantStorage.getTenant(tenantID);
    UtilsService.assertObjectExists(action, tenant, `Tenant with ID '${tenantID}' does not exist`,
      'TenantService', 'handleGetTenant', req.user);
    // Return
    res.json(
      // Filter
      TenantSecurity.filterTenantResponse(
        tenant, req.user)
    );
    next();
  }

  public static async handleGetTenants(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTenants(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TENANTS,
        module: MODULE_NAME,
        method: 'handleGetTenants'
      });
    }
    // Filter
    const filteredRequest = TenantSecurity.filterTenantsRequest(req.query);
    // Get the tenants
    const tenants = await TenantStorage.getTenants(
      { search: filteredRequest.Search },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort });
    // Filter
    TenantSecurity.filterTenantsResponse(tenants, req.user);
    // Return
    res.json(tenants);
    next();
  }

  public static async handleCreateTenant(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Validate
    const filteredRequest = TenantValidator.getInstance().validateTenantCreation(req.body);
    // Check auth
    if (!Authorizations.canCreateTenant(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.TENANT,
        module: MODULE_NAME,
        method: 'handleCreateTenant'
      });
    }
    // Check the Tenant's name
    let foundTenant = await TenantStorage.getTenantByName(filteredRequest.name);
    if (foundTenant) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
        message: `The tenant with name '${filteredRequest.name}' already exists`,
        module: MODULE_NAME,
        method: 'handleCreateTenant',
        user: req.user,
        action: action
      });
    }
    // Get the Tenant with ID (subdomain)
    foundTenant = await TenantStorage.getTenantBySubdomain(filteredRequest.subdomain);
    if (foundTenant) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
        message: `The tenant with subdomain '${filteredRequest.subdomain}' already exists`,
        module: MODULE_NAME,
        method: 'handleCreateTenant',
        user: req.user,
        action: action
      });
    }
    // Update timestamp
    filteredRequest.createdBy = { 'id': req.user.id };
    filteredRequest.createdOn = new Date();
    // Save
    filteredRequest.id = await TenantStorage.saveTenant(filteredRequest);
    // Update with components
    await TenantService.updateSettingsWithComponents(filteredRequest, req);
    // Create DB collections
    await TenantStorage.createTenantDB(filteredRequest.id);
    // Create Admin user in tenant
    const tenantUser: User = UserStorage.getEmptyUser() as User;
    tenantUser.name = filteredRequest.name;
    tenantUser.firstName = 'Admin';
    tenantUser.email = filteredRequest.email;
    // Save User
    tenantUser.id = await UserStorage.saveUser(filteredRequest.id, tenantUser);
    // Save User Role
    await UserStorage.saveUserRole(filteredRequest.id, tenantUser.id, UserRole.ADMIN);
    // Save User Status
    await UserStorage.saveUserStatus(filteredRequest.id, tenantUser.id, tenantUser.status);
    // Save User Account Verification
    const verificationToken = Utils.generateToken(filteredRequest.email);
    await UserStorage.saveUserAccountVerification(filteredRequest.id, tenantUser.id, { verificationToken });
    const resetHash = Utils.generateGUID();
    // Init Password info
    await UserStorage.saveUserPassword(filteredRequest.id, tenantUser.id, { passwordResetHash: resetHash });
    // Send activation link
    const evseDashboardVerifyEmailURL = Utils.buildEvseURL(filteredRequest.subdomain) +
      '/#/verify-email?VerificationToken=' + verificationToken + '&Email=' +
      tenantUser.email + '&ResetToken=' + resetHash;
    // Send Register User (Async)
    NotificationHandler.sendNewRegisteredUser(
      filteredRequest.id,
      Utils.generateGUID(),
      tenantUser,
      {
        'tenant': filteredRequest.name,
        'user': tenantUser,
        'evseDashboardURL': Utils.buildEvseURL(filteredRequest.subdomain),
        'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
      }
    );
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleCreateTenant',
      message: `Tenant '${filteredRequest.name}' has been created successfully`,
      action: action,
      detailedMessages: { params: filteredRequest }
    });
    // Ok
    res.status(HttpStatusCodes.OK).json(Object.assign({ id: filteredRequest.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateTenant(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check
    const tenantUpdate = TenantValidator.getInstance().validateTenantUpdate(req.body);
    // Check auth
    if (!Authorizations.canUpdateTenant(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.TENANT,
        module: MODULE_NAME,
        method: 'handleUpdateTenant',
        value: tenantUpdate.id
      });
    }
    // Get
    const tenant = await TenantStorage.getTenant(tenantUpdate.id);
    UtilsService.assertObjectExists(action, tenant, `Tenant with ID '${tenantUpdate.id}' does not exist`,
      'TenantService', 'handleUpdateTenant', req.user);
    // Check if smart charging is deactivated in all site areas when deactivated in super tenant
    if (tenantUpdate.components && tenantUpdate.components.smartCharging &&
        tenant.components && tenant.components.smartCharging &&
       !tenantUpdate.components.smartCharging.active && tenant.components.smartCharging.active) {
      const siteAreas = await SiteAreaStorage.getSiteAreas(tenantUpdate.id, { smartCharging: true }, Constants.DB_PARAMS_MAX_LIMIT);
      if (siteAreas.count !== 0) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.SMART_CHARGING_STILL_ACTIVE_FOR_SITE_AREA,
          message: 'Site Area(s) is/are still enabled for Smart Charging. Please deactivate it/them to disable Smart Charging in Tenant',
          module: MODULE_NAME,
          method: 'handleUpdateSetting',
          user: req.user,
          detailedMessages: { siteAreas: siteAreas.result.map((siteArea) => `${siteArea.name} (${siteArea.id})`) },
        });
      }
    }

    // Update timestamp
    tenantUpdate.lastChangedBy = { 'id': req.user.id };
    tenantUpdate.lastChangedOn = new Date();
    // Update Tenant
    await TenantStorage.saveTenant(tenantUpdate);
    // Update with components
    await TenantService.updateSettingsWithComponents(tenantUpdate, req);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleUpdateTenant',
      message: `Tenant '${tenantUpdate.name}' has been updated successfully`,
      action: action,
      detailedMessages: { tenant: tenantUpdate }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async updateSettingsWithComponents(tenant: Partial<Tenant>, req: Request): Promise<void> {
    // Create settings
    for (const componentName in tenant.components) {
      // Get the settings
      const currentSetting = await SettingStorage.getSettingByIdentifier(tenant.id, componentName);
      // Check if Component is active
      if (!tenant.components[componentName] || !tenant.components[componentName].active) {
        // Delete settings
        if (currentSetting) {
          await SettingStorage.deleteSetting(tenant.id, currentSetting.id);
        }
        continue;
      }
      // Create
      const newSettingContent: SettingDBContent = Utils.createDefaultSettingContent(
        {
          ...tenant.components[componentName],
          name: componentName
        }, (currentSetting ? currentSetting.content : null));
      if (newSettingContent) {
        // Create & Save
        if (!currentSetting) {
          const newSetting: SettingDB = {
            identifier: componentName,
            content: newSettingContent
          } as SettingDB;
          newSetting.createdOn = new Date();
          newSetting.createdBy = { 'id': req.user.id };
          // Save Setting
          await SettingStorage.saveSettings(tenant.id, newSetting);
        } else {
          currentSetting.content = newSettingContent;
          currentSetting.lastChangedOn = new Date();
          currentSetting.lastChangedBy = { 'id': req.user.id };
          // Save Setting
          await SettingStorage.saveSettings(tenant.id, currentSetting);
        }
      }
    }
  }
}
