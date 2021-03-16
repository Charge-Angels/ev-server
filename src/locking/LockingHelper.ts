import Lock, { LockEntity } from '../types/Locking';

import Asset from '../types/Asset';
import LockingManager from './LockingManager';
import OCPIEndpoint from '../types/ocpi/OCPIEndpoint';
import OICPEndpoint from '../types/oicp/OICPEndpoint';
import SiteArea from '../types/SiteArea';

export default class LockingHelper {
  public static async tryCreateSiteAreaSmartChargingLock(tenantID: string, siteArea: SiteArea, timeout: number): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.SITE_AREA, `${siteArea.id}-smart-charging`);
    if (!(await LockingManager.tryAcquire(lock, timeout))) {
      return null;
    }
    return lock;
  }

  public static async createSiteAreaSmartChargingLock(tenantID: string, siteArea: SiteArea): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.SITE_AREA, `${siteArea.id}-smart-charging`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createBillingSyncUsersLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.USER, 'synchronize-billing-users');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createBillingSyncInvoicesLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.INVOICE, 'synchronize-billing-invoices');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createAssetRetrieveConsumptionsLock(tenantID: string, asset: Asset): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.ASSET, `${asset.id}-consumptions`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createOCPIPushCpoCdrsLock(tenantID: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.TRANSACTION, 'push-cdrs');
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createOCPIPushCpoCdrLock(tenantID: string, transactionID: number): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.TRANSACTION, `push-cdr-${transactionID}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  public static async createOCPIPullEmspTokensLock(tenantID: string, ocpiEndpoint: OCPIEndpoint, partial: boolean): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, `pull-emsp-tokens${partial ? '-partial' : ''}`);
  }

  public static async createOCPICheckCpoCdrsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'check-cpo-cdrs');
  }

  public static async createOCPICheckCpoLocationsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'check-cpo-locations');
  }

  public static async createOCPICheckCpoSessionsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'check-cpo-sessions');
  }

  public static async createOCPIPullEmspCdrsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'pull-emsp-cdrs');
  }

  public static async createOCPIPullEmspLocationsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'pull-emsp-locations');
  }

  public static async createOCPIPullEmspSessionsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'pull-emsp-sessions');
  }

  public static async createOCPIPatchCpoLocationsLock(tenantID: string, ocpiEndpoint: OCPIEndpoint): Promise<Lock | null> {
    return LockingHelper.createOCPIEndpointActionLock(tenantID, ocpiEndpoint, 'patch-cpo-locations');
  }

  public static async createOICPPatchCpoEVSEsLock(tenantID: string, oicpEndpoint: OICPEndpoint): Promise<Lock|null> {
    return LockingHelper.createOICPEndpointActionLock(tenantID, oicpEndpoint, 'patch-cpo-evse-data');
  }

  public static async createOICPPatchCpoEvseStatusesLock(tenantID: string, oicpEndpoint: OICPEndpoint): Promise<Lock|null> {
    return LockingHelper.createOICPEndpointActionLock(tenantID, oicpEndpoint, 'patch-cpo-evse-statuses');
  }

  public static async createOICPPushCpoCdrLock(tenantID: string, transactionID: number): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.TRANSACTION, `push-cdr-${transactionID}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  private static async createOCPIEndpointActionLock(tenantID: string, ocpiEndpoint: OCPIEndpoint, action: string): Promise<Lock | null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.OCPI_ENDPOINT, `${ocpiEndpoint.id}-${action}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }

  private static async createOICPEndpointActionLock(tenantID: string, oicpEndpoint: OICPEndpoint, action: string): Promise<Lock|null> {
    const lock = LockingManager.createExclusiveLock(tenantID, LockEntity.OICP_ENDPOINT, `${oicpEndpoint.id}-${action}`);
    if (!(await LockingManager.acquire(lock))) {
      return null;
    }
    return lock;
  }
}
