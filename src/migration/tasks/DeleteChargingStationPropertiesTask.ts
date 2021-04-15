import ChargingStation from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'DeleteChargingStationPropertiesTask';

export default class DeleteChargingStationPropertiesTask extends MigrationTask {
  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant: Tenant): Promise<void> {
    // Delete the properties from the collection
    const result = await global.database.getCollection<ChargingStation>(tenant.id, 'chargingstations').updateMany(
      {},
      { $unset: { currentServerLocalIPAddress: '', currentServerLocalIPAddressPort: '' } }
    );
    // Log in the default tenant
    if (result.modifiedCount > 0) {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'migrateTenant',
        message: `${result.modifiedCount} Charging Stations' properties have been deleted in Tenant ${Utils.buildTenantName(tenant)}`
      });
    }
  }

  getVersion(): string {
    return '1.1';
  }

  getName(): string {
    return 'DeleteChargingStationPropertiesTask';
  }
}
