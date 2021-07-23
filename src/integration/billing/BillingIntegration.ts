import { BillingChargeInvoiceAction, BillingDataTransactionStart, BillingDataTransactionStop, BillingDataTransactionUpdate, BillingInvoice, BillingInvoiceItem, BillingInvoiceStatus, BillingOperationResult, BillingPaymentMethod, BillingStatus, BillingTax, BillingUser, BillingUserSynchronizeAction } from '../../types/Billing';
import FeatureToggles, { Feature } from '../../utils/FeatureToggles';
import Transaction, { StartTransactionErrorCode } from '../../types/Transaction';
import User, { UserStatus } from '../../types/User';

import BackendError from '../../exception/BackendError';
import { BillingSettings } from '../../types/Setting';
import BillingStorage from '../../storage/mongodb/BillingStorage';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import { Decimal } from 'decimal.js';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { Request } from 'express';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'BillingIntegration';

export default abstract class BillingIntegration {
  // Production Mode is set to true when the target account is a live one!
  protected productionMode = false;

  protected readonly tenant: Tenant; // Assuming UUID or other string format ID
  protected settings: BillingSettings;

  protected constructor(tenant: Tenant, settings: BillingSettings) {
    this.tenant = tenant;
    this.settings = settings;
  }

  public async synchronizeUsers(): Promise<BillingUserSynchronizeAction> {
    await this.checkConnection();
    // Check
    const actionsDone: BillingUserSynchronizeAction = {
      inSuccess: 0,
      inError: 0
    };
    if (FeatureToggles.isFeatureActive(Feature.BILLING_SYNC_USERS)) {
      // Sync e-Mobility Users with no billing data
      const users = await this._getUsersWithNoBillingData();
      if (!Utils.isEmptyArray(users)) {
        // Process them
        await Logging.logInfo({
          tenantID: this.tenant.id,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_SYNCHRONIZE_USERS,
          module: MODULE_NAME, method: 'synchronizeUsers',
          message: `${users.length} new user(s) are going to be synchronized`
        });
        for (const user of users) {
          // Synchronize user
          if (await this.synchronizeUser(user)) {
            actionsDone.inSuccess++;
          } else {
            actionsDone.inError++;
          }
        }
      }
    } else {
      await Logging.logWarning({
        tenantID: this.tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_USERS,
        module: MODULE_NAME, method: 'synchronizeUsers',
        message: 'Feature is switched OFF - operation has been aborted'
      });
    }
    // Log
    await Logging.logActionsResponse(this.tenant.id, ServerAction.BILLING_SYNCHRONIZE_USERS,
      MODULE_NAME, 'synchronizeUsers', actionsDone,
      '{{inSuccess}} user(s) were successfully synchronized',
      '{{inError}} user(s) failed to be synchronized',
      '{{inSuccess}} user(s) were successfully synchronized and {{inError}} failed to be synchronized',
      'All the users are up to date'
    );
    // Update last synchronization
    this.settings.billing.usersLastSynchronizedOn = new Date();
    await SettingStorage.saveBillingSetting(this.tenant.id, this.settings);
    // Result
    return actionsDone;
  }

