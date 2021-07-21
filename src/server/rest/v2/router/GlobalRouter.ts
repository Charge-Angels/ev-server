import express, { NextFunction, Request, Response } from 'express';

import AuthService from '../../v1/service/AuthService';
import ChargingStationRouter from './api/ChargingStationRouter';
import { StatusCodes } from 'http-status-codes';
import SwaggerRouter from './doc/SwaggerRouter';
import UserRouter from './api/UserRouter';

export default class GlobalRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteAPI();
    this.buildRouteDocs();
    this.buildUnknownRoute();
    return this.router;
  }

  protected buildRouteAPI(): void {
    this.router.use('/api',
      AuthService.authenticate(),
      AuthService.checkSessionHash.bind(this),
      [
        new ChargingStationRouter().buildRoutes(),
        new UserRouter().buildRoutes(),
      ]);
  }

  protected buildRouteDocs(): void {
    this.router.use('/docs', new SwaggerRouter().buildRoutes());
  }

  protected buildUnknownRoute(): void {
    this.router.use('*', (req: Request, res: Response, next: NextFunction) => {
      if (!res.headersSent) {
        res.sendStatus(StatusCodes.NOT_FOUND);
        next();
      }
    });
  }
}
