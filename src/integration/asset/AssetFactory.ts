import { AssetConnectionType, AssetSetting } from '../../types/Setting';

import AssetIntegration from './AssetIntegration';
import GreencomAssetIntegration from './greencom/GreencomAssetIntegration';
import IothinkAssetIntegration from './iothink/IothinkAssetIntegration';
import LacroixAssetIntegration from './lacroix/LacroixAssetIntegration';
import Logging from '../../utils/Logging';
import SchneiderAssetIntegration from './schneider/SchneiderAssetIntegration';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';
import WitAssetIntegration from './wit/WitAssetIntegration';

const MODULE_NAME = 'AssetFactory';

export default class AssetFactory {
  static async getAssetImpl(tenant: Tenant, connectionID: string): Promise<AssetIntegration<AssetSetting>> {
    // Check if component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ASSET)) {
      // Get the Asset's settings
      const settings = await SettingStorage.getAssetsSettings(tenant.id);
      if (settings && settings.asset && settings.asset.connections) {
        // Find connection
        const foundConnection = settings.asset.connections.find((connection) => connection.id === connectionID);
        if (foundConnection) {
          let assetIntegrationImpl: AssetIntegration<AssetSetting> = null;
          switch (foundConnection.type) {
            case AssetConnectionType.SCHNEIDER:
              assetIntegrationImpl = new SchneiderAssetIntegration(tenant, settings.asset, foundConnection);
              break;
            case AssetConnectionType.GREENCOM:
              assetIntegrationImpl = new GreencomAssetIntegration(tenant, settings.asset, foundConnection);
              break;
            case AssetConnectionType.IOTHINK:
              assetIntegrationImpl = new IothinkAssetIntegration(tenant, settings.asset, foundConnection);
              break;
            case AssetConnectionType.WIT:
              assetIntegrationImpl = new WitAssetIntegration(tenant, settings.asset, foundConnection);
              break;
            case AssetConnectionType.LACROIX:
              assetIntegrationImpl = new LacroixAssetIntegration(tenant, settings.asset, foundConnection);
              break;
          }
          return assetIntegrationImpl;
        }
      }
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.ASSET,
        module: MODULE_NAME, method: 'getAssetImpl',
        message: 'Asset settings are not configured'
      });
    }
    return null;
  }
}

