import { BillingSettings } from '../../../../types/Setting';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class BillingValidator extends SchemaValidator {
  private static instance: BillingValidator|null = null;
  private updateBillingSetting: Schema;

  private constructor() {
    super('BillingValidator');
    this.updateBillingSetting = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/billing/billing-setting-update.json`, 'utf8'));
  }

  public static getInstance(): BillingValidator {
    if (!BillingValidator.instance) {
      BillingValidator.instance = new BillingValidator();
    }
    return BillingValidator.instance;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public validateUpdateBillingSetting(data: any): BillingSettings {
    // Validate schema
    this.validate(this.updateBillingSetting, data);
    return data;
  }
}
