/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import ChargingStationService from '../../../v1/service/ChargingStationService';
import RouterUtils from '../../../RouterUtils';

export default class ChargingStationRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteChargingStations();
    return this.router;
  }

  protected buildRouteChargingStations(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      if (req.query.Status && req.query.Status === 'in-error') {
        await RouterUtils.handleServerAction(ChargingStationService.handleGetChargingStationsInError.bind(this), ServerAction.CHARGING_STATIONS_IN_ERROR, req, res, next);
      } else {
        await RouterUtils.handleServerAction(ChargingStationService.handleGetChargingStations.bind(this), ServerAction.CHARGING_STATIONS, req, res, next);
      }
    });
  }
}
