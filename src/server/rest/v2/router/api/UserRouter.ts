/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../../../RouterUtils';
import UserService from '../../../v1/service/UserService';

export default class UserRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteUsers();
    return this.router;
  }

  protected buildRouteUsers(): void {
    this.router.get(`/${ServerRoute.REST_USERS}`, async (req: Request, res: Response, next: NextFunction) => {
      if (req.query.Status && req.query.Status === 'in-error') {
        await RouterUtils.handleServerAction(UserService.handleGetUsersInError.bind(this), ServerAction.USERS_IN_ERROR, req, res, next);
      } else {
        req.query.Status = req.query.UserStatus;
        await RouterUtils.handleServerAction(UserService.handleGetUsers.bind(this), ServerAction.USERS, req, res, next);
      }
    });
  }
}
