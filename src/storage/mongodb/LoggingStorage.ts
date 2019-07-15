import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import DatabaseUtils from './DatabaseUtils';
import global from './../../types/GlobalType';
import Utils from '../../utils/Utils';

export default class LoggingStorage {
  public static async deleteLogs(tenantID, deleteUpToDate) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const filters: any = {};
    // Do Not Delete Security Logs
    filters.type = {};
    filters.type.$ne = 'S';
    // Date provided?
    if (deleteUpToDate) {
      filters.timestamp = {};
      filters.timestamp.$lte = new Date(deleteUpToDate);
    } else {
      return;
    }
    // Delete Logs
    const result = await global.database.getCollection<any>(tenantID, 'logs')
      .deleteMany(filters);
    // Return the result
    return result.result;
  }

  public static async deleteSecurityLogs(tenantID, deleteUpToDate) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const filters: any = {};
    // Delete Only Security Logs
    filters.type = {};
    filters.type.$eq = 'S';
    // Date provided?
    if (deleteUpToDate) {
      filters.timestamp = {};
      filters.timestamp.$lte = new Date(deleteUpToDate);
    } else {
      return;
    }
    // Delete Logs
    const result = await global.database.getCollection<any>(tenantID, 'logs')
      .deleteMany(filters);
    // Return the result
    return result.result;
  }

  public static async saveLog(tenantID, logToSave) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check User
    if ('user' in logToSave) {
      logToSave.userID = Utils.convertUserToObjectID(logToSave.user);
    }
    if ('actionOnUser' in logToSave) {
      logToSave.actionOnUserID = Utils.convertUserToObjectID(logToSave.actionOnUser);
    }
    // Transfer
    const log: any = {};
    Database.updateLogging(logToSave, log, false);
    // Insert
    await global.database.getCollection<any>(tenantID, 'logs').insertOne(log);
  }

  public static async getLog(tenantID, id) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const loggingMDB = await global.database.getCollection<any>(tenantID, 'logs')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let logging = null;
    // Set
    if (loggingMDB && loggingMDB.length > 0) {
      // Set
      logging = {};
      Database.updateLogging(loggingMDB[0], logging);
    }
    return logging;
  }

  public static async getLogs(tenantID, params: any = {}, limit?, skip?, sort?) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters: any = {};
    // Date provided?
    if (params.dateFrom || params.dateUntil) {
      filters.timestamp = {};
    }
    // Start date
    if (params.dateFrom) {
      filters.timestamp.$gte = new Date(params.dateFrom);
    }
    // End date
    if (params.dateUntil) {
      filters.timestamp.$lte = new Date(params.dateUntil);
    }

    // Log level
    switch (params.level) {
      // Build filter
      // Error
      case 'E':
        filters.level = 'E';
        break;
      // Warning
      case 'W':
        filters.level = { $in: ['E', 'W'] };
        break;
      // Info
      case 'I':
        filters.level = { $in: ['E', 'W', 'I'] };
        break;
    }
    // Charging Station
    if (params.source) {
      // Parse source with the | delimiter
      const sourceSplitted = params.source.split('|');
      if(sourceSplitted.length > 1) {
        filters.source = { $in: sourceSplitted };
      } else {
        filters.source = params.source;
      }
    }
    // Type
    if (params.type) {
      // Yes, add in filter
      filters.type = params.type;
    }
    // Action
    if (params.action) {
      // Parse action with the | delimiter for multiple values
      const actionSplitted = params.action.split('|');
      if(actionSplitted.length > 1) {
        filters.action = { $in: actionSplitted };
      } else {
        filters.action = params.action;
      }
    }
    // User ID
    if (params.userID) {
      // Yes, add in filter
      // Parse action with the | delimiter for multiple values
      const userSplitted = params.userID.split('|');
      const userArray = [];
      userSplitted.forEach((user)=>{
        userArray.push({"userID": Utils.convertToObjectID(user)});
        userArray.push({"actionOnUserID": Utils.convertToObjectID(user)});
      });
      filters.$or = userArray;
    }
    // Source?
    if (params.search) {
      // Set
      const searchArray = [
        { 'source': { $regex: params.search, $options: 'i' } },
        { 'message': { $regex: params.search, $options: 'i' } },
        { 'detailedMessages': { $regex: params.search, $options: 'i' } },
        { 'action': { $regex: params.search, $options: 'i' } }
      ];
      // Already exists?
      if (filters.$or) {
        // Add them all
        filters.$and = [
          { $or: [...filters.$or] },
          { $or: [...searchArray] },
        ];
      } else {
        // Only one
        filters.$or = searchArray;
      }
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Count Records
    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    const loggingsCountMDB = await global.database.getCollection<any>(tenantID, 'logs')
      .aggregate([...aggregation, { $count: 'count' }], { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
      // Return only the count
      return {
        count: (loggingsCountMDB.length > 0 ? loggingsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
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
    // User
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
    // Action on User
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: 'actionOnUserID',
        foreignField: '_id',
        as: 'actionOnUser'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: { 'path': '$actionOnUser', 'preserveNullAndEmptyArrays': true }
    });
    // Read DB
    const loggingsMDB = await global.database.getCollection<any>(tenantID, 'logs')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    const loggings = [];
    for (const loggingMDB of loggingsMDB) {
      const logging: any = {};
      // Set
      Database.updateLogging(loggingMDB, logging);
      // Set the model
      loggings.push(logging);
    }
    // Ok
    return {
      count: (loggingsCountMDB.length > 0 ?
        (loggingsCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : loggingsCountMDB[0].count) : 0),
      result: loggings
    };
  }
}
