import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import moment from 'moment';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import RefundFactory from '../../../integration/refund/RefundFactory';
import SynchronizeRefundTransactionsTask from '../../../scheduler/tasks/SynchronizeRefundTransactionsTask';
import OCPPService from '../../../server/ocpp/services/OCPPService';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import UserStorage from '../../../storage/mongodb/UserStorage';
import { Action, Entity } from '../../../types/Authorization';
import Consumption from '../../../types/Consumption';
import { ActionsResponse } from '../../../types/GlobalType';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { TransactionInErrorType } from '../../../types/InError';
import { RefundStatus } from '../../../types/Refund';
import TenantComponents from '../../../types/TenantComponents';
import Transaction from '../../../types/Transaction';
import User from '../../../types/User';
import UserToken from '../../../types/UserToken';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import I18nManager from '../../../utils/I18nManager';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import OCPPUtils from '../../ocpp/utils/OCPPUtils';
import TransactionSecurity from './security/TransactionSecurity';
import UtilsService from './UtilsService';

const MODULE_NAME = 'TransactionService';

export default class TransactionService {
  static async handleSynchronizeRefundedTransactions(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      if (!Authorizations.isAdmin(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.UPDATE,
          entity: Entity.TRANSACTION,
          module: MODULE_NAME,
          method: 'handleSynchronizeRefundedTransactions'
        });
      }

      const tenant = await TenantStorage.getTenant(req.user.tenantID);
      const task = new SynchronizeRefundTransactionsTask();
      await task.processTenant(tenant, null);

