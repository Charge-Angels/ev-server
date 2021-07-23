import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import Consumption from '../../types/Consumption';
import Cypher from '../../utils/Cypher';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'ConsumptionStorage';

export default class ConsumptionStorage {
  static async saveConsumption(tenantID: string, consumptionToSave: Consumption): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveConsumption');
    // Check
    await DatabaseUtils.checkTenant(tenantID);
    // Build
    const consumptionMDB = ConsumptionStorage.buildConsumptionMDB(consumptionToSave);
    // Modify
    await global.database.getCollection<any>(tenantID, 'consumptions').findOneAndUpdate(
      { '_id': consumptionMDB._id },
      { $set: consumptionMDB },
      { upsert: true });
    // Debug
    await Logging.traceEnd(tenantID, MODULE_NAME, 'saveConsumption', uniqueTimerID, consumptionMDB);
    // Return
    return consumptionMDB._id;
  }

  static async saveConsumptions(tenantID: string, consumptionsToSave: Consumption[]): Promise<string[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveConsumptions');
    // Check
    await DatabaseUtils.checkTenant(tenantID);
    const consumptionsMDB = [];
    for (const consumptionToSave of consumptionsToSave) {
      // Build
      const consumptionMDB = ConsumptionStorage.buildConsumptionMDB(consumptionToSave);
      // Add
      consumptionsMDB.push(consumptionMDB);
    }
    // Insert
    await global.database.getCollection<any>(tenantID, 'consumptions').insertMany(consumptionsMDB);
    // Debug
    await Logging.traceEnd(tenantID, MODULE_NAME, 'saveConsumptions', uniqueTimerID, consumptionsToSave);
    // Return
    return consumptionsMDB.map((consumptionMDB) => consumptionMDB._id);
  }

  static async deleteConsumptions(tenantID: string, transactionIDs: number[]): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteConsumptions');
    // Check
    await DatabaseUtils.checkTenant(tenantID);
    // DeleFte
    await global.database.getCollection<any>(tenantID, 'consumptions')
      .deleteMany({ 'transactionId': { $in: transactionIDs } });
    // Debug
    await Logging.traceEnd(tenantID, MODULE_NAME, 'deleteConsumptions', uniqueTimerID, { transactionIDs });
  }

  static async getAssetConsumptions(tenantID: string, params: { assetID: string; startDate: Date; endDate: Date }, projectFields?: string[]): Promise<Consumption[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getAssetConsumptions');
    // Check
    await DatabaseUtils.checkTenant(tenantID);
    // Create filters
    const filters: FilterParams = {};
    // ID
    if (params.assetID) {
      filters.assetID = DatabaseUtils.convertToObjectID(params.assetID);
    }
    // Date provided?
    if (params.startDate || params.endDate) {
      filters.startedAt = {};
    }
    // Start date
    if (params.startDate) {
      filters.startedAt.$gte = Utils.convertToDate(params.startDate);
    }
    // End date
    if (params.endDate) {
      filters.startedAt.$lte = Utils.convertToDate(params.endDate);
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Group consumption values per minute
    aggregation.push({
      $group: {
        _id: {
          year: { '$year': '$startedAt' },
          month: { '$month': '$startedAt' },
          day: { '$dayOfMonth': '$startedAt' },
          hour: { '$hour': '$startedAt' },
          minute: { '$minute': '$startedAt' }
        },
        instantWatts: { $avg: '$instantWatts' },
        instantAmps: { $avg: '$instantAmps' },
        limitWatts: { $last: '$limitSiteAreaWatts' },
        limitAmps: { $last: '$limitSiteAreaAmps' },
        stateOfCharge: { $last: '$stateOfCharge' },
      }
    });
    // Rebuild the date
    aggregation.push({
      $addFields: {
        startedAt: {
          $dateFromParts: { 'year': '$_id.year', 'month': '$_id.month', 'day': '$_id.day', 'hour': '$_id.hour', 'minute': '$_id.minute' }
        }
      }
    });
    // Same date
    aggregation.push({
      $addFields: {
        endedAt: '$startedAt'
      }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'assetID');
    aggregation.push({
      $sort: {
        startedAt: 1
      }
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const consumptionsMDB = await global.database.getCollection<Consumption>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    await Logging.traceEnd(tenantID, MODULE_NAME, 'getAssetConsumptions', uniqueTimerID, consumptionsMDB);
    return consumptionsMDB;
  }

  static async getLastAssetConsumption(tenant: Tenant, params: { assetID: string }): Promise<Consumption> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'getLastAssetConsumption');
    // Check
    DatabaseUtils.checkTenantObject(tenant);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        assetID: DatabaseUtils.convertToObjectID(params.assetID)
      }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    aggregation.push({
      $sort: { startedAt: -1 }
    });
    // Limit
    aggregation.push({
      $limit: 1
    });
    let consumption: Consumption = null;
    // Read DB
    const consumptionsMDB = await global.database.getCollection<Consumption>(tenant.id, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    if (consumptionsMDB && consumptionsMDB.length > 0) {
      consumption = consumptionsMDB[0];
    }
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'getLastAssetConsumption', uniqueTimerID, consumptionsMDB);
    return consumption;
  }

  static async getSiteAreaConsumptions(tenantID: string,
      params: { siteAreaID: string; startDate: Date; endDate: Date },
      projectFields?: string[]): Promise<Consumption[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getSiteAreaConsumptions');
    // Check
    await DatabaseUtils.checkTenant(tenantID);
    // Create filters
    const filters: FilterParams = {};
    // ID
    if (params.siteAreaID) {
      filters.siteAreaID = DatabaseUtils.convertToObjectID(params.siteAreaID);
    }
    // Date provided?
    if (params.startDate || params.endDate) {
      filters.startedAt = {};
    }
    // Start date
    if (params.startDate) {
      filters.startedAt.$gte = Utils.convertToDate(params.startDate);
    }
    // End date
    if (params.endDate) {
      filters.startedAt.$lte = Utils.convertToDate(params.endDate);
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Group consumption values per minute
    aggregation.push({
      $group: {
        _id: {
          year: { '$year': '$startedAt' },
          month: { '$month': '$startedAt' },
          day: { '$dayOfMonth': '$startedAt' },
          hour: { '$hour': '$startedAt' },
          minute: { '$minute': '$startedAt' }
        },
        instantWatts: { $sum: '$instantWatts' },
        instantAmps: { $sum: '$instantAmps' },
        limitWatts: { $last: '$limitSiteAreaWatts' },
        limitAmps: { $last: '$limitSiteAreaAmps' }
      }
    });
    // Rebuild the date
    aggregation.push({
      $addFields: {
        startedAt: {
          $dateFromParts: { 'year': '$_id.year', 'month': '$_id.month', 'day': '$_id.day', 'hour': '$_id.hour', 'minute': '$_id.minute' }
        }
      }
    });
    // Same date
    aggregation.push({
      $addFields: {
        endedAt: '$startedAt'
      }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    aggregation.push({
      $sort: {
        startedAt: 1
      }
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields, ['_id']);
    // Read DB
    const consumptionsMDB = await global.database.getCollection<Consumption>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    await Logging.traceEnd(tenantID, MODULE_NAME, 'getSiteAreaConsumptions', uniqueTimerID, consumptionsMDB);
    return consumptionsMDB;
  }

  static async getSiteAreaChargingStationConsumptions(tenant: Tenant,
      params: { siteAreaID: string; startDate: Date; endDate: Date }, dbParams: DbParams = Constants.DB_PARAMS_MAX_LIMIT,
      projectFields?: string[]): Promise<DataResult<Consumption>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenant.id, MODULE_NAME, 'getSiteAreaChargingStationConsumptions');
    // Check
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { endedAt: 1 };
    }
    // Create Aggregation
    const aggregation = [];
    // Create filters
    const filters: FilterParams = {};
    // ID
    if (params.siteAreaID) {
      filters.siteAreaID = DatabaseUtils.convertToObjectID(params.siteAreaID);
    }
    // Date provided?
    if (params.startDate || params.endDate) {
      filters.endedAt = {};
    }
    // Start date
    if (params.startDate) {
      filters.endedAt.$gte = Utils.convertToDate(params.startDate);
    }
    // End date
    if (params.endDate) {
      filters.endedAt.$lte = Utils.convertToDate(params.endDate);
    }
    // Check that charging station is set
    filters.chargeBoxID = { '$ne': null };
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Group consumption values per minute
    aggregation.push({
      $group: {
        _id: {
          year: { '$year': '$endedAt' },
          month: { '$month': '$endedAt' },
          day: { '$dayOfMonth': '$endedAt' },
          hour: { '$hour': '$endedAt' },
          minute: { '$minute': '$endedAt' }
        },
        instantWatts: { $sum: '$instantWatts' },
        instantWattsL1: { $sum: '$instantWattsL1' },
        instantWattsL2: { $sum: '$instantWattsL2' },
        instantWattsL3: { $sum: '$instantWattsL3' },
        instantAmps: { $sum: '$instantAmps' },
        limitWatts: { $last: '$limitSiteAreaWatts' },
        limitAmps: { $last: '$limitSiteAreaAmps' }
      }
    });
    // Rebuild the date
    aggregation.push({
      $addFields: {
        endedAt: {
          $dateFromParts: { 'year': '$_id.year', 'month': '$_id.month', 'day': '$_id.day', 'hour': '$_id.hour', 'minute': '$_id.minute' }
        }
      }
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields, ['_id']);
    // Read DB
    const consumptionsMDB = await global.database.getCollection<Consumption>(tenant.id, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    await Logging.traceEnd(tenant.id, MODULE_NAME, 'getSiteAreaChargingStationConsumptions', uniqueTimerID, consumptionsMDB);
    return {
      count: consumptionsMDB.length,
      result: consumptionsMDB
    };
  }

  static async getTransactionConsumptions(tenantID: string, params: { transactionId: number },
      dbParams: DbParams = Constants.DB_PARAMS_MAX_LIMIT, projectFields?: string[]): Promise<DataResult<Consumption>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getTransactionConsumptions');
    // Check
    await DatabaseUtils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        transactionId: Utils.convertToInt(params.transactionId)
      }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { startedAt: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const consumptionsMDB = await global.database.getCollection<Consumption>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    await Logging.traceEnd(tenantID, MODULE_NAME, 'getTransactionConsumptions', uniqueTimerID, consumptionsMDB);
    return {
      count: consumptionsMDB.length,
      result: consumptionsMDB
    };
  }

  static async getLastTransactionConsumption(tenantID: string, params: { transactionId: number }): Promise<Consumption> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getLastTransactionConsumption');
    // Check
    await DatabaseUtils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        transactionId: Utils.convertToInt(params.transactionId)
      }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    aggregation.push({
      $sort: { startedAt: -1 }
    });
    // Limit
    aggregation.push({
      $limit: 1
    });
    let consumption: Consumption = null;
    // Read DB
    const consumptionsMDB = await global.database.getCollection<Consumption>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    if (consumptionsMDB && consumptionsMDB.length > 0) {
      consumption = consumptionsMDB[0];
    }
    // Debug
    await Logging.traceEnd(tenantID, MODULE_NAME, 'getLastTransactionConsumption', uniqueTimerID, consumptionsMDB);
    return consumption;
  }

  static async getOptimizedTransactionConsumptions(tenantID: string, params: { transactionId: number }, projectFields?: string[]): Promise<Consumption[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getOptimizedTransactionConsumptions');
    // Check
    await DatabaseUtils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        transactionId: Utils.convertToInt(params.transactionId)
      }
    });
    aggregation.push({
      $addFields: { roundedInstantPower: { $round: [{ $divide: ['$instantWatts', 100] }] } }
    });
    // Triming excess values
    aggregation.push({
      $group: {
        _id: {
          roundedInstantPower: '$roundedInstantPower',
          limitWatts: '$limitWatts'
        },
        consumptions: { $push: '$$ROOT' }
      }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    aggregation.push({
      $sort: { 'consumptions.startedAt': 1 }
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const consumptionsMDB = await global.database.getCollection<any>(tenantID, 'consumptions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // TODO: Handle this coding into MongoDB request
    const consumptions: Consumption[] = [];
    for (const consumptionMDB of consumptionsMDB) {
      let lastConsumption: Consumption = null;
      let lastConsumtionRemoved = false;
      // Simplify grouped consumption
      for (let i = 0; i <= consumptionMDB.consumptions.length - 3; i++) {
        if (!lastConsumption) {
          lastConsumption = consumptionMDB.consumptions[i];
        }
        if (lastConsumption.endedAt && consumptionMDB.consumptions[i + 1].startedAt &&
            lastConsumption.endedAt.getTime() === consumptionMDB.consumptions[i + 1].startedAt.getTime()) {
          // Remove
          lastConsumption = consumptionMDB.consumptions[i + 1];
          consumptionMDB.consumptions.splice(i + 1, 1);
          lastConsumtionRemoved = true;
          i--;
        } else {
          // Insert the last consumption before it changes
          if (lastConsumtionRemoved) {
            consumptionMDB.consumptions.splice(i, 0, lastConsumption);
            lastConsumtionRemoved = false;
            i++;
          }
          lastConsumption = consumptionMDB.consumptions[i + 1];
        }
      }
      // Unwind
      for (const consumption of consumptionMDB.consumptions) {
        consumptions.push(consumption);
      }
    }
    // Sort
    consumptions.sort((cons1, cons2) => cons1.endedAt.getTime() - cons2.endedAt.getTime());
    // Debug
    await Logging.traceEnd(tenantID, MODULE_NAME, 'getOptimizedTransactionConsumptions', uniqueTimerID, consumptions);
    return consumptions;
  }

  private static buildConsumptionMDB(consumption: Consumption): any {
    // Set the ID
    if (!consumption.id) {
      const timestamp = Utils.convertToDate(consumption.endedAt);
      if (consumption.transactionId) {
        consumption.id = Cypher.hash(`${consumption.transactionId}~${timestamp.toISOString()}`);
      } else if (consumption.assetID) {
        consumption.id = Cypher.hash(`${consumption.assetID}~${timestamp.toISOString()}`);
      } else {
        throw new Error('Consumption cannot be saved: no Transaction ID or Asset ID provided');
      }
    }
    return {
      _id: consumption.id,
      startedAt: Utils.convertToDate(consumption.startedAt),
      endedAt: Utils.convertToDate(consumption.endedAt),
      transactionId: Utils.convertToInt(consumption.transactionId),
      chargeBoxID: consumption.chargeBoxID,
      connectorId: Utils.convertToInt(consumption.connectorId),
      siteAreaID: DatabaseUtils.convertToObjectID(consumption.siteAreaID),
      siteID: DatabaseUtils.convertToObjectID(consumption.siteID),
      assetID: DatabaseUtils.convertToObjectID(consumption.assetID),
      consumptionWh: Utils.convertToFloat(consumption.consumptionWh),
      consumptionAmps: Utils.convertToFloat(consumption.consumptionAmps),
      cumulatedAmount: Utils.convertToFloat(consumption.cumulatedAmount),
      cumulatedConsumptionWh: Utils.convertToFloat(consumption.cumulatedConsumptionWh),
      cumulatedConsumptionAmps: Utils.convertToFloat(consumption.cumulatedConsumptionAmps),
      pricingSource: consumption.pricingSource,
      amount: Utils.convertToFloat(consumption.amount),
      roundedAmount: Utils.convertToFloat(consumption.roundedAmount),
      currencyCode: consumption.currencyCode,
      instantWatts: Utils.convertToFloat(consumption.instantWatts),
      instantWattsL1: Utils.convertToFloat(consumption.instantWattsL1),
      instantWattsL2: Utils.convertToFloat(consumption.instantWattsL2),
      instantWattsL3: Utils.convertToFloat(consumption.instantWattsL3),
      instantWattsDC: Utils.convertToFloat(consumption.instantWattsDC),
      instantAmps: Utils.convertToFloat(consumption.instantAmps),
      instantAmpsL1: Utils.convertToFloat(consumption.instantAmpsL1),
      instantAmpsL2: Utils.convertToFloat(consumption.instantAmpsL2),
      instantAmpsL3: Utils.convertToFloat(consumption.instantAmpsL3),
      instantAmpsDC: Utils.convertToFloat(consumption.instantAmpsDC),
      instantVolts: Utils.convertToFloat(consumption.instantVolts),
      instantVoltsL1: Utils.convertToFloat(consumption.instantVoltsL1),
      instantVoltsL2: Utils.convertToFloat(consumption.instantVoltsL2),
      instantVoltsL3: Utils.convertToFloat(consumption.instantVoltsL3),
      instantVoltsDC: Utils.convertToFloat(consumption.instantVoltsDC),
      totalInactivitySecs: Utils.convertToInt(consumption.totalInactivitySecs),
      totalDurationSecs: Utils.convertToInt(consumption.totalDurationSecs),
      stateOfCharge: Utils.convertToInt(consumption.stateOfCharge),
      limitAmps: Utils.convertToInt(consumption.limitAmps),
      limitWatts: Utils.convertToInt(consumption.limitWatts),
      limitSource: consumption.limitSource,
      userID: DatabaseUtils.convertToObjectID(consumption.userID),
      smartChargingActive: Utils.convertToBoolean(consumption.smartChargingActive),
      limitSiteAreaWatts: consumption.limitSiteAreaWatts ? Utils.convertToInt(consumption.limitSiteAreaWatts) : null,
      limitSiteAreaAmps: consumption.limitSiteAreaAmps ? Utils.convertToInt(consumption.limitSiteAreaAmps) : null,
      limitSiteAreaSource: consumption.limitSiteAreaSource ? consumption.limitSiteAreaSource : null,
    };
  }
}
