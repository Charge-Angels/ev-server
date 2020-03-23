import DbParams from '../../types/database/DbParams';
import { DataResult } from '../../types/DataResult';
import { TransactionInError, TransactionInErrorType } from '../../types/InError';
import { NotifySessionNotStarted } from '../../types/Notification';
import RefundReport, { RefundStatus } from '../../types/Refund';
import Transaction, { InactivityStatus } from '../../types/Transaction';
import User from '../../types/User';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import global from './../../types/GlobalType';
import ConsumptionStorage from './ConsumptionStorage';
import DatabaseUtils from './DatabaseUtils';
import moment = require('moment');

export default class TransactionStorage {
  public static async deleteTransaction(tenantID: string, transaction: Transaction): Promise<void> {
    await this.deleteTransactions(tenantID, [transaction.id]);
  }

  public static async deleteTransactions(tenantID: string, transactionsIDs: number[]): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'deleteTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    const result = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .deleteMany({ '_id': { $in: transactionsIDs } });
    // Delete Meter Values
    await global.database.getCollection<any>(tenantID, 'metervalues')
      .deleteMany({ 'transactionId': { $in: transactionsIDs } });
    // Delete Consumptions
    await ConsumptionStorage.deleteConsumptions(tenantID, transactionsIDs);
    // Debug
    Logging.traceEnd('TransactionStorage', 'deleteTransaction', uniqueTimerID, { transactionsIDs });
    return result.deletedCount;
  }

  public static async saveTransaction(tenantID: string, transactionToSave: Transaction): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'saveTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // ID not provided?
    if (!transactionToSave.id) {
      transactionToSave.id = await TransactionStorage._findAvailableID(tenantID);
    }
    // Transfer
    const transactionMDB: any = {
      _id: Utils.convertToInt(transactionToSave.id),
      siteID: Utils.convertToObjectID(transactionToSave.siteID),
      siteAreaID: Utils.convertToObjectID(transactionToSave.siteAreaID),
      connectorId: Utils.convertToInt(transactionToSave.connectorId),
      tagID: transactionToSave.tagID,
      userID: Utils.convertToObjectID(transactionToSave.userID),
      chargeBoxID: transactionToSave.chargeBoxID,
      meterStart: Utils.convertToInt(transactionToSave.meterStart),
      timestamp: Utils.convertToDate(transactionToSave.timestamp),
      price: Utils.convertToFloat(transactionToSave.price),
      roundedPrice: Utils.convertToFloat(transactionToSave.roundedPrice),
      priceUnit: transactionToSave.priceUnit,
      pricingSource: transactionToSave.pricingSource,
      stateOfCharge: transactionToSave.stateOfCharge,
      timezone: transactionToSave.timezone,
      signedData: transactionToSave.signedData,
      numberOfMeterValues: Utils.convertToInt(transactionToSave.numberOfMeterValues),
      currentStateOfCharge: Utils.convertToInt(transactionToSave.currentStateOfCharge),
      currentSignedData: transactionToSave.currentSignedData,
      lastMeterValue: transactionToSave.lastMeterValue,
      currentTotalInactivitySecs: Utils.convertToInt(transactionToSave.currentTotalInactivitySecs),
      currentInactivityStatus: transactionToSave.currentInactivityStatus,
      currentCumulatedPrice: Utils.convertToFloat(transactionToSave.currentCumulatedPrice),
      currentConsumption: Utils.convertToFloat(transactionToSave.currentConsumption),
      currentTotalConsumption: Utils.convertToFloat(transactionToSave.currentTotalConsumption),
    };
    if (transactionToSave.stop) {
      // Remove runtime props
      delete transactionMDB.currentConsumption;
      delete transactionMDB.currentCumulatedPrice;
      delete transactionMDB.currentSignedData;
      delete transactionMDB.currentStateOfCharge;
      delete transactionMDB.currentTotalConsumption;
      delete transactionMDB.currentTotalInactivitySecs;
      delete transactionMDB.currentInactivityStatus;
      delete transactionMDB.lastMeterValue;
      delete transactionMDB.numberOfMeterValues;
      // Add stop
      transactionMDB.stop = {
        userID: Utils.convertToObjectID(transactionToSave.stop.userID),
        timestamp: Utils.convertToDate(transactionToSave.stop.timestamp),
        tagID: transactionToSave.stop.tagID,
        meterStop: transactionToSave.stop.meterStop,
        transactionData: transactionToSave.stop.transactionData,
        stateOfCharge: Utils.convertToInt(transactionToSave.stop.stateOfCharge),
        signedData: transactionToSave.stop.signedData,
        totalConsumption: Utils.convertToFloat(transactionToSave.stop.totalConsumption),
        totalInactivitySecs: Utils.convertToInt(transactionToSave.stop.totalInactivitySecs),
        extraInactivitySecs: Utils.convertToInt(transactionToSave.stop.extraInactivitySecs),
        extraInactivityComputed: !!transactionToSave.stop.extraInactivityComputed,
        inactivityStatus: transactionToSave.stop.inactivityStatus,
        totalDurationSecs: Utils.convertToInt(transactionToSave.stop.totalDurationSecs),
        price: Utils.convertToFloat(transactionToSave.stop.price),
        roundedPrice: Utils.convertToFloat(transactionToSave.stop.roundedPrice),
        priceUnit: transactionToSave.priceUnit,
        pricingSource: transactionToSave.stop.pricingSource
      };
    }
    if (transactionToSave.remotestop) {
      transactionMDB.remotestop = {
        timestamp: Utils.convertToDate(transactionToSave.remotestop.timestamp),
        tagID: transactionToSave.remotestop.tagID,
        userID: Utils.convertToObjectID(transactionToSave.remotestop.userID)
      };
    }
    if (transactionToSave.refundData) {
      transactionMDB.refundData = {
        refundId: transactionToSave.refundData.refundId,
        refundedAt: Utils.convertToDate(transactionToSave.refundData.refundedAt),
        status: transactionToSave.refundData.status,
        type: transactionToSave.refundData.type,
        reportId: transactionToSave.refundData.reportId
      };
    }
    if (transactionToSave.billingData) {
      transactionMDB.billingData = {
        status: transactionToSave.billingData.status,
        invoiceStatus: transactionToSave.billingData.invoiceStatus,
        invoiceItem: transactionToSave.billingData.invoiceItem,
        lastUpdate: Utils.convertToDate(transactionToSave.billingData.lastUpdate),
      };
      if (!transactionMDB.billingData.status) {
        delete transactionMDB.billingData.status;
      }
      if (!transactionMDB.billingData.errorCode) {
        delete transactionMDB.billingData.errorCode;
      }
      if (!transactionMDB.billingData.errorCodeDesc) {
        delete transactionMDB.billingData.errorCodeDesc;
      }
      if (!transactionMDB.billingData.invoiceStatus) {
        delete transactionMDB.billingData.invoiceStatus;
      }
      if (!transactionMDB.billingData.invoiceItem) {
        delete transactionMDB.billingData.invoiceItem;
      }
    }
    if (transactionToSave.ocpiSession) {
      transactionMDB.ocpiSession = transactionToSave.ocpiSession;
    }
    if (transactionToSave.ocpiCdr) {
      transactionMDB.ocpiCdr = transactionToSave.ocpiCdr;
    }
    // Modify
    await global.database.getCollection<any>(tenantID, 'transactions').findOneAndReplace(
      { '_id': Utils.convertToInt(transactionToSave.id) },
      transactionMDB,
      { upsert: true });
    // Debug
    Logging.traceEnd('TransactionStorage', 'saveTransaction', uniqueTimerID, { transactionToSave });
    // Return
    return transactionToSave.id;
  }

  public static async assignTransactionsToUser(tenantID: string, user: User) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'assignTransactionsToUser');
    // Assign transactions
    await global.database.getCollection(tenantID, 'transactions').updateMany({
      $and: [
        { 'userID': null },
        { 'tagID': { $in: user.tags.map((tag) => tag.id) } }
      ]
    }, {
      $set: {
        userID: Utils.convertToObjectID(user.id)
      }
    }, {
      upsert: false
    });
    // Debug
    Logging.traceEnd('TransactionStorage', 'assignTransactionsToUser', uniqueTimerID);
  }

  public static async getUnassignedTransactionsCount(tenantID: string, user: User): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'assignTransactionsToUser');
    // Get the number of unassigned transactions
    const unassignedCount = await global.database.getCollection<Transaction>(tenantID, 'transactions').find({
      $and: [
        { 'userID': null },
        { 'tagID': { $in: user.tags.map((tag) => tag.id) } }
      ]
    }).count();
    // Debug
    Logging.traceEnd('TransactionStorage', 'assignTransactionsToUser', uniqueTimerID);
    return unassignedCount;
  }

  public static async getTransactionYears(tenantID: string): Promise<Date[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactionYears');
    // Check
    await Utils.checkTenant(tenantID);
    const firstTransactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .find({})
      .sort({ timestamp: 1 })
      .limit(1)
      .toArray();
    // Found?
    if (!firstTransactionsMDB || firstTransactionsMDB.length === 0) {
      return null;
    }
    const transactionYears = [];
    // Push the rest of the years up to now
    for (let i = new Date(firstTransactionsMDB[0].timestamp).getFullYear(); i <= new Date().getFullYear(); i++) {
      transactionYears.push(i);
    }
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactionYears', uniqueTimerID);
    return transactionYears;
  }

  public static async getTransactions(tenantID: string,
    params: {
      transactionId?: number; ocpiSessionId?: string; search?: string; ownerID?: string; userIDs?: string[]; siteAdminIDs?: string[];
      chargeBoxIDs?: string[]; siteAreaIDs?: string[]; siteID?: string[]; connectorId?: number; startDateTime?: Date;
      endDateTime?: Date; stop?: any; minimalPrice?: boolean; reportIDs?: string[]; inactivityStatus?: InactivityStatus[];
      statistics?: 'refund' | 'history'; refundStatus?: string[];
    },
    dbParams: DbParams, projectFields?: string[]):
    Promise<{
      count: number; result: Transaction[]; stats: {
        totalConsumptionWattHours?: number; totalPriceRefund?: number; totalPricePending?: number;
        countRefundTransactions?: number; countPendingTransactions?: number; countRefundedReports?: number; totalDurationSecs?: number;
        totalPrice?: number; currency?: string; totalInactivitySecs?: number; count: number;
      };
    }> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactions');
    // Check
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Build filter
    const ownerMatch = { $or: [] };
    const filterMatch: any = {};
    // User / Site Admin
    if (params.ownerID) {
      ownerMatch.$or.push({
        userID: Utils.convertToObjectID(params.ownerID)
      });
    }
    if (params.siteAdminIDs) {
      ownerMatch.$or.push({
        siteID: {
          $in: params.siteAdminIDs.map((siteID) => Utils.convertToObjectID(siteID))
        }
      });
    }
    // Filter?
    if (params.transactionId) {
      filterMatch._id = params.transactionId;
    } else if (params.ocpiSessionId) {
      filterMatch['ocpiSession.id'] = params.ocpiSessionId;
    } else if (params.search) {
      // Build filter
      filterMatch.$or = [
        { '_id': Utils.convertToInt(params.search) },
        { 'tagID': { $regex: params.search, $options: 'i' } },
        { 'chargeBoxID': { $regex: params.search, $options: 'i' } }
      ];
    }
    // Charge Box
    if (params.userIDs) {
      filterMatch.userID = { $in: params.userIDs.map((siteID) => Utils.convertToObjectID(siteID)) };
    }
    // Charge Box
    if (params.chargeBoxIDs) {
      filterMatch.chargeBoxID = { $in: params.chargeBoxIDs };
    }
    // Connector
    if (params.connectorId) {
      filterMatch.connectorId = Utils.convertToInt(params.connectorId);
    }
    // Date provided?
    if (params.startDateTime || params.endDateTime) {
      filterMatch.timestamp = {};
    }
    // Start date
    if (params.startDateTime) {
      filterMatch.timestamp.$gte = Utils.convertToDate(params.startDateTime);
    }
    // End date
    if (params.endDateTime) {
      filterMatch.timestamp.$lte = Utils.convertToDate(params.endDateTime);
    }
    // Check stop transaction
    if (params.stop) {
      filterMatch.stop = params.stop;
    }
    // Inactivity Status
    if (params.inactivityStatus) {
      filterMatch['stop.inactivityStatus'] = { $in: params.inactivityStatus };
    }
    // Site's area ID
    if (params.siteAreaIDs) {
      filterMatch.siteAreaID = {
        $in: params.siteAreaIDs.map((siteAreaID) => Utils.convertToObjectID(siteAreaID))
      };
    }
    // Site ID
    if (params.siteID) {
      filterMatch.siteID = {
        $in: params.siteID.map((siteID) => Utils.convertToObjectID(siteID))
      };
    }
    // Refund status
    if (params.refundStatus && params.refundStatus.length > 0) {
      const statuses = params.refundStatus.map((status) => status === RefundStatus.NOT_SUBMITTED ? null : status);
      filterMatch['refundData.status'] = {
        $in: statuses
      };
    }
    // Minimal Price
    if (params.minimalPrice) {
      filterMatch['stop.price'] = { $gt: Utils.convertToInt(params.minimalPrice) };
    }
    // Report ID
    if (params.reportIDs) {
      filterMatch['refundData.reportId'] = { $in: params.reportIDs };
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (ownerMatch.$or && ownerMatch.$or.length > 0) {
      aggregation.push({
        $match: {
          $and: [
            ownerMatch, filterMatch
          ]
        }
      });
    } else {
      aggregation.push({
        $match: filterMatch
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Prepare statistics query
    let statsQuery = null;
    switch (params.statistics) {
      case 'history': // For historical case
        statsQuery = {
          $group: {
            _id: null,
            firstTimestamp: { $min: '$timestamp' },
            lastTimestamp: { $max: '$timestamp' },
            totalConsumptionWattHours: { $sum: '$stop.totalConsumption' },
            totalDurationSecs: { $sum: '$stop.totalDurationSecs' },
            totalPrice: { $sum: '$stop.price' },
            totalInactivitySecs: { '$sum': { $add: ['$stop.totalInactivitySecs', '$stop.extraInactivitySecs'] } },
            currency: { $addToSet: '$stop.priceUnit' },
            count: { $sum: 1 }
          }
        };
        break;
      case 'refund': // For refund case
        statsQuery = {
          $group: {
            _id: null,
            firstTimestamp: { $min: '$timestamp' },
            lastTimestamp: { $max: '$timestamp' },
            totalConsumptionWattHours: { $sum: '$stop.totalConsumption' },
            totalPriceRefund: { $sum: { $cond: [{ '$in': ['$refundData.status', [RefundStatus.SUBMITTED, RefundStatus.APPROVED]] }, '$stop.price', 0] } },
            totalPricePending: { $sum: { $cond: [{ '$in': ['$refundData.status', [RefundStatus.SUBMITTED, RefundStatus.APPROVED]] }, 0, '$stop.price'] } },
            countRefundTransactions: { $sum: { $cond: [{ '$in': ['$refundData.status', [RefundStatus.SUBMITTED, RefundStatus.APPROVED]] }, 1, 0] } },
            countPendingTransactions: { $sum: { $cond: [{ '$in': ['$refundData.status', [RefundStatus.SUBMITTED, RefundStatus.APPROVED]] }, 0, 1] } },
            currency: { $addToSet: '$stop.priceUnit' },
            countRefundedReports: { $addToSet: '$refundData.reportId' },
            count: { $sum: 1 }
          }
        };
        break;
      default: // Default case only count
        statsQuery = {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        };
        break;
    }
    // Count Records
    const transactionsCountMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate([...aggregation, statsQuery], { allowDiskUse: true })
      .toArray();
    let transactionCountMDB = (transactionsCountMDB && transactionsCountMDB.length > 0) ? transactionsCountMDB[0] : null;
    // Initialize statistics
    if (!transactionCountMDB) {
      switch (params.statistics) {
        case 'history':
          transactionCountMDB = {
            totalConsumptionWattHours: 0,
            totalDurationSecs: 0,
            totalPrice: 0,
            totalInactivitySecs: 0,
            count: 0
          };
          break;
        case 'refund':
          transactionCountMDB = {
            totalConsumptionWattHours: 0,
            totalPriceRefund: 0,
            totalPricePending: 0,
            countRefundTransactions: 0,
            countPendingTransactions: 0,
            countRefundedReports: 0,
            count: 0
          };
          break;
        default:
          transactionCountMDB = {
            count: 0
          };
          break;
      }
    }
    if (transactionCountMDB && transactionCountMDB.countRefundedReports) {
      // Translate array response to number
      transactionCountMDB.countRefundedReports = transactionCountMDB.countRefundedReports.length;
    }
    if (transactionCountMDB && transactionCountMDB.currency) {
      // Take first entry as reference currency. Expectation is that we have only one currency for all transaction
      transactionCountMDB.currency = transactionCountMDB.currency[0];
    }
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      return {
        count: transactionCountMDB ? transactionCountMDB.count : 0,
        stats: transactionCountMDB ? transactionCountMDB : {},
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Not yet possible to remove the fields if stop/remoteStop does not exist (MongoDB 4.2)
    // DatabaseUtils.pushConvertObjectIDToString(aggregation, 'stop.userID');
    // DatabaseUtils.pushConvertObjectIDToString(aggregation, 'remotestop.userID');
    // Sort
    if (dbParams.sort) {
      if (!dbParams.sort.timestamp) {
        aggregation.push({
          $sort: { ...dbParams.sort, timestamp: -1 }
        });
      } else {
        aggregation.push({
          $sort: dbParams.sort
        });
      }
    } else {
      aggregation.push({
        $sort: { timestamp: -1 }
      });
    }
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Add Charge Box
    DatabaseUtils.pushChargingStationLookupInAggregation({
      tenantID,
      aggregation: aggregation,
      localField: 'chargeBoxID',
      foreignField: '_id',
      asField: 'chargeBox',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });
    // Add Users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID,
      aggregation: aggregation,
      asField: 'user',
      localField: 'userID',
      foreignField: '_id',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID,
      aggregation: aggregation,
      asField: 'stop.user',
      localField: 'stop.userID',
      foreignField: '_id',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });
    // Rename ID
    DatabaseUtils.pushRenameField(aggregation, '_id', 'id');
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const transactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Convert Object IDs to String
    this._convertRemainingTransactionObjectIDs(transactionsMDB);
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactions', uniqueTimerID, { params, dbParams });
    return {
      count: transactionCountMDB ? (transactionCountMDB.count === Constants.DB_RECORD_COUNT_CEIL ? -1 : transactionCountMDB.count) : 0,
      stats: transactionCountMDB ? transactionCountMDB : {},
      result: transactionsMDB
    };
  }

  public static async getRefundReports(tenantID: string, filter: { ownerID?: string; siteAdminIDs?: string[] }, dbParams: DbParams, projectFields?: string[]): Promise<{ count: number; result: RefundReport[]; stats: {} }> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactions');
    // Check
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    const ownerMatch = { $or: [] };
    const filterMatch = {};
    filterMatch['refundData.reportId'] = { '$ne': null };

    if (filter.ownerID) {
      ownerMatch.$or.push({
        userID: Utils.convertToObjectID(filter.ownerID)
      });
    }
    if (filter.siteAdminIDs) {
      ownerMatch.$or.push({
        siteID: {
          $in: filter.siteAdminIDs.map((siteID) => Utils.convertToObjectID(siteID))
        }
      });
    }
    if (ownerMatch.$or && ownerMatch.$or.length > 0) {
      aggregation.push({
        $match: {
          $and: [
            ownerMatch, filterMatch
          ]
        }
      });
    } else {
      aggregation.push({
        $match: filterMatch
      });
    }
    aggregation.push(
      { '$group': { '_id': '$refundData.reportId', 'userID': { '$first': '$userID' } } }
    );
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Prepare statistics query
    const statsQuery = {
      $group: {
        _id: null,
        count: { $sum: 1 }
      }
    };
    // Count Records
    const transactionsCountMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate([...aggregation, statsQuery], { allowDiskUse: true })
      .toArray();
    let reportCountMDB = (transactionsCountMDB && transactionsCountMDB.length > 0) ? transactionsCountMDB[0] : null;
    // Initialize statistics
    if (!reportCountMDB) {
      reportCountMDB = {
        count: 0
      };
    }
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      return {
        count: reportCountMDB ? reportCountMDB.count : 0,
        stats: reportCountMDB ? reportCountMDB : {},
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Not yet possible to remove the fields if stop/remoteStop does not exist (MongoDB 4.2)
    // DatabaseUtils.pushConvertObjectIDToString(aggregation, 'stop.userID');
    // DatabaseUtils.pushConvertObjectIDToString(aggregation, 'remotestop.userID');
    // Sort
    if (dbParams.sort) {
      if (!dbParams.sort.timestamp) {
        aggregation.push({
          $sort: { ...dbParams.sort, timestamp: -1 }
        });
      } else {
        aggregation.push({
          $sort: dbParams.sort
        });
      }
    } else {
      aggregation.push({
        $sort: { timestamp: -1 }
      });
    }
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Add respective users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID,
      aggregation: aggregation,
      asField: 'user',
      localField: 'userID',
      foreignField: '_id',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });
    // Rename ID
    DatabaseUtils.pushRenameField(aggregation, '_id', 'id');
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const reportsMDB = await global.database.getCollection<RefundReport>(tenantID, 'transactions')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd('TransactionStorage', 'getRefundReports', uniqueTimerID, { dbParams });
    return {
      count: reportCountMDB ? (reportCountMDB.count === Constants.DB_RECORD_COUNT_CEIL ? -1 : reportCountMDB.count) : 0,
      stats: reportCountMDB ? reportCountMDB : {},
      result: reportsMDB
    };
  }

  static async getTransactionsInError(tenantID,
    params: {
      search?: string; userIDs?: string[]; chargeBoxIDs?: string[];
      siteAreaIDs?: string[]; siteID?: string[]; startDateTime?: Date; endDateTime?: Date; withChargeBoxes?: boolean;
      errorType?: (TransactionInErrorType.LONG_INACTIVITY | TransactionInErrorType.NEGATIVE_ACTIVITY | TransactionInErrorType.NEGATIVE_DURATION | TransactionInErrorType.OVER_CONSUMPTION | TransactionInErrorType.INVALID_START_DATE | TransactionInErrorType.NO_CONSUMPTION | TransactionInErrorType.MISSING_USER | TransactionInErrorType.MISSING_PRICE)[];
    },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<TransactionInError>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactionsInError');
    // Check
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Build filters
    const match: any = { stop: { $exists: true } };
    // Filter?
    if (params.search) {
      match.$or = [
        { '_id': Utils.convertToInt(params.search) },
        { 'tagID': { $regex: params.search, $options: 'i' } },
        { 'chargeBoxID': { $regex: params.search, $options: 'i' } }
      ];
    }
    match.issuer = true;
    // User / Site Admin
    if (params.userIDs) {
      match.userID = { $in: params.userIDs.map((user) => Utils.convertToObjectID(user)) };
    }
    // Charge Box
    if (params.chargeBoxIDs) {
      match.chargeBoxID = { $in: params.chargeBoxIDs };
    }
    // Date provided?
    if (params.startDateTime || params.endDateTime) {
      match.timestamp = {};
    }
    // Start date
    if (params.startDateTime) {
      match.timestamp.$gte = Utils.convertToDate(params.startDateTime);
    }
    // End date
    if (params.endDateTime) {
      match.timestamp.$lte = Utils.convertToDate(params.endDateTime);
    }
    // Site Areas
    if (params.siteAreaIDs) {
      match.siteAreaID = {
        $in: params.siteAreaIDs.map((area) => Utils.convertToObjectID(area))
      };
    }
    // Sites
    if (params.siteID) {
      match.siteID = {
        $in: params.siteID.map((site) => Utils.convertToObjectID(site))
      };
    }
    // Create Aggregation
    let aggregation = [];
    const toSubRequests = [];
    aggregation.push({
      $match: match
    });
    // Charging Station?
    if (params.withChargeBoxes ||
      (params.errorType && params.errorType.includes(TransactionInErrorType.OVER_CONSUMPTION))) {
      // Add Charge Box
      DatabaseUtils.pushChargingStationLookupInAggregation({
        tenantID,
        aggregation: aggregation,
        localField: 'chargeBoxID',
        foreignField: '_id',
        asField: 'chargeBox',
        oneToOneCardinality: true,
        oneToOneCardinalityNotNull: false
      });
    }
    // Add respective users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID,
      aggregation: aggregation,
      asField: 'user',
      localField: 'userID',
      foreignField: '_id',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID,
      aggregation: toSubRequests,
      asField: 'stop.user',
      localField: 'stop.userID',
      foreignField: '_id',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });
    // Used only in the error type : missing_user
    if (params.errorType && params.errorType.includes(TransactionInErrorType.MISSING_USER)) {
      // Site Area
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID,
        aggregation: aggregation,
        localField: 'siteAreaID',
        foreignField: '_id',
        asField: 'siteArea',
        oneToOneCardinality: true,
        objectIDFields: ['createdBy', 'lastChangedBy']
      });
    }
    // Build facets for each type of error if any
    if (params.errorType && Array.isArray(params.errorType) && params.errorType.length > 0) {
      const facets: any = { $facet: {} };
      const array = [];
      params.errorType.forEach((type) => {
        array.push(`$${type}`);
        facets.$facet[type] = this.getTransactionsInErrorFacet(type);
      });
      aggregation.push(facets);
      // Manipulate the results to convert it to an array of document on root level
      aggregation.push({ $project: { 'allItems': { $setUnion: array } } });
      aggregation.push({ $unwind: { 'path': '$allItems' } });
      aggregation.push({ $replaceRoot: { newRoot: '$allItems' } });
      // Add a unique identifier as we may have the same Charging Station several time
      aggregation.push({ $addFields: { 'uniqueId': { $concat: [{ $substr: ['$_id', 0, -1] }, '#', '$errorCode'] } } });
    }
    aggregation = aggregation.concat(toSubRequests);
    // Rename ID
    DatabaseUtils.pushRenameField(aggregation, '_id', 'id');
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    // Not yet possible to remove the fields if stop/remoteStop does not exist (MongoDB 4.2)
    // DatabaseUtils.pushConvertObjectIDToString(aggregation, 'stop.userID');
    // DatabaseUtils.pushConvertObjectIDToString(aggregation, 'remotestop.userID');
    // Sort
    if (dbParams.sort) {
      if (!dbParams.sort.timestamp) {
        aggregation.push({
          $sort: { ...dbParams.sort, timestamp: -1 }
        });
      } else {
        aggregation.push({
          $sort: dbParams.sort
        });
      }
    } else {
      aggregation.push({
        $sort: { timestamp: -1 }
      });
    }
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const transactionsMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    const transactionCountMDB = transactionsMDB.length;
    // Convert remaining Object IDs to String
    this._convertRemainingTransactionObjectIDs(transactionsMDB);
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactionsInError', uniqueTimerID, {
      params,
      dbParams
    });
    return {
      count: transactionCountMDB,
      result: transactionsMDB
    };
  }

  public static async getTransaction(tenantID: string, id: number): Promise<Transaction> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // Delegate work
    const transactionsMDB = await TransactionStorage.getTransactions(tenantID, { transactionId: id }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransaction', uniqueTimerID, { id });
    // Found?
    if (transactionsMDB && transactionsMDB.count > 0) {
      return transactionsMDB.result[0];
    }
    return null;
  }

  public static async getOCPITransaction(tenantID: string, sessionId: string): Promise<Transaction> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getOCPITransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // Delegate work
    const transactionsMDB = await TransactionStorage.getTransactions(tenantID, { ocpiSessionId: sessionId }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd('TransactionStorage', 'getOCPITransaction', uniqueTimerID, { sessionId });
    // Found?
    if (transactionsMDB && transactionsMDB.count > 0) {
      return transactionsMDB.result[0];
    }
    return null;
  }

  public static async getActiveTransaction(tenantID: string, chargeBoxID: string, connectorId: number): Promise<Transaction> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getActiveTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        'chargeBoxID': chargeBoxID,
        'connectorId': Utils.convertToInt(connectorId),
        'stop': { $exists: false }
      }
    });
    // Add User
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID, aggregation, localField: 'userID', foreignField: '_id', asField: 'user',
      oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Rename ID
    DatabaseUtils.pushRenameField(aggregation, '_id', 'id');
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    // Read DB
    const transactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('TransactionStorage', 'getActiveTransaction', uniqueTimerID, {
      chargeBoxID,
      connectorId
    });
    // Found?
    if (transactionsMDB && transactionsMDB.length > 0) {
      // Convert remaining Object IDs to String
      this._convertRemainingTransactionObjectIDs(transactionsMDB);
      return transactionsMDB[0];
    }
    return null;
  }

  public static async getLastTransaction(tenantID: string, chargeBoxID: string, connectorId: number): Promise<Transaction> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getLastTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        'chargeBoxID': chargeBoxID,
        'connectorId': Utils.convertToInt(connectorId)
      }
    });
    // Rename ID
    DatabaseUtils.pushRenameField(aggregation, '_id', 'id');
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    // Sort
    aggregation.push({ $sort: { timestamp: -1 } });
    // The last one
    aggregation.push({ $limit: 1 });
    // Add Charge Box
    DatabaseUtils.pushChargingStationLookupInAggregation({
      tenantID,
      aggregation: aggregation,
      localField: 'chargeBoxID',
      foreignField: '_id',
      asField: 'chargeBox',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });
    // Read DB
    const transactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('TransactionStorage', 'getLastTransaction', uniqueTimerID, {
      chargeBoxID,
      connectorId
    });
    // Found?
    if (transactionsMDB && transactionsMDB.length > 0) {
      // Convert remaining Object IDs to String
      this._convertRemainingTransactionObjectIDs(transactionsMDB);
      return transactionsMDB[0];
    }
    return null;
  }

  public static async _findAvailableID(tenantID: string): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', '_findAvailableID');
    // Check
    await Utils.checkTenant(tenantID);
    let existingTransaction: Transaction;
    do {
      // Generate new transaction ID
      const id = Utils.getRandomInt();
      existingTransaction = await TransactionStorage.getTransaction(tenantID, id);
      if (existingTransaction) {
        Logging.logWarning({
          tenantID: tenantID,
          module: 'TransactionStorage',
          method: '_findAvailableID', action: 'nextID',
          message: `Transaction ID '${id}' already exists, generating a new one...`
        });
      } else {
        return id;
      }
    } while (existingTransaction);
    // Debug
    Logging.traceEnd('TransactionStorage', '_findAvailableID', uniqueTimerID);
  }

  public static async getNotStartedTransactions(tenantID: string,
    params: { checkPastAuthorizeMins: number; sessionShouldBeStartedAfterMins: number }): Promise<DataResult<NotifySessionNotStarted>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getNotStartedTransactions');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Compute the date some minutes ago
    const authorizeStartDate = moment().subtract(params.checkPastAuthorizeMins, 'minutes').toDate();
    const authorizeEndDate = moment().subtract(params.sessionShouldBeStartedAfterMins, 'minutes').toDate();
    // Create Aggregation
    const aggregation = [];
    // Authorization window
    aggregation.push({
      $match: {
        timestamp: {
          $gt: Utils.convertToDate(authorizeStartDate),
          $lt: Utils.convertToDate(authorizeEndDate)
        }
      }
    });
    // Group by tagID
    aggregation.push({
      $group: {
        _id: '$tagID',
        authDate: {
          $last: '$timestamp'
        },
        chargeBoxID: {
          $last: '$chargeBoxID'
        },
        userID: {
          $last: '$userID'
        }
      }
    });
    // Add number of mins
    aggregation.push({
      $addFields: {
        dateStart: {
          $toDate: { $subtract: [{ $toLong: '$authDate' }, 5 * 60 * 1000] }
        },
        dateEnd: {
          $toDate: { $add: [{ $toLong: '$authDate' }, params.sessionShouldBeStartedAfterMins * 60 * 1000] }
        }
      }
    });
    // Lookup for transactions
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'transactions'),
        let: { tagID: '$_id', dateStart: '$dateStart', dateEnd: '$dateEnd' },
        pipeline: [{
          $match: {
            $and: [
              { $expr: { $eq: ['$tagID', '$$tagID'] } },
              { $expr: { $gt: ['$timestamp', '$$dateStart'] } },
              { $expr: { $lt: ['$timestamp', '$$dateEnd'] } }
            ]
          }
        }],
        as: 'transaction'
      }
    });
    // Get only authorize with no transactions
    aggregation.push({
      $match: {
        transaction: { $size: 0 }
      }
    });
    // Lookup for users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID, aggregation, localField: 'userID', foreignField: '_id',
      asField: 'user', oneToOneCardinality: true, oneToOneCardinalityNotNull: true
    });
    // Lookup for charging station
    DatabaseUtils.pushChargingStationLookupInAggregation({
      tenantID, aggregation, localField: 'chargeBoxID', foreignField: '_id',
      asField: 'chargingStation', oneToOneCardinality: true, oneToOneCardinalityNotNull: true
    });
    // Format Data
    aggregation.push({
      $project: {
        _id: 0,
        tagID: '$_id',
        authDate: '$dateStart',
        chargingStation: 1,
        user: 1
      }
    });
    // Read DB
    const notifySessionNotStarted: NotifySessionNotStarted[] =
      await global.database.getCollection<NotifySessionNotStarted>(tenantID, 'authorizes')
        .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
        .toArray();
    // Debug
    Logging.traceEnd('ChargingStationStorage', 'getNotStartedTransactions', uniqueTimerID);
    return {
      count: notifySessionNotStarted.length,
      result: notifySessionNotStarted
    };
  }

  private static getTransactionsInErrorFacet(errorType: string) {
    switch (errorType) {
      case TransactionInErrorType.LONG_INACTIVITY:
        return [
          { $addFields: { 'totalInactivity': { $add: ['$stop.totalInactivitySecs', '$stop.extraInactivitySecs'] } } },
          { $match: { 'totalInactivity': { $gte: 86400 } } },
          { $addFields: { 'errorCode': TransactionInErrorType.LONG_INACTIVITY } }
        ];
      case TransactionInErrorType.NO_CONSUMPTION:
        return [
          { $match: { 'stop.totalConsumption': { $lte: 0 } } },
          { $addFields: { 'errorCode': TransactionInErrorType.NO_CONSUMPTION } }
        ];
      case TransactionInErrorType.NEGATIVE_ACTIVITY:
        return [
          {
            $match: {
              $or: [
                { 'stop.totalInactivitySecs': { $lt: 0 } },
                { 'stop.extraInactivitySecs': { $lt: 0 } },
              ]
            }
          },
          { $addFields: { 'errorCode': TransactionInErrorType.NEGATIVE_ACTIVITY } }
        ];
      case TransactionInErrorType.NEGATIVE_DURATION:
        return [
          { $match: { 'stop.totalDurationSecs': { $lt: 0 } } },
          { $addFields: { 'errorCode': TransactionInErrorType.NEGATIVE_DURATION } }
        ];
      case TransactionInErrorType.INVALID_START_DATE:
        return [
          { $match: { 'timestamp': { $lte: Utils.convertToDate('2017-01-01 00:00:00.000Z') } } },
          { $addFields: { 'errorCode': TransactionInErrorType.INVALID_START_DATE } }
        ];
      case TransactionInErrorType.OVER_CONSUMPTION:
        return [
          { $addFields: { activeDuration: { $subtract: ['$stop.totalDurationSecs', '$stop.totalInactivitySecs'] } } },
          { $match: { 'activeDuration': { $gt: 0 } } },
          { $addFields: { connector: { $arrayElemAt: ['$chargeBox.connectors', { $subtract: ['$connectorId', 1] }] } } },
          { $addFields: { averagePower: { $abs: { $multiply: [{ $divide: ['$stop.totalConsumption', '$activeDuration'] }, 3600] } } } },
          { $addFields: { impossiblePower: { $lte: [{ $subtract: [{ $multiply: ['$connector.power', 1.05] }, '$averagePower'] }, 0] } } },
          { $match: { 'impossiblePower': { $eq: true } } },
          { $addFields: { 'errorCode': TransactionInErrorType.OVER_CONSUMPTION } }
        ];
      case TransactionInErrorType.MISSING_PRICE:
        return [
          { $match: { 'stop.price': { $lte: 0 } } },
          { $match: { 'stop.totalConsumption': { $gt: 0 } } },
          { $addFields: { 'errorCode': TransactionInErrorType.MISSING_PRICE } }
        ];
      case TransactionInErrorType.MISSING_USER:
        return [
          {
            $match: {
              $and: [
                {
                  $or: [
                    { 'userID': null },
                    { 'user': null },
                  ]
                },
                { 'siteArea.accessControl': { '$eq': true } }
              ]
            }
          },
          { $addFields: { 'errorCode': TransactionInErrorType.MISSING_USER } }
        ];
      default:
        return [];
    }
  }

  private static _convertRemainingTransactionObjectIDs(transactionsMDB: Transaction[]) {
    for (const transactionMDB of transactionsMDB) {
      // Check Stop created by the join
      if (transactionMDB.stop && Utils.isEmptyJSon(transactionMDB.stop)) {
        delete transactionMDB.stop;
      }
      // Check conversion of MongoDB IDs in sub-document
      if (transactionMDB.stop && transactionMDB.stop.userID) {
        transactionMDB.stop.userID = transactionMDB.stop.userID.toString();
      }
      if (transactionMDB.remotestop && transactionMDB.remotestop.userID) {
        transactionMDB.remotestop.userID = transactionMDB.remotestop.userID.toString();
      }
    }
  }
}
