import Consumption, { AbstractCurrentConsumption } from '../../types/Consumption';

import Asset from '../../types/Asset';
import AssetFactory from '../../integration/asset/AssetFactory';
import AssetStorage from '../../storage/mongodb/AssetStorage';
import Constants from '../../utils/Constants';
import ConsumptionStorage from '../../storage/mongodb/ConsumptionStorage';
import Decimal from 'decimal.js';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import SiteArea from '../../types/SiteArea';
import SmartChargingFactory from '../../integration/smart-charging/SmartChargingFactory';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'AssetGetConsumptionTask';

export default class AssetGetConsumptionTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    // Check if Asset component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ASSET)) {
      const smartChargingActive = Utils.isTenantComponentActive(tenant, TenantComponents.SMART_CHARGING);
      // Create Helper Array with site areas to trigger smart charging
      const triggerSmartChargingSiteAreas = [];
      // Get dynamic assets only
      const dynamicAssets = await AssetStorage.getAssets(tenant,
        {
          dynamicOnly: true,
          withSiteArea: true
        },
        Constants.DB_PARAMS_MAX_LIMIT
      );
      // Process them
      for (const asset of dynamicAssets.result) {
        if (asset.usesPushAPI) {
          continue;
        }
        const assetLock = await LockingHelper.acquireAssetRetrieveConsumptionsLock(tenant.id, asset);
        if (assetLock) {
          try {
            // Get asset factory
            const assetImpl = await AssetFactory.getAssetImpl(tenant, asset.connectionID);
            if (assetImpl) {
              // Retrieve Consumption
              const assetConsumptions = await assetImpl.retrieveConsumptions(asset);
              if (!Utils.isEmptyArray(assetConsumptions)) {
                // Create helper for site area limit
                const siteAreaLimitConsumption = {} as Consumption;
                await OCPPUtils.addSiteLimitationToConsumption(tenant, asset.siteArea, siteAreaLimitConsumption);
                // Create Consumptions
                for (const consumption of assetConsumptions) {
                  // Check if last consumption already exists
                  if (asset.lastConsumption?.timestamp && moment(consumption.lastConsumption.timestamp).diff(moment(asset.lastConsumption.timestamp), 'seconds') < 50) {
                    continue;
                  }
                  // Create Consumption to save
                  const consumptionToSave: Consumption = {
                    startedAt: asset.lastConsumption?.timestamp ? asset.lastConsumption.timestamp : moment(consumption.lastConsumption.timestamp).subtract(1, 'minutes').toDate(),
                    endedAt: consumption.lastConsumption.timestamp,
                    assetID: asset.id,
                    siteAreaID: asset.siteAreaID,
                    siteID: asset.siteArea.siteID,
                    cumulatedConsumptionWh: consumption.currentConsumptionWh,
                    cumulatedConsumptionAmps: Math.floor(consumption.currentConsumptionWh / asset.siteArea.voltage),
                    instantAmps: consumption.currentInstantAmps,
                    instantWatts: consumption.currentInstantWatts,
                    stateOfCharge: consumption.currentStateOfCharge,
                    limitSiteAreaWatts: siteAreaLimitConsumption.limitSiteAreaWatts,
                    limitSiteAreaAmps: siteAreaLimitConsumption.limitSiteAreaAmps,
                    limitSiteAreaSource: siteAreaLimitConsumption.limitSiteAreaSource,
                    smartChargingActive: siteAreaLimitConsumption.smartChargingActive,
                  };
                  // Save Consumption
                  await ConsumptionStorage.saveConsumption(tenant.id, consumptionToSave);
                  // Set Consumption to Asset
                  this.assignAssetConsumption(asset, consumption);
                }
                // Save Asset
                await AssetStorage.saveAsset(tenant, asset);
                // Check if variation since last smart charging run exceeds the variation threshold
                if (smartChargingActive && this.checkVariationSinceLastSmartChargingRun(asset)) {
                  // Check if Site Area is already pushed
                  const siteAreaAlreadyPushed = triggerSmartChargingSiteAreas.findIndex((siteArea) => siteArea.id === asset.siteArea.id);
                  if (siteAreaAlreadyPushed === -1) {
                    triggerSmartChargingSiteAreas.push(asset.siteArea);
                  }
                }
              }
            }
          } catch (error) {
            // Log error
            await Logging.logActionExceptionMessage(tenant.id, ServerAction.RETRIEVE_ASSET_CONSUMPTION, error);
          } finally {
            // Release the lock
            await LockingManager.release(assetLock);
          }
        }
      }
      // Execute smart charging on site areas which are exceeding variation threshold
      for (const siteArea of triggerSmartChargingSiteAreas) {
        await this.triggerSmartCharging(tenant, siteArea);
      }
    }
  }

  private checkVariationSinceLastSmartChargingRun(asset: Asset): boolean {
    // Check if smart charging active for site area
    if (asset.siteArea?.smartCharging) {
      // Calculate consumption variation since last smart charging run
      const consumptionVariation = asset.currentInstantWatts - asset.powerWattsLastSmartChargingRun;
      if (consumptionVariation === 0 || !(asset.variationThresholdPercent > 0)) {
        return false;
      }
      // Calculate the variation threshold in Watts
      const variationThreshold = new Decimal(asset.staticValueWatt).mul(asset.variationThresholdPercent / 100).toNumber();
      if (variationThreshold < Math.abs(consumptionVariation)) {
        return true;
      }
    }
    return false;
  }

  private async triggerSmartCharging(tenant: Tenant, siteArea: SiteArea) {
    const siteAreaLock = await LockingHelper.acquireSiteAreaSmartChargingLock(tenant.id, siteArea, 30);
    if (siteAreaLock) {
      try {
        const smartCharging = await SmartChargingFactory.getSmartChargingImpl(tenant);
        if (smartCharging) {
          await smartCharging.computeAndApplyChargingProfiles(siteArea);
        }
      } finally {
        // Release lock
        await LockingManager.release(siteAreaLock);
      }
    }
  }

  private assignAssetConsumption(asset: Asset, consumption: AbstractCurrentConsumption) {
    // Assign
    asset.lastConsumption = consumption.lastConsumption;
    asset.currentConsumptionWh = consumption.currentConsumptionWh;
    asset.currentInstantAmps = consumption.currentInstantAmps;
    asset.currentInstantAmpsL1 = consumption.currentInstantAmpsL1;
    asset.currentInstantAmpsL2 = consumption.currentInstantAmpsL2;
    asset.currentInstantAmpsL3 = consumption.currentInstantAmpsL3;
    asset.currentInstantVolts = consumption.currentInstantVolts;
    asset.currentInstantVoltsL1 = consumption.currentInstantVoltsL1;
    asset.currentInstantVoltsL2 = consumption.currentInstantVoltsL2;
    asset.currentInstantVoltsL3 = consumption.currentInstantVoltsL3;
    asset.currentInstantWatts = consumption.currentInstantWatts;
    asset.currentInstantWattsL1 = consumption.currentInstantWattsL1;
    asset.currentInstantWattsL2 = consumption.currentInstantWattsL2;
    asset.currentInstantWattsL3 = consumption.currentInstantWattsL3;
    asset.currentStateOfCharge = consumption.currentStateOfCharge;
  }
}
