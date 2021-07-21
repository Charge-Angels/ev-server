import { HttpBillingInvoiceRequest, HttpBillingRequest, HttpBillingWebHookRequest, HttpDeletePaymentMethod, HttpPaymentMethods, HttpSetupPaymentMethod } from '../../../../../types/requests/v1/HttpBillingRequest';
import { HttpCreateTransactionInvoiceRequest, HttpForceSynchronizeUserInvoicesRequest, HttpSynchronizeUserRequest } from '../../../../../types/requests/v1/HttpUserRequest';

import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class BillingSecurity {
  static filterSynchronizeUserRequest(requestBody: any): HttpSynchronizeUserRequest {
    const filteredUser: HttpSynchronizeUserRequest = {} as HttpSynchronizeUserRequest;
    if (Utils.objectHasProperty(requestBody, 'id')) {
      filteredUser.id = sanitize(requestBody.id);
    }
    if (Utils.objectHasProperty(requestBody, 'email')) {
      filteredUser.email = sanitize(requestBody.email);
    }
    return filteredUser;
  }

  static filterGetInvoicesRequest(requestQuery: any): HttpBillingInvoiceRequest {
    const filteredRequest = {} as HttpBillingInvoiceRequest;
    if (Utils.objectHasProperty(requestQuery, 'UserID')) {
      filteredRequest.UserID = sanitize(requestQuery.UserID);
    }
    if (Utils.objectHasProperty(requestQuery, 'Status')) {
      filteredRequest.Status = sanitize(requestQuery.Status);
    }
    if (Utils.objectHasProperty(requestQuery, 'StartDateTime')) {
      filteredRequest.StartDateTime = sanitize(requestQuery.StartDateTime);
    }
    if (Utils.objectHasProperty(requestQuery, 'EndDateTime')) {
      filteredRequest.EndDateTime = sanitize(requestQuery.EndDateTime);
    }
    if (Utils.objectHasProperty(requestQuery, 'Search')) {
      filteredRequest.Search = sanitize(requestQuery.Search);
    }
    UtilsSecurity.filterSkipAndLimit(requestQuery, filteredRequest);
    UtilsSecurity.filterSort(requestQuery, filteredRequest);
    return filteredRequest;
  }

  static filterGetInvoiceRequest(requestQuery: any): HttpBillingInvoiceRequest {
    return {
      ID: sanitize(requestQuery.ID)
    } as HttpBillingInvoiceRequest;
  }

  static filterForceSynchronizeUserInvoicesRequest(requestBody: any): HttpForceSynchronizeUserInvoicesRequest {
    return {
      userID: sanitize(requestBody.userID)
    };
  }

  static filterLinkTransactionToInvoiceRequest(requestBody: any): HttpCreateTransactionInvoiceRequest {
    return {
      transactionID: sanitize(requestBody.transactionID)
    };
  }

  static filterDownloadInvoiceRequest(requestQuery: any): HttpBillingRequest {
    return {
      ID: sanitize(requestQuery.ID)
    };
  }

  static filterBillingWebHookRequest(requestQuery: any): HttpBillingWebHookRequest {
    return {
      tenantID: sanitize(requestQuery.TenantID)
    };
  }

  static filterSetupPaymentMethodRequest(requestBody: any): HttpSetupPaymentMethod {
    return {
      userID: sanitize(requestBody.userID),
      paymentMethodId: sanitize(requestBody.paymentMethodId),
    };
  }

  static filterPaymentMethodsRequest(requestQuery: any): HttpPaymentMethods {
    const filteredRequest: HttpPaymentMethods = {
      userID: sanitize(requestQuery.userID)
    };
    UtilsSecurity.filterSkipAndLimit(requestQuery, filteredRequest);
    return filteredRequest;
  }

  static filterDeletePaymentMethodRequest(requestBody: any): HttpDeletePaymentMethod {
    return {
      userID: sanitize(requestBody.userID),
      paymentMethodId: sanitize(requestBody.paymentMethodId),
    };
  }
}
