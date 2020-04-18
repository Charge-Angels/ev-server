import TenantStorage from '../../storage/mongodb/TenantStorage';
import { Action } from '../../types/Authorization';
import global from '../../types/GlobalType';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import MigrationTask from '../MigrationTask';

const MODULE_NAME = 'UpdateConsumptionsToObjectIDs';

export default class UpdateConsumptionsToObjectIDs extends MigrationTask {
  async migrate() {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    let updated = 0;
    // Create Aggregation
    const aggregation = [];
    aggregation.push({
      '$match': {
        $or: [
          { siteID: { $type: 'string' } },
          { siteAreaID: { $type: 'string' } },
          { userID: { $type: 'string' } }
        ]
      }
    });
    aggregation.push({
      '$limit': 1
    });
    let consumptionsMDB;
    do {
      // Read
      consumptionsMDB = await global.database.getCollection<any>(tenant.id, 'consumptions')
        .aggregate(aggregation).toArray();
      // Check and Update whole consumption
      for (const consumptionMDB of consumptionsMDB) {
        // Update Sites
        if (typeof consumptionMDB.siteID === 'string') {
          // Update all
          const result = await global.database.getCollection<any>(tenant.id, 'consumptions').updateMany(
            { siteID: consumptionMDB.siteID },
            { $set: { siteID: Utils.convertToObjectID(consumptionMDB.siteID) } }
          );
          updated += result.modifiedCount;
        }
        // Update Site Areas
        if (typeof consumptionMDB.siteAreaID === 'string') {
          // Update all
          const result = await global.database.getCollection<any>(tenant.id, 'consumptions').updateMany(
            { siteAreaID: consumptionMDB.siteAreaID },
            { $set: { siteAreaID: Utils.convertToObjectID(consumptionMDB.siteAreaID) } }
          );
          updated += result.modifiedCount;
        }
        // Update Users
        if (typeof consumptionMDB.userID === 'string') {
          // Update all
          const result = await global.database.getCollection<any>(tenant.id, 'consumptions').updateMany(
            { userID: consumptionMDB.userID },
            { $set: { userID: Utils.convertToObjectID(consumptionMDB.userID) } }
          );
          updated += result.modifiedCount;
        }
      }
    } while (consumptionsMDB.length > 0);
    // Log
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: Action.MIGRATION,
        module: MODULE_NAME, method: 'migrate',
        message: `Tenant ${tenant.name} (${tenant.id}): ${updated} consumptions have been updated`
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'UpdateConsumptionsToObjectIDs';
  }

  isAsynchronous() {
    return true;
  }
}

