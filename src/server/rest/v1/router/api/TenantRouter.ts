/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../../../RouterUtils';
import TenantService from '../../service/TenantService';
import sanitize from 'mongo-sanitize';

export default class TenantRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteTenants();
    this.buildRouteTenant();
    return this.router;
  }

  protected buildRouteTenants(): void {
    this.router.get(`/${ServerRoute.REST_TENANTS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TenantService.handleGetTenants.bind(this), ServerAction.TENANTS, req, res, next);
    });
  }

  protected buildRouteTenant(): void {
    this.router.get(`/${ServerRoute.REST_TENANT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = sanitize(req.params.id);
      await RouterUtils.handleServerAction(TenantService.handleGetTenant.bind(this), ServerAction.TENANT, req, res, next);
    });
  }
}
