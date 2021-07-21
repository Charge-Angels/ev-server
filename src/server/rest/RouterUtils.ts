import { NextFunction, Request, Response } from 'express';

import { ServerAction } from '../../types/Server';

export default class RouterUtils {
  public static async handleServerAction(
      handleMethod: (serverAction: ServerAction, req: Request, res: Response, next: NextFunction) => Promise<void>,
      serverAction: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await handleMethod(serverAction, req, res, next);
      next();
    } catch (error) {
      next(error);
    }
  }
}
