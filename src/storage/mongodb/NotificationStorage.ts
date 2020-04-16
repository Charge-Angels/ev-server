import DbParams from '../../types/database/DbParams';
import { DataResult } from '../../types/DataResult';
import global from '../../types/GlobalType';
import { Notification } from '../../types/UserNotifications';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';

const MODULE_NAME = 'NotificationStorage';

export default class NotificationStorage {

  static async getNotifications(tenantID: string,
    params: { userID?: string; dateFrom?: Date; channel?: string; sourceId?: string; sourceDescr?: string; data?: object; chargeBoxID?: string },
    dbParams: DbParams): Promise<DataResult<Notification>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getNotifications');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation: any[] = [];
    // Set the filters
    const filters: any = {};
    // Set Date From?
    if (params.dateFrom) {
      filters.timestamp = {};
      filters.timestamp.$gte = Utils.convertToDate(params.dateFrom);
    }
    // Set Channel?
    if (params.channel) {
      filters.channel = params.channel;
    }
    // Set Source?
    if (params.sourceDescr) {
      filters.sourceDescr = params.sourceDescr;
    }
    // Set ChargeBox?
    if (params.chargeBoxID) {
      filters.chargeBoxID = params.chargeBoxID;
    }
    // Set User ID?
    if (params.userID) {
      filters.userID = Utils.convertToObjectID(params.userID);
    }
    // Set Data
    if (params.data) {
      for (const key in params.data) {
        filters[`data.${key}`] = params.data[key];
      }
    }
    // Set SourceId?
    if (params.sourceId) {
      filters.sourceId = params.sourceId;
    }
    // Filters
    aggregation.push({
      $match: filters
    });
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const notificationsCountMDB = await global.database.getCollection<any>(tenantID, 'notifications')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      return {
        count: (notificationsCountMDB.length > 0 ? notificationsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Charge Box
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'chargingstations'),
        localField: 'chargeBoxID',
        foreignField: '_id',
        as: 'chargeBox'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: { 'path': '$chargeBox', 'preserveNullAndEmptyArrays': true }
    });
    // Add User
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: 'userID',
        foreignField: '_id',
        as: 'user'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: { 'path': '$user', 'preserveNullAndEmptyArrays': true }
    });
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: { timestamp: -1 }
      });
    }
    // Skip
    aggregation.push({
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });
    // Read DB
    const notificationsMDB = await global.database.getCollection<any>(tenantID, 'notifications')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getNotifications', uniqueTimerID, params);
    // Ok
    return {
      count: (notificationsCountMDB.length > 0 ? notificationsCountMDB[0].count : 0),
      result: notificationsMDB
    };
  }

  static async saveNotification(tenantID: string, notificationToSave: Notification): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveNotification');
    // Check Tenant
    await Utils.checkTenant(tenantID);

    const ocpiEndpointMDB: any = {
      _id: Cypher.hash(`${notificationToSave.sourceId}~${notificationToSave.channel}`),
      userID: Utils.convertToObjectID(notificationToSave.userID),
      timestamp: Utils.convertToDate(notificationToSave.timestamp),
      channel: notificationToSave.channel,
      sourceId: notificationToSave.sourceId,
      sourceDescr: notificationToSave.sourceDescr,
      data: notificationToSave.data,
      chargeBoxID: notificationToSave.chargeBoxID
    };

    // Create
    await global.database.getCollection<any>(tenantID, 'notifications')
      .insertOne(ocpiEndpointMDB);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveNotification', uniqueTimerID, { notificationToSave });
  }
}
