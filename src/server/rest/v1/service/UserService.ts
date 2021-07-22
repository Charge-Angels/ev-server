import { Action, Entity } from '../../../../types/Authorization';
import { ActionsResponse, ImportStatus } from '../../../../types/GlobalType';
import { AsyncTaskType, AsyncTasks } from '../../../../types/AsyncTask';
import { Car, CarType } from '../../../../types/Car';
import { DataResult, UserDataResult } from '../../../../types/DataResult';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import User, { ImportedUser, UserRequiredImportProperties } from '../../../../types/User';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import AsyncTaskManager from '../../../../async-task/AsyncTaskManager';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import BillingFactory from '../../../../integration/billing/BillingFactory';
import Busboy from 'busboy';
import CSVError from 'csvtojson/v2/CSVError';
import CarStorage from '../../../../storage/mongodb/CarStorage';
import Constants from '../../../../utils/Constants';
import EmspOCPIClient from '../../../../client/ocpi/EmspOCPIClient';
import JSONStream from 'JSONStream';
import LockingHelper from '../../../../locking/LockingHelper';
import LockingManager from '../../../../locking/LockingManager';
import Logging from '../../../../utils/Logging';
import NotificationHandler from '../../../../notification/NotificationHandler';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../../../../types/ocpi/OCPIRole';
import { OCPITokenWhitelist } from '../../../../types/ocpi/OCPIToken';
import OCPIUtils from '../../../ocpi/OCPIUtils';
import { ServerAction } from '../../../../types/Server';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import { StartTransactionErrorCode } from '../../../../types/Transaction';
import TagStorage from '../../../../storage/mongodb/TagStorage';
import Tenant from '../../../../types/Tenant';
import TenantComponents from '../../../../types/TenantComponents';
import { UserInErrorType } from '../../../../types/InError';
import UserNotifications from '../../../../types/UserNotifications';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import UserValidator from '../validator/UserValidator';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './security/UtilsSecurity';
import UtilsService from './UtilsService';
import _ from 'lodash';
import csvToJson from 'csvtojson/v2';
import moment from 'moment';

const MODULE_NAME = 'UserService';

export default class UserService {

