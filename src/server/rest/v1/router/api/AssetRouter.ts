/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import AssetService from '../../service/AssetService';
import RouterUtils from '../../../RouterUtils';

export default class AssetRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteCreateAssetConsumption();
    return this.router;
  }

  protected buildRouteCreateAssetConsumption(): void {
    this.router.post(`/${ServerRoute.REST_ASSET_CONSUMPTION}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(AssetService.handleCreateAssetConsumption.bind(this), ServerAction.ASSET_CONSUMPTION, req, res, next);
    });
  }
}