  public async synchronizeUser(user: User): Promise<BillingUser> {
    let billingUser: BillingUser = null;
    try {
      billingUser = await this._synchronizeUser(user);
      await Logging.logInfo({
        tenantID: this.tenant.id,
        actionOnUser: user,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'synchronizeUser',
        message: `Successfully synchronized user: '${user.id}' - '${user.email}'`,
      });
      return billingUser;
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        actionOnUser: user,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'synchronizeUser',
        message: `Failed to synchronize user: '${user.id}' - '${user.email}'`,
        detailedMessages: { error: error.stack }
      });
    }
    return billingUser;
  }

  public async forceSynchronizeUser(user: User): Promise<BillingUser> {
    let billingUser: BillingUser = null;
    try {
      billingUser = await this._synchronizeUser(user, true /* !forceMode */);
      if (user?.billingData?.customerID !== billingUser?.billingData?.customerID) {
        await Logging.logWarning({
          tenantID: this.tenant.id,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
          module: MODULE_NAME, method: 'forceSynchronizeUser',
          message: `CustomerID has been repaired - old value ${user?.billingData?.customerID} - ${billingUser?.billingData?.customerID}`
        });
      }
      await Logging.logInfo({
        tenantID: this.tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
        actionOnUser: user,
        module: MODULE_NAME, method: 'forceSynchronizeUser',
        message: `Successfully forced the synchronization of user: '${user.id}' - '${user.email}'`,
      });
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        actionOnUser: user,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_FORCE_SYNCHRONIZE_USER,
        module: MODULE_NAME, method: 'forceSynchronizeUser',
        message: `Failed to force the synchronization of user: '${user.id}' - '${user.email}'`,
        detailedMessages: { error: error.stack }
      });
    }
    return billingUser;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async synchronizeInvoices(user?: User): Promise<BillingUserSynchronizeAction> {
    const actionsDone: BillingUserSynchronizeAction = {
      inSuccess: 0,
      inError: 0
    };
    await Logging.logWarning({
      tenantID: this.tenant.id,
      source: Constants.CENTRAL_SERVER,
      action: ServerAction.BILLING_SYNCHRONIZE_INVOICES,
      module: MODULE_NAME, method: 'synchronizeInvoices',
      message: 'Method is deprecated - operation skipped'
    });
    return actionsDone;
  }

  public async chargeInvoices(forceOperation = false): Promise<BillingChargeInvoiceAction> {
    const actionsDone: BillingChargeInvoiceAction = {
      inSuccess: 0,
      inError: 0
    };
    // Check connection
    await this.checkConnection();
    // Prepare filtering and sorting
    const { filter, sort, limit } = this.preparePeriodicBillingQueryParameters(forceOperation);
    let skip = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const invoices = await BillingStorage.getInvoices(this.tenant, filter, { sort, limit, skip });
      if (Utils.isEmptyArray(invoices.result)) {
        break;
      }
      skip += limit;
      for (const invoice of invoices.result) {
        try {
          // Skip invoices that are already PAID or not relevant for the current billing process
          if (this.isInvoiceOutOfPeriodicOperationScope(invoice)) {
            continue;
          }
          // Make sure to avoid trying to charge it again too soon
          if (!forceOperation && moment(invoice.createdOn).isSame(moment(), 'day')) {
            actionsDone.inSuccess++;
            await Logging.logWarning({
              tenantID: this.tenant.id,
              source: Constants.CENTRAL_SERVER,
              action: ServerAction.BILLING_PERFORM_OPERATIONS,
              actionOnUser: invoice.user,
              module: MODULE_NAME, method: 'chargeInvoices',
              message: `Invoice is too new - Operation has been skipped - '${invoice.id}'`
            });
            continue;
          }
          const newInvoice = await this.chargeInvoice(invoice);
          if (this.isInvoiceOutOfPeriodicOperationScope(newInvoice)) {
            // The new invoice may now have a different status - and this impacts the pagination
            skip--; // This is very important!
          }
          await Logging.logInfo({
            tenantID: this.tenant.id,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.BILLING_PERFORM_OPERATIONS,
            actionOnUser: invoice.user,
            module: MODULE_NAME, method: 'chargeInvoices',
            message: `Successfully charged invoice '${invoice.id}'`
          });
          actionsDone.inSuccess++;
        } catch (error) {
          actionsDone.inError++;
          await Logging.logError({
            tenantID: this.tenant.id,
            source: Constants.CENTRAL_SERVER,
            action: ServerAction.BILLING_PERFORM_OPERATIONS,
            actionOnUser: invoice.user,
            module: MODULE_NAME, method: 'chargeInvoices',
            message: `Failed to charge invoice '${invoice.id}'`,
            detailedMessages: { error: error.stack }
          });
        }
      }
    }
    return actionsDone;
  }

  public async sendInvoiceNotification(billingInvoice: BillingInvoice): Promise<boolean> {
    try {
      // Do not send notifications for invoices that are not yet finalized!
      if (billingInvoice.status === BillingInvoiceStatus.OPEN || billingInvoice.status === BillingInvoiceStatus.PAID) {
        // Send link to the user using our notification framework (link to the front-end + download)
        const tenant = await TenantStorage.getTenant(this.tenant.id);
        // Stripe saves amount in cents
        const decimInvoiceAmount = new Decimal(billingInvoice.amount).div(100);
        // Format amunt with currency symbol depending on locale
        const invoiceAmount = new Intl.NumberFormat(Utils.convertLocaleForCurrency(billingInvoice.user.locale), { style: 'currency', currency: billingInvoice.currency.toUpperCase() }).format(decimInvoiceAmount.toNumber());
        // Send async notification
        await NotificationHandler.sendBillingNewInvoiceNotification(
          this.tenant,
          billingInvoice.id,
          billingInvoice.user,
          {
            user: billingInvoice.user,
            evseDashboardInvoiceURL: Utils.buildEvseBillingInvoicesURL(tenant.subdomain),
            evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
            invoiceDownloadUrl: Utils.buildEvseBillingDownloadInvoicesURL(tenant.subdomain, billingInvoice.id),
            // Empty url allows to decide wether to display "pay" button in the email
            payInvoiceUrl: billingInvoice.status === BillingInvoiceStatus.OPEN ? billingInvoice.payInvoiceUrl : '',
            invoiceAmount: invoiceAmount,
            invoiceNumber: billingInvoice.number,
            invoiceStatus: billingInvoice.status,
          }
        );
        // Needed only for testing
        return true;
      }
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.BILLING_TRANSACTION,
        module: MODULE_NAME, method: 'sendInvoiceNotification',
        message: `Failed to send notification for invoice '${billingInvoice.id}'`,
        detailedMessages: { error: error.stack }
      });
      return false;
    }
  }

  public checkStopTransaction(transaction: Transaction): void {
    // Check User
    if (!transaction.userID || !transaction.user) {
      throw new BackendError({
        message: 'User is not provided',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkStopTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Check Charging Station
    if (!transaction.chargeBox) {
      throw new BackendError({
        message: 'Charging Station is not provided',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkStopTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Check Billing Data
    if (!transaction.user?.billingData?.customerID) {
      throw new BackendError({
        message: 'User has no Billing Data',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkStopTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
  }

  public checkStartTransaction(transaction: Transaction): void {
    // Check User
    if (!transaction.userID || !transaction.user) {
      throw new BackendError({
        message: 'User is not provided',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkStartTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
    // Check Billing Data (only in Live Mode)
    if (!transaction.user?.billingData?.customerID) {
      throw new BackendError({
        message: 'User has no billing data or no customer ID',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkStartTransaction',
        action: ServerAction.BILLING_TRANSACTION
      });
    }
  }

  private async _getUsersWithNoBillingData(): Promise<User[]> {
    const newUsers = await UserStorage.getUsers(this.tenant.id,
      {
        statuses: [UserStatus.ACTIVE],
        notSynchronizedBillingData: true
      }, Constants.DB_PARAMS_MAX_LIMIT);
    if (newUsers.count > 0) {
      return newUsers.result;
    }
    return [];
  }

  private async _synchronizeUser(user: User, forceMode = false): Promise<BillingUser> {
    // Check if we need to create or update a STRIPE customer
    let billingUser: BillingUser = null;
    if (!forceMode) {
      // ------------------
      // Regular Situation
      // ------------------
      const exists = await this.isUserSynchronized(user); // returns false when the customerID is not set
      if (!exists) {
        billingUser = await this.createUser(user);
      } else {
        billingUser = await this.updateUser(user);
      }
    } else {
      // ----------------------------------------------------------------------------------------------
      // Specific use-case - Trying to REPAIR inconsistencies
      // e.g.: CustomerID is set, but the corresponding data does not exist anymore on the STRIPE side
      // ----------------------------------------------------------------------------------------------
      try {
        billingUser = await this.getUser(user);
        if (!billingUser) {
          billingUser = await this.createUser(user);
        } else {
          billingUser = await this.updateUser(user);
        }
      } catch (error) {
        // Let's repair it
        billingUser = await this.repairUser(user);
      }
    }
    return billingUser;
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  public async clearTestData(): Promise<void> {
    // await this.checkConnection(); - stripe connection is useless to cleanup test data
    await Logging.logInfo({
      tenantID: this.tenant.id,
      source: Constants.CENTRAL_SERVER,
      action: ServerAction.BILLING_TEST_DATA_CLEANUP,
      module: MODULE_NAME, method: '_clearAllInvoiceTestData',
      message: 'Starting test data cleanup'
    });
    await this._clearAllInvoiceTestData();
    await Logging.logInfo({
      tenantID: this.tenant.id,
      source: Constants.CENTRAL_SERVER,
      action: ServerAction.BILLING_TEST_DATA_CLEANUP,
      module: MODULE_NAME, method: '_clearAllInvoiceTestData',
      message: 'Invoice Test data cleanup has been completed'
    });
    await this._clearAllUsersTestData();
    await Logging.logInfo({
      tenantID: this.tenant.id,
      source: Constants.CENTRAL_SERVER,
      action: ServerAction.BILLING_TEST_DATA_CLEANUP,
      module: MODULE_NAME, method: '_clearAllInvoiceTestData',
      message: 'User Test data cleanup has been completed'
    });
  }

  private async _clearAllInvoiceTestData(): Promise<void> {
    const invoices: DataResult<BillingInvoice> = await BillingStorage.getInvoices(this.tenant, { liveMode: false }, Constants.DB_PARAMS_MAX_LIMIT);
    // Let's now finalize all invoices and attempt to get it paid
    for (const invoice of invoices.result) {
      try {
        await this._clearInvoiceTestData(invoice);
        await Logging.logInfo({
          tenantID: this.tenant.id,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_TEST_DATA_CLEANUP,
          actionOnUser: invoice.user,
          module: MODULE_NAME, method: '_clearAllInvoiceTestData',
          message: `Successfully clear test data for invoice '${invoice.id}'`
        });
      } catch (error) {
        await Logging.logError({
          tenantID: this.tenant.id,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_TEST_DATA_CLEANUP,
          actionOnUser: invoice.user,
          module: MODULE_NAME, method: '_clearAllInvoiceTestData',
          message: `Failed to clear invoice test data - Invoice: '${invoice.id}'`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private async _clearInvoiceTestData(billingInvoice: BillingInvoice): Promise<void> {
    if (billingInvoice.liveMode) {
      throw new BackendError({
        message: 'Unexpected situation - attempt to clear an invoice with live billing data',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: '_clearInvoiceTestData',
        action: ServerAction.BILLING_TEST_DATA_CLEANUP
      });
    }
    await this._clearTransactionsTestData(billingInvoice);
    await BillingStorage.deleteInvoice(this.tenant, billingInvoice.id);
  }

  private async _clearTransactionsTestData(billingInvoice: BillingInvoice): Promise<void> {
    await Promise.all(billingInvoice.sessions.map(async (session) => {
      const transactionID = session.transactionID;
      try {
        const transaction = await TransactionStorage.getTransaction(this.tenant.id, Number(transactionID));
        // Update Billing Data
        const stop: BillingDataTransactionStop = {
          status: BillingStatus.UNBILLED,
          invoiceID: null,
          invoiceNumber: null,
          invoiceStatus: null
        };
        transaction.billingData = {
          withBillingActive: false,
          lastUpdate:new Date(),
          stop
        };
        // Save to clear billing data
        await TransactionStorage.saveTransactionBillingData(this.tenant.id, Number(transaction.id), transaction.billingData);
      } catch (error) {
        await Logging.logError({
          tenantID: this.tenant.id,
          action: ServerAction.BILLING_TEST_DATA_CLEANUP,
          module: MODULE_NAME, method: '_clearTransactionsTestData',
          message: 'Failed to clear transaction billing data',
          detailedMessages: { error: error.stack }
        });
      }
    }));
  }

  private async _clearAllUsersTestData(): Promise<void> {
    const users: User[] = await this._getUsersWithTestBillingData();
    // Let's now finalize all invoices and attempt to get it paid
    for (const user of users) {
      try {
        await this._clearUserTestBillingData(user);
        await Logging.logInfo({
          tenantID: this.tenant.id,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_TEST_DATA_CLEANUP,
          actionOnUser: user,
          module: MODULE_NAME, method: '_clearAllUsersTestData',
          message: `Successfully cleared user test data for invoice '${user.id}'`
        });
      } catch (error) {
        await Logging.logError({
          tenantID: this.tenant.id,
          source: Constants.CENTRAL_SERVER,
          action: ServerAction.BILLING_TEST_DATA_CLEANUP,
          actionOnUser: user,
          module: MODULE_NAME, method: '_clearAllUsersTestData',
          message: `Failed to clear user test data - User: '${user.id}'`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  private async _getUsersWithTestBillingData(): Promise<User[]> {
    // Get the users where billingData.liveMode is set to false
    const users = await UserStorage.getUsers(this.tenant.id,
      {
        statuses: [UserStatus.ACTIVE],
        withTestBillingData: true
      }, Constants.DB_PARAMS_MAX_LIMIT);
    if (users.count > 0) {
      return users.result;
    }
    return [];
  }

  private async _clearUserTestBillingData(user: User): Promise<void> {
    if (user?.billingData?.liveMode) {
      throw new BackendError({
        message: 'Unexpected situation - attempt to clear a user with live billing data',
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: '_clearUserTestBillingData',
        action: ServerAction.BILLING_TEST_DATA_CLEANUP
      });
    }
    // Let's remove the billingData field
    await UserStorage.saveUserBillingData(this.tenant.id, user.id, null);
  }

  private isInvoiceOutOfPeriodicOperationScope(invoice: BillingInvoice): boolean {
    if (invoice.status === BillingInvoiceStatus.DRAFT && this.settings.billing?.periodicBillingAllowed) {
      return false;
    }
    if (invoice.status === BillingInvoiceStatus.OPEN) {
      return false;
    }
    return true;
  }

  private preparePeriodicBillingQueryParameters(forceOperation: boolean): { limit: number, sort: Record<string, unknown>, filter: Record<string, unknown> } {
    // Prepare filtering to process Invoices of the previous month
    let startDateTime: Date, endDateTime: Date, limit: number;
    if (forceOperation) {
      // Only used when running tests
      limit = 1; // Specific limit to test the pagination
      startDateTime = moment().startOf('day').toDate(); // Today at 00:00:00 (AM)
      endDateTime = moment().endOf('day').toDate(); // Today at 23:59:59 (PM)
    } else {
      // Used once a month
      limit = Constants.BATCH_PAGE_SIZE;
      startDateTime = moment().date(0).date(1).startOf('day').toDate(); // 1st day of the previous month 00:00:00 (AM)
      endDateTime = moment().date(1).startOf('day').toDate(); // 1st day of this month 00:00:00 (AM)
    }
    // Filter the invoice status based on the billing settings
    let invoiceStatus;
    if (this.settings.billing?.periodicBillingAllowed) {
      // Let's finalize DRAFT invoices and trigger a payment attemnpt for unpaid invoices as well
      invoiceStatus = [ BillingInvoiceStatus.DRAFT, BillingInvoiceStatus.OPEN ];
    } else {
      // Let's trigger a new payment attemnpt for unpaid invoices
      invoiceStatus = [ BillingInvoiceStatus.OPEN ];
    }
    // Now return the query parameters
    return {
      // --------------------------------------------------------------------------------
      // ACHTUNG!!! Make sure to adapt the paging logic when the data used for filtering
      // is also updated by the periodic operation
      // --------------------------------------------------------------------------------
      filter: {
        startDateTime,
        endDateTime,
        invoiceStatus
      },
      limit,
      sort: { createdOn: 1 } // Sort by creation date - process the eldest first!
    };
  }

  abstract checkConnection(): Promise<void>;

  abstract checkActivationPrerequisites(): Promise<void>;

  abstract checkTestDataCleanupPrerequisites() : Promise<void>;

  abstract resetConnectionSettings() : Promise<BillingSettings>;

  abstract startTransaction(transaction: Transaction): Promise<BillingDataTransactionStart>;

  abstract updateTransaction(transaction: Transaction): Promise<BillingDataTransactionUpdate>;

  abstract stopTransaction(transaction: Transaction): Promise<BillingDataTransactionStop>;

  abstract billTransaction(transaction: Transaction): Promise<BillingDataTransactionStop>;

  abstract checkIfUserCanBeCreated(user: User): Promise<boolean>;

  abstract checkIfUserCanBeUpdated(user: User): Promise<boolean>;

  abstract checkIfUserCanBeDeleted(user: User): Promise<boolean>;

  abstract getUser(user: User): Promise<BillingUser>;

  abstract createUser(user: User): Promise<BillingUser>;

  abstract updateUser(user: User): Promise<BillingUser>;

  abstract repairUser(user: User): Promise<BillingUser>;

  abstract deleteUser(user: User): Promise<void>;

  abstract isUserSynchronized(user: User): Promise<boolean>;

  abstract getTaxes(): Promise<BillingTax[]>;

  abstract billInvoiceItem(user: User, billingInvoiceItems: BillingInvoiceItem, idemPotencyKey?: string): Promise<BillingInvoice>;

  abstract downloadInvoiceDocument(invoice: BillingInvoice): Promise<Buffer>;

  abstract chargeInvoice(invoice: BillingInvoice): Promise<BillingInvoice>;

  abstract consumeBillingEvent(req: Request): Promise<boolean>;

  abstract setupPaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult>;

  abstract getPaymentMethods(user: User): Promise<BillingPaymentMethod[]>;

  abstract deletePaymentMethod(user: User, paymentMethodId: string): Promise<BillingOperationResult>;

  abstract precheckStartTransactionPrerequisites(user: User): Promise<StartTransactionErrorCode[]>;
}
