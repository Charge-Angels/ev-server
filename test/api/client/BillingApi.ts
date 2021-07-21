import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { ServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class BillingApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async testConnection(params?, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.readAll(params, paging, ordering, '/client/api/CheckBillingConnection');
  }

  public async synchronizeUsers(params?, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return await super.create(params, '/client/api/BillingSynchronizeUsers');
  }

  public async synchronizeUser(params?) {
    return await super.create(params, '/client/api/BillingSynchronizeUser');
  }

  public async forceSynchronizeUser(params?) {
    return await super.create(params, '/client/api/BillingForceSynchronizeUser');
  }

  public async synchronizeInvoices(params?) {
    return await super.create(params, '/client/api/BillingSynchronizeInvoices');
  }

  public async downloadInvoiceDocument(params?) {
    return await super.read(params, super.buildRestEndpointUrl(1, ServerRoute.REST_BILLING_DOWNLOAD_INVOICE, params));
  }

  public async getBillingSetting(params?) {
    return await super.read(params, super.buildRestEndpointUrl(1, ServerRoute.REST_BILLING_SETTING, params));
  }

  public async checkBillingConnection(params?) {
    return await super.create(params, super.buildRestEndpointUrl(1, ServerRoute.REST_BILLING_CHECK, params));
  }

  public async clearBillingTestData(params?) {
    return await super.create(params, super.buildRestEndpointUrl(1, ServerRoute.REST_BILLING_CLEAR_TEST_DATA, params));
  }

  public async updateBillingSetting(params?) {
    return await super.update(params, super.buildRestEndpointUrl(1, ServerRoute.REST_BILLING_SETTING, params));
  }

  public async readInvoices(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, super.buildRestEndpointUrl(1, ServerRoute.REST_BILLING_INVOICES, params));
  }
}
