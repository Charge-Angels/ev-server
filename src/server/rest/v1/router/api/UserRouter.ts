/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../../../RouterUtils';
import UserService from '../../service/UserService';

export default class UserRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteUsers();
    this.buildRouteUser();
    this.buildRouteCreateUser();
    this.buildRouteUpdateUser();
    this.buildRouteDeleteUser();
    this.buildRouteUserDefaultCarTag();
    this.buildRouteUserGetSites();
    this.buildRouteUserSiteAssign();
    this.buildRouteUserSiteUnassign();
    this.buildRouteUserUpdateMobileToken();
    this.buildRouteUserGetImage();
    this.buildRouteUsersInError();
    this.buildRouteUserImport();
    this.buildRouteUserExport();
    return this.router;
  }

  protected buildRouteUsers(): void {
    this.router.get(`/${ServerRoute.REST_USERS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(UserService.handleGetUsers.bind(this), ServerAction.USERS, req, res, next);
    });
  }

  protected buildRouteUser(): void {
    this.router.get(`/${ServerRoute.REST_USER}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(UserService.handleGetUser.bind(this), ServerAction.USER, req, res, next);
    });
  }

  protected buildRouteCreateUser(): void {
    this.router.post(`/${ServerRoute.REST_USERS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(UserService.handleCreateUser.bind(this), ServerAction.USER_CREATE, req, res, next);
    });
  }

  protected buildRouteUpdateUser(): void {
    this.router.put(`/${ServerRoute.REST_USER}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(UserService.handleUpdateUser.bind(this), ServerAction.USER_UPDATE, req, res, next);
    });
  }

  protected buildRouteDeleteUser(): void {
    this.router.delete(`/${ServerRoute.REST_USER}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(UserService.handleDeleteUser.bind(this), ServerAction.USER_DELETE, req, res, next);
    });
  }

  protected buildRouteUserDefaultCarTag(): void {
    this.router.get(`/${ServerRoute.REST_USER_DEFAULT_TAG_CAR}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.UserID = req.params.id;
      await RouterUtils.handleServerAction(UserService.handleGetUserDefaultTagCar.bind(this), ServerAction.USER_DEFAULT_TAG_CAR, req, res, next);
    });
  }

  protected buildRouteUserGetSites(): void {
    this.router.get(`/${ServerRoute.REST_USER_SITES}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.UserID = req.params.id;
      await RouterUtils.handleServerAction(UserService.handleGetSites.bind(this), ServerAction.USER_SITES, req, res, next);
    });
  }

  protected buildRouteUserSiteAssign(): void {
    this.router.post(`/${ServerRoute.REST_USER_SITES}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.userID = req.params.id;
      await RouterUtils.handleServerAction(UserService.handleAssignSitesToUser.bind(this), ServerAction.ADD_SITES_TO_USER, req, res, next);
    });
  }

  protected buildRouteUserSiteUnassign(): void {
    this.router.put(`/${ServerRoute.REST_USER_SITES}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.userID = req.params.id;
      await RouterUtils.handleServerAction(UserService.handleAssignSitesToUser.bind(this), ServerAction.REMOVE_SITES_FROM_USER, req, res, next);
    });
  }

  protected buildRouteUserUpdateMobileToken(): void {
    this.router.put(`/${ServerRoute.REST_USER_UPDATE_MOBILE_TOKEN}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(UserService.handleUpdateUserMobileToken.bind(this), ServerAction.USER_UPDATE_MOBILE_TOKEN, req, res, next);
    });
  }

  protected buildRouteUserGetImage(): void {
    this.router.get(`/${ServerRoute.REST_USER_IMAGE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(UserService.handleGetUserImage.bind(this), ServerAction.USER_IMAGE, req, res, next);
    });
  }

  protected buildRouteUsersInError(): void {
    this.router.get(`/${ServerRoute.REST_USERS_IN_ERROR}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(UserService.handleGetUsersInError.bind(this), ServerAction.USERS_IN_ERROR, req, res, next);
    });
  }

  protected buildRouteUserImport(): void {
    this.router.post(`/${ServerRoute.REST_USERS_IMPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(UserService.handleImportUsers.bind(this), ServerAction.USERS_IMPORT, req, res, next);
    });
  }

  protected buildRouteUserExport(): void {
    this.router.get(`/${ServerRoute.REST_USERS_EXPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(UserService.handleExportUsers.bind(this), ServerAction.USERS_EXPORT, req, res, next);
    });
  }
}
