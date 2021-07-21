/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import AuthService from '../../service/AuthService';
import RouterUtils from '../../../RouterUtils';

export default class AuthRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteSignIn();
    this.buildRouteSignOn();
    this.buildRouteSignOut();
    this.buildRoutePasswordReset();
    this.buildRouteVerifyMail();
    this.buildRouteResendVerificationMail();
    this.buildRouteEndUserLicenseAgreement();
    this.buildRouteCheckEndUserLicenseAgreement();
    return this.router;
  }

  protected buildRouteSignIn(): void {
    this.router.post(`/${ServerRoute.REST_SIGNIN}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleLogIn.bind(this), ServerAction.LOGIN, req, res, next);
    });
  }

  protected buildRouteSignOn(): void {
    this.router.post(`/${ServerRoute.REST_SIGNON}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleRegisterUser.bind(this), ServerAction.REGISTER_USER, req, res, next);
    });
  }

  protected buildRouteSignOut(): void {
    this.router.get(`/${ServerRoute.REST_SIGNOUT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleUserLogOut.bind(this), ServerAction.LOGOUT, req, res, next);
    });
  }

  protected buildRoutePasswordReset(): void {
    this.router.post(`/${ServerRoute.REST_PASSWORD_RESET}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleUserPasswordReset.bind(this), ServerAction.PASSWORD_RESET, req, res, next);
    });
  }

  protected buildRouteResendVerificationMail(): void {
    this.router.post(`/${ServerRoute.REST_MAIL_RESEND}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleResendVerificationEmail.bind(this), ServerAction.RESEND_VERIFICATION_MAIL, req, res, next);
    });
  }

  protected buildRouteVerifyMail(): void {
    this.router.get(`/${ServerRoute.REST_MAIL_CHECK}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleVerifyEmail.bind(this), ServerAction.VERIFY_EMAIL, req, res, next);
    });
  }

  protected buildRouteEndUserLicenseAgreement(): void {
    this.router.get(`/${ServerRoute.REST_END_USER_LICENSE_AGREEMENT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleGetEndUserLicenseAgreement.bind(this), ServerAction.END_USER_LICENSE_AGREEMENT, req, res, next);
    });
  }

  protected buildRouteCheckEndUserLicenseAgreement(): void {
    this.router.get(`/${ServerRoute.REST_END_USER_LICENSE_AGREEMENT_CHECK}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AuthService.handleCheckEndUserLicenseAgreement.bind(this), ServerAction.CHECK_END_USER_LICENSE_AGREEMENT, req, res, next);
    });
  }
}
