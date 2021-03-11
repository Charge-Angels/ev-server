/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../RouterUtils';
import TagService from '../../service/TagService';

export default class TagRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteTags();
    this.buildRouteTag();
    return this.router;
  }

  protected buildRouteTags(): void {
    this.router.get(`/${ServerRoute.REST_TAGS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleGetTags.bind(this), ServerAction.TAGS, req, res, next);
    });
  }

  protected buildRouteTag(): void {
    this.router.get(`/${ServerRoute.REST_TAG}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TagService.handleGetTag.bind(this), ServerAction.TAG, req, res, next);
    });
  }
}