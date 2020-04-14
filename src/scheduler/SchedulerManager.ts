import CheckOfflineChargingStationsTask from './tasks/CheckOfflineChargingStationsTask';
import CheckPreparingSessionNotStartedTask from './tasks/CheckPreparingSessionNotStartedTask';
import CheckUserAccountInactivityTask from './tasks/CheckUserAccountInactivityTask';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import LoggingDatabaseTableCleanupTask from './tasks/LoggingDatabaseTableCleanupTask';
import OCPIPatchLocationsTask from './tasks/ocpi/OCPIPatchLocationsTask';
import SchedulerTask from './SchedulerTask';
import SynchronizeBillingUsersTask from './tasks/SynchronizeBillingUsersTask';
import SynchronizeRefundTransactionsTask from './tasks/SynchronizeRefundTransactionsTask';
import cron from 'node-cron';
import OCPIGetTokensTask from './tasks/ocpi/OCPIGetTokensTask';
import OCPIGetLocationsTask from './tasks/ocpi/OCPIGetLocationsTask';
import OCPIGetSessionsTask from './tasks/ocpi/OCPIGetSessionsTask';
import OCPIGetCdrsTask from './tasks/ocpi/OCPIGetCdrsTask';
import CheckSessionNotStartedAfterAuthorizeTask from './tasks/CheckSessionNotStartedAfterAuthorizeTask';
import SynchronizeCarsTask from './tasks/SynchronizeCarsTask';
import CheckAndComputeSmartChargingTask from './tasks/CheckAndComputeSmartChargingTask';
import { Action } from '../types/Authorization';

const MODULE_NAME = 'SchedulerManager';

export default class SchedulerManager {
  private static schedulerConfig = Configuration.getSchedulerConfig();

  static init() {
    // Active?
    if (SchedulerManager.schedulerConfig.active) {
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: Action.SCHEDULER,
        module: MODULE_NAME, method: 'init',
        message: 'The Scheduler is active'
      });
      // Yes: init
      for (const task of SchedulerManager.schedulerConfig.tasks) {
        // Active?
        if (!task.active) {
          Logging.logWarning({
            tenantID: Constants.DEFAULT_TENANT,
            action: Action.SCHEDULER,
            module: MODULE_NAME, method: 'init',
            message: `The task '${task.name}' is inactive`
          });
          continue;
        }
        let schedulerTask: SchedulerTask;
        // Tasks
        switch (task.name) {
          case 'LoggingDatabaseTableCleanupTask':
            schedulerTask = new LoggingDatabaseTableCleanupTask();
            break;
          case 'CheckUserAccountInactivityTask':
            schedulerTask = new CheckUserAccountInactivityTask();
            break;
          case 'CheckOfflineChargingStationsTask':
            // The task runs every five minutes
            schedulerTask = new CheckOfflineChargingStationsTask();
            break;
          case 'CheckPreparingSessionNotStartedTask':
            // The task runs every five minutes
            schedulerTask = new CheckPreparingSessionNotStartedTask();
            break;
          case 'OCPIPatchLocationsTask':
            schedulerTask = new OCPIPatchLocationsTask();
            break;
          case 'OCPIGetCdrsTask':
            schedulerTask = new OCPIGetCdrsTask();
            break;
          case 'OCPIGetLocationsTask':
            schedulerTask = new OCPIGetLocationsTask();
            break;
          case 'OCPIGetSessionsTask':
            schedulerTask = new OCPIGetSessionsTask();
            break;
          case 'OCPIGetTokensTask':
            schedulerTask = new OCPIGetTokensTask();
            break;
          case 'SynchronizeRefundTransactionsTask':
            schedulerTask = new SynchronizeRefundTransactionsTask();
            break;
          case 'SynchronizeBillingUsersTask':
            schedulerTask = new SynchronizeBillingUsersTask();
            break;
          case 'SynchronizeCarsTask':
            schedulerTask = new SynchronizeCarsTask();
            break;
          case 'CheckSessionNotStartedAfterAuthorizeTask':
            schedulerTask = new CheckSessionNotStartedAfterAuthorizeTask();
            break;
          case 'CheckAndComputeSmartChargingTask':
            schedulerTask = new CheckAndComputeSmartChargingTask();
            break;

          default:
            Logging.logError({
              tenantID: Constants.DEFAULT_TENANT,
              action: Action.SCHEDULER,
              module: MODULE_NAME, method: 'init',
              message: `The task '${task.name}' is unknown`
            });
        }
        if (schedulerTask) {
          cron.schedule(task.periodicity, async (): Promise<void> => await schedulerTask.run(task.name, task.config));
          Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            action: Action.SCHEDULER,
            module: MODULE_NAME, method: 'init',
            message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'`
          });
        }
      }
    } else {
      // Log
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        action: Action.SCHEDULER,
        module: MODULE_NAME, method: 'init',
        message: 'The Scheduler is inactive'
      });
    }
  }
}
