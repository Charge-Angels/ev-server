import axios from 'axios';
import { Handler, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import passport from 'passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import Authorizations from '../../../authorization/Authorizations';
import AppError from '../../../exception/AppError';
import BillingFactory from '../../../integration/billing/BillingFactory';
import NotificationHandler from '../../../notification/NotificationHandler';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import { Action } from '../../../types/Authorization';
import { HTTPError } from '../../../types/HTTPError';
import { HttpLoginRequest, HttpResetPasswordRequest } from '../../../types/requests/HttpUserRequest';
import Tag from '../../../types/Tag';
import User, { UserRole, UserStatus } from '../../../types/User';
import UserToken from '../../../types/UserToken';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import AuthSecurity from './security/AuthSecurity';

const _centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
let jwtOptions;

// Init JWT auth options
if (_centralSystemRestConfig) {
  // Set
  jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: _centralSystemRestConfig.userTokenKey
    // pragma issuer: 'evse-dashboard',
    // audience: 'evse-dashboard'
  };
  // Use
  passport.use(new Strategy(jwtOptions, (jwtPayload, done) =>
    // Return the token decoded right away
    done(null, jwtPayload)
  ));
}

export default class AuthService {

  public static initialize(): Handler {
    return passport.initialize();
  }

  public static authenticate() {
    return passport.authenticate('jwt', { session: false });
  }

