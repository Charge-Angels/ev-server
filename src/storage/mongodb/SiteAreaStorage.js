const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const AppError = require('../../exception/AppError');
const ObjectID = require('mongodb').ObjectID;
const DatabaseUtils = require('./DatabaseUtils');
const BackendError = require('../../exception/BackendError');

class SiteAreaStorage {
  static async getSiteAreaImage(tenantID, id) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const siteAreaImagesMDB = await global.database.getCollection(tenantID, 'siteareaimages')
      .find({_id: Utils.convertToObjectID(id)})
      .limit(1)
      .toArray();
    let siteAreaImage = null;
    // Set
    if (siteAreaImagesMDB && siteAreaImagesMDB.length > 0) {
      siteAreaImage = {
        id: siteAreaImagesMDB[0]._id,
        image: siteAreaImagesMDB[0].image
      };
    }
    return siteAreaImage;
  }

  static async getSiteAreaImages(tenantID) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const siteAreaImagesMDB = await global.database.getCollection(tenantID, 'siteareaimages')
      .find({})
      .toArray();
    const siteAreaImages = [];
    // Add
    if (siteAreaImagesMDB && siteAreaImagesMDB.length > 0) {
      for (const siteAreaImageMDB of siteAreaImagesMDB) {
        siteAreaImages.push({
          id: siteAreaImageMDB._id,
          image: siteAreaImageMDB.image
        });
      }
    }
    return siteAreaImages;
  }

  static async getSiteArea(tenantID, id, withChargeBoxes, withSite) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Site = require('../../entity/Site');  // Avoid fucking circular deps!!!
    const SiteArea = require('../../entity/SiteArea'); // Avoid fucking circular deps!!!
    const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {_id: Utils.convertToObjectID(id)}
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID,aggregation);
    // Charging Station
    if (withChargeBoxes) {
      // Add
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "chargingstations"),
          localField: "_id",
          foreignField: "siteAreaID",
          as: "chargingStations"
        }
      });
    }
    // Site
    if (withSite) {
      // Add
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "sites"),
          localField: "siteID",
          foreignField: "_id",
          as: "site"
        }
      });
      // Add
      aggregation.push({
        $unwind: {"path": "$site", "preserveNullAndEmptyArrays": true}
      });
    }
    // Read DB
    const siteAreasMDB = await global.database.getCollection(tenantID, 'siteareas')
      .aggregate(aggregation)
      .toArray();
    let siteArea = null;
    // Create
    if (siteAreasMDB && siteAreasMDB.length > 0) {
      // Create
      siteArea = new SiteArea(tenantID, siteAreasMDB[0]);
      // Set Charging Station
      if (siteAreasMDB[0].chargingStations) {
        // Sort Charging Stations
        siteAreasMDB[0].chargingStations.sort((cb1, cb2) => {
          return cb1._id.localeCompare(cb2._id);
        });
        // Set
        siteArea.setChargingStations(siteAreasMDB[0].chargingStations.map((chargingStation) => {
          // Create the Charging Station
          const chargingStationObj = new ChargingStation(tenantID, chargingStation);
          // Set the Site Area to it
          chargingStationObj.setSiteArea(new SiteArea(tenantID, siteArea.getModel())); // To avoid circular deps Charger -> Site Area -> Charger
          // Return
          return chargingStationObj;
        }));
      }
      // Set Site
      if (siteAreasMDB[0].site) {
        siteArea.setSite(new Site(tenantID, siteAreasMDB[0].site));
      }
    }
    return siteArea;
  }

  static async saveSiteArea(tenantID, siteAreaToSave) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const SiteArea = require('../../entity/SiteArea'); // Avoid fucking circular deps!!!
    // Check if ID/Name is provided
    if (!siteAreaToSave.id && !siteAreaToSave.name) {
      // ID must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site Area has no ID and no Name`,
        550, "SiteAreaStorage", "saveSiteArea");
    }
    const siteAreaFilter = {};
    // Build Request
    if (siteAreaToSave.id) {
      siteAreaFilter._id = Utils.convertToObjectID(siteAreaToSave.id);
    } else {
      siteAreaFilter._id = new ObjectID();
    }
    // Check Created By/On
    siteAreaToSave.createdBy = Utils.convertUserToObjectID(siteAreaToSave.createdBy);
    siteAreaToSave.lastChangedBy = Utils.convertUserToObjectID(siteAreaToSave.lastChangedBy);
    // Transfer
    const siteArea = {};
    Database.updateSiteArea(siteAreaToSave, siteArea, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'siteareas').findOneAndUpdate(
      siteAreaFilter,
      {$set: siteArea},
      {upsert: true, new: true, returnOriginal: false});
    // Create
    return new SiteArea(tenantID, result.value);
  }

  static async saveSiteAreaImage(tenantID, siteAreaImageToSave) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!siteAreaImageToSave.id) {
      // ID must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site Area Image has no ID`,
        550, "SiteAreaStorage", "saveSiteAreaImage");
    }
    // Modify
    await global.database.getCollection(tenantID, 'siteareaimages').findOneAndUpdate(
      {'_id': Utils.convertToObjectID(siteAreaImageToSave.id)},
      {$set: {image: siteAreaImageToSave.image}},
      {upsert: true, new: true, returnOriginal: false});
  }

  static async getSiteAreas(tenantID, params = {}, limit, skip, sort) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Site = require('../../entity/Site');  // Avoid fucking circular deps!!!
    const SiteArea = require('../../entity/SiteArea'); // Avoid fucking circular deps!!!
    const ChargingStation = require('../../entity/ChargingStation'); // Avoid fucking circular deps!!!
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters = {};
    // Source?
    if (params.search) {
      // Build filter
      filters.$or = [
        {"name": {$regex: params.search, $options: 'i'}}
      ];
    }
    // Set Site?
    if (params.siteID) {
      filters.siteID = Utils.convertToObjectID(params.siteID);
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
    const siteAreasCountMDB = await global.database.getCollection(tenantID, 'siteareas')
      .aggregate([...aggregation, {$count: "count"}])
      .toArray();
    // Sites
    if (params.withSite) {
      // Add Sites
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "sites"),
          localField: "siteID",
          foreignField: "_id",
          as: "site"
        }
      });
      // Single Record
      aggregation.push({
        $unwind: {"path": "$site", "preserveNullAndEmptyArrays": true}
      });
    }
    // Charging Stations
    if (params.withChargeBoxes) {
      // Add Charging Stations
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, "chargingstations"),
          localField: "_id",
          foreignField: "siteAreaID",
          as: "chargeBoxes"
        }
      });
    }
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID,aggregation);
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: {name: 1}
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
    const siteAreasMDB = await global.database.getCollection(tenantID, 'siteareas')
      .aggregate(aggregation, {collation: {locale: Constants.DEFAULT_LOCALE, strength: 2}})
      .toArray();
    const siteAreas = [];
    // Check
    if (siteAreasMDB && siteAreasMDB.length > 0) {
      // Create
      for (const siteAreaMDB of siteAreasMDB) {
        // Create
        const siteArea = new SiteArea(tenantID, siteAreaMDB);
        // Set Site Areas
        if (params.withChargeBoxes && siteAreaMDB.chargeBoxes) {
          siteArea.setChargingStations(siteAreaMDB.chargeBoxes.map((chargeBox) => {
            return new ChargingStation(tenantID, chargeBox);
          }));
        }
        // Set Site
        if (params.withSite && siteAreaMDB.site) {
          // Set
          siteArea.setSite(new Site(tenantID, siteAreaMDB.site));
        }
        // Add
        siteAreas.push(siteArea);
      }
    }
    // Ok
    return {
      count: (siteAreasCountMDB.length > 0 ? siteAreasCountMDB[0].count : 0),
      result: siteAreas
    };
  }

  static async deleteSiteArea(tenantID, id) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Remove Charging Station's Site Area
    await global.database.getCollection(tenantID, 'chargingstations').updateMany(
      {siteAreaID: Utils.convertToObjectID(id)},
      {$set: {siteAreaID: null}},
      {upsert: false, new: true, returnOriginal: false});
    // Delete Site
    await global.database.getCollection(tenantID, 'siteareas')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
    // Delete Image
    await global.database.getCollection(tenantID, 'sitesareaimages')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
  }
}

module.exports = SiteAreaStorage;
