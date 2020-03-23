import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import DbParams from '../../types/database/DbParams';
import { DataResult } from '../../types/DataResult';
import global from '../../types/GlobalType';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';

export default class TenantStorage {
  public static async getTenant(id: string): Promise<Tenant> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'getTenant');
    // Delegate querying
    const tenantsMDB = await TenantStorage.getTenants({ tenantID: id }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd('TenantStorage', 'getTenant', uniqueTimerID, { id });
    return tenantsMDB.count > 0 ? tenantsMDB.result[0] : null;
  }

  public static async getTenantByName(name: string): Promise<Tenant> {
    // Delegate querying
    const tenantsResult = await TenantStorage.getTenants({ tenantName: name }, Constants.DB_PARAMS_SINGLE_RECORD);
    return tenantsResult.count > 0 ? tenantsResult.result[0] : null;
  }

  public static async getTenantBySubdomain(subdomain: string): Promise<Tenant> {
    // Delegate querying
    const tenantsResult = await TenantStorage.getTenants({ tenantSubdomain: subdomain }, Constants.DB_PARAMS_SINGLE_RECORD);
    return tenantsResult.count > 0 ? tenantsResult.result[0] : null;
  }

  public static async saveTenant(tenantToSave: Partial<Tenant>): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'saveTenant');
    // Check
    if (!tenantToSave.id && !tenantToSave.name) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'TenantStorage',
        method: 'saveTenant',
        message: 'Tenant has no ID and no Name'
      });
    }
    const tenantFilter: any = {};
    // Build Request
    if (tenantToSave.id) {
      tenantFilter._id = Utils.convertToObjectID(tenantToSave.id);
    } else {
      tenantFilter._id = new ObjectID();
    }
    // Properties to save
    // eslint-disable-next-line prefer-const
    let tenantMDB = {
      _id: tenantFilter._id,
      name: tenantToSave.name,
      email: tenantToSave.email,
      subdomain: tenantToSave.subdomain,
      components: tenantToSave.components ? tenantToSave.components : {}
    };
    DatabaseUtils.addLastChangedCreatedProps(tenantMDB, tenantToSave);
    // Modify
    await global.database.getCollection<Tenant>(Constants.DEFAULT_TENANT, 'tenants').findOneAndUpdate(
      tenantFilter,
      { $set: tenantMDB },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('TenantStorage', 'saveTenant', uniqueTimerID, { tenantToSave });
    // Create
    return tenantFilter._id.toHexString();
  }

  public static async createTenantDB(tenantID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'createTenantDB');
    // Create DB
    await global.database.checkAndCreateTenantDatabase(tenantID);
    // Debug
    Logging.traceEnd('TenantStorage', 'createTenantDB', uniqueTimerID, { tenantID });
  }

  // Delegate
  public static async getTenants(
    params: { tenantID?: string; tenantName?: string; tenantSubdomain?: string; search?: string },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<Tenant>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'getTenants');
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: any = {};
    if (params.tenantID) {
      filters._id = Utils.convertToObjectID(params.tenantID);
    } else if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { 'name': { $regex: searchRegex, $options: 'i' } },
        { 'subdomain': { $regex: searchRegex, $options: 'i' } }
      ];
    }
    // Name
    if (params.tenantName) {
      filters.name = params.tenantName;
    }
    // Subdomain
    if (params.tenantSubdomain) {
      filters.subdomain = params.tenantSubdomain;
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const tenantsCountMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'tenants')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (tenantsCountMDB.length > 0 ? tenantsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation('', aggregation);
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: {
          name: 1
        }
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
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const tenantsMDB = await global.database.getCollection<Tenant>(Constants.DEFAULT_TENANT, 'tenants')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();

    // Debug
    Logging.traceEnd('TenantStorage', 'getTenants', uniqueTimerID, { params, dbParams });
    // Ok
    return {
      count: (tenantsCountMDB.length > 0 ?
        (tenantsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : tenantsCountMDB[0].count) : 0),
      result: tenantsMDB
    };
  }

  public static async deleteTenant(id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'deleteTenant');
    // Delete
    await global.database.getCollection<Tenant>(Constants.DEFAULT_TENANT, 'tenants')
      .findOneAndDelete({
        '_id': Utils.convertToObjectID(id)
      });
    // Debug
    Logging.traceEnd('TenantStorage', 'deleteTenant', uniqueTimerID, { id });
  }

  public static async deleteTenantDB(id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TenantStorage', 'deleteTenantDB');
    // Delete
    await global.database.deleteTenantDatabase(id);
    // Debug
    Logging.traceEnd('TenantStorage', 'deleteTenantDB', uniqueTimerID, { id });
  }
}
