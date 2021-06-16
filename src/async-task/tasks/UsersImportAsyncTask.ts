import { ActionsResponse, ImportStatus } from '../../types/GlobalType';
import User, { ImportedUser, UserRole, UserStatus } from '../../types/User';

import AbstractAsyncTask from '../AsyncTask';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DbParams from '../../types/database/DbParams';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import { ServerAction } from '../../types/Server';
import Tag from '../../types/Tag';
import TagStorage from '../../storage/mongodb/TagStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'UsersImportAsyncTask';

const result: ActionsResponse = {
  inError: 0,
  inSuccess: 0,
};

export default class UsersImportAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const importUsersLock = await LockingHelper.createImportUsersLock(this.asyncTask.tenantID);
    if (importUsersLock) {
      const tenant = await TenantStorage.getTenant(this.asyncTask.tenantID);
      try {
        const dbParams: DbParams = { limit: Constants.IMPORT_PAGE_SIZE, skip: 0 };
        let importedUsers: DataResult<ImportedUser>;
        const startTime = new Date().getTime();
        // Get total number of Users to import
        const totalUsersToImport = await UserStorage.getImportedUsersCount(tenant.id);
        if (totalUsersToImport > 0) {
          await Logging.logInfo({
            tenantID: tenant.id,
            action: ServerAction.USERS_IMPORT,
            module: MODULE_NAME, method: 'processTenant',
            message: `${totalUsersToImport} User(s) are going to be imported...`
          });
        }
        do {
          // Get the imported users
          importedUsers = await UserStorage.getImportedUsers(tenant.id, { status: ImportStatus.READY }, dbParams);
          for (const importedUser of importedUsers.result) {
            try {
              // Existing Users
              const foundUser = await UserStorage.getUserByEmail(tenant.id, importedUser.email);
              if (foundUser) {
                // Check tag is already in use
                if (!foundUser.issuer) {
                  throw new Error('User is not local to the organization');
                }
                if (foundUser.status !== UserStatus.PENDING) {
                  throw new Error('User account is already in use');
                }
                // Update it
                foundUser.name = importedUser.name;
                foundUser.firstName = importedUser.firstName;
                await UserStorage.saveUser(tenant.id, foundUser);
                // Remove the imported User
                await UserStorage.deleteImportedUser(tenant.id, importedUser.id);
                result.inSuccess++;
                continue;
              }
              // New User
              const newUser = UserStorage.createNewUser() as User;
              // Set
              newUser.firstName = importedUser.firstName;
              newUser.name = importedUser.name;
              newUser.email = importedUser.email;
              newUser.createdBy = { id: importedUser.importedBy };
              newUser.createdOn = importedUser.importedOn;
              // Save the new User
              newUser.id = await UserStorage.saveUser(tenant.id, newUser);
              // Role need to be set separately
              await UserStorage.saveUserRole(tenant.id, newUser.id, UserRole.BASIC);
              // Status need to be set separately
              await UserStorage.saveUserStatus(tenant.id, newUser.id, importedUser.autoActivateAtImport ? UserStatus.ACTIVE : UserStatus.PENDING);
              // Save tag if any and assign it to user
              // if (importedUser.tagIDs && importedUser.visualIDs) {
              if (importedUser.tagIDs) {
                await this.handleUserTagImport(tenant, importedUser, newUser);
              }
              // Remove the imported User
              await UserStorage.deleteImportedUser(tenant.id, importedUser.id);
              result.inSuccess++;
            } catch (error) {
              importedUser.status = ImportStatus.ERROR;
              importedUser.errorDescription = error.message;
              result.inError++;
              // Update it
              await UserStorage.saveImportedUser(tenant.id, importedUser);
              // Log
              await Logging.logError({
                tenantID: tenant.id,
                action: ServerAction.USERS_IMPORT,
                module: MODULE_NAME, method: 'processTenant',
                message: `Error when importing User with email '${importedUser.email}': ${error.message}`,
                detailedMessages: { user: importedUser, error: error.message, stack: error.stack }
              });
            }
          }
          // Log
          if (importedUsers.result.length > 0 && (result.inError + result.inSuccess) > 0) {
            const intermediateDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
            await Logging.logDebug({
              tenantID: tenant.id,
              action: ServerAction.USERS_IMPORT,
              module: MODULE_NAME, method: 'processTenant',
              message: `${result.inError + result.inSuccess}/${totalUsersToImport} User(s) have been processed in ${intermediateDurationSecs}s...`
            });
          }
        } while (!Utils.isEmptyArray(importedUsers?.result));
        // Log final results
        const executionDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
        await Logging.logActionsResponse(tenant.id, ServerAction.USERS_IMPORT, MODULE_NAME, 'processTenant', result,
          `{{inSuccess}} User(s) have been imported successfully in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inError}} User(s) failed to be imported in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inSuccess}} User(s) have been imported successfully but {{inError}} failed in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `Not User has been imported in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`
        );
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.USERS_IMPORT, error);
      } finally {
        // Release the lock
        await LockingManager.release(importUsersLock);
      }
    }
  }

  private async handleUserTagImport(tenant: Tenant, importedUser: ImportedUser, newUser: User) {
    for (const tag of importedUser.tagIDs.split('|')) {
      try {
        let tagToSave: Tag;
        // Existing tags
        const foundTag = await TagStorage.getTag(tenant.id, tag, { withNbrTransactions: true });
        if (foundTag) {
          // Check tag is already in use
          if (!foundTag.issuer) {
            throw new Error('Tag is not local to the organization');
          }
          if (foundTag.userID) {
            throw new Error('Tag is already assigned to an user');
          }
          if (foundTag.active) {
            throw new Error('Tag is already active');
          }
          if (foundTag.transactionsCount > 0) {
            throw new Error(`Tag is already used in ${foundTag.transactionsCount} transaction(s)`);
          }
          if (foundTag.id !== tag) {
            throw new Error('Tag VisualID is already assigned to another tag');
          }
          tagToSave = foundTag;
        } else {
          // New Tag
          tagToSave = {
            id: tag,
            // TODO: add the visualID coming from csv
            visualID: new ObjectID().toString(),
            issuer: true,
            active: false,
            createdBy: { id: importedUser.importedBy },
            createdOn: importedUser.importedOn,
          };
        }
        tagToSave.userID = newUser.id;
        // Save the new Tag
        await TagStorage.saveTag(tenant.id, tagToSave);
      } catch (error) {
        // Update the imported Tag
        importedUser.status = ImportStatus.ERROR;
        importedUser.errorDescription = error.message;
        result.inError++;
        // Update it
        await UserStorage.saveImportedUser(tenant.id, importedUser);
        // Log
        await Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.TAGS_IMPORT,
          module: MODULE_NAME, method: 'processTenant',
          message: `Error when importing Tag ID '${importedUser.id}': ${error.message}`,
          detailedMessages: { tag: importedUser, error: error.message, stack: error.stack }
        });
      }
    }
  }
}
