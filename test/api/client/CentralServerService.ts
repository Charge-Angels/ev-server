import { PricingSettingsType, SettingDB } from '../../../src/types/Setting';
import chai, { expect } from 'chai';

import AssetApi from './AssetApi';
import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import AuthenticationApi from './AuthenticationApi';
import BaseApi from './utils/BaseApi';
import BillingApi from './BillingApi';
import CarApi from './CarApi';
import ChargingStationApi from './ChargingStationApi';
import CompanyApi from './CompanyApi';
import ContextDefinition from '../context/ContextDefinition';
import { HTTPError } from '../../../src/types/HTTPError';
import LogsApi from './LogsApi';
import MailApi from './MailApi';
import OCPIEndpointApi from './OCPIEndpointApi';
import RegistrationTokenApi from './RegistrationTokenApi';
import SettingApi from './SettingApi';
import SiteApi from './SiteApi';
import SiteAreaApi from './SiteAreaApi';
import SmartChargingApi from './SmartChargingApi';
import StatisticsApi from './StatisticsApi';
import { StatusCodes } from 'http-status-codes';
import TenantApi from './TenantApi';
import TenantComponents from '../../../src/types/TenantComponents';
import TestConstants from './utils/TestConstants';
import TransactionApi from './TransactionApi';
import User from '../../../src/types/User';
import UserApi from './UserApi';
import chaiSubset from 'chai-subset';
import config from '../../config';

// Set
chai.use(chaiSubset);

export default class CentralServerService {

  private static _defaultInstance = new CentralServerService();
  public authenticatedApi: AuthenticatedBaseApi;
  public assetApi: AssetApi;
  public carApi: CarApi;
  public carApiSuperTenant: CarApi;
  public companyApi: CompanyApi;
  public siteApi: SiteApi;
  public siteAreaApi: SiteAreaApi;
  public userApi: UserApi;
  public chargingStationApi: ChargingStationApi;
  public registrationApi: RegistrationTokenApi;
  public transactionApi: TransactionApi;
  public settingApi: SettingApi;
  public ocpiEndpointApi: OCPIEndpointApi;
  public authenticatedSuperAdminApi: AuthenticatedBaseApi;
  public authenticationApi: AuthenticationApi;
  public tenantApi: TenantApi;
  public mailApi: MailApi;
  public logsApi: LogsApi;
  public statisticsApi: StatisticsApi;
  public billingApi: BillingApi;
  public smartChargingApi: SmartChargingApi;
  public _baseApi: BaseApi;
  private _baseURL: string;
  private _authenticatedUser: any;
  private _authenticatedSuperAdmin: any;

