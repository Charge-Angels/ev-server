import { PricingSetting, PricingSettingsType } from '../../types/Setting';
import ConvergentChargingPricing from './ConvergentChargingPricingMod';
import Pricing from './Pricing';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import SimplePricing from '../pricing/simple-pricing/SimplePricing';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';

export default class PricingFactory {
  static async getPricingImpl(tenantID: string, transaction: Transaction): Promise<Pricing<PricingSetting>> {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if the pricing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.PRICING)) {
      // Get the pricing's settings
      const pricingSetting = await SettingStorage.getPricingSettings(tenantID);
      // Check
      if (pricingSetting) {
        // SAP Convergent Charging
        if (pricingSetting.type === PricingSettingsType.CONVERGENT_CHARGING) {
          // Return the CC implementation
          return new ConvergentChargingPricing(tenantID, pricingSetting.convergentCharging, transaction);
        // Simple Pricing
        } else if (pricingSetting.type === PricingSettingsType.SIMPLE) {
          // Return the Simple Pricing implementation
          return new SimplePricing(tenantID, pricingSetting.simple, transaction);
        }
      }
    }
    // Pricing is not active
    return null;
  }
}

