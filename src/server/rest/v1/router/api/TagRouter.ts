/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import RouterUtils from '../../../RouterUtils';
import TagService from '../../service/TagService';

export default class TagRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteTags();
    this.buildRouteTag();
    this.buildRouteCreateTag();
    this.buildRouteDeleteTag();
    this.buildRouteDeleteTags();
    this.buildRouteUpdateTag();
    this.buildRouteImportTag();
    this.buildRouteExportTag();
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

  protected buildRouteCreateTag(): void {
    this.router.post(`/${ServerRoute.REST_TAGS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TagService.handleCreateTag.bind(this), ServerAction.TAG_CREATE, req, res, next);
    });
  }

  protected buildRouteDeleteTag(): void {
    this.router.delete(`/${ServerRoute.REST_TAG}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(TagService.handleDeleteTag.bind(this), ServerAction.TAG_DELETE, req, res, next);
    });
  }

  protected buildRouteDeleteTags(): void {
    this.router.delete(`/${ServerRoute.REST_TAGS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleDeleteTags.bind(this), ServerAction.TAGS_DELETE, req, res, next);
    });
  }

  protected buildRouteUpdateTag(): void {
    this.router.put(`/${ServerRoute.REST_TAG}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleUpdateTag.bind(this), ServerAction.TAG_UPDATE, req, res, next);
    });
  }

  protected buildRouteImportTag(): void {
    this.router.post(`/${ServerRoute.REST_TAGS_IMPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleImportTags.bind(this), ServerAction.TAGS_IMPORT, req, res, next);
    });
  }

  protected buildRouteExportTag(): void {
    this.router.get(`/${ServerRoute.REST_TAGS_EXPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(TagService.handleExportTags.bind(this), ServerAction.TAGS_EXPORT, req, res, next);
    });
  }
}
