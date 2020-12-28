import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import SchedulerTask from '../SchedulerTask';
import { SensitiveDataMigrationState } from '../../types/SensitiveData';
import SensitiveDataMigrationStorage from '../../storage/mongodb/SensitiveDataMigrationStorage';
import { SettingDB } from '../../types/Setting';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default class MigrateSensitiveDataTask extends SchedulerTask {

  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    // Detect if Crypto Key changed
    const isCryptoKeyChanged:boolean = await Cypher.detectConfigurationKey(tenant.id);

    // Migrate only if cryptoKey changed
    if (isCryptoKeyChanged) {

      // Database Lock
      const createDatabaseLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.DATABASE, 'migrate-sensitive-data');
      if (await LockingManager.acquire(createDatabaseLock)) {
        try {

          // Get all settings per tenant
          const settings = await SettingStorage.getSettings(tenant.id, {},
            Constants.DB_PARAMS_MAX_LIMIT);

          // Filter settings with sensitiveData
          const reducedSettings = settings.result.filter((
            value: SettingDB) => {
            if (value?.sensitiveData && !Utils.isEmptyArray(value?.sensitiveData)) {
              return true;
            }
          });

          if (reducedSettings && !Utils.isEmptyArray(reducedSettings)) {
            const settingSensitiveData = await Cypher.migrateAllSensitiveData(tenant.id, reducedSettings);
            const migrationState = {
              timestamp: new Date(),
              name: tenant.id,
              version: 'final',
              settingSensitiveData: settingSensitiveData
            } as SensitiveDataMigrationState;
            await SensitiveDataMigrationStorage.saveSensitiveDataMigrationState(tenant.id, migrationState);
          }

          await Cypher.setMigrationDone(tenant.id);
        } finally {
          // Release the database creation Lock
          await LockingManager.release(createDatabaseLock);
        }
      }
    }
  }
}
