import { AsyncTaskType, AsyncTasks } from '../../../types/AsyncTask';
/* eslint-disable @typescript-eslint/member-ordering */
import { BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceItem, BillingInvoiceStatus, BillingOperationResult, BillingPaymentMethod, BillingStatus, BillingTax, BillingUser, BillingUserData } from '../../../types/Billing';
import FeatureToggles, { Feature } from '../../../utils/FeatureToggles';
import StripeHelpers, { StripeChargeOperationResult } from './StripeHelpers';
import Transaction, { StartTransactionErrorCode } from '../../../types/Transaction';

import AsyncTaskManager from '../../../async-task/AsyncTaskManager';
import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import BillingIntegration from '../BillingIntegration';
import { BillingSettings } from '../../../types/Setting';
import BillingStorage from '../../../storage/mongodb/BillingStorage';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import { Request } from 'express';
import { ServerAction } from '../../../types/Server';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import Stripe from 'stripe';
import Tenant from '../../../types/Tenant';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'StripeBillingIntegration';
export default class StripeBillingIntegration extends BillingIntegration {

  private static readonly STRIPE_MAX_LIST = 100;
  private axiosInstance: AxiosInstance;
  private stripe: Stripe;

  constructor(tenant: Tenant, settings: BillingSettings) {
    super(tenant, settings);
    this.axiosInstance = AxiosFactory.getAxiosInstance(this.tenant.id);
  }

  public static getInstance(tenant: Tenant, settings: BillingSettings): StripeBillingIntegration {
    if (settings.stripe?.url && settings.stripe?.secretKey && settings.stripe?.publicKey) {
      return new StripeBillingIntegration(tenant, settings);
    }
    // STRIPE prerequisites are not met
    return null;
  }

