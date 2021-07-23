import { BillingDataTransactionStop, BillingStatus } from '../../types/Billing';

import AbstractAsyncTask from '../AsyncTask';
import BillingFactory from '../../integration/billing/BillingFactory';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import Utils from '../../utils/Utils';

export default class BillTransactionAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const tenant = await TenantStorage.getTenant(this.asyncTask.tenantID);
    // Check if OCPI component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.BILLING)) {
      try {
        const billingImpl = await BillingFactory.getBillingImpl(tenant);
        if (billingImpl) {
          // Get the Transaction to bill
          const transactionID: string = this.asyncTask.parameters.transactionID;
          const userID: string = this.asyncTask.parameters.userID;
          const lock = await LockingHelper.acquireBillUserLock(tenant.id, userID);
          if (lock) {
            try {
              const transaction = await TransactionStorage.getTransaction(tenant.id, Number(transactionID), { withUser: true, withChargingStation: true });
              if (!transaction) {
                throw new Error(`Unknown Transaction ID '${this.asyncTask.parameters.transactionID}'`);
              }
              // Check consistency - async task should only bill transactions created while transaction billing was ON
              if (!transaction.billingData?.withBillingActive) {
                throw new Error(`Unexpected situation - billing should be active - transaction ID: '${this.asyncTask.parameters.transactionID}'`);
              }
              // Check status - async task should only bill transactions marked as PENDING
              if (transaction.billingData?.stop?.status !== BillingStatus.PENDING) {
                throw new Error(`Unexpected situation - billing status should be PENDING - transaction ID: '${this.asyncTask.parameters.transactionID}'`);
              }
              // Attempt to finalize and pay invoices
              const billingDataStop: BillingDataTransactionStop = await billingImpl.billTransaction(transaction);
              // Update
              transaction.billingData.stop = billingDataStop;
              transaction.billingData.lastUpdate = new Date();
              // Save
              await TransactionStorage.saveTransaction(tenant.id, transaction);
            } finally {
              // Release the lock
              await LockingManager.release(lock);
            }
          } else {
            throw new Error(`Unexpected situation - concurrent billing - transaction ID: '${this.asyncTask.parameters.transactionID}' - user: ${this.asyncTask.parameters.userID}`);
          }
        }
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.BILLING_TRANSACTION, error);
      }
    }
  }
}
