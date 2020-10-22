import { HttpAssignTransactionsToUserRequest, HttpConsumptionFromTransactionRequest, HttpPushTransactionCdrRequest, HttpTransactionRequest, HttpTransactionsRefundRequest, HttpTransactionsRequest, HttpUnassignTransactionsToUserRequest } from '../../../../../types/requests/HttpTransactionRequest';
import Transaction, { TransactionConsumption } from '../../../../../types/Transaction';

import Authorizations from '../../../../../authorization/Authorizations';
import CarSecurity from './CarSecurity';
import Constants from '../../../../../utils/Constants';
import Consumption from '../../../../../types/Consumption';
import { DataResult } from '../../../../../types/DataResult';
import { OCPICdr } from '../../../../../types/ocpi/OCPICdr';
import RefundReport from '../../../../../types/Refund';
import { TransactionInError } from '../../../../../types/InError';
import UserSecurity from './UserSecurity';
import UserToken from '../../../../../types/UserToken';
import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class TransactionSecurity {
  public static filterTransactionsRefund(request: any): HttpTransactionsRefundRequest {
    if (!request.transactionIds) {
      return { transactionIds: [] };
    }
    return { transactionIds: request.transactionIds.map(sanitize) };
  }

  public static filterAssignTransactionsToUser(request: HttpAssignTransactionsToUserRequest): HttpAssignTransactionsToUserRequest {
    return { UserID: request.UserID ? sanitize(request.UserID) : null };
  }

  static filterUnassignedTransactionsCountRequest(request: any): HttpUnassignTransactionsToUserRequest {
    return { UserID: request.UserID ? sanitize(request.UserID) : null };
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
      ID: Utils.convertToInt(sanitize(request.ID))
    };
  }

  public static filterPushTransactionCdrRequest(request: any): HttpPushTransactionCdrRequest {
    return {
      transactionId: Utils.convertToInt(sanitize(request.transactionId))
    };
  }

  public static filterTransactionsActiveRequest(request: any): HttpTransactionsRequest {
    const filteredRequest: HttpTransactionsRequest = {} as HttpTransactionsRequest;
    if (request.Issuer) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorId = sanitize(request.ConnectorId);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.UserID = request.UserID ? sanitize(request.UserID) : null;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterTransactionsRequest(request: any): HttpTransactionsRequest {
    const filteredRequest = {} as HttpTransactionsRequest;
    // Handle picture
    if (Utils.objectHasProperty(request, 'Issuer')) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.TagID = sanitize(request.TagID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.InactivityStatus = sanitize(request.InactivityStatus);
    filteredRequest.RefundStatus = sanitize(request.RefundStatus);
    filteredRequest.MinimalPrice = sanitize(request.MinimalPrice);
    if (request.Statistics) {
      filteredRequest.Statistics = sanitize(request.Statistics);
    }
    if (request.UserID) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    if (request.ReportIDs) {
      filteredRequest.ReportIDs = sanitize(request.ReportIDs);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterTransactionsInErrorRequest(request: any): HttpTransactionsRequest {
    const filteredRequest: HttpTransactionsRequest = {} as HttpTransactionsRequest;
    // Handle picture
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.SiteAreaID = sanitize(request.SiteAreaID);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.ErrorType = sanitize(request.ErrorType);
    if (request.UserID) {
      filteredRequest.UserID = sanitize(request.UserID);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterTransactionResponse(transaction: Transaction|TransactionInError, loggedUser: UserToken): Transaction {
    let filteredTransaction: Transaction;
    if (!transaction) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadTransaction(loggedUser, transaction)) {
      // Set only necessary info
      filteredTransaction = {} as Transaction;
      filteredTransaction.id = transaction.id;
      if (Utils.objectHasProperty(transaction, 'errorCode')) {
        filteredTransaction.uniqueId = transaction.uniqueId;
        (filteredTransaction as TransactionInError).errorCode = (transaction as TransactionInError).errorCode;
      }
      filteredTransaction.chargeBoxID = transaction.chargeBoxID;
      filteredTransaction.siteID = transaction.siteID;
      filteredTransaction.siteAreaID = transaction.siteAreaID;
      filteredTransaction.connectorId = transaction.connectorId;
      filteredTransaction.meterStart = transaction.meterStart;
      filteredTransaction.timestamp = transaction.timestamp;
      filteredTransaction.timezone = transaction.timezone;
      if (Utils.objectHasProperty(transaction, 'price')) {
        filteredTransaction.price = transaction.price;
        filteredTransaction.roundedPrice = transaction.roundedPrice;
        filteredTransaction.priceUnit = transaction.priceUnit;
        filteredTransaction.pricingSource = transaction.pricingSource;
      }
      if (!transaction.stop) {
        filteredTransaction.currentInstantWatts = transaction.currentInstantWatts;
        filteredTransaction.currentInstantWattsL1 = transaction.currentInstantWattsL1;
        filteredTransaction.currentInstantWattsL2 = transaction.currentInstantWattsL2;
        filteredTransaction.currentInstantWattsL3 = transaction.currentInstantWattsL3;
        filteredTransaction.currentInstantWattsDC = transaction.currentInstantWattsDC;
        filteredTransaction.currentTotalConsumptionWh = transaction.currentTotalConsumptionWh;
        filteredTransaction.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs;
        filteredTransaction.currentInactivityStatus = transaction.currentInactivityStatus;
        filteredTransaction.currentTotalDurationSecs = transaction.currentTotalDurationSecs;
        filteredTransaction.currentCumulatedPrice = transaction.currentCumulatedPrice;
        filteredTransaction.currentStateOfCharge = transaction.currentStateOfCharge;
        filteredTransaction.currentSignedData = transaction.currentSignedData;
        filteredTransaction.currentInstantVolts = transaction.currentInstantVolts;
        filteredTransaction.currentInstantVoltsL1 = transaction.currentInstantVoltsL1;
        filteredTransaction.currentInstantVoltsL2 = transaction.currentInstantVoltsL2;
        filteredTransaction.currentInstantVoltsL3 = transaction.currentInstantVoltsL3;
        filteredTransaction.currentInstantVoltsDC = transaction.currentInstantVoltsDC;
        filteredTransaction.currentInstantAmps = transaction.currentInstantAmps;
        filteredTransaction.currentInstantAmpsL1 = transaction.currentInstantAmpsL1;
        filteredTransaction.currentInstantAmpsL2 = transaction.currentInstantAmpsL2;
        filteredTransaction.currentInstantAmpsL3 = transaction.currentInstantAmpsL3;
        filteredTransaction.currentInstantAmpsDC = transaction.currentInstantAmpsDC;
      }
      if (!transaction.stop && transaction.chargeBox && transaction.chargeBox.connectors) {
        const foundConnector = Utils.getConnectorFromID(transaction.chargeBox, transaction.connectorId);
        filteredTransaction.status = foundConnector ? foundConnector.status : null;
      }
      filteredTransaction.stateOfCharge = transaction.stateOfCharge;
      filteredTransaction.signedData = transaction.signedData;
      filteredTransaction.refundData = transaction.refundData;
      if (transaction.ocpiData) {
        filteredTransaction.ocpiData = {
          sessionCheckedOn: transaction.ocpiData.sessionCheckedOn,
          cdrCheckedOn: transaction.ocpiData.cdrCheckedOn,
        };
        if (transaction.ocpiData.cdr) {
          filteredTransaction.ocpiData.cdr = {
            id: transaction.ocpiData.cdr.id,
          } as OCPICdr;
        }
      }
      // Demo user?
      if (Authorizations.isDemo(loggedUser)) {
        filteredTransaction.tagID = Constants.ANONYMIZED_VALUE;
      } else {
        filteredTransaction.tagID = transaction.tagID;
      }
      if (transaction.car) {
        filteredTransaction.car = CarSecurity.filterCarResponse(transaction.car, loggedUser);
      }
      // Filter user
      filteredTransaction.user = UserSecurity.filterMinimalUserResponse(transaction.user, loggedUser);
      filteredTransaction.userID = transaction.userID;
      // Transaction Stop
      if (transaction.stop) {
        filteredTransaction.stop = {
          tagID: Authorizations.isDemo(loggedUser) ? Constants.ANONYMIZED_VALUE : transaction.stop.tagID,
          meterStop: transaction.stop.meterStop,
          timestamp: transaction.stop.timestamp,
          totalConsumptionWh: transaction.stop.totalConsumptionWh,
          totalInactivitySecs: transaction.stop.totalInactivitySecs + transaction.stop.extraInactivitySecs,
          inactivityStatus: transaction.stop.inactivityStatus,
          totalDurationSecs: transaction.stop.totalDurationSecs,
          stateOfCharge: transaction.stop.stateOfCharge,
          signedData: transaction.stop.signedData,
          userID: transaction.stop.userID,
          user: transaction.stop.user ? UserSecurity.filterMinimalUserResponse(transaction.stop.user, loggedUser) : null
        };
        if (transaction.stop.price) {
          filteredTransaction.stop.price = transaction.stop.price;
          filteredTransaction.stop.roundedPrice = transaction.stop.roundedPrice;
          filteredTransaction.stop.priceUnit = transaction.stop.priceUnit;
          filteredTransaction.stop.pricingSource = transaction.stop.pricingSource;
        }
        if (transaction.billingData) {
          filteredTransaction.billingData = {
            invoiceID: transaction.billingData.invoiceID
          };
        }
      }
    }
    return filteredTransaction;
  }

  static filterTransactionsResponse(transactions: DataResult<Transaction|TransactionInError>, loggedUser: UserToken): void {
    const filteredTransactions = [];
    if (!transactions.result) {
      return null;
    }
    // Filter result
    for (const transaction of transactions.result) {
      const filteredTransaction = TransactionSecurity.filterTransactionResponse(transaction, loggedUser);
      if (filteredTransaction) {
        filteredTransactions.push(filteredTransaction);
      }
    }
    transactions.result = filteredTransactions;
  }

  static filterRefundReportResponse(report: RefundReport, loggedUser: UserToken): RefundReport {
    let filteredRefundReport: RefundReport;
    if (!report) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadReport(loggedUser)) {
      // Set only necessary info
      filteredRefundReport = {} as RefundReport;
      if (report.id) {
        filteredRefundReport.id = report.id;
      }
      if (report.user) {
        filteredRefundReport.user = report.user;
      }
    }
    return filteredRefundReport;
  }

  static filterRefundReportsResponse(reports: DataResult<RefundReport>, loggedUser: UserToken): void {
    const filteredReports = [];
    if (!reports.result) {
      return null;
    }
    // Filter result
    for (const report of reports.result) {
      const filteredReport = TransactionSecurity.filterRefundReportResponse(report, loggedUser);
      if (filteredReport) {
        filteredReports.push(filteredReport);
      }
    }
    reports.result = filteredReports;
  }

  public static filterConsumptionFromTransactionRequest(request: any): HttpConsumptionFromTransactionRequest {
    const filteredRequest: HttpConsumptionFromTransactionRequest = {} as HttpConsumptionFromTransactionRequest;
    // Set
    if (Utils.objectHasProperty(request, 'TransactionId')) {
      filteredRequest.TransactionId = Utils.convertToInt(sanitize(request.TransactionId));
    }
    if (Utils.objectHasProperty(request, 'LoadAllConsumptions')) {
      filteredRequest.LoadAllConsumptions = Utils.convertToBoolean(sanitize(request.LoadAllConsumptions));
    }
    return filteredRequest;
  }

  public static filterChargingStationTransactionsRequest(request: any): HttpTransactionsRequest {
    const filteredRequest: HttpTransactionsRequest = {} as HttpTransactionsRequest;
    // Set
    filteredRequest.ChargeBoxID = sanitize(request.ChargeBoxID);
    filteredRequest.ConnectorId = sanitize(request.ConnectorId);
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterTransactionConsumptionsResponse(transaction: Transaction, consumptions: Consumption[], loggedUser: UserToken): Transaction {
    transaction.values = [];
    if (!consumptions) {
      consumptions = [];
    }
    // Check Authorization
    if (transaction.user) {
      if (!Authorizations.canReadUser(loggedUser, transaction.userID)) {
        return transaction;
      }
    } else if (!transaction.user && !Authorizations.isAdmin(loggedUser)) {
      return transaction;
    }
    const filteredTransaction = TransactionSecurity.filterTransactionResponse(transaction, loggedUser);
    if (consumptions.length === 0) {
      filteredTransaction.values = [];
      return filteredTransaction;
    }
    // Clean
    filteredTransaction.values = consumptions.map((consumption) => {
      const newConsumption: TransactionConsumption = {
        date: consumption.startedAt,
        instantWatts: consumption.instantWatts,
        instantWattsL1: consumption.instantWattsL1,
        instantWattsL2: consumption.instantWattsL2,
        instantWattsL3: consumption.instantWattsL3,
        instantWattsDC: consumption.instantWattsDC,
        instantAmps: consumption.instantAmps,
        instantAmpsL1: consumption.instantAmpsL1,
        instantAmpsL2: consumption.instantAmpsL2,
        instantAmpsL3: consumption.instantAmpsL3,
        instantAmpsDC: consumption.instantAmpsDC,
        instantVolts: consumption.instantVolts,
        instantVoltsL1: consumption.instantVoltsL1,
        instantVoltsL2: consumption.instantVoltsL2,
        instantVoltsL3: consumption.instantVoltsL3,
        instantVoltsDC: consumption.instantVoltsDC,
        cumulatedConsumptionWh: consumption.cumulatedConsumptionWh,
        cumulatedConsumptionAmps: consumption.cumulatedConsumptionAmps,
        stateOfCharge: consumption.stateOfCharge,
        cumulatedAmount: consumption.cumulatedAmount,
        limitWatts: consumption.limitWatts,
        limitAmps: consumption.limitAmps,
      };
      return newConsumption;
    });
    // Add the last point (duration of the last consumption)
    if (consumptions.length > 0) {
      filteredTransaction.values.push({
        ...filteredTransaction.values[filteredTransaction.values.length - 1],
        date: consumptions[consumptions.length - 1].endedAt,
      });
    }
    return filteredTransaction;
  }
}
