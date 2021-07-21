import Consumption from '../../../../types/Consumption';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class AssetValidator extends SchemaValidator {
  private static instance: AssetValidator|null = null;
  private createAssetConsumption: Schema;

  private constructor() {
    super('AssetValidator');
    this.createAssetConsumption = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/asset/create-asset-consumption.json`, 'utf8'));
  }

  public static getInstance(): AssetValidator {
    if (!AssetValidator.instance) {
      AssetValidator.instance = new AssetValidator();
    }
    return AssetValidator.instance;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public validateCreateAssetConsumption(data: any): Consumption {
    // Validate schema
    this.validate(this.createAssetConsumption, data);
    return data;
  }
}
