import AccessControl from 'role-acl';
import BackendError from '../exception/BackendError';
import TenantComponents from '../types/TenantComponents';
import Constants from '../utils/Constants';

const GRANTS = {
  superAdmin: {
    grants: [
      { resource: 'Users', action: 'List', attributes: ['*'] },
      { resource: 'User', action: ['Create', 'Read', 'Update'], attributes: ['*'] },
      {
        resource: 'User', action: 'Delete', attributes: ['*'],
        condition: { Fn: 'NOT_EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: 'Loggings', action: 'List', attributes: ['*'] },
      { resource: 'Logging', action: 'Read', attributes: ['*'] },
      { resource: 'Tenants', action: 'List', attributes: ['*'] },
      { resource: 'Tenant', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'Cars', action: 'List', attributes: ['*'] },
      { resource: 'Cars', action: 'SynchronizeCars', attributes: ['*'] },
      { resource: 'Car', action: 'Read', attributes: ['*'] },
    ]
  },
  admin: {
    grants: [
      { resource: 'Users', action: 'List', attributes: ['*'] },
      { resource: 'User', action: ['Create', 'Read', 'Update'], attributes: ['*'] },
      {
        resource: 'User', action: 'Delete', attributes: ['*'],
        condition: { Fn: 'NOT_EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: 'Companies', action: 'List', attributes: ['*'] },
      { resource: 'Company', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'Sites', action: 'List', attributes: ['*'] },
      { resource: 'Site', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'SiteAreas', action: 'List', attributes: ['*'] },
      { resource: 'SiteArea', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'ChargingStations', action: 'List', attributes: ['*'] },
      {
        resource: 'ChargingStation', action: ['Create', 'Read', 'Update', 'Delete',
          'Reset', 'ClearCache', 'GetConfiguration', 'ChangeConfiguration',
          'RemoteStartTransaction', 'RemoteStopTransaction', 'UnlockConnector',
          'Authorize', 'SetChargingProfile', 'GetCompositeSchedule', 'ClearChargingProfile',
          'GetDiagnostics', 'UpdateFirmware', 'ExportParams', 'ChangeAvailability'], attributes: ['*']
      },
      { resource: 'Transactions', action: 'List', attributes: ['*'] },
      {
        resource: 'Transaction',
        action: ['Read', 'Update', 'Delete'],
        attributes: ['*']
      },
      {
        resource: 'Report', action: ['Read'], attributes: ['*']
      },
      { resource: 'Loggings', action: 'List', attributes: ['*'] },
      { resource: 'Logging', action: 'Read', attributes: ['*'] },
      { resource: 'Pricing', action: ['Read', 'Update'], attributes: ['*'] },
      {
        resource: 'Billing',
        action: ['BillingCheckConnection', 'BillingSynchronizeUsers', 'BillingForceSynchronizeUser']
      },
      { resource: 'Taxes', action: ['List'], attributes: ['*'] },
      { resource: 'Invoices', action: ['List'], attributes: ['*'] },
      { resource: 'Asset', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'Assets', action: 'List', attributes: ['*'] },
      { resource: 'Settings', action: 'List', attributes: ['*'] },
      { resource: 'Setting', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'Tokens', action: 'List', attributes: ['*'] },
      { resource: 'Token', action: ['Create', 'Read', 'Update', 'Delete'], attributes: ['*'] },
      { resource: 'OcpiEndpoints', action: 'List', attributes: ['*'] },
      {
        resource: 'OcpiEndpoint',
        action: ['Create', 'Read', 'Update', 'Delete', 'Ping', 'GenerateLocalToken', 'Register', 'TriggerJob'],
        attributes: ['*']
      },
      { resource: 'Connections', action: 'List', attributes: ['*'] },
      { resource: 'Connection', action: ['Create', 'Read', 'Delete'], attributes: ['*'] },
      { resource: 'Cars', action: 'List', attributes: ['*'] },
      { resource: 'Car', action: 'Read', attributes: ['*'] }

    ]
  },
  basic: {
    grants: [
      {
        resource: 'User', action: ['Read', 'Update'], attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
      { resource: 'Assets', action: 'List', attributes: ['*'] },
      { resource: 'Asset', action: 'Read', attributes: ['*'] },
      { resource: 'Companies', action: 'List', attributes: ['*'] },
      {
        resource: 'Company', action: 'Read', attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'companies': '$.company' } }
      },
      { resource: 'Invoices', action: ['List'], attributes: ['*'] },
      { resource: 'Invoice', action: ['Download'], attributes: ['*'] },
      { resource: 'Sites', action: 'List', attributes: ['*'] },
      {
        resource: 'Site', action: 'Read', attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      { resource: 'SiteAreas', action: 'List', attributes: ['*'] },
      {
        resource: 'SiteArea', action: 'Read', attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      { resource: 'ChargingStations', action: 'List', attributes: ['*'] },
      {
        resource: 'ChargingStation',
        action: ['Read', 'UnlockConnector'],
        attributes: ['*']
      },
      {
        resource: 'ChargingStation',
        action: ['RemoteStartTransaction', 'Authorize'],
        attributes: ['*'],
        condition: {
          Fn: 'OR',
          args: [
            {
              Fn: 'EQUALS',
              args: { 'site': null }
            },
            {
              Fn: 'LIST_CONTAINS',
              args: {
                'sites': '$.site'
              }
            }
          ]
        }
      },
      {
        resource: 'ChargingStation',
        action: 'RemoteStopTransaction',
        attributes: ['*'],
        condition: {
          Fn: 'OR',
          args: [
            {
              Fn: 'EQUALS',
              args: { 'user': '$.owner' }
            },
            {
              Fn: 'LIST_CONTAINS',
              args: {
                'tagIDs': '$.tagID'
              }
            }
          ]
        }
      },
      { resource: 'Transactions', action: 'List', attributes: ['*'] },
      {
        resource: 'Transaction', action: ['Read'], attributes: ['*'],
        condition: {
          Fn: 'OR',
          args: [
            {
              Fn: 'EQUALS',
              args: { 'user': '$.owner' }
            },
            {
              Fn: 'LIST_CONTAINS',
              args: {
                'tagIDs': '$.tagID'
              }
            }
          ]
        }
      },
      { resource: 'Settings', action: 'List', attributes: ['*'] },
      { resource: 'Setting', action: 'Read', attributes: ['*'] },
      { resource: 'Connections', action: 'List', attributes: ['*'] },
      { resource: 'Connection', action: ['Create'], attributes: ['*'] },
      {
        resource: 'Connection', action: ['Read', 'Delete'], attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'user': '$.owner' } }
      },
    ]
  },
  demo: {
    grants: [
      { resource: 'User', action: 'Read', attributes: ['*'] },
      { resource: 'Assets', action: 'List', attributes: ['*'] },
      { resource: 'Asset', action: 'Read', attributes: ['*'] },
      { resource: 'Companies', action: 'List', attributes: ['*'] },
      { resource: 'Company', action: 'Read', attributes: ['*'] },
      { resource: 'Sites', action: 'List', attributes: ['*'] },
      { resource: 'Site', action: 'Read', attributes: ['*'] },
      { resource: 'SiteAreas', action: 'List', attributes: ['*'] },
      { resource: 'SiteArea', action: 'Read', attributes: ['*'] },
      { resource: 'ChargingStations', action: 'List', attributes: ['*'] },
      { resource: 'ChargingStation', action: 'Read', attributes: ['*'] },
      { resource: 'Transactions', action: 'List', attributes: ['*'] },
      {
        resource: 'Transaction', action: 'Read', attributes: ['*'],
        condition: {
          Fn: 'OR',
          args: [
            {
              Fn: 'EQUALS',
              args: { 'site': null }
            },
            {
              Fn: 'LIST_CONTAINS',
              args: {
                'sites': '$.site'
              }
            }
          ]
        }
      },
      { resource: 'Settings', action: 'List', attributes: ['*'] },
      {
        resource: 'Setting', action: 'Read', attributes: ['*'],
        condition: { Fn: 'EQUALS', args: { 'identifier': TenantComponents.ANALYTICS } }
      },
    ]
  },
  siteAdmin: {
    '$extend': {
      'basic': {}
    },
    grants: [
      { resource: 'Users', action: 'List', attributes: ['*'] },
      { resource: 'User', action: ['Read'], attributes: ['*'] },
      {
        resource: 'Site', action: ['Update'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesAdmin': '$.site' } }
      },
      {
        resource: 'SiteArea', action: ['Create', 'Update', 'Delete'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sites': '$.site' } }
      },
      {
        resource: 'ChargingStation',
        action: ['Update', 'Delete',
          'Reset', 'ClearCache', 'GetConfiguration', 'ChangeConfiguration',
          'SetChargingProfile', 'GetCompositeSchedule', 'ClearChargingProfile',
          'GetDiagnostics', 'UpdateFirmware', 'RemoteStopTransaction', 'ExportParams', 'ChangeAvailability'],
        attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesAdmin': '$.site' } }
      },
      {
        resource: 'Transaction', action: ['Read'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesAdmin': '$.site' } }
      },
      {
        resource: 'Report', action: ['Read'], attributes: ['*']
      },
      { resource: 'Loggings', action: 'List', attributes: ['*'] },
      { resource: 'Logging', action: 'Read', attributes: ['*'], args: { 'sites': '$.site' } },
      { resource: 'Tokens', action: 'List', attributes: ['*'] },
      {
        resource: 'Token',
        action: ['Create', 'Read'],
        attributes: ['*'],
        args: { 'sites': '$.site' }
      },
    ]
  },
  siteOwner: {
    '$extend': {
      'basic': {}
    },
    grants: [
      { resource: 'Users', action: 'List', attributes: ['*'] },
      { resource: 'User', action: ['Read'], attributes: ['*'] },
      {
        resource: 'Site', action: ['Update'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesOwner': '$.site' } }
      },
      {
        resource: 'Transaction', action: ['Read', 'RefundTransaction'], attributes: ['*'],
        condition: { Fn: 'LIST_CONTAINS', args: { 'sitesOwner': '$.site' } }
      },
      {
        resource: 'Report', action: ['Read'], attributes: ['*']
      },
    ]
  },
};

export default class AuthorizationsDefinition {

  private static _instance: AuthorizationsDefinition;
  private accessControl: AccessControl;

  private constructor() {
    try {
      this.accessControl = new AccessControl(GRANTS);
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'AuthorizationsDefinition',
        method: 'getScopes',
        message: 'Unable to load authorization grants',
        detailedMessages: { error }
      });
    }
  }

  public static getInstance(): AuthorizationsDefinition {
    if (!AuthorizationsDefinition._instance) {
      AuthorizationsDefinition._instance = new AuthorizationsDefinition();
    }
    return AuthorizationsDefinition._instance;
  }

  public getScopes(groups: ReadonlyArray<string>): ReadonlyArray<string> {
    const scopes = [];
    try {
      this.accessControl.allowedResources({ role: groups }).forEach(
        (resource: string): void => {
          this.accessControl.allowedActions({ role: groups, resource: resource }).forEach(
            (action: string): number => scopes.push(`${resource}:${action}`)
          );
        }
      );
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'AuthorizationsDefinition',
        method: 'getScopes',
        message: 'Unable to load available scopes',
        detailedMessages: { error }
      });
    }
    return scopes;
  }

  public can(role: ReadonlyArray<string>, resource: string, action: string, context?): boolean {
    try {
      const permission = this.accessControl.can(role).execute(action).with(context).on(resource);
      return permission.granted;
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'AuthorizationsDefinition',
        method: 'can',
        message: 'Unable to check authorization',
        detailedMessages: { error }
      });
    }
  }
}