  public static async handleLogIn(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = AuthSecurity.filterLoginRequest(req.body);
    // Get Tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with Email '${filteredRequest.email}' tried to log in with an unknown tenant '${filteredRequest.tenant}'!`,
        module: 'AuthService',
        method: 'handleLogIn',
        action: action
      });
    }
    req.user = { tenantID };
    // Check
    if (!filteredRequest.email) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Email is mandatory',
        module: 'AuthService',
        method: 'handleLogIn'
      });
    }
    if (!filteredRequest.password) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Password is mandatory',
        module: 'AuthService',
        method: 'handleLogIn'
      });
    }
    if (!filteredRequest.acceptEula) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_EULA_ERROR,
        message: 'The End-user License Agreement is mandatory',
        module: 'AuthService',
        method: 'handleLogIn'
      });
    }
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.email);
    if (!user) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with Email '${filteredRequest.email}' does not exist for tenant '${(filteredRequest.tenant ? filteredRequest.tenant : tenantID)}'`,
        module: 'AuthService',
        method: 'handleLogIn'
      });
    }
    if (user.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with Email '${filteredRequest.email}' is logically deleted`,
        module: 'AuthService',
        method: 'handleLogIn'
      });
    }
    // Check if the number of trials is reached
    if (user.passwordWrongNbrTrials >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
      // Check if the user is still locked
      if (user.status === UserStatus.LOCKED) {
        // Yes: Check date to reset pass
        if (user.passwordBlockedUntil && moment(user.passwordBlockedUntil).isBefore(moment())) {
          // Time elapsed: activate the account again
          Logging.logSecurityInfo({
            tenantID: req.user.tenantID,
            actionOnUser: user,
            module: 'AuthService', method: 'handleLogIn', action: action,
            message: 'User has been unlocked after a period of time can try to login again'
          });
          // Save User Status
          await UserStorage.saveUserStatus(req.user.tenantID, user.id, UserStatus.ACTIVE);
          // Init User Password
          await UserStorage.saveUserPassword(req.user.tenantID, user.id,
            { passwordWrongNbrTrials: 0, passwordBlockedUntil: null, passwordResetHash: null });
          // Read user again
          const updatedUser = await UserStorage.getUser(tenantID, user.id);
          // Check user
          await AuthService.checkUserLogin(action, tenantID, updatedUser, filteredRequest, req, res, next);
        } else {
          // Return data
          throw new AppError({
            source: Constants.CENTRAL_SERVER,
            errorCode: HTTPError.USER_LOCKED_ERROR,
            message: 'User is locked',
            module: 'AuthService',
            method: 'handleLogIn'
          });
        }
      } else {
        // An admin has reactivated the account
        user.passwordWrongNbrTrials = 0;
        user.passwordBlockedUntil = null;
        // Check user
        await AuthService.checkUserLogin(action, tenantID, user, filteredRequest, req, res, next);
      }
    } else {
      // Nbr trials OK: Check user
      await AuthService.checkUserLogin(action, tenantID, user, filteredRequest, req, res, next);
    }
  }

  public static async handleRegisterUser(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = AuthSecurity.filterRegisterUserRequest(req.body);
    // Get the Tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User is trying to register with an unknown tenant '${filteredRequest.tenant}'!`,
        module: 'AuthService',
        method: 'handleGetEndUserLicenseAgreement'
      });
    }
    req.user = { tenantID };
    // Check EULA
    if (!filteredRequest.acceptEula) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_EULA_ERROR,
        message: 'The End-user License Agreement is mandatory',
        module: 'AuthService',
        method: 'handleLogIn'
      });
    }
    // Check
    if (!filteredRequest.captcha) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The captcha is mandatory',
        module: 'AuthService',
        method: 'handleRegisterUser'
      });
    }
    // Check Captcha
    const response = await axios.get(
      `https://www.google.com/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`);
    if (!response.data.success) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The captcha is invalid',
        module: 'AuthService',
        method: 'handleRegisterUser'
      });
    } else if (response.data.score < 0.5) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The captcha score is too low',
        module: 'AuthService',
        method: 'handleRegisterUser'
      });
    }
    // Check Mandatory field
    Utils.checkIfUserValid(filteredRequest as User, null, req);
    // Check email
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.email);
    if (user) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
        message: 'Email already exists',
        module: 'AuthService',
        method: 'handleRegisterUser'
      });
    }
    // Generate a password
    const newPasswordHashed = await Utils.hashPasswordBcrypt(filteredRequest.password);
    // Create the user
    const newUser = UserStorage.getEmptyUser() as User;
    newUser.email = filteredRequest.email;
    newUser.name = filteredRequest.name;
    newUser.firstName = filteredRequest.firstName;
    newUser.locale = req.locale.substring(0, 5);
    newUser.createdOn = new Date();
    const verificationToken = Utils.generateToken(req.body.email);
    const endUserLicenseAgreement = await UserStorage.getEndUserLicenseAgreement(tenantID, newUser.locale.substring(0, 2));
    // Save User
    newUser.id = await UserStorage.saveUser(tenantID, newUser);
    // Save User Status
    if (tenantID === Constants.DEFAULT_TENANT) {
      await UserStorage.saveUserRole(tenantID, newUser.id, UserRole.SUPER_ADMIN);
    } else {
      await UserStorage.saveUserRole(tenantID, newUser.id, UserRole.BASIC);
    }
    // Save User Status
    await UserStorage.saveUserStatus(tenantID, newUser.id, UserStatus.PENDING);

    const tag: Tag = {
      id: newUser.name[0] + newUser.firstName[0] + Utils.getRandomInt(),
      active: true,
      issuer: true,
      lastChangedOn: new Date()
    };
    await UserStorage.saveUserTag(req.user.tenantID, newUser.id, tag);

    // Save User password
    await UserStorage.saveUserPassword(tenantID, newUser.id,
      {
        password: newPasswordHashed,
        passwordWrongNbrTrials: 0,
        passwordResetHash: null,
        passwordBlockedUntil: null
      });
    // Save User Account Verification
    await UserStorage.saveUserAccountVerification(tenantID, newUser.id, { verificationToken });
    // Save User EULA
    await UserStorage.saveUserEULA(tenantID, newUser.id,
      {
        eulaAcceptedOn: new Date(),
        eulaAcceptedVersion: endUserLicenseAgreement.version,
        eulaAcceptedHash: endUserLicenseAgreement.hash
      });
    // Assign user to all sites with auto-assign flag set
    const sites = await SiteStorage.getSites(tenantID,
      { withAutoUserAssignment: true },
      Constants.DB_PARAMS_MAX_LIMIT
    );
    if (sites.count > 0) {
      const siteIDs = sites.result.map((site) => site.id);
      if (siteIDs && siteIDs.length > 0) {
        await UserStorage.addSitesToUser(tenantID, newUser.id, siteIDs);
      }
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: newUser, action: action,
      module: 'AuthService',
      method: 'handleRegisterUser',
      message: `User with Email '${req.body.email}' has been created successfully`,
      detailedMessages: { params: req.body }
    });

    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Send notification
      const evseDashboardVerifyEmailURL = Utils.buildEvseURL(filteredRequest.tenant) +
        '/#/verify-email?VerificationToken=' + verificationToken + '&Email=' + newUser.email;
      // Notify (Async)
      NotificationHandler.sendNewRegisteredUser(
        tenantID,
        Utils.generateGUID(),
        newUser,
        {
          'tenant': filteredRequest.name,
          'user': newUser,
          'evseDashboardURL': Utils.buildEvseURL(filteredRequest.tenant),
          'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
        }
      );
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async checkAndSendResetPasswordConfirmationEmail(tenantID: string, filteredRequest: Partial<HttpResetPasswordRequest>, action: Action, req: Request, res: Response, next: NextFunction) {
    // No hash: Send email with init pass hash link
    if (!filteredRequest.captcha) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The captcha is mandatory',
        module: 'AuthService',
        method: 'handleUserPasswordReset'
      });
    }
    // Check captcha
    const response = await axios.get(
      `https://www.google.com/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`);
    // Check
    if (!response.data.success) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The reCaptcha is invalid',
        module: 'AuthService',
        method: 'handleRegisterUser'
      });
    } else if (response.data.score < 0.5) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The reCaptcha score is too low, got ${response.data.score} and expected to be >= 0.5`,
        module: 'AuthService',
        method: 'handleRegisterUser'
      });
    }
    // Generate a new password
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.email);
    // Found?
    if (!user) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with Email '${filteredRequest.email}' does not exist`,
        module: 'AuthService',
        method: 'handleUserPasswordReset'
      });
    }
    // Deleted
    if (user.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with Email '${filteredRequest.email}' is logically deleted`,
        module: 'AuthService',
        method: 'handleUserPasswordReset'
      });
    }
    const resetHash = Utils.generateGUID();
    // Init Password info
    await UserStorage.saveUserPassword(tenantID, user.id, { passwordResetHash: resetHash });
    // Log
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: user, action: action,
      module: 'AuthService',
      method: 'handleUserPasswordReset',
      message: `User with Email '${req.body.email}' will receive an email to reset his password`
    });
    // Send notification
    const evseDashboardResetPassURL = Utils.buildEvseURL(filteredRequest.tenant) +
      '/#/define-password?hash=' + resetHash;
    // Send Request Password (Async)
    NotificationHandler.sendRequestPassword(
      tenantID,
      Utils.generateGUID(),
      user,
      {
        'user': user,
        'evseDashboardURL': Utils.buildEvseURL(filteredRequest.tenant),
        'evseDashboardResetPassURL': evseDashboardResetPassURL
      }
    );
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async resetUserPassword(tenantID: string, filteredRequest, action: Action, req: Request, res: Response, next: NextFunction) {
    // Get the user
    const user = await UserStorage.getUserByPasswordResetHash(tenantID, filteredRequest.hash);
    // Found?
    if (!user) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with password reset hash '${filteredRequest.hash}' does not exist`,
        module: 'AuthService',
        method: 'handleUserPasswordReset'
      });
    }
    // Deleted
    if (user.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User with password reset hash '${filteredRequest.hash}' is logically deleted`,
        module: 'AuthService',
        method: 'handleUserPasswordReset'
      });
    }
    // Hash it
    const newHashedPassword = await Utils.hashPasswordBcrypt(filteredRequest.password);
    // Save new password
    await UserStorage.saveUserPassword(tenantID, user.id,
      {
        password: newHashedPassword,
        passwordWrongNbrTrials: 0,
        passwordResetHash: null,
        passwordBlockedUntil: null
      });
    // Log
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: user, action: action,
      module: 'AuthService',
      method: 'handleUserPasswordReset',
      message: 'User\'s password has been reset successfully',
      detailedMessages: { params: req.body }
    });

    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUserPasswordReset(action: Action, req: Request, res: Response, next: NextFunction) {
    const filteredRequest = AuthSecurity.filterResetPasswordRequest(req.body);
    // Get Tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User is trying to access resource with an unknown tenant '${filteredRequest.tenant}'!`,
        module: 'AuthService',
        method: 'handleUserPasswordReset',
        action: action
      });
    }
    // Check hash
    if (!filteredRequest.hash) {
      // Send Confirmation Email for requesting a new password
      await AuthService.checkAndSendResetPasswordConfirmationEmail(tenantID, filteredRequest, action, req, res, next);
    } else {
      // Send the new password
      await AuthService.resetUserPassword(tenantID, filteredRequest, action, req, res, next);
    }
  }

  public static async handleCheckEndUserLicenseAgreement(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = AuthSecurity.filterCheckEulaRequest(req.query);
    // Check
    if (!filteredRequest.Tenant) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Tenant is mandatory',
        module: 'AuthService',
        method: 'handleCheckEndUserLicenseAgreement'
      });
    }
    // Get Tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.Tenant);
    if (!tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Tenant is mandatory',
        module: 'AuthService',
        method: 'handleCheckEndUserLicenseAgreement'
      });
    }
    // Check hash
    if (!filteredRequest.Email) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Email is mandatory',
        module: 'AuthService',
        method: 'handleCheckEndUserLicenseAgreement'
      });
    }
    // Get User
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.Email);
    if (!user) {
      // Do not return error, only reject it
      res.json({ eulaAccepted: false });
      next();
      return;
    }
    // Get last Eula version
    const endUserLicenseAgreement = await UserStorage.getEndUserLicenseAgreement(tenantID, user.locale.substring(0, 2));
    if (user.eulaAcceptedHash === endUserLicenseAgreement.hash) {
      // Check if version matches
      res.json({ eulaAccepted: true });
      next();
      return;
    }
    // Check if version matches
    res.json({ eulaAccepted: false });
    next();
  }

  public static async handleGetEndUserLicenseAgreement(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = AuthSecurity.filterEndUserLicenseAgreementRequest(req);
    // Get Tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);

    if (!tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User is trying to access resource with an unknown tenant '${filteredRequest.tenant}'!`,
        module: 'AuthService', method: 'handleGetEndUserLicenseAgreement',
        action: action
      });
    }
    // Get it
    const endUserLicenseAgreement = await UserStorage.getEndUserLicenseAgreement(tenantID, filteredRequest.Language);
    res.json(
      // Filter
      AuthSecurity.filterEndUserLicenseAgreementResponse(
        endUserLicenseAgreement)
    );
    next();
  }

  public static async handleVerifyEmail(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = AuthSecurity.filterVerifyEmailRequest(req.query);
    // Get Tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.Tenant);
    if (!tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        action: action,
        module: 'AuthService', method: 'handleVerifyEmail',
        message: `User is trying to access resource with an unknown tenant '${filteredRequest.Tenant}'!`
      });
    }
    // Check that this is not the super tenant
    if (tenantID === Constants.DEFAULT_TENANT) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        action: action,
        module: 'AuthService', method: 'handleVerifyEmail',
        message: 'Cannot verify email in the Super Tenant'
      });
    }
    // Check email
    if (!filteredRequest.Email) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        action: action,
        module: 'AuthService', method: 'handleVerifyEmail',
        message: 'The email is mandatory'
      });
    }
    // Check verificationToken
    if (!filteredRequest.VerificationToken) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        action: action,
        module: 'AuthService', method: 'handleVerifyEmail',
        message: 'Verification token is mandatory'
      });
    }
    // Check email
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.Email);
    // User exists?
    if (!user) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        action: action,
        module: 'AuthService', method: 'handleVerifyEmail',
        message: `The user with email '${filteredRequest.Email}' does not exist`
      });
    }
    // User deleted?
    if (user.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        action: action,
        module: 'AuthService', method: 'handleVerifyEmail',
        message: 'The user is logically deleted'
      });
    }
    // Check if account is already active
    if (user.status === UserStatus.ACTIVE) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_ACCOUNT_ALREADY_ACTIVE_ERROR,
        action: action,
        user: user,
        module: 'AuthService', method: 'handleVerifyEmail',
        message: 'Account is already active'
      });
    }
    // Check verificationToken
    if (user.verificationToken !== filteredRequest.VerificationToken) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.INVALID_TOKEN_ERROR,
        action: action,
        user: user,
        module: 'AuthService', method: 'handleVerifyEmail',
        message: 'Wrong Verification Token'
      });
    }
    // Save User Status
    await UserStorage.saveUserStatus(tenantID, user.id, UserStatus.ACTIVE);
    // For integration with billing
    const billingImpl = await BillingFactory.getBillingImpl(tenantID);
    if (billingImpl) {
      try {
        const billingData = await billingImpl.createUser(user);
        await UserStorage.saveUserBillingData(tenantID, user.id, billingData);
        Logging.logInfo({
          tenantID: tenantID,
          module: 'AuthService', method: 'handleVerifyEmail',
          action: action,
          user: user,
          message: 'User has been created successfully in the billing system'
        });
      } catch (error) {
        Logging.logError({
          tenantID: tenantID,
          module: 'AuthService', method: 'handleVerifyEmail',
          action: action,
          user: user,
          message: 'User cannot be created in the billing system',
          detailedMessages: { error }
        });
      }
    }
    // Save User Verification Account
    await UserStorage.saveUserAccountVerification(tenantID, user.id,
      { verificationToken: null, verifiedAt: new Date() });
    // Log
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: user, action: action,
      module: 'AuthService', method: 'handleVerifyEmail',
      message: 'User account has been successfully verified and activated',
      detailedMessages: { params: req.query }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleResendVerificationEmail(action: Action, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = AuthSecurity.filterResendVerificationEmail(req.body);
    // Get the tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);

    if (!tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User is trying to access resource with an unknown tenant '${filteredRequest.tenant}'!`,
        module: 'AuthService',
        method: 'handleResendVerificationEmail',
        action: action
      });
    }
    // Check that this is not the super tenant
    if (tenantID === Constants.DEFAULT_TENANT) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cannot request a verification Email in the Super Tenant',
        module: 'AuthService',
        method: 'handleResendVerificationEmail',
        action: action
      });
    }
    // Check email
    if (!filteredRequest.email) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Email is mandatory',
        module: 'AuthService',
        method: 'handleResendVerificationEmail',
        action: action
      });
    }
    // Check captcha
    if (!filteredRequest.captcha) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The captcha is mandatory',
        module: 'AuthService',
        method: 'handleResendVerificationEmail',
        action: action
      });
    }

    // Is valid captcha?
    const response = await axios.get(
      `https://www.google.com/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`);
    if (!response.data.success) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The captcha is invalid',
        module: 'AuthService',
        method: 'handleResendVerificationEmail',
        action: action
      });
    } else if (response.data.score < 0.5) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The captcha is too low',
        module: 'AuthService',
        method: 'handleResendVerificationEmail',
        action: action
      });
    }
    // Is valid email?
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.email);
    // User exists?
    if (!user) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The user with Email '${filteredRequest.email}' does not exist`,
        module: 'AuthService',
        method: 'handleResendVerificationEmail',
        action: action
      });
    }
    // User deleted?
    if (user.deleted) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The user with Email '${filteredRequest.email}' is logically deleted`,
        module: 'AuthService',
        method: 'handleResendVerificationEmail',
        action: action
      });
    }
    // Check if account is already active
    if (user.status === UserStatus.ACTIVE) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_ACCOUNT_ALREADY_ACTIVE_ERROR,
        message: 'Account is already active',
        module: 'AuthService',
        method: 'handleResendVerificationEmail',
        action: action,
        user: user
      });
    }
    let verificationToken;
    // Check verificationToken
    if (!user.verificationToken) {
      // Verification token was not created after registration
      // This should not happen
      // Generate new verificationToken
      verificationToken = Utils.generateToken(filteredRequest.email);
      user.verificationToken = verificationToken;
      // Save User Verification Account
      await UserStorage.saveUserAccountVerification(tenantID, user.id, { verificationToken });
    } else {
      // Get existing verificationToken
      verificationToken = user.verificationToken;
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: user,
      action: action,
      module: 'AuthService',
      method: 'handleResendVerificationEmail',
      message: `User with Email '${filteredRequest.email}' has been created successfully`,
      detailedMessages: { params: req.body }
    });
    // Send notification
    const evseDashboardVerifyEmailURL = Utils.buildEvseURL(filteredRequest.tenant) +
      '/#/verify-email?VerificationToken=' + verificationToken + '&Email=' +
      user.email;
    // Send Verification Email (Async)
    NotificationHandler.sendVerificationEmail(
      tenantID,
      Utils.generateGUID(),
      user,
      {
        'user': user,
        'evseDashboardURL': Utils.buildEvseURL(filteredRequest.tenant),
        'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
      }
    );
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static handleUserLogOut(action: Action, req: Request, res: Response, next: NextFunction) {
    req.logout();
    res.status(200).send({});
  }

  public static async userLoginWrongPassword(action: Action, tenantID: string, user: User, req: Request, res: Response, next: NextFunction) {
    // Add wrong trial + 1
    if (isNaN(user.passwordWrongNbrTrials)) {
      user.passwordWrongNbrTrials = 0;
    }
    const passwordWrongNbrTrials = user.passwordWrongNbrTrials + 1;
    // Check if the number of trial is reached
    if (passwordWrongNbrTrials >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
      // Too many attempts, lock user
      // Save User Status
      await UserStorage.saveUserStatus(tenantID, user.id, UserStatus.LOCKED);
      // Save User Blocked Date
      await UserStorage.saveUserPassword(tenantID, user.id,
        {
          passwordWrongNbrTrials,
          passwordBlockedUntil: moment().add(_centralSystemRestConfig.passwordBlockedWaitTimeMin, 'm').toDate()
        });
      // Log
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_LOCKED_ERROR,
        message: 'User is locked',
        module: 'AuthService',
        method: 'checkUserLogin',
        action: action,
        user: user
      });
    } else {
      // Save User Nbr Password Trials
      await UserStorage.saveUserPassword(tenantID, user.id, { passwordWrongNbrTrials });
      // Log
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `User failed to log in, ${_centralSystemRestConfig.passwordWrongNumberOfTrial - user.passwordWrongNbrTrials} trial(s) remaining`,
        module: 'AuthService',
        method: 'checkUserLogin',
        action: action,
        user: user
      });
    }
  }

  public static async userLoginSucceeded(action: Action, tenantID: string, user: User, req: Request, res: Response, next: NextFunction) {
    // Password / Login OK
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: user,
      module: 'AuthService', method: 'checkUserLogin',
      action: action, message: 'User logged in successfully'
    });
    // Set Eula Info on Login Only
    if (action === 'Login') {
      // Save EULA
      const endUserLicenseAgreement = await UserStorage.getEndUserLicenseAgreement(tenantID, user.locale.substring(0, 2));
      await UserStorage.saveUserEULA(tenantID, user.id,
        {
          eulaAcceptedOn: new Date(),
          eulaAcceptedVersion: endUserLicenseAgreement.version,
          eulaAcceptedHash: endUserLicenseAgreement.hash
        }
      );
    }
    // Reset wrong number of trial
    await UserStorage.saveUserPassword(tenantID, user.id,
      { passwordWrongNbrTrials: 0, passwordBlockedUntil: null, passwordResetHash: null });
    // Yes: build payload
    const payload: UserToken = await Authorizations.buildUserToken(tenantID, user);
    // Build token
    let token;
    // Role Demo?
    if (Authorizations.isDemo(user)) {
      token = jwt.sign(payload, jwtOptions.secretOrKey, {
        expiresIn: _centralSystemRestConfig.userDemoTokenLifetimeDays * 24 * 3600
      });
    } else {
      token = jwt.sign(payload, jwtOptions.secretOrKey, {
        expiresIn: _centralSystemRestConfig.userTokenLifetimeHours * 3600
      });
    }
    // Return it
    res.json({ token: token });
  }

  public static async getTenantID(subdomain: string) {
    // Check
    if (!subdomain) {
      return Constants.DEFAULT_TENANT;
    }
    // Get it
    const tenant = await TenantStorage.getTenantBySubdomain(subdomain);
    // Return
    return (tenant ? tenant.id : null);
  }

  public static async checkUserLogin(action: Action, tenantID: string, user: User, filteredRequest: Partial<HttpLoginRequest>, req: Request, res: Response, next: NextFunction) {
    // User Found?
    if (!user) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `Unknown user tried to log in with email '${filteredRequest.email}'`,
        module: 'AuthService',
        method: 'checkUserLogin',
        user: user
      });
    }
    // Check password
    let match = false;
    if (user.password) {
      match = await Utils.checkPasswordBCrypt(filteredRequest.password, user.password);
    }
    // Check new and old version of hashing the password
    if (match || (user.password === Utils.hashPassword(filteredRequest.password))) {
      // Check if the account is pending
      if (user.status === UserStatus.PENDING) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.USER_ACCOUNT_PENDING_ERROR,
          message: 'Account is pending! User must activate his account in his email',
          module: 'AuthService',
          method: 'checkUserLogin',
          user: user
        });
      }
      // Check if the account is active
      if (user.status !== UserStatus.ACTIVE) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.USER_ACCOUNT_INACTIVE_ERROR,
          message: `Account is not active ('${user.status}')`,
          module: 'AuthService',
          method: 'checkUserLogin',
          user: user
        });
      }
      // Login OK
      await AuthService.userLoginSucceeded(action, tenantID, user, req, res, next);
    } else {
      // Login KO
      await AuthService.userLoginWrongPassword(action, tenantID, user, req, res, next);
    }
  }
}

