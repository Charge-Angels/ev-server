import { ActionsResponse, ImportStatus } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DbParams from '../../types/database/DbParams';
import ImportAsyncTask from './ImportAsyncTask';
import { ImportedTag } from '../../types/Tag';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import TagStorage from '../../storage/mongodb/TagStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'TagsImportAsyncTask';

export default class TagsImportAsyncTask extends ImportAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const importTagsLock = await LockingHelper.acquireImportTagsLock(this.asyncTask.tenantID);
    if (importTagsLock) {
      const tenant = await TenantStorage.getTenant(this.asyncTask.tenantID);
      try {
        const dbParams: DbParams = { limit: Constants.IMPORT_PAGE_SIZE, skip: 0 };
        let importedTags: DataResult<ImportedTag>;
        const result: ActionsResponse = {
          inError: 0,
          inSuccess: 0,
        };
        const startTime = new Date().getTime();
        // Get total number of Tags to import
        const totalTagsToImport = await TagStorage.getImportedTagsCount(tenant.id);
        if (totalTagsToImport > 0) {
          await Logging.logInfo({
            tenantID: tenant.id,
            action: ServerAction.TAGS_IMPORT,
            module: MODULE_NAME, method: 'processTenant',
            message: `${totalTagsToImport} Tag(s) are going to be imported...`
          });
        }
        do {
          // Get the imported tags
          importedTags = await TagStorage.getImportedTags(tenant.id, { status: ImportStatus.READY }, dbParams);
          for (const importedTag of importedTags.result) {
            try {
              // Check & Import the Tag
              await this.processImportedTag(tenant, importedTag);
              // Remove the imported Tag
              await TagStorage.deleteImportedTag(tenant.id, importedTag.id);
              result.inSuccess++;
            } catch (error) {
              // Mark the imported Tag faulty with the reason
              importedTag.status = ImportStatus.ERROR;
              importedTag.errorDescription = error.message;
              result.inError++;
              await TagStorage.saveImportedTag(tenant.id, importedTag);
              await Logging.logError({
                tenantID: tenant.id,
                action: ServerAction.TAGS_IMPORT,
                module: MODULE_NAME, method: 'processTenant',
                message: `Cannot import Tag ID '${importedTag.id}': ${error.message}`,
                detailedMessages: { importedTag, error: error.stack }
              });
            }
          }
          if (!Utils.isEmptyArray(importedTags.result) && (result.inError + result.inSuccess) > 0) {
            const intermediateDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
            await Logging.logDebug({
              tenantID: tenant.id,
              action: ServerAction.TAGS_IMPORT,
              module: MODULE_NAME, method: 'processTenant',
              message: `${result.inError + result.inSuccess}/${totalTagsToImport} Tag(s) have been processed in ${intermediateDurationSecs}s...`
            });
          }
        } while (!Utils.isEmptyArray(importedTags?.result));
        // Log final results
        const executionDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
        await Logging.logActionsResponse(tenant.id, ServerAction.TAGS_IMPORT, MODULE_NAME, 'processTenant', result,
          `{{inSuccess}} Tag(s) have been imported successfully in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inError}} Tag(s) failed to be imported in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inSuccess}} Tag(s) have been imported successfully but {{inError}} failed in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `Not Tag has been imported in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`
        );
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.TAGS_IMPORT, error);
      } finally {
        // Release the lock
        await LockingManager.release(importTagsLock);
      }
    }
  }
}
