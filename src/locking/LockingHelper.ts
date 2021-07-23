import Lock, { LockEntity } from '../types/Locking';

import Asset from '../types/Asset';
import AsyncTask from '../types/AsyncTask';
import Constants from '../utils/Constants';
import LockingManager from './LockingManager';
import OCPIEndpoint from '../types/ocpi/OCPIEndpoint';
import OICPEndpoint from '../types/oicp/OICPEndpoint';
import SiteArea from '../types/SiteArea';

export default class LockingHelper {
  public static async acquireAsyncTaskLock(tenantID: string, asyncTask: AsyncTask): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.ASYNC_TASK, `${asyncTask.id}`, 300);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async acquireSiteAreaSmartChargingLock(tenantID: string, siteArea: SiteArea, timeoutSecs: number): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.SITE_AREA, `${siteArea.id}-smart-charging`, 180);
    if (!(await LockingManager.acquire(lock, timeoutSecs))) {
      return null;
    }
    return lock;
  }

  public static async acquireBillingSyncUsersLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.USER, 'synchronize-billing-users');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async acquireImportUsersLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.USER, 'import-users');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async acquireImportTagsLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.TAG, 'import-tags');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async acquireSyncCarCatalogsLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.CAR_CATALOG, 'synchronize-car-catalogs');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async acquireBillingSyncInvoicesLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.INVOICE, 'synchronize-billing-invoices');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async acquireBillingPeriodicOperationLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.INVOICE, 'periodic-billing');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async acquireAssetRetrieveConsumptionsLock(tenantID: string, asset: Asset): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.ASSET, `${asset.id}-consumptions`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async acquireOCPIPushCpoCdrsLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.TRANSACTION, 'push-cdrs');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createOCPIPushTokensLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.acquireOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'push-tokens');
  }

  public static async acquireOCPIPushCdrLock(tenantID: string, transactionID: number): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.TRANSACTION, `push-cdr-${transactionID}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createOCPIPullTokensLock(tenantID: string, ocpiEndpoint: OCPIEndpoint, partial: boolean): Promise<Lock | null> {
    return LockingHelper.acquireOCPIEndpointActionLock(tenantID, ocpiEndpoint, `pull-tokens${partial ? '-partial' : ''}`);
  }

  public static async createOCPICheckCdrsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.acquireOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'check-cdrs');
  }

  public static async createOCPICheckLocationsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.acquireOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'check-locations');
  }

  public static async createOCPICheckSessionsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.acquireOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'check-sessions');
  }

  public static async createOCPIPullCdrsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.acquireOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'pull-cdrs');
  }

  public static async createOCPIPullLocationsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.acquireOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'pull-locations');
  }

  public static async createOCPIPullSessionsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.acquireOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'pull-sessions');
  }

  public static async createOCPIPatchLocationsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.acquireOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'patch-locations');
  }

  public static async createOCPIPatchEVSEStatusesLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock|null> {
    return LockingHelper.acquireOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'patch-evse-statuses');
  }

  public static async createOICPPatchEVSEsLock(tenantID: string, oicpEndpoint: OICPEndpoint): Promise<Lock|null> {
    return LockingHelper.acquireOICPEndpointActionLock(tenantID, oicpEndpoint, 'patch-evses');
  }

  public static async createOICPPatchEvseStatusesLock(tenantID: string, oicpEndpoint: OICPEndpoint): Promise<Lock|null> {
    return LockingHelper.acquireOICPEndpointActionLock(tenantID, oicpEndpoint, 'patch-evse-statuses');
  }

  public static async acquireOICPPushCdrLock(tenantID: string, transactionID: number): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.TRANSACTION, `push-cdr-${transactionID}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async acquireBillUserLock(tenantID: string, userID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.USER, `bill-user-${userID}`);
    // ----------------------------------------------------------------------------------------
    // We may have concurrent attempts to create an invoice when running billing async tasks.
    // On the otherhand, we cannot just give up too early in case of conflicts
    // To prevent such situation, we have here a timeout of 60 seconds.
    // This means that we assume here that the billing concrete layer (stripe) will be able to
    // create within a minute both the invoice item and the corresponding invoice.
    // ----------------------------------------------------------------------------------------
    if (!(await LockingManager.acquire(lock, 60 /* , timeoutSecs) */))) {
      return null;
    }
    return lock;
  }

  public static async acquireChargingStationLock(tenantID: string, chargingStationID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.CHARGING_STATION,
      `${chargingStationID}`, Constants.CHARGING_STATION_LOCK_SECS);
    if (!(await LockingManager.acquire(lock, Constants.CHARGING_STATION_LOCK_SECS * 2))) {
      return null;
    }
    return lock;
  }

  private static async acquireOCPIEndpointActionLock(tenantID: string, ocpiEndpoint: OCPIEndpoint, action: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.OCPI_ENDPOINT, `${ocpiEndpoint.id}-${action}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  private static async acquireOICPEndpointActionLock(tenantID: string, oicpEndpoint: OICPEndpoint, action: string): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.OICP_ENDPOINT, `${oicpEndpoint.id}-${action}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }
}