  public constructor(tenantSubdomain = null, user: Partial<User> = null, superAdminUser: Partial<User> = null) {
    this._baseURL = `${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`;
    // Create the Base API
    this._baseApi = new BaseApi(this._baseURL);
    if (user) {
      this._authenticatedUser = user;
    } else {
      this._authenticatedUser = {
        email: config.get('admin.username'),
        password: config.get('admin.password')
      };
    }
    if (superAdminUser) {
      this._authenticatedSuperAdmin = superAdminUser;
    } else {
      this._authenticatedSuperAdmin = {
        email: config.get('superadmin.username'),
        password: config.get('superadmin.password')
      };
    }
    // Create the Authenticated API
    if (!tenantSubdomain && tenantSubdomain !== '') {
      this.authenticatedApi = new AuthenticatedBaseApi(this._baseURL, this._authenticatedUser.email, this._authenticatedUser.password, ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
    } else {
      this.authenticatedApi = new AuthenticatedBaseApi(this._baseURL, this._authenticatedUser.email, this._authenticatedUser.password, tenantSubdomain);
    }
    this.authenticatedSuperAdminApi = new AuthenticatedBaseApi(this._baseURL, this._authenticatedSuperAdmin.email, this._authenticatedSuperAdmin.password, '');
    // Create the Company
    this.companyApi = new CompanyApi(this.authenticatedApi);
    this.siteApi = new SiteApi(this.authenticatedApi);
    this.siteAreaApi = new SiteAreaApi(this.authenticatedApi);
    this.userApi = new UserApi(this.authenticatedApi);
    this.chargingStationApi = new ChargingStationApi(this.authenticatedApi);
    this.transactionApi = new TransactionApi(this.authenticatedApi);
    this.settingApi = new SettingApi(this.authenticatedApi);
    this.logsApi = new LogsApi(this.authenticatedApi);
    this.ocpiEndpointApi = new OCPIEndpointApi(this.authenticatedApi);
    this.authenticationApi = new AuthenticationApi(this._baseApi);
    this.tenantApi = new TenantApi(this.authenticatedSuperAdminApi, this._baseApi);
    this.mailApi = new MailApi(new BaseApi(`http://${config.get('mailServer.host')}:${config.get('mailServer.port')}`));
    this.statisticsApi = new StatisticsApi(this.authenticatedApi);
    this.registrationApi = new RegistrationTokenApi(this.authenticatedApi);
    this.billingApi = new BillingApi(this.authenticatedApi);
    this.assetApi = new AssetApi(this.authenticatedApi);
    this.carApi = new CarApi(this.authenticatedApi);
    this.smartChargingApi = new SmartChargingApi(this.authenticatedApi);
    this.carApiSuperTenant = new CarApi(this.authenticatedSuperAdminApi);
  }

  public static get defaultInstance(): CentralServerService {
    if (CentralServerService._defaultInstance) {
      return CentralServerService._defaultInstance;
    }
    CentralServerService._defaultInstance = new CentralServerService();
    return CentralServerService._defaultInstance;
  }

  public getAuthenticatedUserEmail() {
    return this._authenticatedUser.email;
  }

  public async updatePriceSetting(pricekWh, priceUnit) {
    const settings = await this.settingApi.readAll({});
    let newSetting = false;
    let setting: SettingDB = settings.data.result.find((s) => s.identifier === 'pricing');
    if (!setting) {
      setting = {} as SettingDB;
      setting.identifier = TenantComponents.PRICING;
      newSetting = true;
    }
    setting.content = {
      type: PricingSettingsType.SIMPLE,
      simple: {
        price: pricekWh,
        currency: priceUnit
      }
    };
    if (newSetting) {
      return this.settingApi.create(setting);
    }
    return this.settingApi.update(setting);
  }

  public async createEntity(entityApi, entity, performCheck = true) {
    // Create
    const response = await entityApi.create(entity);
    // Check
    if (performCheck) {
      expect(response.status).to.equal(StatusCodes.OK);
      expect(response.data).not.null;
      expect(response.data.status).to.eql('Success');
      expect(response.data).to.have.property('id');
      expect(response.data.id).to.match(/^[a-f0-9]+$/);
      // Set the id
      entity.id = response.data.id;
      return entity;
    }
    // Let the caller to handle response
    return response;
  }

  public async getEntityById(entityApi, entity, performCheck = true) {
    // Check first if created
    expect(entity).to.not.be.null;
    // Retrieve it from the backend
    const response = await entityApi.readById(entity.id);

    // Check
    if (performCheck) {
      // Check if ok
      expect(response.status).to.equal(StatusCodes.OK);
      expect(response.data.id).is.eql(entity.id);
      expect(response.data).to.containSubset(entity);
      // Return the entity
      return response.data;
    }
    // Let the caller to handle response
    return response;
  }

  public async checkEntityInList(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Retrieve from the backend
    const response = await entityApi.readAll({}, {
      limit: TestConstants.UNLIMITED,
      skip: 0
    });
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(StatusCodes.OK);
      // Contains props
      expect(response.data).to.have.property('count');
      expect(response.data).to.have.property('result');
      // All record retrieved
      expect(response.data.count).to.eql(response.data.result.length);
      // Check created entity
      delete entity.locale;
      expect(response.data.result).to.containSubset([{ id: entity.id }]);
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  public async checkEntityInListWithParams(entityApi, entity, params = {}, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Retrieve from the backend
    const response = await entityApi.readAll(params, {
      limit: TestConstants.UNLIMITED,
      skip: 0
    });
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(StatusCodes.OK);
      // Contains props
      expect(response.data).to.have.property('count');
      expect(response.data).to.have.property('result');
      // All record retrieved
      expect(response.data.count).to.eql(response.data.result.length);
      // Check created company
      expect(response.data.result).to.containSubset([entity]);
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  public async deleteEntity(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Delete it in the backend
    const response = await entityApi.delete(entity.id);
    // Check
    if (performCheck) {
      expect(response.status).to.equal(StatusCodes.OK);
      expect(response.data.status).to.eql('Success');
      return response;
    }
    // Let the caller to handle response
    return response;

  }

  public async updateEntity(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Delete it in the backend
    const response = await entityApi.update(entity);
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(StatusCodes.OK);
      expect(response.data.status).to.eql('Success');
      return response;
    }
    // Let the caller to handle response
    return response;
  }

  public async checkDeletedEntityById(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Create it in the backend
    const response = await entityApi.readById(entity.id);
    // Check
    if (performCheck) {
      // Check if not found
      expect(response.status).to.equal(HTTPError.OBJECT_DOES_NOT_EXIST_ERROR);
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  public async revokeEntity(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Delete it in the backend
    const response = await entityApi.revoke(entity.id);
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(StatusCodes.OK);
      expect(response.data.status).to.eql('Success');
      return response;
    }
    // Let the caller to handle response
    return response;
  }

  public async reconnect() {
    await this.authenticatedApi.authenticate(true);
  }
}

const DefaultCentralServerService = CentralServerService.defaultInstance;
