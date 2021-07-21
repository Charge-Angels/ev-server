import { HttpAssignTransactionsToUserRequest, HttpConsumptionFromTransactionRequest, HttpPushTransactionCdrRequest, HttpTransactionRequest, HttpTransactionsRefundRequest, HttpTransactionsRequest, HttpUnassignTransactionsToUserRequest } from '../../../../../types/requests/v1/HttpTransactionRequest';

import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class TransactionSecurity {
  public static filterTransactionsRefund(request: any): HttpTransactionsRefundRequest {
    if (!Utils.objectHasProperty(request, 'transactionIds') || Utils.isEmptyArray(request.transactionIds)) {
      return { transactionIds: [] };
    }
    return { transactionIds:  request.transactionIds.map(sanitize) };
  }

  public static filterAssignTransactionsToUser(request: any): HttpAssignTransactionsToUserRequest {
    return {
      TagID: sanitize(request.TagID),
      UserID: sanitize(request.UserID),
    };
  }

  static filterUnassignedTransactionsCountRequest(request: any): HttpUnassignTransactionsToUserRequest {
    return {
      TagID: sanitize(request.TagID),
    };
  }

  public static filterTransactionRequestByID(request: any): number {
    return Utils.convertToInt(sanitize(request.ID));
  }

  public static filterTransactionRequestByIDs(request: any): number[] {
    return request.transactionsIDs.map(sanitize);
  }

  public static filterTransactionSoftStop(request: any): number {
    return Utils.convertToInt(sanitize(request.ID));
  }

  public static filterTransactionRequest(request: any): HttpTransactionRequest {
    return {
      ID: Utils.convertToInt(sanitize(request.ID)),
      WithCar: UtilsSecurity.filterBoolean(request.WithCar),
      WithTag: UtilsSecurity.filterBoolean(request.WithTag),
      WithUser: UtilsSecurity.filterBoolean(request.WithUser),
    };
  }

  public static filterPushTransactionCdrRequest(request: any): HttpPushTransactionCdrRequest {
    return {
      transactionId: Utils.convertToInt(sanitize(request.transactionId))
    };
  }

  public static filterTransactionsRequest(request: any): HttpTransactionsRequest {
    const filteredRequest = {} as HttpTransactionsRequest;
    if (Utils.objectHasProperty(request, 'Issuer')) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
    filteredRequest.ChargingStationID = sanitize(request.ChargingStationID);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.VisualTagID = sanitize(request.VisualTagID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.InactivityStatus = sanitize(request.InactivityStatus);
    filteredRequest.RefundStatus = sanitize(request.RefundStatus);
    filteredRequest.MinimalPrice = sanitize(request.MinimalPrice);
    filteredRequest.ConnectorID = sanitize(request.ConnectorID);
    if (Utils.objectHasProperty(request, 'Statistics')) {
      filteredRequest.Statistics = sanitize(request.Statistics);
    }
    if (Utils.objectHasProperty(request, 'UserID')) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    if (Utils.objectHasProperty(request, 'ReportIDs')) {
      filteredRequest.ReportIDs = sanitize(request.ReportIDs);
    }
    if (Utils.objectHasProperty(request, 'Status')) {
      filteredRequest.Status = sanitize(request.Status);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    UtilsSecurity.filterProject(request, filteredRequest);
    return filteredRequest;
  }

  public static filterTransactionsInErrorRequest(request: any): HttpTransactionsRequest {
    const filteredRequest: HttpTransactionsRequest = {} as HttpTransactionsRequest;
    // Handle picture
    filteredRequest.ChargingStationID = sanitize(request.ChargingStationID);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.ErrorType = sanitize(request.ErrorType);
    filteredRequest.ConnectorID = sanitize(request.ConnectorID);
    if (Utils.objectHasProperty(request, 'UserID')) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterConsumptionFromTransactionRequest(request: any): HttpConsumptionFromTransactionRequest {
    const filteredRequest: HttpConsumptionFromTransactionRequest = {} as HttpConsumptionFromTransactionRequest;
    // Set
    if (Utils.objectHasProperty(request, 'TransactionId')) {
      filteredRequest.TransactionId = Utils.convertToInt(sanitize(request.TransactionId));
    }
    if (Utils.objectHasProperty(request, 'WithTag')) {
      filteredRequest.WithTag = UtilsSecurity.filterBoolean(request.WithTag);
    }
    if (Utils.objectHasProperty(request, 'WithCar')) {
      filteredRequest.WithCar = UtilsSecurity.filterBoolean(request.WithCar);
    }
    if (Utils.objectHasProperty(request, 'WithUser')) {
      filteredRequest.WithUser = UtilsSecurity.filterBoolean(request.WithUser);
    }
    if (Utils.objectHasProperty(request, 'LoadAllConsumptions')) {
      filteredRequest.LoadAllConsumptions = Utils.convertToBoolean(sanitize(request.LoadAllConsumptions));
    }
    return filteredRequest;
  }
}