  public async getStripeInstance(): Promise<Stripe> {
    // TODO - To be removed - only used by automated tests!
    await this.checkConnection();
    return this.stripe;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async checkConnection(): Promise<void> {
    // Initialize Stripe
    if (!this.stripe) {
      try {
        const secretKey = await Cypher.decrypt(this.tenant.id, this.settings.stripe.secretKey);
        this.stripe = new Stripe(secretKey, {
          apiVersion: '2020-08-27',
        });
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'checkConnection',
          action: ServerAction.CHECK_BILLING_CONNECTION,
          message: 'Failed to connect to Stripe - Key is inconsistent',
          detailedMessages: { error: error.stack }
        });
      }
      // Try to connect
      try {
        // Let's make sure the connection works as expected
        this.productionMode = await StripeHelpers.isConnectedToALiveAccount(this.stripe);
        if (this.productionMode && !Utils.isProductionEnv()) {
          throw new BackendError({
            source: Constants.CENTRAL_SERVER,
            module: MODULE_NAME, method: 'checkConnection',
            action: ServerAction.CHECK_BILLING_CONNECTION,
            message: 'Failed to connect to Stripe - connecting to a productive account is forbidden in DEV Mode'
          });
        }
      } catch (error) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'checkConnection',
          action: ServerAction.CHECK_BILLING_CONNECTION,
          message: 'Failed to connect to Stripe',
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  public async checkActivationPrerequisites(): Promise<void> {
    await this.checkTaxPrerequisites();
  }

  public async checkTaxPrerequisites(): Promise<void> {
    // Check whether the taxID is set and still active
    const taxID = this.settings.billing?.taxID;
    if (taxID) {
      const billingTax: BillingTax = await this.getTaxRate(taxID);
      if (!billingTax) {
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'checkTaxPrerequisites',
          action: ServerAction.BILLING_TAXES,
          message: `Billing prerequisites are not consistent - taxID is not found or inactive - taxID: '${taxID}'`
        });
      }
    } else {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'checkTaxPrerequisites',
        action: ServerAction.BILLING_TAXES,
        message: 'Billing prerequisites are not consistent - taxID is mandatory'
      });
    }
  }

  public async checkTestDataCleanupPrerequisites(): Promise<void> {
    // Make sure the STRIPE account is not live
    let secretKey: string, publicKey: string;
    try {
      secretKey = await Cypher.decrypt(this.tenant.id, this.settings.stripe.secretKey);
      publicKey = this.settings.stripe.publicKey;
    } catch (error) {
      // Ignore error
    }
    if (secretKey?.startsWith('sk_live_') || publicKey?.startsWith('pk_live_')) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'checkTestDataCleanupPrerequisites',
        action: ServerAction.BILLING_TEST_DATA_CLEANUP,
        message: 'Stripe Account is live - Test data cleanup has been aborted'
      });
    }
  }

  public async resetConnectionSettings(): Promise<BillingSettings> {
    // Reset connection settings
    const newBillingsSettings = this.settings;
    newBillingsSettings.billing = {
      isTransactionBillingActivated: false,
      immediateBillingAllowed: false,
      periodicBillingAllowed: false,
      taxID: null
    };
    newBillingsSettings.stripe = {
      url: null,
      secretKey: null,
      publicKey: null
    };
    await SettingStorage.saveBillingSetting(this.tenant.id, newBillingsSettings);
    return newBillingsSettings;
  }

  private convertToBillingUser(customer: Stripe.Customer, user: User) : BillingUser {
    if (!user) {
      throw new Error('Unexpected situation - user cannot be null');
    }
    if (!customer) {
      throw new Error('Unexpected situation - customer cannot be null');
    }
    const userID = customer.metadata?.['userID'];
    if (userID !== user.id) {
      throw new Error('Unexpected situation - the STRIPE metadata does not match');
    }
    const billingData = {
      ...user?.billingData
    };
    const billingUser: BillingUser = {
      userID,
      name: customer.name,
      billingData
    };
    return billingUser;
  }

  public async isUserSynchronized(user: User): Promise<boolean> {
    // Check Stripe
    await this.checkConnection();
    // Make sure to get fresh data
    user = await UserStorage.getUser(this.tenant.id, user.id);
    const customerID: string = user?.billingData?.customerID;
    // returns true when the customerID is properly set!
    return !!customerID;
  }

  public async getUser(user: User): Promise<BillingUser> {
    // Check Stripe
    await this.checkConnection();
    // Make sure the billing data has been provided
    if (!user.billingData) {
      user = await UserStorage.getUser(this.tenant.id, user.id);
    }
    // Retrieve the STRIPE customer (if any)
    const customerID: string = user.billingData?.customerID;
    if (customerID) {
      const customer = await this.getStripeCustomer(customerID);
      // Return the corresponding  Billing User
      return this.convertToBillingUser(customer, user);
    }
    // customerID is not set - do not throw exceptions in that case
    return null;
  }

  public async getTaxes(): Promise<BillingTax[]> {
    await this.checkConnection();
    const taxes : BillingTax[] = [];
    try {
      let request;
      const requestParams : Stripe.TaxRateListParams = { limit: StripeBillingIntegration.STRIPE_MAX_LIST, active: true };
      do {
        request = await this.stripe.taxRates.list(requestParams);
        for (const tax of request.data) {
          taxes.push({
            id: tax.id,
            description: tax.description,
            displayName: tax.display_name,
            percentage: tax.percentage
          });
        }
        if (request.has_more) {
          requestParams.starting_after = taxes[taxes.length - 1].id;
        }
      } while (request.has_more);
      await Logging.logInfo({
        tenantID: this.tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TAXES,
        module: MODULE_NAME, method: 'getTaxes',
        message: `Retrieved tax list (${taxes.length} taxes)`
      });
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_TAXES,
        module: MODULE_NAME, method: 'getTaxes',
        message: 'Failed to retrieve tax rates',
        detailedMessages: { error: error.stack }
      });
    }
    return taxes;
  }

  public async getTaxRate(taxID: string): Promise<BillingTax> {
    await this.checkConnection();
    let taxRate : BillingTax = null;
    try {
      const stripeTaxRate: Stripe.TaxRate = await this.stripe.taxRates.retrieve(taxID);
      if (stripeTaxRate && stripeTaxRate.active) {
        const { id, description, display_name: displayName, percentage } = stripeTaxRate;
        taxRate = { id, description, displayName, percentage };
      }
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_TAXES,
        module: MODULE_NAME, method: 'getTaxRate',
        message: 'Failed to retrieve tax rate',
        detailedMessages: { error: error.stack }
      });
    }
    return taxRate;
  }

  public async getStripeInvoice(id: string): Promise<Stripe.Invoice> {
    // Get Invoice
    const stripeInvoice = await this.stripe.invoices.retrieve(id);
    return stripeInvoice;
  }

  private async _createStripeInvoice(customerID: string, userID: string, idempotencyKey?: string | number): Promise<Stripe.Invoice> {
    // Let's create the STRIPE invoice
    const stripeInvoice: Stripe.Invoice = await this.stripe.invoices.create({
      customer: customerID,
      // collection_method: 'send_invoice', //Default option is 'charge_automatically'
      // days_until_due: 30, // Optional when using default settings
      auto_advance: false, // our integration is responsible for transitioning the invoice between statuses
      metadata: {
        tenantID: this.tenant.id,
        userID
      }
    }, {
      // idempotency_key: idempotencyKey?.toString(),
      idempotencyKey: idempotencyKey?.toString(), // STRIPE version 8.137.0 - property as been renamed!!!
    });
    return stripeInvoice;
  }

  public async synchronizeAsBillingInvoice(stripeInvoice: Stripe.Invoice, checkUserExists:boolean): Promise<BillingInvoice> {
    if (!stripeInvoice) {
      throw new BackendError({
        message: 'Unexpected situation - invoice is not set',
        source: Constants.CENTRAL_SERVER, module: MODULE_NAME, action: ServerAction.BILLING,
        method: 'synchronizeAsBillingInvoice',
      });
    }
    const stripeInvoiceID = stripeInvoice.id;
    // Destructuring the STRIPE invoice to extract the required information
    // eslint-disable-next-line id-blacklist, max-len
    const { id: invoiceID, customer, number, livemode: liveMode, amount_due: amount, amount_paid: amountPaid, status, currency: invoiceCurrency, invoice_pdf: downloadUrl, metadata, hosted_invoice_url: payInvoiceUrl } = stripeInvoice;
    const customerID = customer as string;
    const currency = invoiceCurrency?.toUpperCase();
    // The invoice date may change when finalizing a DRAFT invoice
    const epoch = stripeInvoice.status_transitions?.finalized_at || stripeInvoice.created;
    const createdOn = moment.unix(epoch).toDate(); // epoch to Date!
    // Check metadata consistency - userID is mandatory!
    const userID = metadata?.userID;
    if (!userID) {
      throw new BackendError({
        message: `Unexpected situation - invoice is not an e-Mobility invoice - ${stripeInvoiceID}`,
        source: Constants.CENTRAL_SERVER, module: MODULE_NAME, action: ServerAction.BILLING,
        method: 'synchronizeAsBillingInvoice',
      });
    } else if (checkUserExists) {
      // Let's make sure the userID is still valid
      const user = await UserStorage.getUser(this.tenant.id, userID);
      if (!user) {
        throw new BackendError({
          message: `Unexpected situation - the e-Mobility user does not exist - ${userID}`,
          source: Constants.CENTRAL_SERVER, module: MODULE_NAME, action: ServerAction.BILLING,
          method: 'synchronizeAsBillingInvoice',
        });
      }
    }
    // Get the corresponding BillingInvoice (if any)
    const billingInvoice: BillingInvoice = await BillingStorage.getInvoiceByInvoiceID(this.tenant, stripeInvoice.id);
    const invoiceToSave: BillingInvoice = {
      id: billingInvoice?.id, // ACHTUNG: billingInvoice is null when creating the Billing Invoice
      // eslint-disable-next-line id-blacklist
      userID, invoiceID, customerID, liveMode, number, amount, amountPaid, currency, createdOn, downloadUrl, downloadable: !!downloadUrl,
      status: status as BillingInvoiceStatus, payInvoiceUrl,
    };
    // Let's persist the up-to-date data
    const freshInvoiceId = await BillingStorage.saveInvoice(this.tenant, invoiceToSave);
    // TODO - perf improvement? - can't we just reuse
    const freshBillingInvoice = await BillingStorage.getInvoice(this.tenant, freshInvoiceId);
    return freshBillingInvoice;
  }

  private async _createStripeInvoiceItem(parameters: Stripe.InvoiceItemCreateParams, idempotencyKey: string | number): Promise<Stripe.InvoiceItem> {
    // Let's create the line item
    const stripeInvoiceItem = await this.stripe.invoiceItems.create(parameters, {
      // idempotency_key: idempotencyKey?.toString()
      idempotencyKey: idempotencyKey?.toString(), // STRIPE version 8.137.0 - property as been renamed!!!
    });
      // returns the newly created invoice item
    return stripeInvoiceItem;
  }

  private getTaxRateIds(): Array<string> {
    if (this.settings.billing.taxID) {
      return [this.settings.billing.taxID] ;
    }
    return []; // No tax rates so far!
  }

  public async downloadInvoiceDocument(invoice: BillingInvoice): Promise<Buffer> {
    if (invoice.downloadUrl) {
      // Get document
      const response = await this.axiosInstance.get(invoice.downloadUrl, {
        responseType: 'arraybuffer'
      });
      // Convert
      return Buffer.from(response.data);
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async consumeBillingEvent(req: Request): Promise<boolean> {
    let event: { data, type: string };
    if (process.env.STRIPE_WEBHOOK_SECRET) { // ##CR - to be clarified - where this secret key should come from
      // Retrieve the event by verifying the signature using the raw body and secret.
      const signature = req.headers['stripe-signature'];
      try {
        event = this.stripe.webhooks.constructEvent(
          req.body, // Req.rawBody,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.log('⚠️  Webhook signature verification failed.');
        // pragma return res.sendStatus(StatusCodes.BAD_REQUEST);
        return false; // ##CR - this is stupid
      }
    } else {
      // Webhook signing is recommended, but if the secret is not known
      // we can retrieve the event data directly from the request body.
      event = {
        data: req.body.data,
        type: req.body.type
      };
    }
    if (event.type === 'payment_intent.succeeded') {
      // The payment was complete
      // Fulfill any orders, e-mail receipts, etc
      console.log('💰 Payment succeeded with payment method ' + event.data.object.payment_method);
    } else if (event.type === 'payment_intent.payment_failed') {
      // The payment failed to go through due to decline or authentication request
      const error = event.data.object.last_payment_error.message;
      console.log('❌ Payment failed with error: ' + error);
    } else if (event.type === 'payment_method.attached') {
      // A new payment method was attached to a customer
      console.log('💳 Attached ' + event.data.object.id + ' to customer');
    } else {
      console.log(`❌ unexpected event : ${event.type}`);
    }
    return true;
  }

  public async chargeInvoice(billingInvoice: BillingInvoice): Promise<BillingInvoice> {
    await this.checkConnection();
    const operationResult = await this.chargeStripeInvoice(billingInvoice.invoiceID);
    if (!operationResult?.succeeded && operationResult?.error) {
      if (StripeHelpers.isResourceMissingError(operationResult.error)) {
        await StripeHelpers.updateInvoiceAdditionalData(this.tenant, billingInvoice, operationResult);
        throw operationResult.error;
      } else {
        await Logging.logError({
          tenantID: this.tenant.id,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_CHARGE_INVOICE,
          actionOnUser: billingInvoice.user,
          module: MODULE_NAME, method: 'chargeInvoice',
          message: `Payment attempt failed - stripe invoice: '${billingInvoice.invoiceID}'`,
          detailedMessages: { error: operationResult.error.stack }
        });
      }
    }
    // Reuse the operation result (for better performance)
    let stripeInvoice = operationResult.invoice;
    if (!stripeInvoice) {
      // Get fresh data only when necessary
      stripeInvoice = await this.getStripeInvoice(billingInvoice.invoiceID);
    }
    // Let's replicate some information on our side
    billingInvoice = await this.synchronizeAsBillingInvoice(stripeInvoice, false);
    await StripeHelpers.updateInvoiceAdditionalData(this.tenant, billingInvoice, operationResult);
    // Send a notification to the user
    void this.sendInvoiceNotification(billingInvoice);
    await this._updateTransactionsBillingData(billingInvoice);
    return billingInvoice;
  }

  // TODO - move this method to the billing abstraction to make it common to all billing implementation
  private async _updateTransactionsBillingData(billingInvoice: BillingInvoice): Promise<void> {
    await Promise.all(billingInvoice.sessions.map(async (session) => {
      const transactionID = session.transactionID;
      try {
        const transaction = await TransactionStorage.getTransaction(this.tenant.id, Number(transactionID));
        // Update Billing Data
        transaction.billingData.stop.invoiceStatus = billingInvoice.status;
        transaction.billingData.stop.invoiceNumber = billingInvoice.number;
        transaction.billingData.lastUpdate = new Date();
        // Save
        await TransactionStorage.saveTransaction(this.tenant.id, transaction);
      } catch (error) {
        // Catch stripe errors and send the information back to the client
        await Logging.logError({
          tenantID: this.tenant.id,
          action: ServerAction.BILLING_PERFORM_OPERATIONS,
          module: MODULE_NAME, method: '_updateTransactionsBillingData',
          message: 'Failed to update transaction billing data',
          detailedMessages: { error: error.stack }
        });
      }
    }));
  }

  private async chargeStripeInvoice(invoiceID: string): Promise<StripeChargeOperationResult> {
    try {
      // Fetch the invoice from stripe (do NOT TRUST the local copy)
      let stripeInvoice: Stripe.Invoice = await this.stripe.invoices.retrieve(invoiceID);
      // Check the current invoice status
      if (stripeInvoice.status !== BillingInvoiceStatus.PAID) {
        // Finalize the invoice (if necessary)
        if (stripeInvoice.status === BillingInvoiceStatus.DRAFT) {
          stripeInvoice = await this.stripe.invoices.finalizeInvoice(invoiceID);
        }
        // Once finalized, the invoice is in the "open" state!
        if (stripeInvoice.status === BillingInvoiceStatus.OPEN
          || stripeInvoice.status === BillingInvoiceStatus.UNCOLLECTIBLE) {
          // Set the payment options
          const paymentOptions: Stripe.InvoicePayParams = {};
          stripeInvoice = await this.stripe.invoices.pay(invoiceID, paymentOptions);
        }
      }
      return {
        succeeded: true,
        invoice: stripeInvoice
      };
    } catch (error) {
      return {
        succeeded: false,
        error,
      };
    }
  }

  public async setupPaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult> {
    // Check Stripe
    await this.checkConnection();
    // Check billing data consistency
    let customerID = user?.billingData?.customerID;
    if (!customerID) {
      // User Sync is now made implicitly - LAZY mode
      const billingUser = await this.synchronizeUser(user);
      customerID = billingUser?.billingData?.customerID;
    }
    // User should now exist
    if (!customerID) {
      throw new BackendError({
        message: `User is not known in Stripe: '${user.id}' - (${user.email})`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'setupPaymentMethod',
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD
      });
    }
    // Let's do it!
    let billingOperationResult: BillingOperationResult;
    if (!paymentMethodId) {
      // Let's create a setupIntent for the stripe customer
      billingOperationResult = await this._createSetupIntent(user, customerID);
    } else {
      // Attach payment method to the stripe customer
      billingOperationResult = await this._attachPaymentMethod(user, customerID, paymentMethodId);
    }
    return billingOperationResult;
  }

  public async getPaymentMethods(user: User): Promise<BillingPaymentMethod[]> {
    // Check Stripe
    await this.checkConnection();
    // Check billing data consistency
    const customerID = user?.billingData?.customerID;
    const paymentMethods: BillingPaymentMethod[] = await this._getPaymentMethods(user, customerID);
    await Logging.logInfo({
      tenantID: this.tenant.id,
      user,
      source: Constants.CENTRAL_SERVER,
      action: ServerAction.BILLING_PAYMENT_METHODS,
      module: MODULE_NAME, method: 'getPaymentMethods',
      message: `Number of payment methods: ${paymentMethods?.length}`
    });
    return paymentMethods;
  }

  public async deletePaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult> {
    // Check Stripe
    await this.checkConnection();
    // Check billing data consistency
    const customerID = user?.billingData?.customerID;
    if (!customerID) {
      throw new BackendError({
        message: `User is not known in Stripe: '${user.id}' - (${user.email})`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'deletePaymentMethod',
        action: ServerAction.BILLING_DELETE_PAYMENT_METHOD
      });
    }
    // Let's do it!
    const billingOperationResult: BillingOperationResult = await this._detachPaymentMethod(paymentMethodId, customerID);
    return billingOperationResult;
  }

  private async _createSetupIntent(user: User, customerID: string): Promise<BillingOperationResult> {
    try {
      // Let's create a setupIntent for the stripe customer
      const setupIntent: Stripe.SetupIntent = await this.stripe.setupIntents.create({
        customer: customerID
      });
      await Logging.logInfo({
        tenantID: this.tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        module: MODULE_NAME, method: '_createSetupIntent',
        message: `Setup intent has been created - customer '${customerID}' - (${user.email})`
      });
      // Send some feedback
      return {
        succeeded: true,
        internalData: setupIntent
      };
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        actionOnUser: user,
        module: MODULE_NAME, method: '_createSetupIntent',
        message: `Stripe operation failed - ${error?.message as string}`
      });
      return {
        succeeded: false,
        error
      };
    }
  }

  private async _attachPaymentMethod(user: User, customerID: string, paymentMethodId: string): Promise<BillingOperationResult> {
    try {
      // Attach payment method to the stripe customer
      const paymentMethod: Stripe.PaymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerID
      });
      // Add billing_details to the payment method
      const billingDetails: Stripe.PaymentMethodUpdateParams.BillingDetails = StripeHelpers.buildBillingDetails(user);
      let paymentMethodUpdateParams: Stripe.PaymentMethodUpdateParams;
      if (billingDetails) {
        paymentMethodUpdateParams = {
          billing_details: billingDetails
        };
      }
      await this.stripe.paymentMethods.update(paymentMethodId, paymentMethodUpdateParams);
      await Logging.logInfo({
        tenantID: this.tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        module: MODULE_NAME, method: '_attachPaymentMethod',
        message: `Payment method ${paymentMethodId} has been attached - customer '${customerID}' - (${user.email})`
      });
      // Set this payment method as the default
      await this.stripe.customers.update(customerID, {
        invoice_settings: { default_payment_method: paymentMethodId }
      });
      await Logging.logInfo({
        tenantID: this.tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        module: MODULE_NAME, method: '_attachPaymentMethod',
        message: `Default payment method has been set ${paymentMethodId} - customer '${customerID}' - (${user.email})`
      });
      // Send some feedback
      return {
        succeeded: true,
        internalData: paymentMethod
      };
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_SETUP_PAYMENT_METHOD,
        actionOnUser: user,
        module: MODULE_NAME, method: '_attachPaymentMethod',
        message: `Stripe operation failed - ${error?.message as string}`
      });
      return {
        succeeded: false,
        error
      };
    }
  }

  private async _getPaymentMethods(user: User, customerID: string): Promise<BillingPaymentMethod[]> {
    const paymentMethods: BillingPaymentMethod[] = [];
    try {
      const customer = await this.getStripeCustomer(customerID);
      if (customer) {
        let response: Stripe.ApiList<Stripe.PaymentMethod>;
        const requestParams : Stripe.PaymentMethodListParams = {
          limit: StripeBillingIntegration.STRIPE_MAX_LIST,
          customer: customerID,
          type: 'card',
        };
        do {
          response = await this.stripe.paymentMethods.list(requestParams);
          for (const paymentMethod of response.data) {
            paymentMethods.push({
              id: paymentMethod.id,
              brand: paymentMethod.card.brand,
              expiringOn: new Date(paymentMethod.card.exp_year, paymentMethod.card.exp_month, 0),
              last4: paymentMethod.card.last4,
              type: paymentMethod.type,
              createdOn: moment.unix(paymentMethod.created).toDate(),
              isDefault: paymentMethod.id === customer.invoice_settings.default_payment_method
            });
          }
          if (response.has_more) {
            requestParams.starting_after = paymentMethods[paymentMethods.length - 1].id;
          }
        } while (response.has_more);
      }
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_PAYMENT_METHODS,
        actionOnUser: user,
        module: MODULE_NAME, method: '_getPaymentMethods',
        message: 'Failed to retrieve payment methods',
        detailedMessages: { error: error.stack }
      });
    }
    return paymentMethods;
  }

  private async _detachPaymentMethod(paymentMethodId: string, customerID: string): Promise<BillingOperationResult> {
    try {
      // Verify payment method to be deleted is not the default one
      const customer = await this.getStripeCustomer(customerID);
      if (customer.invoice_settings.default_payment_method === paymentMethodId) {
        throw new BackendError({
          message: 'Cannot delete default payment method',
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME,
          method: '_detachPaymentMethod',
          action: ServerAction.BILLING_DELETE_PAYMENT_METHOD,
        });
      }
      // Detach payment method from the stripe customer
      const paymentMethod: Stripe.PaymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);
      await Logging.logInfo({
        tenantID: this.tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_DELETE_PAYMENT_METHOD,
        module: MODULE_NAME, method: '_detachPaymentMethod',
        message: `Payment method ${paymentMethodId} has been detached - customer '${customerID}'`
      });
      // Send some feedback
      return {
        succeeded: true,
        internalData: paymentMethod
      };
    } catch (error) {
      // catch stripe errors and send the information back to the client
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_DELETE_PAYMENT_METHOD,
        module: MODULE_NAME, method: '_detachPaymentMethod',
        message: `Failed to detach payment method - customer '${customerID}'`,
        detailedMessages: { error: error.stack }
      });
      // Send some feedback
      return {
        succeeded: false,
        error
      };
    }
  }

  private isTransactionUserInternal(transaction: Transaction): boolean {
    return this.isUserInternal(transaction?.user);
  }

  private isUserInternal(user: User): boolean {
    // slf
    if (this.tenant.id === '5be7fb271014d90008992f06') {
      const email = user?.email?.toLocaleLowerCase();
      if (email?.endsWith('@sap.com') || email?.endsWith('@vinci-facilities.com')) {
        // Internal user
        return true;
      }
    } else if (this.tenant.id === '5e2701b248aaa90007904cca') {
      // Special mode for a particular user on that particular tenant
      if (user?.id !== '5e74e254a25a3e0006fa79d3') {
        // Do not bill other users than that one!
        return true;
      }
    }
    // This is an external user
    return false;
  }

  public async startTransaction(transaction: Transaction): Promise<BillingDataTransactionStart> {

    if (!this.settings.billing.isTransactionBillingActivated) {
      return {
        // Keeps track whether the billing was activated or not on start transaction
        withBillingActive: false
      };
    }
    // Temporary solution - Check for internal users
    if (this.isTransactionUserInternal(transaction)) {
      return {
        // Do not bill internal users
        withBillingActive: false
      };
    }
    // Check Stripe
    await this.checkConnection();
    // Check Transaction
    this.checkStartTransaction(transaction);
    // Check Start Transaction Prerequisites
    const customerID: string = transaction.user?.billingData?.customerID;
    // Check whether the customer exists or not
    const customer = await this.checkStripeCustomer(customerID);
    // Check whether the customer has a default payment method
    this.checkStripePaymentMethod(customer);
    // Well ... when in test mode we may allow to start the transaction
    if (!customerID) {
      // Not yet LIVE ... starting a transaction without a STRIPE CUSTOMER is allowed
      await Logging.logWarning({
        tenantID: this.tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'startTransaction',
        message: 'Live Mode is OFF - transaction has been started with NO customer data'
      });
    }
    return {
      withBillingActive: true
    };
  }

  private async checkStripeCustomer(customerID: string): Promise<Stripe.Customer> {
    const customer = await this.getStripeCustomer(customerID);
    if (!customer) {
      throw new BackendError({
        message: `Customer not found - ${customerID}`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'startTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    return customer;
  }

  private checkStripePaymentMethod(customer: Stripe.Customer): void {
    if (!customer.default_source && !customer.invoice_settings?.default_payment_method) {
      throw new BackendError({
        message: `Customer has no default payment method - ${customer.id}`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'startTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async updateTransaction(transaction: Transaction): Promise<BillingDataTransactionUpdate> {
    // Check User
    if (!transaction.userID || !transaction.user) {
      throw new BackendError({
        message: 'User is not provided',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'updateTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    return {
      // Just propagate the initial state
      withBillingActive: transaction.billingData?.withBillingActive
    };
  }

  private _buildInvoiceItemParkTimeParameters(customerID: string, billingInvoiceItem: BillingInvoiceItem, invoiceID?: string): Stripe.InvoiceItemCreateParams {
    const { parkingData, taxes } = billingInvoiceItem;
    const currency = parkingData.pricingData.currency.toLowerCase();
    // Build stripe parameters for the parking time
    const parameters: Stripe.InvoiceItemCreateParams = {
      invoice: invoiceID,
      customer: customerID,
      currency,
      description: parkingData.description,
      tax_rates: taxes,
      // quantity: 1, //Cannot be set separately
      amount: Utils.createDecimal(parkingData.pricingData.amount).times(100).round().toNumber(),
      metadata: { ...billingInvoiceItem?.metadata }
    };
    if (!parameters.invoice) {
      // STRIPE throws an exception when invoice is set to null.
      delete parameters.invoice;
    }
    return parameters;
  }

  private _buildInvoiceItemParameters(customerID: string, billingInvoiceItem: BillingInvoiceItem, invoiceID?: string): Stripe.InvoiceItemCreateParams {
    /* --------------------------------------------------------------------------------
     Convert pricing information to STRIPE expected data
    -----------------------------------------------------------------------------------
    Example:
      Consumption 1000 Kw.h - total amount: 4 euros
      Unit price should be (4 / 1000) ==> 0.004
    Stripe expects 'unit_amount' as an Integer, in Cents
      unit_amount: 0.4 ==> Not an integer - throws an exception
    Stripe alternative - 'unit_amount_decimal' in Cents, with 2 decimals, as a string!
      unit_amount_decimal: '004.00' (in Cents, with 2 decimals, as a string)
    ----------------------------------------------------------------------------------- */
    const { description, pricingData, taxes } = billingInvoiceItem;
    const currency = pricingData.currency.toLowerCase();
    // Build stripe parameters for the item
    const parameters: Stripe.InvoiceItemCreateParams = {
      invoice: invoiceID,
      customer: customerID,
      currency,
      description,
      tax_rates: taxes,
      // quantity: 1, //Cannot be set separately
      amount: Utils.createDecimal(pricingData.amount).times(100).round().toNumber(), // In cents
      metadata: { ...billingInvoiceItem?.metadata }
    };

    // // ----------------------------------------------------------------------------------------
    // // INVESTIGATIONS - Attempts to set both the quantity and the unit_amount
    // // ----------------------------------------------------------------------------------------
    // Quantity must be an Integer! - STRIPE does not support decimals
    // const quantity = Utils.createDecimal(pricingData.quantity).round().toNumber(); // kW.h -
    // if (quantity === 0) {
    //   // ----------------------------------------------------------------------------------------
    //   // The quantity was too small - let's prevent dividing by zero
    //   // parameters.quantity = 0; // Not an option for STRIPE
    //   // ----------------------------------------------------------------------------------------
    //   parameters.amount = Utils.createDecimal(pricingData.amount).times(100).round().toNumber();
    // } else {
    //   // ----------------------------------------------------------------------------------------
    //   // STRIPE expects either "unit_amount" in Cents - or unit_amount_decimal (with 4 decimals)
    //   // ----------------------------------------------------------------------------------------
    //   const unit_amount_in_cents = Utils.createDecimal(pricingData.amount).times(100).dividedBy(quantity);
    //   // Let's use the more precise option
    //   const unit_amount_decimal: string = unit_amount_in_cents.times(100).round().dividedBy(100).toNumber().toFixed(2);
    //   parameters.quantity = quantity;
    //   parameters.unit_amount_decimal = unit_amount_decimal;
    // }

    if (!parameters.invoice) {
      // STRIPE throws an exception when invoice is set to null.
      delete parameters.invoice;
    }
    return parameters;
  }

  public async stopTransaction(transaction: Transaction): Promise<BillingDataTransactionStop> {
    // Check whether the billing was activated on start transaction
    if (!transaction.billingData?.withBillingActive) {
      return {
        status: BillingStatus.UNBILLED
      };
    }
    // Do not bill suspicious StopTransaction events
    if (FeatureToggles.isFeatureActive(Feature.BILLING_CHECK_THRESHOLD_ON_STOP) && !Utils.isDevelopmentEnv()) {
      // Suspicious StopTransaction may occur after a 'Housing temperature approaching limit' error on some charging stations
      const timeSpent = this.computeTimeSpentInSeconds(transaction);
      // TODO - make it part of the pricing or billing settings!
      if (timeSpent < 60 /* seconds */ || transaction.stop.totalConsumptionWh < 1000 /* 1kWh */) {
        await Logging.logWarning({
          tenantID: this.tenant.id,
          user: transaction.userID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'stopTransaction',
          message: `Transaction data is suspicious - billing operation has been aborted - transaction ID: ${transaction.id}`
        });
        return {
          status: BillingStatus.UNBILLED
        };
      }
    }
    // Create and Save async task
    await AsyncTaskManager.createAndSaveAsyncTasks({
      name: AsyncTasks.BILL_TRANSACTION,
      action: ServerAction.BILLING_TRANSACTION,
      type: AsyncTaskType.TASK,
      tenantID: this.tenant.id,
      parameters: {
        transactionID: String(transaction.id),
        userID: transaction.userID
      },
      module: MODULE_NAME,
      method: 'stopTransaction',
    });
    // Inform the calling layer that the operation has been postponed
    return {
      status: BillingStatus.PENDING
    };
  }

  public async billTransaction(transaction: Transaction): Promise<BillingDataTransactionStop> {
    // Check Stripe
    await this.checkConnection();
    // Check object
    this.checkStopTransaction(transaction);
    try {
      // Check that the customer STRIPE exists
      const customerID: string = transaction.user?.billingData?.customerID;
      const customer = await this.getStripeCustomer(customerID);
      if (customer) {
        await Logging.logInfo({
          tenantID: this.tenant.id,
          user: transaction.userID,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'billTransaction',
          message: `Billing process is about to start - transaction ID: ${transaction.id}`
        });
        const billingDataTransactionStop: BillingDataTransactionStop = await this._billTransaction(transaction);
        return billingDataTransactionStop;
      }
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        user: transaction.userID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'billTransaction',
        message: `Failed to bill the transaction - Transaction ID '${transaction.id}'`,
        detailedMessages: { error: error.stack }
      });
    }
    return {
      status: BillingStatus.FAILED
    };
  }

  private async _getLatestDraftInvoiceOfTheMonth(customerID: string): Promise<Stripe.Invoice> {
    // Fetch the invoice list - c.f.: https://stripe.com/docs/api/invoices/list
    // The invoices are returned sorted by creation date, with the most recent ones appearing first.
    const list = await this.stripe.invoices.list({
      customer: customerID,
      status: BillingInvoiceStatus.DRAFT,
      limit: 1
    });
    const latestDraftInvoice = !Utils.isEmptyArray((list.data)) ? list.data[0] : null;
    // Check for the date
    // We do not want to mix in the same invoice charging sessions from different months
    if (latestDraftInvoice && moment.unix(latestDraftInvoice.created).isSame(moment(), 'month')) {
      return latestDraftInvoice;
    }
    // The latest DRAFT invoice is too old - don't reuse it!
    return null;
  }

  private async _billTransaction(transaction: Transaction): Promise<BillingDataTransactionStop> {
    // ACHTUNG: a single transaction may generate several lines in the invoice
    const invoiceItem: BillingInvoiceItem = this.convertToBillingInvoiceItem(transaction);
    const billingInvoice = await this.billInvoiceItem(transaction.user, invoiceItem, `${transaction.id}`);
    // Send a notification to the user
    void this.sendInvoiceNotification(billingInvoice);
    return {
      status: BillingStatus.BILLED,
      invoiceID: billingInvoice.id,
      invoiceStatus: billingInvoice.status,
      invoiceNumber: billingInvoice.number,
      invoiceItem: this.shrinkInvoiceItem(invoiceItem),
    };
  }

  private shrinkInvoiceItem(fatInvoiceItem: BillingInvoiceItem): BillingInvoiceItem {
    // The initial invoice item includes redundant transaction data
    const { description, transactionID, pricingData } = fatInvoiceItem;
    // Let's return only essential information
    const lightInvoiceItem: BillingInvoiceItem = {
      description,
      transactionID,
      pricingData
    };
    return lightInvoiceItem;
  }

  private convertToBillingInvoiceItem(transaction: Transaction) : BillingInvoiceItem {
    // Destructuring transaction.stop
    const transactionID = transaction.id;
    const { price, priceUnit, roundedPrice, totalConsumptionWh, timestamp } = transaction.stop;
    const description = this.buildLineItemDescription(transaction);
    // -------------------------------------------------------------------------------
    // ACHTUNG - STRIPE expects the amount and prices in CENTS!
    // -------------------------------------------------------------------------------
    const quantity = Utils.createDecimal(transaction.stop.totalConsumptionWh).dividedBy(1000).toNumber(); // Total consumption in kW.h
    const amount = roundedPrice; // Total amount for the line item
    const currency = priceUnit;
    // -------------------------------------------------------------------------------
    const taxes = this.getTaxRateIds(); // TODO - take into account SITE settings
    // Build a billing invoice item based on the transaction
    const billingInvoiceItem: BillingInvoiceItem = {
      description,
      transactionID,
      pricingData: {
        quantity,
        amount,
        currency
      },
      taxes,
      metadata: {
        // Let's keep track of the initial data for troubleshooting purposes
        tenantID: this.tenant.id,
        transactionID: transaction.id,
        userID: transaction.userID,
        price,
        roundedPrice,
        priceUnit,
        totalConsumptionWh,
        begin: transaction.timestamp?.valueOf(),
        end: timestamp?.valueOf()
      }
    };
    // Add Parking Time information
    if (FeatureToggles.isFeatureActive(Feature.BILLING_ITEM_WITH_PARKING_TIME)) {
      // TODO - draft implementation - behind a feature toggle - not yet activated
      billingInvoiceItem.parkingData = {
        description: this.buildLineItemParkingTimeDescription(transaction),
        pricingData: {
          quantity: 1,
          amount: 0,
          currency
        }
      };
    }
    // Returns a item representing the complete charging session (energy + parking information)
    return billingInvoiceItem ;
  }

  public async billInvoiceItem(user: User, billingInvoiceItem: BillingInvoiceItem, idemPotencyKey?: string): Promise<BillingInvoice> {
    // Let's collect the required information
    let refreshDataRequired = false;
    const userID: string = user.id;
    const customerID: string = user.billingData?.customerID;
    // Check whether a DRAFT invoice can be used
    let stripeInvoice: Stripe.Invoice;
    if (this.settings.billing?.immediateBillingAllowed) {
      // immediateBillingAllowed is ON - we want an invoice per transaction
      // Because of some STRIPE constraints the invoice creation must be postpone!
      stripeInvoice = null;
    } else {
      // immediateBillingAllowed is OFF - let's add to the latest DRAFT invoice (if any)
      stripeInvoice = await this._getLatestDraftInvoiceOfTheMonth(customerID);
    }
    // Let's create an invoice item
    // When the stripeInvoice is null a pending item is created
    if (FeatureToggles.isFeatureActive(Feature.BILLING_ITEM_WITH_PARKING_TIME) && billingInvoiceItem.parkingData) {
      const invoiceItemParameters: Stripe.InvoiceItemCreateParams = this._buildInvoiceItemParkTimeParameters(customerID, billingInvoiceItem, stripeInvoice?.id);
      const stripeInvoiceItem = await this._createStripeInvoiceItem(invoiceItemParameters, this.buildIdemPotencyKey(idemPotencyKey, 'parkTime'));
      if (!stripeInvoiceItem) {
        await Logging.logError({
          tenantID: this.tenant.id,
          user: user.id,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'billInvoiceItem',
          message: `Unexpected situation - stripe invoice item is null - stripe invoice id: '${stripeInvoice?.id}'`
        });
      }
    }
    const invoiceItemParameters: Stripe.InvoiceItemCreateParams = this._buildInvoiceItemParameters(customerID, billingInvoiceItem, stripeInvoice?.id);
    const stripeInvoiceItem = await this._createStripeInvoiceItem(invoiceItemParameters, this.buildIdemPotencyKey(idemPotencyKey, 'energy'));
    if (!stripeInvoiceItem) {
      await Logging.logError({
        tenantID: this.tenant.id,
        user: user.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'billInvoiceItem',
        message: `Unexpected situation - stripe invoice item is null - stripe invoice id: '${stripeInvoice?.id}'`
      });
    }
    if (!stripeInvoice) {
      // Let's create a new DRAFT invoice (if none has been found)
      stripeInvoice = await this._createStripeInvoice(customerID, userID, this.buildIdemPotencyKey(idemPotencyKey));
    } else {
      // Here an existing invoice is being reused
      refreshDataRequired = true;
    }
    let operationResult: StripeChargeOperationResult;
    if (this.settings.billing?.immediateBillingAllowed) {
      // Let's try to bill the stripe invoice using the default payment method of the customer
      operationResult = await this.chargeStripeInvoice(stripeInvoice.id);
      if (!operationResult?.succeeded && operationResult?.error) {
        await Logging.logError({
          tenantID: this.tenant.id,
          user: user.id,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_TRANSACTION,
          module: MODULE_NAME, method: 'billInvoiceItem',
          message: `Payment attempt failed - stripe invoice: '${stripeInvoice?.id}'`,
          detailedMessages: { error: operationResult.error.stack }
        });
      }
      if (operationResult?.invoice) {
        // Reuse the operation result (for better performance)
        stripeInvoice = operationResult.invoice;
      } else {
        // Something went wrong - we need to fetch the latest information from STRIPE again!
        refreshDataRequired = true;
      }
    }
    // Get fresh data only when necessary - e.g.: invoice has been finalized, however the payment attempt failed
    if (refreshDataRequired) {
      stripeInvoice = await this.getStripeInvoice(stripeInvoice.id);
    }
    // Let's replicate some information on our side
    const billingInvoice = await this.synchronizeAsBillingInvoice(stripeInvoice, false);
    // We have now a Billing Invoice - Let's update it with details about the last operation result
    await StripeHelpers.updateInvoiceAdditionalData(this.tenant, billingInvoice, operationResult, billingInvoiceItem);
    // Return the billing invoice
    return billingInvoice;
  }

  private buildIdemPotencyKey(uniqueId: string, prefix = 'invoice'): string {
    if (uniqueId) {
      return `${prefix}_${uniqueId}`;
    }
    return null;
  }

  private buildLineItemParkingTimeDescription(transaction: Transaction) {
    const sessionID = String(transaction?.id);
    const timeSpent = this.convertTimeSpentToString(transaction);
    // TODO - behind a feature toggle - translate it before activating the feature
    // TODO - handle the corresponding pricing - for now this is free!
    const description = `Charging Session: ${sessionID} - Free parking time: ${timeSpent}`;
    return description;
  }

  private buildLineItemDescription(transaction: Transaction) {
    const chargeBox = transaction.chargeBox;
    const i18nManager = I18nManager.getInstanceForLocale(transaction.user.locale);
    const sessionID = String(transaction?.id);
    const startDate = i18nManager.formatDateTime(transaction.timestamp, 'LL', transaction.timezone);
    const startTime = i18nManager.formatDateTime(transaction.timestamp, 'LT', transaction.timezone);
    const stopTime = i18nManager.formatDateTime(transaction.stop.timestamp, 'LT', transaction.timezone);
    const formattedConsumptionkWh = this.formatConsumptionToKWh(transaction);
    const timeSpent = this.convertTimeSpentToString(transaction);
    const descriptionPattern = (chargeBox?.siteArea?.name) ? 'billing.chargingAtSiteArea' : 'billing.chargingAtChargeBox';
    // Get the translated line item description
    const description = i18nManager.translate(descriptionPattern, {
      sessionID,
      startDate,
      startTime,
      timeSpent,
      totalConsumption: formattedConsumptionkWh,
      siteAreaName: chargeBox?.siteArea?.name,
      chargeBoxID: transaction?.chargeBoxID,
      stopTime,
    });
    return description;
  }

  private formatConsumptionToKWh(transaction: Transaction): string {
    // ACHTUNG: consumed energy shown in the line item might be slightly different from the billed energy
    return Utils.createDecimal(transaction.stop.totalConsumptionWh).dividedBy(1000).toNumber().toLocaleString(this.getUserLocale(transaction));
  }

  private getUserLocale(transaction: Transaction) {
    return transaction.user.locale ? transaction.user.locale.replace('_', '-') : Constants.DEFAULT_LOCALE.replace('_', '-');
  }

  private computeTimeSpentInSeconds(transaction: Transaction): number {
    let totalDuration: number;
    if (!transaction.stop) {
      totalDuration = moment.duration(moment(transaction.lastConsumption.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    } else {
      totalDuration = moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds();
    }
    return totalDuration;
  }

  private convertTimeSpentToString(transaction: Transaction): string {
    const totalDuration = this.computeTimeSpentInSeconds(transaction);
    return moment.duration(totalDuration, 's').format('h[h]mm', { trim: false });
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  public async checkIfUserCanBeCreated(user: User): Promise<boolean> {
    // throw new BackendError({
    //   source: Constants.CENTRAL_SERVER,
    //   module: MODULE_NAME, method: 'createUser',
    //   action: ServerAction.USER_CREATE,
    //   user: user,
    //   message: 'Cannot create the user'
    // });
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  public async checkIfUserCanBeUpdated(user: User): Promise<boolean> {
    // throw new BackendError({
    //   source: Constants.CENTRAL_SERVER,
    //   module: MODULE_NAME, method: 'updateUser',
    //   action: ServerAction.USER_CREATE,
    //   user: user,
    //   message: 'Cannot update the user'
    // });
    return true;
  }

  public async checkIfUserCanBeDeleted(user: User): Promise<boolean> {
    // Check connection
    await this.checkConnection();
    // No billing in progress
    if (!user.billingData || !user.billingData.customerID) {
      return true;
    }
    // Check connection
    await this.checkConnection();
    // Check invoices
    // OPENED
    let list = await this.stripe.invoices.list({
      customer: user.billingData.customerID,
      status: BillingInvoiceStatus.OPEN,
    });
    if (list && !Utils.isEmptyArray(list.data)) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.USER_DELETE,
        actionOnUser: user,
        module: MODULE_NAME, method: 'checkIfUserCanBeDeleted',
        message: 'Opened invoice still exist in Stripe'
      });
      return false;
    }
    // DRAFT
    list = await this.stripe.invoices.list({
      customer: user.billingData.customerID,
      status: BillingInvoiceStatus.DRAFT,
    });
    if (list && !Utils.isEmptyArray(list.data)) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.USER_DELETE,
        actionOnUser: user,
        module: MODULE_NAME, method: 'checkIfUserCanBeDeleted',
        message: 'Draft invoice still exist in Stripe'
      });
      return false;
    }
    // PENDING
    const itemsList = await this.stripe.invoiceItems.list({
      customer: user.billingData.customerID,
      pending: true,
    });
    if (itemsList && itemsList.data && itemsList.data.length > 0) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.USER_DELETE,
        actionOnUser: user,
        module: MODULE_NAME, method: 'checkIfUserCanBeDeleted',
        message: 'Pending invoice still exist in Stripe'
      });
      return false;
    }
    return true;
  }

  public async createUser(user: User): Promise<BillingUser> {
    return await this._createUser(user, false);
  }

  public async repairUser(user: User): Promise<BillingUser> {
    return await this._createUser(user, true);
  }

  private async _createUser(user: User, forceUserCreation: boolean): Promise<BillingUser> {
    // Check connection
    await this.checkConnection();
    await this.checkIfUserCanBeCreated(user);
    if (user.billingData?.customerID) {
      // The customerID should be preserved - unless the creation is forced
      if (!forceUserCreation) {
        throw new Error('Unexpected situation - the customerID is already set');
      }
    }
    // Checks create a new STRIPE customer
    const customer: Stripe.Customer = await this.stripe.customers.create({
      ...StripeHelpers.buildCustomerCommonProperties(user),
      metadata: {
        tenantID: this.tenant.id,
        userID: user.id // IMPORTANT - keep track on the stripe side of the original eMobility user
      }
    });
    // Let's populate the initial Billing Data of our new customer
    const billingData: BillingUserData = {
      customerID: customer.id,
      liveMode: customer.livemode, // true when using a productive STRIPE account
      lastChangedOn: new Date(),
      hasSynchroError: false,
      invoicesLastSynchronizedOn: null
    };
    // Save the billing data
    user.billingData = billingData;
    await UserStorage.saveUserBillingData(this.tenant.id, user.id, user.billingData);
    // Let's return the corresponding Billing User
    return this.convertToBillingUser(customer, user);
  }

  public async updateUser(user: User): Promise<BillingUser> {
    // Check connection
    await this.checkConnection();
    await this.checkIfUserCanBeUpdated(user);
    // Let's check if the STRIPE customer exists
    const customerID:string = user?.billingData?.customerID;
    if (!customerID) {
      throw new Error('Unexpected situation - the customerID is NOT set');
    }
    let customer = await this.getStripeCustomer(customerID);
    const userID = customer?.metadata?.['userID'];
    if (userID !== user.id) {
      throw new Error('Unexpected situation - the STRIPE metadata does not match');
    }
    // Update user data
    const updateParams: Stripe.CustomerUpdateParams = {
      ...StripeHelpers.buildCustomerCommonProperties(user),
    };
    // Update changed data
    customer = await this.stripe.customers.update(customerID, updateParams);
    // Let's update the Billing Data of our customer
    user.billingData.lastChangedOn = new Date();
    await UserStorage.saveUserBillingData(this.tenant.id, user.id, user.billingData);
    // Let's return the corresponding Billing User
    return this.convertToBillingUser(customer, user);
  }

  public async deleteUser(user: User): Promise<void> {
    if (FeatureToggles.isFeatureActive(Feature.BILLING_PREVENT_CUSTOMER_DELETION)) {
      // To be on the SAFE side - we preserve the customer on the STRIPE side
      return Promise.resolve();
    }
    // Check Stripe
    await this.checkConnection();
    // const customer = await this.getCustomerByEmail(user.email);
    const customerID = user.billingData?.customerID;
    const customer = await this.getStripeCustomer(customerID);
    if (customer && customer.id) {
      await this.stripe.customers.del(
        customer.id
      );
    }
  }

  private async getStripeCustomer(customerID: string): Promise<Stripe.Customer> {
    if (customerID) {
      try {
        // Gets the STRIPE Customer
        const customer: Stripe.Customer | Stripe.DeletedCustomer = await this.stripe.customers.retrieve(customerID);
        // Check for the deletion flag
        const deleted = (customer.deleted) ? true : false; // ACHTUNG - STRIPE type definition is wrong!
        if (deleted) {
          throw new BackendError({
            source: Constants.CENTRAL_SERVER,
            module: MODULE_NAME, method: 'getStripeCustomer',
            action: ServerAction.BILLING,
            message: `Customer is marked as deleted - ${customerID}`
          });
        }
        // We are now sure this is not a Stripe.DeletedCustomer!!
        return customer as Stripe.Customer;
      } catch (error) {
        // ---------------------------------------------------------------------------------------
        // This should not happen - The customerID should be stable
        // May happen when billing settings are changed to point to a different STRIPE account
        // ---------------------------------------------------------------------------------------
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'getStripeCustomer',
          action: ServerAction.BILLING,
          message: `Customer ID is inconsistent - ${customerID}`,
          detailedMessages: { error: error.stack }
        });
      }
    }
    // -----------------------------------------------------------------
    // Returns null only when the customerID input parameter is null
    // Everything else should throw an error
    // --------------------------------------------------------------
    return null;
  }

  public async precheckStartTransactionPrerequisites(user: User): Promise<StartTransactionErrorCode[]> {
    const errorCodes: StartTransactionErrorCode[] = [];
    // Check billing prerequisites
    if (!this.settings.billing.isTransactionBillingActivated) {
      // Nothing to check - billing of transactions is not yet ON
      return errorCodes;
    }
    if (this.isUserInternal(user)) {
      // Nothing to check - we do not bill internal user's transactions
      return errorCodes;
    }
    // Make sure the STRIPE connection is ok
    try {
      await this.checkConnection();
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'precheckStartTransactionPrerequisites',
        message: 'Stripe Prerequisites to start a transaction are not met',
        detailedMessages: { error: error.stack }
      });
      return [StartTransactionErrorCode.BILLING_NO_SETTINGS];
    }
    // Check all settings that are necessary to bill a transaction
    try {
      await this.checkTaxPrerequisites(); // Checks that the taxID is still valid
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'precheckStartTransactionPrerequisites',
        message: 'Billing setting prerequisites to start a transaction are not met',
        detailedMessages: { error: error.stack }
      });
      errorCodes.push(StartTransactionErrorCode.BILLING_NO_TAX);
    }
    // Check user prerequisites
    const customerID: string = user?.billingData?.customerID;
    try {
      // Check whether the customer exists or not
      const customer = await this.checkStripeCustomer(customerID);
      // Check whether the customer has a default payment method
      this.checkStripePaymentMethod(customer);
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'precheckStartTransactionPrerequisites',
        message: `User prerequisites to start a transaction are not met -  user: ${user.id}`,
        detailedMessages: { error: error.stack }
      });
      // TODO - return a more precise error code when payment method has expired
      errorCodes.push(StartTransactionErrorCode.BILLING_NO_PAYMENT_METHOD);
    }
    // Let's return the check results!
    return errorCodes;
  }
}