  public static async handleGetUserDefaultTagCar(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidator.getInstance().validateUserDefaultTagCar(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.UserID, MODULE_NAME, 'handleGetUserDefaultTagCar', req.user);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.UserID, Action.READ, action);
    // Handle Tag
    // Get the default Tag
    let tag = await TagStorage.getDefaultUserTag(req.user.tenantID, user.id, {
      issuer: true
    }, ['visualID', 'description', 'active']);
    if (!tag) {
      // Get the first active Tag
      tag = await TagStorage.getFirstActiveUserTag(req.user.tenantID, user.id, {
        issuer: true
      }, ['visualID', 'description', 'active']);
    }
    // Handle Car
    let car: Car;
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.CAR)) {
      // Get the default Car
      car = await CarStorage.getDefaultUserCar(req.tenant, filteredRequest.UserID, {},
        ['id', 'type', 'licensePlate', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion']
      );
      if (!car) {
        // Get the first available car
        car = await CarStorage.getFirstAvailableUserCar(req.tenant, filteredRequest.UserID,
          ['id', 'type', 'licensePlate', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion']
        );
      }
    }
    const errorCodes: Array<StartTransactionErrorCode> = [];
    // Check Billing errors
    await UserService.checkBillingErrorCodes(action, req.tenant, req.user, user, errorCodes);
    // Add error if EULA are not accepted (use case -> at user import)
    if (!user.eulaAcceptedOn) {
      errorCodes.push(StartTransactionErrorCode.EULA_NOT_ACCEPTED);
    }
    res.json({
      tag, car, errorCodes
    });
    next();
  }

  public static async handleAssignSitesToUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.SITES, 'SiteService', 'handleAssignSitesToUser');
    // Filter request
    const filteredRequest = UserValidator.getInstance().validateUserAssignToSites(req.body);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.userID, Action.READ, action);
    // Check and Get Sites
    const sites = await UtilsService.checkUserSitesAuthorization(
      req.tenant, req.user, user, filteredRequest.siteIDs, action);
    // Save
    if (action === ServerAction.ADD_SITES_TO_USER) {
      await UserStorage.addSitesToUser(req.user.tenantID, filteredRequest.userID, sites.map((site) => site.id));
    } else {
      await UserStorage.removeSitesFromUser(req.user.tenantID, filteredRequest.userID, sites.map((site) => site.id));
    }
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user,
      module: MODULE_NAME,
      method: 'handleAssignSitesToUser',
      message: 'User\'s Sites have been assigned successfully', action: action
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const userID = UserValidator.getInstance().validateUserGetByID(req.query).ID.toString();
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, userID, Action.DELETE, action, null, {}, false, false);
    // Delete OCPI User
    if (!user.issuer) {
      // Delete User
      await UserStorage.deleteUser(req.user.tenantID, user.id);
      await Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, actionOnUser: user,
        module: MODULE_NAME, method: 'handleDeleteUser',
        message: `User with ID '${user.id}' has been deleted successfully`,
        action: action
      });
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
      return;
    }
    // Delete Billing
    await UserService.checkAndDeleteUserBilling(req.tenant, req.user, user);
    // Delete OCPI
    await UserService.checkAndDeleteUserOCPI(req.tenant, req.user, user);
    // Delete Car
    await UserService.checkAndDeleteCar(req.tenant, req.user, user);
    // Delete User
    await UserStorage.deleteUser(req.user.tenantID, user.id);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleDeleteUser',
      message: `User with ID '${user.id}' has been deleted successfully`,
      action: action
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    let statusHasChanged = false;
    // Filter
    const filteredRequest = UserValidator.getInstance().validateUserUpdate({ ...req.params, ...req.body });
    // Check and Get User
    let user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest);
    // Check email already exists
    const userWithEmail = await UserStorage.getUserByEmail(req.user.tenantID, filteredRequest.email);
    if (userWithEmail && user.id !== userWithEmail.id) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
        message: `Email '${filteredRequest.email}' already exists`,
        module: MODULE_NAME, method: 'handleUpdateUser',
        user: req.user,
        action: action
      });
    }
    // Check if Status has been changed
    if (filteredRequest.status && filteredRequest.status !== user.status) {
      statusHasChanged = true;
    }
    // Update timestamp
    const lastChangedBy = { id: req.user.id };
    const lastChangedOn = new Date();
    // Check User validity
    UtilsService.checkIfUserValid(filteredRequest, user, req);
    // Update user
    user = {
      ...user,
      ...filteredRequest,
      name: filteredRequest.name.toUpperCase(),
      email: filteredRequest.email.toLowerCase(),
      lastChangedBy: lastChangedBy,
      lastChangedOn: lastChangedOn,
    };
    // Update User (override TagIDs because it's not of the same type as in filteredRequest)
    await UserStorage.saveUser(req.user.tenantID, user, true);
    // Save User's password
    if (filteredRequest.password) {
      // Update the password
      const newPasswordHashed = await Utils.hashPasswordBcrypt(filteredRequest.password);
      await UserStorage.saveUserPassword(req.user.tenantID, filteredRequest.id,
        {
          password: newPasswordHashed,
          passwordWrongNbrTrials: 0,
          passwordResetHash: null,
          passwordBlockedUntil: null
        });
    }
    // Only Admin can save these data
    if (Authorizations.isAdmin(req.user) || Authorizations.isSuperAdmin(req.user)) {
      // Save User's Status
      if (filteredRequest.status) {
        await UserStorage.saveUserStatus(req.user.tenantID, user.id, filteredRequest.status);
      }
      // Save User's Role
      if (filteredRequest.role) {
        await UserStorage.saveUserRole(req.user.tenantID, user.id, filteredRequest.role);
      }
      // Save Admin Data
      if (Utils.objectHasProperty(filteredRequest, 'plateID')) {
        const adminData: { plateID?: string; } = {};
        adminData.plateID = filteredRequest.plateID || null;
        await UserStorage.saveUserAdminData(req.user.tenantID, user.id, adminData);
      }
    }
    // Update Billing
    await UserService.updateUserBilling(ServerAction.USER_UPDATE, req.tenant, req.user, user);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleUpdateUser',
      message: 'User has been updated successfully',
      action: action
    });
    // Notify
    if (statusHasChanged && req.tenant.id !== Constants.DEFAULT_TENANT) {
      // Send notification (Async)
      NotificationHandler.sendUserAccountStatusChanged(
        req.tenant,
        Utils.generateUUID(),
        user,
        {
          'user': user,
          'evseDashboardURL': Utils.buildEvseURL(req.tenant.subdomain)
        }
      ).catch(() => { });
    }
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateUserMobileToken(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidator.getInstance().validateUserUpdateMobileToken({ ...req.params, ...req.body });
    // Check Mandatory fields
    if (!filteredRequest.mobileToken) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User\'s mobile token ID must be provided',
        module: MODULE_NAME, method: 'handleUpdateUserMobileToken',
        user: req.user,
        action: action
      });
    }
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action);
    // Update User (override TagIDs because it's not of the same type as in filteredRequest)
    await UserStorage.saveUserMobileToken(req.user.tenantID, user.id, {
      mobileToken: filteredRequest.mobileToken,
      mobileOs: filteredRequest.mobileOS,
      mobileLastChangedOn: new Date()
    });
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: user,
      module: MODULE_NAME, method: 'handleUpdateUserMobileToken',
      message: 'User\'s mobile token has been updated successfully',
      action: action,
      detailedMessages: {
        mobileToken: filteredRequest.mobileToken,
        mobileOS: filteredRequest.mobileOS
      }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidator.getInstance().validateUserGetByID(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetUser', req.user);
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, filteredRequest.ID.toString(), Action.READ, action, null, {
        withImage: true
      }, true, false);
    res.json(user);
    next();
  }

  public static async handleGetUserImage(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const userID = UserValidator.getInstance().validateUserGetByID(req.query).ID.toString();
    // Check and Get User
    const user = await UtilsService.checkAndGetUserAuthorization(
      req.tenant, req.user, userID, Action.READ, action);
    // Get the user image
    const userImage = await UserStorage.getUserImage(req.user.tenantID, user.id);
    res.json(userImage);
    next();
  }

  public static async handleExportUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    await UtilsService.exportToCSV(req, res, 'exported-users.csv',
      UserService.getUsers.bind(this),
      UserService.convertToCSV.bind(this));
  }

  public static async handleGetSites(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.USER, MODULE_NAME, 'handleGetSites');
    // Filter
    const filteredRequest = UserValidator.getInstance().validateUserGetSites(req.query);
    // Check User
    try {
      await UtilsService.checkAndGetUserAuthorization(
        req.tenant, req.user, filteredRequest.UserID, Action.READ, action);
    } catch (error) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Check dynamic auth for reading Sites
    const authorizationUserSitesFilters = await AuthorizationService.checkAndGetUserSitesAuthorizations(req.tenant,
      req.user, filteredRequest);
    if (!authorizationUserSitesFilters.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get Sites
    const sites = await UserStorage.getUserSites(req.user.tenantID,
      {
        search: filteredRequest.Search,
        userIDs: [filteredRequest.UserID],
        ...authorizationUserSitesFilters.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationUserSitesFilters.projectFields
    );
    // Filter
    sites.result = sites.result.map((userSite) => ({
      userID: userSite.userID,
      siteAdmin: userSite.siteAdmin,
      siteOwner: userSite.siteOwner,
      site: userSite.site
    }));
    res.json(sites);
    next();
  }

  public static async handleGetUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Return
    res.json(await UserService.getUsers(req));
    next();
  }

  public static async handleGetUsersInError(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidator.getInstance().validateUsersGetInError(req.query);
    // Get authorization filters
    const authorizationUserInErrorFilters = await AuthorizationService.checkAndGetUsersInErrorAuthorizations(
      req.tenant, req.user, filteredRequest);
    // Get users
    const users = await UserStorage.getUsersInError(req.user.tenantID,
      {
        search: filteredRequest.Search,
        roles: (filteredRequest.Role ? filteredRequest.Role.split('|') : null),
        errorTypes: (filteredRequest.ErrorType ? filteredRequest.ErrorType.split('|') : Object.values(UserInErrorType)),
        ...authorizationUserInErrorFilters.filters
      },
      {
        limit: filteredRequest.Limit,
        onlyRecordCount: filteredRequest.OnlyRecordCount,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields)
      },
      authorizationUserInErrorFilters.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addUsersAuthorizations(req.tenant, req.user, users as UserDataResult, authorizationUserInErrorFilters);
    res.json(users);
    next();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public static async handleImportUsers(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!(await Authorizations.canImportUsers(req.user)).authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.IMPORT, entity: Entity.USERS,
        module: MODULE_NAME, method: 'handleImportUser'
      });
    }
    // Acquire the lock
    const importUsersLock = await LockingHelper.acquireImportUsersLock(req.tenant.id);
    if (!importUsersLock) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        action: action,
        errorCode: HTTPError.CANNOT_ACQUIRE_LOCK,
        module: MODULE_NAME, method: 'handleImportUsers',
        message: 'Error in importing the Users: cannot acquire the lock',
        user: req.user
      });
    }
    // Default values for User import
    const importedBy = req.user.id;
    const importedOn = new Date();
    const usersToBeImported: ImportedUser[] = [];
    const startTime = new Date().getTime();
    const result: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    try {
      // Delete all previously imported users
      await UserStorage.deleteImportedUsers(req.user.tenantID);
      // Get the stream
      const busboy = new Busboy({ headers: req.headers });
      req.pipe(busboy);
      // Handle closed socket
      let connectionClosed = false;
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      req.socket.on('close', async () => {
        if (!connectionClosed) {
          connectionClosed = true;
          // Release the lock
          await LockingManager.release(importUsersLock);
        }
      });
      await new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        busboy.on('file', async (fieldname, file, filename, encoding, mimetype) => {
          if (filename.slice(-4) === '.csv') {
            const converter = csvToJson({
              trim: true,
              delimiter: Constants.CSV_SEPARATOR,
              output: 'json',
            });
            void converter.subscribe(async (user: ImportedUser) => {
              // Check connection
              if (connectionClosed) {
                throw new Error('HTTP connection has been closed');
              }
              // Check the format of the first entry
              if (!result.inSuccess && !result.inError) {
                // Check header
                const userKeys = Object.keys(user);
                if (!UserRequiredImportProperties.every((property) => userKeys.includes(property))) {
                  if (!res.headersSent) {
                    res.writeHead(HTTPError.INVALID_FILE_CSV_HEADER_FORMAT);
                    res.end();
                    resolve();
                  }
                  throw new Error(`Missing one of required properties: '${UserRequiredImportProperties.join(', ')}'`);
                }
              }
              // Set default value
              user.importedBy = importedBy;
              user.importedOn = importedOn;
              user.importedData = {
                'autoActivateUserAtImport' : UtilsSecurity.filterBoolean(req.headers.autoactivateuseratimport),
                'autoActivateTagAtImport' :  UtilsSecurity.filterBoolean(req.headers.autoactivatetagatimport)
              };
              // Import
              const importSuccess = await UserService.processUser(action, req, user, usersToBeImported);
              if (!importSuccess) {
                result.inError++;
              }
              // Insert batched
              if (!Utils.isEmptyArray(usersToBeImported) && (usersToBeImported.length % Constants.IMPORT_BATCH_INSERT_SIZE) === 0) {
                await UserService.insertUsers(req.user.tenantID, req.user, action, usersToBeImported, result);
              }
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
            }, async (error: CSVError) => {
              // Release the lock
              await LockingManager.release(importUsersLock);
              // Log
              await Logging.logError({
                tenantID: req.user.tenantID,
                module: MODULE_NAME, method: 'handleImportUsers',
                action: action,
                user: req.user.id,
                message: `Exception while parsing the CSV '${filename}': ${error.message}`,
                detailedMessages: { error: error.stack }
              });
              if (!res.headersSent) {
                res.writeHead(HTTPError.INVALID_FILE_FORMAT);
                res.end();
                resolve();
              }
              // Completed
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
            }, async () => {
              // Consider the connection closed
              connectionClosed = true;
              // Insert batched
              if (usersToBeImported.length > 0) {
                await UserService.insertUsers(req.user.tenantID, req.user, action, usersToBeImported, result);
              }
              // Release the lock
              await LockingManager.release(importUsersLock);
              // Log
              const executionDurationSecs = Utils.truncTo((new Date().getTime() - startTime) / 1000, 2);
              await Logging.logActionsResponse(
                req.user.tenantID, action,
                MODULE_NAME, 'handleImportUsers', result,
                `{{inSuccess}} User(s) were successfully uploaded in ${executionDurationSecs}s and ready for asynchronous import`,
                `{{inError}} User(s) failed to be uploaded in ${executionDurationSecs}s`,
                `{{inSuccess}}  User(s) were successfully uploaded in ${executionDurationSecs}s and ready for asynchronous import and {{inError}} failed to be uploaded`,
                `No User have been uploaded in ${executionDurationSecs}s`, req.user
              );
              // Create and Save async task
              await AsyncTaskManager.createAndSaveAsyncTasks({
                name: AsyncTasks.USERS_IMPORT,
                action: ServerAction.USERS_IMPORT,
                type: AsyncTaskType.TASK,
                tenantID: req.tenant.id,
                module: MODULE_NAME,
                method: 'handleImportUsers',
              });
              // Respond
              res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
              next();
              resolve();
            });
            // Start processing the file
            void file.pipe(converter);
          } else if (mimetype === 'application/json') {
            const parser = JSONStream.parse('users.*');
            // TODO: Handle the end of the process to send the data like the CSV
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            parser.on('data', async (user: ImportedUser) => {
              // Set default value
              user.importedBy = importedBy;
              user.importedOn = importedOn;
              // Import
              const importSuccess = await UserService.processUser(action, req, user, usersToBeImported);
              if (!importSuccess) {
                result.inError++;
              }
              // Insert batched
              if ((usersToBeImported.length % Constants.IMPORT_BATCH_INSERT_SIZE) === 0) {
                await UserService.insertUsers(req.user.tenantID, req.user, action, usersToBeImported, result);
              }
            });
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            parser.on('error', async (error) => {
              // Release the lock
              await LockingManager.release(importUsersLock);
              // Log
              await Logging.logError({
                tenantID: req.user.tenantID,
                module: MODULE_NAME, method: 'handleImportUsers',
                action: action,
                user: req.user.id,
                message: `Invalid Json file '${filename}'`,
                detailedMessages: { error: error.stack }
              });
              if (!res.headersSent) {
                res.writeHead(HTTPError.INVALID_FILE_FORMAT);
                res.end();
                resolve();
              }
            });
            file.pipe(parser);
          } else {
            // Release the lock
            await LockingManager.release(importUsersLock);
            // Log
            await Logging.logError({
              tenantID: req.user.tenantID,
              module: MODULE_NAME, method: 'handleImportUsers',
              action: action,
              user: req.user.id,
              message: `Invalid file format '${mimetype}'`
            });
            if (!res.headersSent) {
              res.writeHead(HTTPError.INVALID_FILE_FORMAT);
              res.end();
            }
          }
        });
      });
    } catch (error) {
      // Release the lock
      await LockingManager.release(importUsersLock);
      throw error;
    }
  }

  public static async handleCreateUser(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = UserValidator.getInstance().validateUserCreate(req.body);
    // Check Mandatory fields
    UtilsService.checkIfUserValid(filteredRequest, null, req);
    // Get dynamic auth
    const authorizationFilter = await AuthorizationService.checkAndGetUserAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest);
    if (!authorizationFilter.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.READ, entity: Entity.SITE,
        module: MODULE_NAME, method: 'handleCreateSite'
      });
    }
    // Get the email
    const foundUser = await UserStorage.getUserByEmail(req.user.tenantID, filteredRequest.email);
    if (foundUser) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
        message: `Email '${filteredRequest.email}' already exists`,
        module: MODULE_NAME, method: 'handleCreateUser',
        user: req.user,
        action: action
      });
    }
    // Create
    const newUser: User = {
      ...filteredRequest,
      name: filteredRequest.name.toUpperCase(),
      email: filteredRequest.email.toLowerCase(),
      createdBy: { id: req.user.id },
      createdOn: new Date(),
      issuer: true,
    } as User;
    // Create the User
    newUser.id = await UserStorage.saveUser(req.user.tenantID, newUser, true);
    // Save password
    if (newUser.password) {
      const newPasswordHashed = await Utils.hashPasswordBcrypt(newUser.password);
      await UserStorage.saveUserPassword(req.user.tenantID, newUser.id,
        {
          password: newPasswordHashed,
          passwordWrongNbrTrials: 0,
          passwordResetHash: null,
          passwordBlockedUntil: null
        });
    }
    // Only Admin can save these data
    if (Authorizations.isAdmin(req.user) || Authorizations.isSuperAdmin(req.user)) {
      // Save User Status
      if (newUser.status) {
        await UserStorage.saveUserStatus(req.user.tenantID, newUser.id, newUser.status);
      }
      // Save User Role
      if (newUser.role) {
        await UserStorage.saveUserRole(req.user.tenantID, newUser.id, newUser.role);
      }
      // Save Admin Data
      if (newUser.plateID || Utils.objectHasProperty(newUser, 'notificationsActive')) {
        const adminData: { plateID?: string; notificationsActive?: boolean; notifications?: UserNotifications } = {};
        if (newUser.plateID) {
          adminData.plateID = newUser.plateID;
        }
        if (Utils.objectHasProperty(newUser, 'notificationsActive')) {
          adminData.notificationsActive = newUser.notificationsActive;
          if (newUser.notifications) {
            adminData.notifications = newUser.notifications;
          }
        }
        // Save User Admin data
        await UserStorage.saveUserAdminData(req.user.tenantID, newUser.id, adminData);
      }
    }
    // Assign user to all sites with auto-assign flag set
    const sites = await SiteStorage.getSites(req.tenant,
      { withAutoUserAssignment: true },
      Constants.DB_PARAMS_MAX_LIMIT
    );
    if (!Utils.isEmptyArray(sites.result)) {
      const siteIDs = sites.result.map((site) => site.id);
      await UserStorage.addSitesToUser(req.user.tenantID, newUser.id, siteIDs);
    }
    // Update Billing
    await UserService.updateUserBilling(ServerAction.USER_CREATE, req.tenant, req.user, newUser);
    // Log
    await Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: req.user,
      module: MODULE_NAME, method: 'handleCreateUser',
      message: `User with ID '${newUser.id}' has been created successfully`,
      action: action
    });
    res.json(Object.assign({ id: newUser.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  private static async insertUsers(tenantID: string, user: UserToken, action: ServerAction, usersToBeImported: ImportedUser[], result: ActionsResponse): Promise<void> {
    try {
      const nbrInsertedUsers = await UserStorage.saveImportedUsers(tenantID, usersToBeImported);
      result.inSuccess += nbrInsertedUsers;
    } catch (error) {
      // Handle dup keys
      result.inSuccess += error.result.nInserted;
      result.inError += error.writeErrors.length;
      await Logging.logError({
        tenantID: tenantID,
        module: MODULE_NAME, method: 'insertUsers',
        action: action,
        user: user.id,
        message: `Cannot import ${error.writeErrors.length as number} users!`,
        detailedMessages: { error: error.stack, tagsError: error.writeErrors }
      });
    }
    usersToBeImported.length = 0;
  }

  private static convertToCSV(req: Request, users: User[], writeHeader = true): string {
    let headers = null;
    // Header
    if (writeHeader) {
      headers = [
        'id',
        'name',
        'firstName',
        'locale',
        'role',
        'status',
        'email',
        'eulaAcceptedOn',
        'createdOn',
        'changedOn',
        'changedBy',
      ].join(Constants.CSV_SEPARATOR);
    }
    // Content
    const rows = users.map((user) => {
      const row = [
        user.id,
        user.name,
        user.firstName,
        user.locale,
        user.role,
        user.status,
        user.email,
        moment(user.eulaAcceptedOn).format('YYYY-MM-DD'),
        moment(user.createdOn).format('YYYY-MM-DD'),
        moment(user.lastChangedOn).format('YYYY-MM-DD'),
        (user.lastChangedBy ? Utils.buildUserFullName(user.lastChangedBy as User, false) : '')
      ].map((value) => Utils.escapeCsvValue(value));
      return row;
    }).join(Constants.CR_LF);
    return Utils.isNullOrUndefined(headers) ? Constants.CR_LF + rows : [headers, rows].join(Constants.CR_LF);
  }

  private static async getUsers(req: Request): Promise<DataResult<User>> {
    // Filter
    const filteredRequest = UserValidator.getInstance().validateUsersGet(req.query);
    // Get authorization filters
    const authorizationUsersFilters = await AuthorizationService.checkAndGetUsersAuthorizations(
      req.tenant, req.user, filteredRequest);
    if (!authorizationUsersFilters.authorized) {
      return Constants.DB_EMPTY_DATA_RESULT;
    }
    // Get Tag IDs from Visual IDs
    if (filteredRequest.VisualTagID) {
      const tagIDs = await TagStorage.getTags(req.tenant.id, { visualIDs: filteredRequest.VisualTagID.split('|') }, Constants.DB_PARAMS_MAX_LIMIT, ['userID']);
      if (!Utils.isEmptyArray(tagIDs.result)) {
        const userIDs = _.uniq(tagIDs.result.map((tag) => tag.userID));
        filteredRequest.UserID = userIDs.join('|');
      }
    }
    // Get users
    const users = await UserStorage.getUsers(req.user.tenantID,
      {
        search: filteredRequest.Search,
        issuer: Utils.isBoolean(filteredRequest.Issuer) || filteredRequest.Issuer ? Utils.convertToBoolean(filteredRequest.Issuer) : null,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        userIDs: (filteredRequest.UserID ? filteredRequest.UserID.split('|') : null),
        roles: (filteredRequest.Role ? filteredRequest.Role.split('|') : null),
        statuses: (filteredRequest.Status ? filteredRequest.Status.split('|') : null),
        excludeSiteID: filteredRequest.ExcludeSiteID,
        ...authorizationUsersFilters.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationUsersFilters.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addUsersAuthorizations(req.tenant, req.user, users as UserDataResult, authorizationUsersFilters);
    // Return
    return users;
  }

  private static async processUser(action: ServerAction, req: Request, importedUser: ImportedUser, usersToBeImported: ImportedUser[]): Promise<boolean> {
    try {
      const newImportedUser: ImportedUser = {
        name: importedUser.name.toUpperCase(),
        firstName: importedUser.firstName,
        email: importedUser.email,
        importedData: importedUser.importedData,
        siteIDs: importedUser.siteIDs
      };
      // Validate User data
      UserValidator.getInstance().validateImportedUserCreation(newImportedUser);
      // Set properties
      newImportedUser.importedBy = importedUser.importedBy;
      newImportedUser.importedOn = importedUser.importedOn;
      newImportedUser.status = ImportStatus.READY;
      // Save it later on
      usersToBeImported.push(newImportedUser);
      return true;
    } catch (error) {
      await Logging.logError({
        tenantID: req.user.tenantID,
        module: MODULE_NAME, method: 'importUser',
        action: action,
        message: 'User cannot be imported',
        detailedMessages: { user: importedUser, error: error.stack }
      });
      return false;
    }
  }

  private static async checkBillingErrorCodes(action: ServerAction, tenant: Tenant,
      loggedUser: UserToken, user: User, errorCodes: StartTransactionErrorCode[]) {
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.BILLING)) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant);
        if (billingImpl) {
          errorCodes.push(
            ...await billingImpl.precheckStartTransactionPrerequisites(user));
        }
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          module: MODULE_NAME,
          method: 'checkBillingErrorCodes',
          action: action,
          message: `Start Transaction checks failed for ${user.id}`,
          detailedMessages: { error: error.stack }
        });
        // Billing module is ON but the settings are not set or inconsistent
        errorCodes.push(StartTransactionErrorCode.BILLING_INCONSISTENT_SETTINGS);
      }
    }
  }

  private static async checkAndDeleteUserBilling(tenant: Tenant, loggedUser: UserToken, user: User): Promise<void> {
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.BILLING)) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant);
        if (!billingImpl) {
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.USER_DELETE,
            errorCode: HTTPError.GENERAL_ERROR,
            message: 'Billing service is not configured',
            module: MODULE_NAME, method: 'checkAndDeleteUserBilling',
            user: loggedUser, actionOnUser: user
          });
        }
        if (user.billingData) {
          const userCanBeDeleted = await billingImpl.checkIfUserCanBeDeleted(user);
          if (!userCanBeDeleted) {
            throw new AppError({
              source: Constants.CENTRAL_SERVER,
              action: ServerAction.USER_DELETE,
              errorCode: HTTPError.BILLING_DELETE_ERROR,
              message: 'User cannot be deleted due to billing constraints',
              module: MODULE_NAME, method: 'checkAndDeleteUserBilling',
              user: loggedUser, actionOnUser: user
            });
          }
        }
        await billingImpl.deleteUser(user);
      } catch (error) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.USER_DELETE,
          errorCode: HTTPError.BILLING_DELETE_ERROR,
          message: 'Error occurred in billing system',
          module: MODULE_NAME, method: 'checkAndDeleteUserBilling',
          user: loggedUser, actionOnUser: user,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private static async checkAndDeleteUserOCPI(tenant: Tenant, loggedUser: UserToken, user: User): Promise<void> {
    // Synchronize badges with IOP (eMSP)
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.OCPI)) {
      try {
        const ocpiClient: EmspOCPIClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.EMSP) as EmspOCPIClient;
        if (ocpiClient) {
          // Get tags
          const tags = (await TagStorage.getTags(tenant.id,
            { userIDs: [user.id], withNbrTransactions: true }, Constants.DB_PARAMS_MAX_LIMIT)).result;
          for (const tag of tags) {
            await ocpiClient.pushToken({
              uid: tag.id,
              type: OCPIUtils.getOCPITokenTypeFromID(tag.id),
              auth_id: tag.userID,
              visual_number: tag.visualID,
              issuer: tenant.name,
              valid: false,
              whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
              last_updated: new Date()
            });
          }
        }
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          module: MODULE_NAME,
          method: 'checkAndDeleteUserOCPI',
          action: ServerAction.USER_DELETE,
          message: `Unable to disable tokens of user ${user.id} with IOP`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private static async checkAndDeleteCar(tenant: Tenant, loggedUser: UserToken, user: User) {
    // Delete cars
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.CAR)) {
      const cars = await CarStorage.getCars(tenant, { userIDs: [user.id] }, Constants.DB_PARAMS_MAX_LIMIT);
      if (!Utils.isEmptyArray(cars.result)) {
        for (const car of cars.result) {
          // Delete private Car
          if (car.type === CarType.PRIVATE) {
            // Delete Car
            await CarStorage.deleteCar(tenant, car.id);
          } else {
            // Clear User
            car.userID = null;
            car.default = false;
            await CarStorage.saveCar(tenant, car);
          }
        }
      }
    }
  }

  private static async updateUserBilling(action: ServerAction, tenant: Tenant, loggedUser: UserToken, user: User) {
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.BILLING)) {
      const billingImpl = await BillingFactory.getBillingImpl(tenant);
      if (billingImpl) {
        try {
          await billingImpl.synchronizeUser(user);
        } catch (error) {
          await Logging.logError({
            tenantID: tenant.id, action,
            module: MODULE_NAME, method: 'updateUserBilling',
            user: loggedUser, actionOnUser: user,
            message: 'User cannot be updated in billing system',
            detailedMessages: { error: error.stack }
          });
        }
      }
    }
  }
}
