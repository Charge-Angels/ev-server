/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../RouterUtils';
import UserService from '../../service/UserService';

export default class UserRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteUsers();
    this.buildRouteUser();
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
}
