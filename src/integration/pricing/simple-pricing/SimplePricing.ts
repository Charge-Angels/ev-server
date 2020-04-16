import Pricing from '../Pricing';
import Transaction from '../../../types/Transaction';
import Consumption from '../../../types/Consumption';
import { SimplePricingSetting } from '../../../types/Setting';
import { PricedConsumption } from '../../../types/Pricing';
import Utils from '../../../utils/Utils';

export default class SimplePricing extends Pricing<SimplePricingSetting> {
  constructor(tenantID: string, readonly settings: SimplePricingSetting, transaction: Transaction) {
    super(tenantID, settings, transaction);
  }

  async startSession(consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(consumptionData);
  }

  async updateSession(consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(consumptionData);
  }

  async stopSession(consumptionData: Consumption): Promise<PricedConsumption> {
    return this.computePrice(consumptionData);
  }

  async computePrice(consumptionData: Consumption): Promise<PricedConsumption> {
    let amount: number;
    let roundedAmount: number;
    if (consumptionData.consumption && typeof consumptionData.consumption === 'number') {
      amount = Utils.convertToFloat((this.settings.price * (consumptionData.consumption / 1000)).toFixed(6));
      roundedAmount = Utils.convertToFloat((this.settings.price * (consumptionData.consumption / 1000)).toFixed(2));
    } else {
      amount = 0;
      roundedAmount = 0;
    }
    const pricedConsumption: PricedConsumption = {
      pricingSource: 'simple',
      amount: amount,
      roundedAmount: roundedAmount,
      currencyCode: this.settings.currency,
      cumulatedAmount: 0
    };
    return pricedConsumption;
  }
}
