import { HttpTenantLogoRequest, HttpTenantRequest, HttpTenantsRequest } from '../../../../types/requests/v1/HttpTenantRequest';

import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../SchemaValidator';
import Tenant from '../../../../types/Tenant';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TenantValidator extends SchemaValidator {
  private static instance: TenantValidator|null = null;
  private tenantCreateReqSuperAdmin: Schema;
  private tenantUpdateReqSuperAdmin: Schema;
  private tenantDeleteReqSuperAdmin: Schema;
  private tenantGetLogoReqSuperAdmin: Schema;
  private tenantGetReqSuperAdmin: Schema;
  private tenantsGetReqSuperAdmin: Schema;

  private constructor() {
    super('TenantValidator');
    this.tenantCreateReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-create.json`, 'utf8'));
    this.tenantUpdateReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-update.json`, 'utf8'));
    this.tenantDeleteReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-delete.json`, 'utf8'));
    this.tenantGetReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-get.json`, 'utf8'));
    this.tenantsGetReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenants-get.json`, 'utf8'));
    this.tenantGetLogoReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-get-logo.json`, 'utf8'));
  }

  public static getInstance(): TenantValidator {
    if (!TenantValidator.instance) {
      TenantValidator.instance = new TenantValidator();
    }
    return TenantValidator.instance;
  }

  public validateTenantCreateRequestSuperAdmin(tenant: Tenant): Tenant {
    // Validate schema
    this.validate(this.tenantCreateReqSuperAdmin, tenant);
    // Validate deps between components
    this.validateComponentDependencies(tenant);
    return tenant;
  }

  public validateTenantUpdateRequestSuperAdmin(tenant: Tenant): Tenant {
    // Validate schema
    this.validate(this.tenantUpdateReqSuperAdmin, tenant);
    // Validate deps between components
    this.validateComponentDependencies(tenant);
    return tenant;
  }

  public validateTenantDeleteRequestSuperAdmin(data: any): string {
    // Validate schema
    this.validate(this.tenantDeleteReqSuperAdmin, data);
    return data.ID;
  }

  public validateGetLogoReqSuperAdmin(data: HttpTenantLogoRequest): HttpTenantLogoRequest {
    // Validate schema
    this.validate(this.tenantGetLogoReqSuperAdmin, data);
    return data;
  }

  public validateTenantGetReqSuperAdmin(data: any): HttpTenantRequest {
    // Validate schema
    this.validate(this.tenantGetReqSuperAdmin, data);
    return data;
  }

  public validateTenantsGetReqSuperAdmin(data: any): HttpTenantsRequest {
    // Validate schema
    this.validate(this.tenantsGetReqSuperAdmin, data);
    return data;
  }

  private validateComponentDependencies(tenant: Tenant): void {
    if (tenant.components) {
      // Both OICP and OCPI cannot be active
      if (tenant.components.oicp && tenant.components.ocpi &&
          tenant.components.oicp.active && tenant.components.ocpi.active) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Both OICP and OCPI roaming components cannot be active',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
      // Smart Charging active: Organization must be active
      if (tenant.components.smartCharging && tenant.components.organization &&
          tenant.components.smartCharging.active && !tenant.components.organization.active) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Organization must be active to use the Smart Charging component',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
      // Asset active: Organization must be active
      if (tenant.components.asset && tenant.components.organization &&
        tenant.components.asset.active && !tenant.components.organization.active) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Organization must be active to use the Asset component',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
      // Car Connector active: Car must be active
      if (tenant.components.carConnector && tenant.components.car &&
        tenant.components.carConnector.active && !tenant.components.car.active) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Car must be active to use the Car Connector component',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
      // Billing active: Pricing must be active
      if (tenant.components.billing && tenant.components.pricing &&
          tenant.components.billing.active && !tenant.components.pricing.active) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Pricing must be active to use the Billing component',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
      // Refund active: Pricing must be active
      if (tenant.components.refund && tenant.components.pricing &&
          tenant.components.refund.active && !tenant.components.pricing.active) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Pricing must be active to use the Refund component',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
    }
  }
}