      const response: any = {
        ...Constants.REST_RESPONSE_SUCCESS,
      };
      res.json(response);
      next();
    } catch (error) {
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleRefundTransactions(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRefund(req.body);
    if (!filteredRequest.transactionIds) {
      // Not Found!
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Transaction IDs must be provided',
        module: MODULE_NAME,
        method: 'handleRefundTransactions',
        user: req.user,
        action: action
      });
    }
    const transactionsToRefund: Transaction[] = [];
    for (const transactionId of filteredRequest.transactionIds) {
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
      if (!transaction) {
        Logging.logError({
          tenantID: req.user.tenantID,
          user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
          module: MODULE_NAME, method: 'handleRefundTransactions',
          message: `Transaction '${transaction.id}' does not exist`,
          action: action,
          detailedMessages: { transaction }
        });
        continue;
      }
      if (transaction.refundData && !!transaction.refundData.refundId && transaction.refundData.status !== RefundStatus.CANCELLED) {
        Logging.logError({
          tenantID: req.user.tenantID,
          user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
          module: MODULE_NAME, method: 'handleRefundTransactions',
          message: `Transaction '${transaction.id}' is already refunded`,
          action: action,
          detailedMessages: { transaction }
        });
        continue;
      }
      // Check auth
      if (!Authorizations.canRefundTransaction(req.user, transaction)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.REFUND_TRANSACTION,
          entity: Entity.TRANSACTION,
          module: MODULE_NAME,
          method: 'handleRefundTransactions',
          value: transaction.id.toString()
        });
      }
      transactionsToRefund.push(transaction);
    }
    // Get Transaction User
    const user: User = await UserStorage.getUser(req.user.tenantID, req.user.id);
    UtilsService.assertObjectExists(action, user, `User with ID '${req.user.id}' does not exist`,
      'TransactionService', 'handleRefundTransactions', req.user);
    const refundConnector = await RefundFactory.getRefundConnector(req.user.tenantID);
    if (!refundConnector) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'No Refund Implementation Found',
        module: MODULE_NAME,
        method: 'handleRefundTransactions',
        user: req.user,
        action: action
      });
    }
    const refundedTransactions = await refundConnector.refund(req.user.tenantID, user.id, transactionsToRefund);
    const response: any = {
      ...Constants.REST_RESPONSE_SUCCESS,
      inSuccess: refundedTransactions.length
    };
    // Send result
    const notRefundedTransactions = transactionsToRefund.length - refundedTransactions.length;
    if (notRefundedTransactions > 0) {
      response.inError = notRefundedTransactions;
    }
    res.json(response);
    next();
  }


  public static async handleGetUnassignedTransactionsCount(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check Auth
    if (!Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetUnassignedTransactionsCount'
      });
    }
    // Filter
    const filteredRequest = TransactionSecurity.filterUnassignedTransactionsCountRequest(req.query);
    if (!filteredRequest.UserID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'UserID must be provided',
        module: MODULE_NAME,
        method: 'handleGetUnassignedTransactionsCount',
        user: req.user,
        action: action
      });
    }
    // Get the user
    const user: User = await UserStorage.getUser(req.user.tenantID, filteredRequest.UserID);
    UtilsService.assertObjectExists(action, user, `User with ID '${filteredRequest.UserID}' does not exist`,
      'TransactionService', 'handleAssignTransactionsToUser', req.user);
    // Get unassigned transactions
    const count = await TransactionStorage.getUnassignedTransactionsCount(req.user.tenantID, user);
    // Return
    res.json(count);
    next();
  }

  public static async handleAssignTransactionsToUser(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auths
    if (!Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleAssignTransactionsToUser'
      });
    }
    // Filter
    const filteredRequest = TransactionSecurity.filterAssignTransactionsToUser(req.query);
    // Check
    if (!filteredRequest.UserID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'User ID must be provided',
        module: MODULE_NAME,
        method: 'handleAssignTransactionsToUser',
        user: req.user,
        action: action
      });
    }
    // Get the user
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.UserID);
    UtilsService.assertObjectExists(action, user, `User with ID '${filteredRequest.UserID}' does not exist`,
      'TransactionService', 'handleAssignTransactionsToUser', req.user);
    // Assign
    await TransactionStorage.assignTransactionsToUser(req.user.tenantID, user);
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteTransaction(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionId = TransactionSecurity.filterTransactionRequestByID(req.query);
    // Check auth
    if (!Authorizations.canDeleteTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleDeleteTransaction',
        value: transactionId.toString()
      });
    }
    // Get
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
    UtilsService.assertObjectExists(action, transaction, `Transaction with ID '${transactionId}' does not exist`,
      'TransactionService', 'handleDeleteTransaction', req.user);
    // Delete
    const result = await TransactionService.deleteTransactions(action, req.user, [transactionId]);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleDeleteTransactions(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionsIds = TransactionSecurity.filterTransactionRequestByIDs(req.body);
    // Check auth
    if (!Authorizations.canDeleteTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleDeleteTransactions',
        value: transactionsIds.toString()
      });
    }
    // Delete
    const result = await TransactionService.deleteTransactions(action, req.user, transactionsIds);
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleTransactionSoftStop(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const transactionId = TransactionSecurity.filterTransactionSoftStop(req.body);
    // Transaction Id is mandatory
    UtilsService.assertIdIsProvided(action, transactionId, 'TransactionService', 'handleTransactionSoftStop', req.user);
    // Check auth
    if (!Authorizations.canUpdateTransaction(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleTransactionSoftStop',
        value: transactionId.toString()
      });
    }
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
    UtilsService.assertObjectExists(action, transaction, `Transaction with ID ${transactionId} does not exist`,
      'TransactionService', 'handleTransactionSoftStop', req.user);
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, transaction.chargeBoxID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station with ID '${transaction.chargeBoxID}' does not exist`,
      'TransactionService', 'handleTransactionSoftStop', req.user);
    // Check User
    let user: User;
    if (!transaction.user && transaction.userID) {
      // Get Transaction User
      user = await UserStorage.getUser(req.user.tenantID, transaction.userID);
      UtilsService.assertObjectExists(action, user, `User with ID '${transaction.userID}' does not exist`,
        'TransactionService', 'handleTransactionSoftStop', req.user);
    }
    // Stop Transaction
    const result = await new OCPPService().handleStopTransaction(
      {
        chargeBoxIdentity: chargingStation.id,
        tenantID: req.user.tenantID
      },
      {
        transactionId: transactionId,
        chargeBoxID: chargingStation.id,
        idTag: req.user.tagIDs[0],
        timestamp: Utils.convertToDate(transaction.lastMeterValue ? transaction.lastMeterValue.timestamp : transaction.timestamp).toISOString(),
        meterStop: transaction.lastMeterValue.value ? transaction.lastMeterValue.value : transaction.meterStart
      },
      true
    );
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      source: chargingStation.id,
      user: req.user, actionOnUser: user,
      module: MODULE_NAME, method: 'handleTransactionSoftStop',
      message: `Connector '${transaction.connectorId}' > Transaction ID '${transactionId}' has been stopped successfully`,
      action: action,
      detailedMessages: { result }
    });
    // Ok
    res.json(result);
    next();
  }

  public static async handleGetConsumptionFromTransaction(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterConsumptionFromTransactionRequest(req.query);
    // Transaction Id is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.TransactionId, 'TransactionService',
      'handleGetConsumptionFromTransaction', req.user);
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.TransactionId);
    UtilsService.assertObjectExists(action, transaction, `Transaction with ID '${filteredRequest.TransactionId}' does not exist`,
      'TransactionService', 'handleGetConsumptionFromTransaction', req.user);
    // Check auth
    if (!Authorizations.canReadTransaction(req.user, transaction)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetConsumptionFromTransaction',
        value: transaction.id.toString()
      });
    }
    // Check dates
    if (filteredRequest.StartDateTime && filteredRequest.EndDateTime && moment(filteredRequest.StartDateTime).isAfter(moment(filteredRequest.EndDateTime))) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `The requested start date '${new Date(filteredRequest.StartDateTime).toISOString()}' is after the requested end date '${new Date(filteredRequest.StartDateTime).toISOString()}' `,
        module: MODULE_NAME,
        method: 'handleGetConsumptionFromTransaction',
        user: req.user,
        action: action
      });
    }
    // Get the consumption
    let consumptions: Consumption[] = await ConsumptionStorage.getConsumptions(req.user.tenantID, { transactionId: transaction.id });
    // Dates provided?
    const startDateTime = filteredRequest.StartDateTime ? filteredRequest.StartDateTime : Constants.MIN_DATE;
    const endDateTime = filteredRequest.EndDateTime ? filteredRequest.EndDateTime : Constants.MAX_DATE;
    // Filter?
    if (consumptions && (filteredRequest.StartDateTime || filteredRequest.EndDateTime)) {
      consumptions = consumptions.filter((consumption) =>
        moment(consumption.endedAt).isBetween(startDateTime, endDateTime, null, '[]'));
    }
    // Return the result
    res.json(TransactionSecurity.filterConsumptionsFromTransactionResponse(transaction, consumptions, req.user));
    next();
  }

  public static async handleGetTransaction(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, 'TransactionService', 'handleGetTransaction', req.user);
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(action, transaction, `Transaction with ID '${filteredRequest.ID}' does not exist`,
      'TransactionService', 'handleGetTransaction', req.user);
    // Check auth
    if (!Authorizations.canReadTransaction(req.user, transaction)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetTransaction',
        value: filteredRequest.ID.toString()
      });
    }
    // Return
    res.json(
      // Filter
      TransactionSecurity.filterTransactionResponse(transaction, req.user)
    );
    next();
  }

  public static async handleGetChargingStationTransactions(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetChargingStationTransactions'
      });
    }
    // Filter
    const filteredRequest = TransactionSecurity.filterChargingStationTransactionsRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ChargeBoxID, 'TransactionService', 'handleGetChargingStationTransactions:ChargeBoxID', req.user);
    UtilsService.assertIdIsProvided(action, filteredRequest.ConnectorId, 'TransactionService', 'handleGetChargingStationTransactions:ConnectorId', req.user);
    // Get Charge Box
    const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ChargeBoxID);
    UtilsService.assertObjectExists(action, chargingStation, `Charging Station with ID '${filteredRequest.ChargeBoxID}' does not exist`,
      'TransactionService', 'handleGetChargingStationTransactions', req.user);
    // Query
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID, {
      chargeBoxIDs: [chargingStation.id],
      connectorId: filteredRequest.ConnectorId,
      startDateTime: filteredRequest.StartDateTime,
      endDateTime: filteredRequest.EndDateTime
    },
    { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount }
    );
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    // Return
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionYears(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Get Transactions
    const transactionsYears = await TransactionStorage.getTransactionYears(req.user.tenantID);
    const result: any = {};
    if (transactionsYears) {
      result.years = [];
      result.years.push(new Date().getFullYear());
    }
    // Return
    res.json(transactionsYears);
    next();
  }

  public static async handleGetTransactionsActive(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetTransactionsActive'
      });
    }
    const filter: any = { stop: { $exists: false } };
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsActiveRequest(req.query);
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Authorizations.isBasic(req.user)) {
      filter.ownerID = req.user.id;
    }
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.SiteID) {
        filter.siteID = Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID.split('|'));
      }
      if (Authorizations.isSiteAdmin(req.user)) {
        filter.siteAdminIDs = req.user.sitesAdmin;
      }
    }
    if (filteredRequest.ConnectorId) {
      filter.connectorId = filteredRequest.ConnectorId;
    }
    filter.withChargeBoxes = true;
    if (filteredRequest.Search) {
      filter.search = filteredRequest.Search;
    }
    // Get Transactions
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID, filter,
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount }
    );
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    // Return
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionsCompleted(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetTransactionsCompleted'
      });
    }
    const filter: any = { stop: { $exists: true } };
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRequest(req.query);
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Authorizations.isBasic(req.user)) {
      filter.ownerID = req.user.id;
    }
    // Check Organization
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.SiteID) {
        filter.siteID = Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID.split('|'));
      }
      if (Authorizations.isSiteAdmin(req.user)) {
        filter.siteAdminIDs = req.user.sitesAdmin;
      }
    }
    if (filteredRequest.StartDateTime) {
      filter.startDateTime = filteredRequest.StartDateTime;
    }
    if (filteredRequest.EndDateTime) {
      filter.endDateTime = filteredRequest.EndDateTime;
    }
    if (filteredRequest.RefundStatus) {
      filter.refundStatus = filteredRequest.RefundStatus.split('|');
    }
    if (filteredRequest.MinimalPrice) {
      filter.minimalPrice = filteredRequest.MinimalPrice;
    }
    if (filteredRequest.Statistics) {
      filter.statistics = filteredRequest.Statistics;
    }
    if (filteredRequest.Search) {
      filter.search = filteredRequest.Search;
    }
    if (filteredRequest.InactivityStatus) {
      filter.inactivityStatus = filteredRequest.InactivityStatus.split('|');
    }
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID, filter,
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount }
    );
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    // Return
    res.json(transactions);
    next();
  }

  public static async handleGetTransactionsToRefund(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetTransactionsToRefund'
      });
    }
    const filter: any = { stop: { $exists: true } };
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRequest(req.query);
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Authorizations.isBasic(req.user)) {
      filter.ownerID = req.user.id;
    }
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.SiteID) {
        filter.siteID = Authorizations.getAuthorizedSiteAdminIDs(req.user, filteredRequest.SiteID.split('|'));
      }
      filter.siteAdminIDs = Authorizations.getAuthorizedSiteAdminIDs(req.user);
    }
    if (filteredRequest.StartDateTime) {
      filter.startDateTime = filteredRequest.StartDateTime;
    }
    if (filteredRequest.EndDateTime) {
      filter.endDateTime = filteredRequest.EndDateTime;
    }
    if (filteredRequest.RefundStatus) {
      filter.refundStatus = filteredRequest.RefundStatus.split('|');
    }
    if (filteredRequest.MinimalPrice) {
      filter.minimalPrice = filteredRequest.MinimalPrice;
    }
    if (filteredRequest.Statistics) {
      filter.statistics = filteredRequest.Statistics;
    }
    if (filteredRequest.Search) {
      filter.search = filteredRequest.Search;
    }
    if (filteredRequest.ReportIDs) {
      filter.reportIDs = filteredRequest.ReportIDs.split('|');
    }
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID, filter,
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount }
    );
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    // Return
    res.json(transactions);
    next();
  }

  public static async handleGetRefundReports(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetRefundReports'
      });
    }
    const filter: any = { stop: { $exists: true } };
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRequest(req.query);
    if (Authorizations.isBasic(req.user)) {
      filter.ownerID = req.user.id;
    }
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.SiteID) {
        filter.siteID = Authorizations.getAuthorizedSiteAdminIDs(req.user, filteredRequest.SiteID.split('|'));
      }
      filter.siteAdminIDs = Authorizations.getAuthorizedSiteAdminIDs(req.user);
    }
    // Get Reports
    const reports = await TransactionStorage.getRefundReports(req.user.tenantID, filter, {
      limit: filteredRequest.Limit,
      skip: filteredRequest.Skip,
      sort: filteredRequest.Sort,
      onlyRecordCount: filteredRequest.OnlyRecordCount
    });
    // Filter
    TransactionSecurity.filterRefundReportsResponse(reports, req.user);
    // Return
    res.json(reports);
    next();
  }

  public static async handleGetTransactionsExport(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetTransactionsExport'
      });
    }
    const filter: any = { stop: { $exists: true } };
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRequest(req.query);
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Authorizations.isBasic(req.user)) {
      filter.ownerID = req.user.id;
    }
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.SiteID) {
        filter.siteID = Authorizations.getAuthorizedSiteIDs(req.user, filteredRequest.SiteID.split('|'));
      }
      if (Authorizations.isSiteAdmin(req.user)) {
        filter.siteAdminIDs = req.user.sitesAdmin;
      }
    }
    // Date
    if (filteredRequest.StartDateTime) {
      filter.startDateTime = filteredRequest.StartDateTime;
    }
    if (filteredRequest.EndDateTime) {
      filter.endDateTime = filteredRequest.EndDateTime;
    }
    if (filteredRequest.RefundStatus) {
      filter.refundStatus = filteredRequest.RefundStatus.split('|');
    }
    if (filteredRequest.Search) {
      filter.search = filteredRequest.Search;
    }
    if (filteredRequest.SiteID) {
      filter.siteID = filteredRequest.SiteID;
    }
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID, filter,
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount }
    );
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    const filename = 'exported-transactions.csv';
    fs.writeFile(filename, TransactionService.convertToCSV(req.user, transactions.result), (err) => {
      if (err) {
        throw err;
      }
      res.download(filename, (err2) => {
        if (err2) {
          throw err2;
        }
        fs.unlink(filename, (err3) => {
          if (err3) {
            throw err3;
          }
        });
      });
    });
  }

  public static async handleGetTransactionsToRefundExport(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetTransactionsToRefundExport'
      });
    }
    const filter: any = { stop: { $exists: true } };
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRequest(req.query);
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Authorizations.isBasic(req.user)) {
      filter.ownerID = req.user.id;
    }
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.SiteID) {
        filter.siteID = Authorizations.getAuthorizedSiteAdminIDs(req.user, filteredRequest.SiteID.split('|'));
      }
      filter.siteAdminIDs = Authorizations.getAuthorizedSiteAdminIDs(req.user);
    }
    if (filteredRequest.StartDateTime) {
      filter.startDateTime = filteredRequest.StartDateTime;
    }
    if (filteredRequest.EndDateTime) {
      filter.endDateTime = filteredRequest.EndDateTime;
    }
    if (filteredRequest.RefundStatus) {
      filter.refundStatus = filteredRequest.RefundStatus.split('|');
    }
    if (filteredRequest.MinimalPrice) {
      filter.minimalPrice = filteredRequest.MinimalPrice;
    }
    if (filteredRequest.Statistics) {
      filter.statistics = filteredRequest.Statistics;
    }
    if (filteredRequest.Search) {
      filter.search = filteredRequest.Search;
    }
    if (filteredRequest.ReportIDs) {
      filter.reportIDs = filteredRequest.ReportIDs.split('|');
    }
    const transactions = await TransactionStorage.getTransactions(req.user.tenantID, filter,
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount }
    );
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    // Hash userId and tagId for confidentiality purposes
    for (const transaction of transactions.result) {
      if (transaction.user) {
        transaction.user.id = transaction.user ? Cypher.hash(transaction.user.id) : '';
      }
      transaction.tagID = transaction.tagID ? Cypher.hash(transaction.tagID) : '';
    }
    const filename = 'exported-refund-transactions.csv';
    fs.writeFile(filename, TransactionService.convertToCSV(req.user, transactions.result), (err) => {
      if (err) {
        throw err;
      }
      res.download(filename, (err2) => {
        if (err2) {
          throw err2;
        }
        fs.unlink(filename, (err3) => {
          if (err3) {
            throw err3;
          }
        });
      });
    });
  }

  public static async handleGetTransactionsInError(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTransactionsInError(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetTransactionsInError'
      });
    }
    const filter: any = {};
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsInErrorRequest(req.query);
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
    }
    if (filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    if (Utils.isComponentActiveFromToken(req.user, TenantComponents.ORGANIZATION)) {
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      filter.siteID = Authorizations.getAuthorizedSiteAdminIDs(req.user, filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null);
    }

    // Date
    if (filteredRequest.StartDateTime) {
      filter.startDateTime = filteredRequest.StartDateTime;
    }
    if (filteredRequest.EndDateTime) {
      filter.endDateTime = filteredRequest.EndDateTime;
    }
    if (filteredRequest.ErrorType) {
      filter.errorType = filteredRequest.ErrorType.split('|');
    } else if (Utils.isComponentActiveFromToken(req.user, TenantComponents.PRICING)) {
      filter.errorType = [TransactionInErrorType.LONG_INACTIVITY, TransactionInErrorType.NEGATIVE_ACTIVITY, TransactionInErrorType.NEGATIVE_DURATION, TransactionInErrorType.OVER_CONSUMPTION, TransactionInErrorType.INVALID_START_DATE, TransactionInErrorType.NO_CONSUMPTION, TransactionInErrorType.MISSING_PRICE, TransactionInErrorType.MISSING_USER];
    } else {
      filter.errorType = [TransactionInErrorType.LONG_INACTIVITY, TransactionInErrorType.NEGATIVE_ACTIVITY, TransactionInErrorType.NEGATIVE_DURATION, TransactionInErrorType.OVER_CONSUMPTION, TransactionInErrorType.INVALID_START_DATE, TransactionInErrorType.NO_CONSUMPTION, TransactionInErrorType.MISSING_USER];
    }
    // Site Area
    const transactions = await TransactionStorage.getTransactionsInError(req.user.tenantID,
      { ...filter, search: filteredRequest.Search },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      });
    // Filter
    TransactionSecurity.filterTransactionsResponse(transactions, req.user);
    // Return
    res.json(transactions);
    next();
  }

  public static convertToCSV(loggedUser: UserToken, transactions: Transaction[]): string {
    const i18nManager = new I18nManager(loggedUser.locale);
    // Headers
    let csv = `ID${Constants.CSV_SEPARATOR}Charging Station${Constants.CSV_SEPARATOR}Connector${Constants.CSV_SEPARATOR}User ID${Constants.CSV_SEPARATOR}User${Constants.CSV_SEPARATOR}Start Date${Constants.CSV_SEPARATOR}End Date${Constants.CSV_SEPARATOR}Total Consumption (kW.h)${Constants.CSV_SEPARATOR}Total Duration (Mins)${Constants.CSV_SEPARATOR}Total Inactivity (Mins)${Constants.CSV_SEPARATOR}Price${Constants.CSV_SEPARATOR}Price Unit\r\n`;
    // Content
    for (const transaction of transactions) {
      csv += `${transaction.id}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.chargeBoxID}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.connectorId}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.user ? Cypher.hash(transaction.user.id) : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.user ? Utils.buildUserFullName(transaction.user, false) : ''}` + Constants.CSV_SEPARATOR;
      csv += `${i18nManager.formatDateTime(transaction.timestamp, 'L')} ${i18nManager.formatDateTime(transaction.timestamp, 'LT')}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? `${i18nManager.formatDateTime(transaction.stop.timestamp, 'L')} ${i18nManager.formatDateTime(transaction.stop.timestamp, 'LT')}` : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? Math.round(transaction.stop.totalConsumption ? transaction.stop.totalConsumption / 1000 : 0) : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? Math.round(transaction.stop.totalDurationSecs ? transaction.stop.totalDurationSecs / 60 : 0) : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? Math.round(transaction.stop.totalInactivitySecs ? transaction.stop.totalInactivitySecs / 60 : 0) : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? Math.round(transaction.stop.price * 100) / 100 : ''}` + Constants.CSV_SEPARATOR;
      csv += `${transaction.stop ? transaction.stop.priceUnit : ''}\r\n`;
    }
    return csv;
  }

  private static async deleteTransactions(action: Action, loggedUser: UserToken, transactionsIDs: number[]): Promise<ActionsResponse> {
    const transactionsIDsToDelete = [];
    const result: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    const specificError: { refunded: number; notFound: number; refundedIDs: number[]; notFoundIDs: number[] } = {
      refunded: 0,
      notFound: 0,
      refundedIDs: [],
      notFoundIDs: []
    };
    // Check if transaction has been refunded
    const refundConnector = await RefundFactory.getRefundConnector(loggedUser.tenantID);
    for (const transactionId of transactionsIDs) {
      // Get
      const transaction = await TransactionStorage.getTransaction(loggedUser.tenantID, transactionId);
      // Not Found
      if (!transaction) {
        result.inError++;
        specificError.notFound++;
        specificError.notFoundIDs.push(transactionId);
        // Already Refunded
      } else if (refundConnector && !refundConnector.canBeDeleted(transaction)) {
        result.inError++;
        specificError.refunded++;
        specificError.refundedIDs.push(transactionId);
      } else {
        // Ongoing transaction?
        if (!transaction.stop) {
          if (!transaction.chargeBox) {
            transactionsIDsToDelete.push(transactionId);
          } else {
            // Check connector
            const foundConnector = transaction.chargeBox.connectors.find((connector) => connector.connectorId === transaction.connectorId);
            if (foundConnector && transaction.id === foundConnector.activeTransactionID) {
              // Clear connector
              OCPPUtils.checkAndFreeChargingStationConnector(transaction.chargeBox, transaction.connectorId);
              await ChargingStationStorage.saveChargingStation(action, loggedUser.tenantID, transaction.chargeBox);
            }
            // To Delete
            transactionsIDsToDelete.push(transactionId);
          }
        } else {
          // To Delete
          transactionsIDsToDelete.push(transactionId);
        }
      }
    }
    // Delete All Transactions
    result.inSuccess = await TransactionStorage.deleteTransactions(loggedUser.tenantID, transactionsIDsToDelete);
    // Adjust
    result.inError += transactionsIDsToDelete.length - result.inSuccess;
    // Log
    if (result.inError > 0) {
      const errorDetails = [];
      if (specificError.notFound) {
        errorDetails.push(`${specificError.notFound} session IDs have not been found: ${specificError.notFoundIDs.join(', ')}`);
      }
      if (specificError.refunded) {
        errorDetails.push(`${specificError.refunded} session IDs has been refunded and cannot be deleted: ${specificError.refundedIDs.join(', ')}`);
      }
      Logging.logError({
        tenantID: loggedUser.tenantID,
        user: loggedUser,
        module: MODULE_NAME, method: 'handleDeleteTransactions',
        message: `${result.inSuccess} transaction(s) have been deleted successfully and ${result.inError} encountered an error or cannot be deleted`,
        action: action,
        detailedMessages: { errorDetails }
      });
    } else {
      Logging.logInfo({
        tenantID: loggedUser.tenantID,
        user: loggedUser,
        module: MODULE_NAME, method: 'handleDeleteTransactions',
        message: `${result.inSuccess} transaction(s) have been deleted successfully`,
        action: action
      });
    }
    return result;
  }
}
