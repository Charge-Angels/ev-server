import Ajv from 'ajv';
import AppError from '../../exception/AppError';
import Constants from '../../utils/Constants';
import { HTTPError } from '../../types/HTTPError';
import Schema from '../../types/validator/Schema';
import ajvSanitizer from 'ajv-sanitizer';
import fs from 'fs';
import global from '../../types/GlobalType';
import sanitize from 'mongo-sanitize';

const extraSanitizers = {
  mongo: (value) => sanitize(value),
};

export default class SchemaValidator {
  private readonly ajv: Ajv.Ajv;
  private commonSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/common/common.json`, 'utf8'));
  private tenantSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant.json`, 'utf8'));
  private tenantComponentSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-components.json`, 'utf8'));
  private chargingStationSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation.json`, 'utf8'));
  private tagSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag.json`, 'utf8'));
  private transactionSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction.json`, 'utf8'));
  private userSchema: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user.json`, 'utf8'));

  constructor(readonly moduleName: string,
      config: {
        allErrors: boolean; removeAdditional: boolean | 'all' | 'failing' | undefined;
        useDefaults: boolean; coerceTypes: boolean;
      } = {
        allErrors: true,
        removeAdditional: 'all',
        useDefaults: true,
        coerceTypes: true
      }) {
    this.ajv = ajvSanitizer(new Ajv(config), extraSanitizers);
    this.ajv.addFormat('latitude', {
      type: 'number',
      validate: (c) => Constants.REGEX_VALIDATION_LATITUDE.test(c.toString())
    });
    this.ajv.addFormat('longitude', {
      type: 'number',
      validate: (c) => Constants.REGEX_VALIDATION_LONGITUDE.test(c.toString())
    });
    this.ajv.addSchema(this.commonSchema);
    this.ajv.addSchema(this.tenantSchema);
    this.ajv.addSchema(this.tenantComponentSchema);
    this.ajv.addSchema(this.chargingStationSchema);
    this.ajv.addSchema(this.tagSchema);
    this.ajv.addSchema(this.transactionSchema);
    this.ajv.addSchema(this.userSchema);
  }

  public validate(schema: Schema, content: any): void {
    const fnValidate = this.ajv.compile(schema);
    if (!fnValidate(content)) {
      if (!fnValidate.errors) {
        fnValidate.errors = [];
      }
      const errors = fnValidate.errors.map((error) => ({
        path: error.dataPath,
        message: error.message ? error.message : ''
      }));
      const concatenatedErrors: string[] = [];
      for (const error of errors) {
        if (error.path && error.path !== '') {
          concatenatedErrors.push(`Property '${error.path}': ${error.message}`);
        } else {
          concatenatedErrors.push(`Error: ${error.message}`);
        }
      }
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: concatenatedErrors.join(', '),
        module: this.moduleName,
        method: 'validate',
        detailedMessages: { errors, content, schema }
      });
    }
  }
}
