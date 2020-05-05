import TenantStorage from '../../storage/mongodb/TenantStorage';
import global from '../../types/GlobalType';
import { ServerAction } from '../../types/Server';
import { RefundStatus } from '../../types/Refund';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';

const MODULE_NAME = 'AddTransactionRefundStatusTask';

export default class AddTransactionRefundStatusTask extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant) {
    // Add the status property to the refunded transactions
    const result = await global.database.getCollection<any>(tenant.id, 'transactions').updateMany(
      {
        'refundData': { $exists: true },
        'refundData.status': { $exists: false }
      },
      { $set: { 'refundData.status': RefundStatus.SUBMITTED } },
      { upsert: false }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Refunded Transaction(s) has been updated in Tenant '${tenant.name}'`
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'AddTransactionRefundStatusTask';
  }
}
