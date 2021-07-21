import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import BillingService from '../../service/BillingService';
import RouterUtils from '../../../RouterUtils';

export default class BillingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    // -----------------------------------
    // ROUTES for BILLING SETTINGS
    // -----------------------------------
    this.buildRouteBillingSetting();
    this.buildRouteUpdateBillingSetting();
    this.buildRouteCheckBillingConnection();
    this.buildRouteClearTestData();
    // -----------------------------------
    // ROUTES for PAYMENT METHODS
    // -----------------------------------
    this.buildRouteBillingPaymentMethods();
    // this.buildRouteBillingPaymentMethod(); - // No use case so far
    // this.buildRouteBillingCreatePaymentMethod(); - // No use case so far
    // this.buildRouteBillingUpdatePaymentMethod(); - // No use case so far
    this.buildRouteBillingDeletePaymentMethod();
    this.buildRouteBillingPaymentMethodSetup();
    this.buildRouteBillingPaymentMethodAttach();
    this.buildRouteBillingPaymentMethodDetach();
    // -----------------------------------
    // ROUTES for INVOICES
    // -----------------------------------
    this.buildRouteBillingInvoices();
    this.buildRouteBillingInvoice();
    this.buildRouteBillingInvoiceDownload();
    return this.router;
  }

  protected buildRouteBillingSetting(): void {
    this.router.get(`/${ServerRoute.REST_BILLING_SETTING}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleServerAction(BillingService.handleGetBillingSetting.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  protected buildRouteUpdateBillingSetting(): void {
    this.router.put(`/${ServerRoute.REST_BILLING_SETTING}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleServerAction(BillingService.handleUpdateBillingSetting.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  protected buildRouteCheckBillingConnection(): void {
    this.router.post(`/${ServerRoute.REST_BILLING_CHECK}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleServerAction(BillingService.handleCheckBillingConnection.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  protected buildRouteClearTestData(): void {
    this.router.post(`/${ServerRoute.REST_BILLING_CLEAR_TEST_DATA}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleServerAction(BillingService.handleClearBillingTestData.bind(this), ServerAction.SETTINGS, req, res, next);
    });
  }

  protected buildRouteBillingPaymentMethods(): void {
    this.router.get(`/${ServerRoute.REST_BILLING_PAYMENT_METHODS}`, (req: Request, res: Response, next: NextFunction) => {
      // GET {{base_url}}/v1/api/billing/users/5be451dad0685c19bff48856/payment-methods?Limit=100&SortFields=id
      req.query.userID = req.params.userID;
      void RouterUtils.handleServerAction(BillingService.handleBillingGetPaymentMethods.bind(this), ServerAction.BILLING_PAYMENT_METHODS, req, res, next);
    });
  }

  protected buildRouteBillingDeletePaymentMethod(): void {
    // DELETE {{base_url}}/v1/api/billing/users/5be451dad0685c19bff48856/payment-methods?Limit=100&SortFields=id
    this.router.delete(`/${ServerRoute.REST_BILLING_PAYMENT_METHOD}`, (req: Request, res: Response, next: NextFunction) => {
      req.body.userID = req.params.userID;
      req.body.paymentMethodId = req.params.paymentMethodID;
      void RouterUtils.handleServerAction(BillingService.handleBillingDeletePaymentMethod.bind(this), ServerAction.BILLING_DELETE_PAYMENT_METHOD, req, res, next);
    });
  }

  protected buildRouteBillingPaymentMethodSetup(): void {
    this.router.post(`/${ServerRoute.REST_BILLING_PAYMENT_METHOD_SETUP}`, (req: Request, res: Response, next: NextFunction) => {
      // STRIPE prerequisite - ask for a setup intent first!
      req.body.userID = req.params.userID;
      void RouterUtils.handleServerAction(BillingService.handleBillingSetupPaymentMethod.bind(this), ServerAction.BILLING_SETUP_PAYMENT_METHOD, req, res, next);
    });
  }

  protected buildRouteBillingPaymentMethodAttach(): void {
    this.router.post(`/${ServerRoute.REST_BILLING_PAYMENT_METHOD_ATTACH}`, (req: Request, res: Response, next: NextFunction) => {
      // Creates a new payment method and attach it to the user as its default
      req.body.userID = req.params.userID;
      req.body.paymentMethodId = req.params.paymentMethodID;
      void RouterUtils.handleServerAction(BillingService.handleBillingSetupPaymentMethod.bind(this), ServerAction.BILLING_SETUP_PAYMENT_METHOD, req, res, next);
    });
  }

  protected buildRouteBillingPaymentMethodDetach(): void {
    this.router.post(`/${ServerRoute.REST_BILLING_PAYMENT_METHOD_DETACH}`, (req: Request, res: Response, next: NextFunction) => {
      // POST {{base_url}}/v1/api/users/5be451dad0685c19bff48856/payment-methods/pm_1Ib3MxF5e1VSb1v6eH3Zhn4K/detach
      // Detach a payment method from the user:
      req.body.userID = req.params.userID;
      req.body.paymentMethodId = req.params.paymentMethodID;
      void RouterUtils.handleServerAction(BillingService.handleBillingDeletePaymentMethod.bind(this), ServerAction.BILLING_DELETE_PAYMENT_METHOD, req, res, next);
    });
  }

  protected buildRouteBillingInvoices(): void {
    this.router.get(`/${ServerRoute.REST_BILLING_INVOICES}`, (req: Request, res: Response, next: NextFunction) => {
      void RouterUtils.handleServerAction(BillingService.handleGetInvoices.bind(this), ServerAction.BILLING_INVOICES, req, res, next);
    });
  }

  protected buildRouteBillingInvoice(): void {
    this.router.get(`/${ServerRoute.REST_BILLING_INVOICE}`, (req: Request, res: Response, next: NextFunction) => {
      // GET {{base_url}}/v1/api/invoices/606193168f22ac7f02223c8c
      req.query.ID = req.params.invoiceID;
      void RouterUtils.handleServerAction(BillingService.handleGetInvoice.bind(this), ServerAction.BILLING_INVOICE, req, res, next);
    });
  }

  protected buildRouteBillingInvoiceDownload(): void {
    this.router.get(`/${ServerRoute.REST_BILLING_DOWNLOAD_INVOICE}`, (req: Request, res: Response, next: NextFunction) => {
      // GET {{base_url}}/v1/api/invoices/606193168f22ac7f02223c8c/download
      req.query.ID = req.params.invoiceID;
      void RouterUtils.handleServerAction(BillingService.handleDownloadInvoice.bind(this), ServerAction.BILLING_DOWNLOAD_INVOICE, req, res, next);
    });
  }
}
