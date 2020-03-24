import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Database from '../../../utils/Database';
import Logging from '../../../utils/Logging';
import PricingSecurity from './security/PricingSecurity';
import PricingStorage from '../../../storage/mongodb/PricingStorage';

export default class PricingService {
  static async handleGetPricing(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check auth
      if (!Authorizations.canReadPricing(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: action,
          entity: Entity.PRICING,
          module: 'PricingService',
          method: 'handleGetPricing'
        });
      }
      // Get the Pricing
      const pricing = await PricingStorage.getPricing(req.user.tenantID);
      // Return
      if (pricing) {
        res.json(
          // Filter
          PricingSecurity.filterPricingResponse(
            pricing, req.user)
        );
      } else {
        res.json(null);
      }
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleUpdatePricing(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check auth
      if (!Authorizations.canUpdatePricing(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: action,
          entity: Entity.PRICING,
          module: 'PricingService',
          method: 'handleUpdatePricing'
        });
      }
      // Filter
      const filteredRequest = PricingSecurity.filterPricingUpdateRequest(req.body);
      // Check
      if (!filteredRequest.priceKWH || isNaN(filteredRequest.priceKWH)) {
        // Not Found!
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `The price ${filteredRequest.priceKWH} has not a correct format`,
          module: 'PricingService',
          method: 'handleUpdatePricing',
          user: req.user
        });
      }
      // Update
      const pricing: any = {};
      Database.updatePricing(filteredRequest, pricing);
      // Set timestamp
      pricing.timestamp = new Date();
      // Get
      await PricingStorage.savePricing(req.user.tenantID, pricing);
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, action: action,
        module: 'PricingService',
        method: 'handleUpdatePricing',
        message: `Pricing has been updated to '${req.body.priceKWH} ${req.body.priceUnit}'`,
        detailedMessages: { params: req.body }
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}
