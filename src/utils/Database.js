const Utils = require('./Utils');
const Constants = require('./Constants');

require('source-map-support').install();

let _heartbeatIntervalSecs;

class Database {
  static updateID(src, dest) {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    if (!dest.id && src._id) {
      dest.id = src._id;
    }
    dest.id = Database.validateId(dest.id);
  }

  static validateId(id) {
    let changedID = id;
    // Object?
    if (changedID && (typeof changedID == "object")) {
      // Mongo DB?
      if (changedID instanceof Buffer) {
        changedID = changedID.toString('hex');
      } else {
        changedID = changedID.toString();
      }
    }
    return changedID;
  }

  static setChargingStationHeartbeatIntervalSecs(heartbeatIntervalSecs) {
    _heartbeatIntervalSecs = heartbeatIntervalSecs;
  }

  static updateChargingStation(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.siteAreaID = Database.validateId(src.siteAreaID);
    } else {
      dest.siteAreaID = Utils.convertToObjectID(src.siteAreaID);
    }
    dest.chargePointSerialNumber = src.chargePointSerialNumber;
    dest.chargePointModel = src.chargePointModel;
    dest.chargeBoxSerialNumber = src.chargeBoxSerialNumber;
    dest.chargePointVendor = src.chargePointVendor;
    dest.iccid = src.iccid;
    dest.imsi = src.imsi;
    dest.meterType = src.meterType;
    dest.firmwareVersion = src.firmwareVersion;
    dest.meterSerialNumber = src.meterSerialNumber;
    dest.endpoint = src.endpoint;
    dest.ocppVersion = src.ocppVersion;
    if (src.ocppProtocol) {
      dest.ocppProtocol = src.ocppProtocol;
    } else {
      dest.ocppProtocol = Constants.OCPP_PROTOCOL_SOAP;
    }
    if (src.cfApplicationIDAndInstanceIndex) {
      dest.cfApplicationIDAndInstanceIndex = src.cfApplicationIDAndInstanceIndex;
    }
    dest.lastHeartBeat = Utils.convertToDate(src.lastHeartBeat);
    dest.deleted = src.deleted;
    // Check Inactive Chargers
    if (forFrontEnd) {
      // Default
      dest.inactive = false;
      const inactivitySecs = Math.floor((Date.now() - dest.lastHeartBeat.getTime()) / 1000);
      // Inactive?
      if (inactivitySecs > (_heartbeatIntervalSecs * 5)) {
        dest.inactive = true;
      }
    }
    dest.lastReboot = Utils.convertToDate(src.lastReboot);
    if (src.chargingStationURL) {
      dest.chargingStationURL = src.chargingStationURL;
    }
    if (src.hasOwnProperty('numberOfConnectedPhase')) {
      dest.numberOfConnectedPhase = Utils.convertToInt(src.numberOfConnectedPhase);
    }
    if (src.hasOwnProperty('maximumPower')) {
      dest.maximumPower = Utils.convertToInt(src.maximumPower);
    }
    if (src.hasOwnProperty('cannotChargeInParallel')) {
      dest.cannotChargeInParallel = src.cannotChargeInParallel;
    }
    dest.connectors = [];
    if (src.connectors) {
      // Set
      for (const connector of src.connectors) {
        if (connector) {
          dest.connectors.push({
            "connectorId": Utils.convertToInt(connector.connectorId),
            "currentConsumption": Utils.convertToFloat(connector.currentConsumption),
            "currentStateOfCharge": Utils.convertToInt(connector.currentStateOfCharge),
            "totalConsumption": Utils.convertToFloat(connector.totalConsumption),
            "status": connector.status,
            "errorCode": connector.errorCode,
            "info": connector.info,
            "vendorErrorCode": connector.vendorErrorCode,
            "power": Utils.convertToInt(connector.power),
            "type": connector.type,
            "activeTransactionID": Utils.convertToInt(connector.activeTransactionID)
          });
        } else {
          dest.connectors.push(null);
        }
      }
    }
    // Update
    Database.updateCreatedAndLastChanged(src, dest);
    // No connectors?
    if (!dest.connectors) {
      dest.connectors = [];
    }
  }

  static updateEula(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.version = src.version;
    dest.language = src.language;
    dest.text = src.text;
    dest.hash = src.hash;
  }

  static updatePricing(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.priceKWH = Utils.convertToFloat(src.priceKWH);
    dest.priceUnit = src.priceUnit;
  }

  static updateMigration(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.name = src.name;
    dest.version = src.version;
    dest.durationSecs = Utils.convertToFloat(src.durationSecs);
  }

  static updateConfiguration(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.configuration = src.configuration;
  }

  static updateStatusNotification(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.chargeBoxID = src.chargeBoxID;
    dest.connectorId = Utils.convertToInt(src.connectorId);
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.status = src.status;
    dest.errorCode = src.errorCode;
    dest.info = src.info;
    dest.vendorId = src.vendorId;
    dest.vendorErrorCode = src.vendorErrorCode;
  }

  static updateNotification(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.channel = src.channel;
    dest.sourceId = src.sourceId;
    dest.sourceDescr = src.sourceDescr;
    // User
    dest.userID = Utils.convertToObjectID(src.userID);
    if (forFrontEnd && !Utils.isEmptyJSon(dest.userID)) {
      dest.user = {};
      Database.updateUser(src.userID, dest.user);
    }
    // ChargeBox
    dest.chargeBoxID = src.chargeBoxID
    if (forFrontEnd && !Utils.isEmptyJSon(dest.chargeBoxID)) {
      dest.chargeBox = {};
      Database.updateChargingStation(src.chargeBoxID, dest.chargeBox);
    }
  }

  static updateMeterValue(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.chargeBoxID = src.chargeBoxID
    dest.connectorId = Utils.convertToInt(src.connectorId);
    dest.transactionId = Utils.convertToInt(src.transactionId);
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.value = Utils.convertToInt(src.value);
    if (src.hasOwnProperty("registeredValue")) {
      dest.registeredValue = Utils.convertToInt(src.registeredValue);
    }
    if (src.hasOwnProperty("totalInactivitySecs")) {
      dest.totalInactivitySecs = Utils.convertToInt(src.totalInactivitySecs);
    }
    dest.attribute = src.attribute;
  }

  static updateUser(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      if (src.image) {
        dest.image = src.image;
      }
    }
    if (src.name) {
      dest.name = src.name;
    }
    if (src.firstName) {
      dest.firstName = src.firstName;
    }
    if (src.email) {
      dest.email = src.email;
    }
    if (src.phone) {
      dest.phone = src.phone;
    }
    if (src.mobile) {
      dest.mobile = src.mobile;
    }
    if (src.iNumber) {
      dest.iNumber = src.iNumber;
    }
    if (src.costCenter) {
      dest.costCenter = src.costCenter;
    }
    dest.address = {};
    if (src.address) {
      Database.updateAddress(src.address, dest.address)
    }
    if (src.status) {
      dest.status = src.status;
    }
    if (src.locale) {
      dest.locale = src.locale;
    }
    if (src.eulaAcceptedOn) {
      dest.eulaAcceptedOn = Utils.convertToDate(src.eulaAcceptedOn);
      dest.eulaAcceptedVersion = src.eulaAcceptedVersion;
      dest.eulaAcceptedHash = src.eulaAcceptedHash;
    }
    Database.updateCreatedAndLastChanged(src, dest);
    dest.deleted = src.deleted;
    if (forFrontEnd && src.tagIDs) {
      dest.tagIDs = src.tagIDs;
    }
    if (src.role) {
      dest.role = src.role;
    }
    if (src.password) {
      dest.password = src.password;
      dest.passwordWrongNbrTrials = Utils.convertToInt(src.passwordWrongNbrTrials);
      dest.passwordBlockedUntil = Utils.convertToDate(src.passwordBlockedUntil);
    }
    if (src.passwordResetHash) {
      dest.passwordResetHash = src.passwordResetHash;
    }
    if (src.verifiedAt) {
      dest.verifiedAt = Utils.convertToDate(src.verifiedAt);
    }
    // No check of if(src.verificationToken), otherwise we cannot set it back to null (after being verified)
    dest.verificationToken = src.verificationToken;
  }

  static updateSite(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.image = src.image;
      dest.companyID = Database.validateId(src.companyID);
    } else {
      dest.companyID = Utils.convertToObjectID(src.companyID);
    }
    dest.name = src.name;
    dest.address = {};
    dest.allowAllUsersToStopTransactions = src.allowAllUsersToStopTransactions;
    Database.updateAddress(src.address, dest.address)
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateVehicleManufacturer(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.logo = src.logo;
      dest.numberOfVehicles = src.numberOfVehicles;
    }
    dest.name = src.name;
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateCreatedAndLastChanged(src, dest) {
    // Check
    if (src.createdBy) {
      // Set
      dest.createdBy = src.createdBy;
      // User model?
      if (typeof dest.createdBy == "object" &&
        dest.createdBy.constructor.name != "ObjectID") {
        // Yes
        dest.createdBy = {};
        Database.updateUser(src.createdBy, dest.createdBy);
      } else {
        try {
          dest.createdBy = Utils.convertToObjectID(dest.createdBy);
        } catch (e) {
        } // Not an Object ID
      }
    }
    // Check
    if (src.createdOn) {
      dest.createdOn = Utils.convertToDate(src.createdOn);
    }
    // Check
    if (src.lastChangedBy) {
      // Set
      dest.lastChangedBy = src.lastChangedBy;
      // User model?
      if (typeof dest.lastChangedBy == "object" &&
        dest.lastChangedBy.constructor.name != "ObjectID") {
        // Yes
        dest.lastChangedBy = {};
        Database.updateUser(src.lastChangedBy, dest.lastChangedBy);
      } else {
        try {
          dest.lastChangedBy = Utils.convertToObjectID(dest.lastChangedBy);
        } catch (e) {
        } // Not an Object ID
      }
    }
    // Check
    if (src.lastChangedOn) {
      dest.lastChangedOn = Utils.convertToDate(src.lastChangedOn);
    }
  }

  static updateCompany(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.logo = src.logo;
    }
    dest.name = src.name;
    dest.address = {};
    Database.updateAddress(src.address, dest.address);
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateTenant(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.name = src.name;
    dest.subdomain = src.subdomain;
    dest.email = src.email;
    dest.components = (src.components ? src.components : {});
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateVehicle(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.images = src.images;
      dest.numberOfImages = src.numberOfImages;
      dest.vehicleManufacturerID = Database.validateId(src.vehicleManufacturerID);
    } else {
      dest.vehicleManufacturerID = Utils.convertToObjectID(src.vehicleManufacturerID);
    }
    dest.type = src.type;
    dest.model = src.model;
    dest.batteryKW = Utils.convertToInt(src.batteryKW);
    dest.autonomyKmWLTP = Utils.convertToInt(src.autonomyKmWLTP);
    dest.autonomyKmReal = Utils.convertToInt(src.autonomyKmReal);
    dest.horsePower = Utils.convertToInt(src.horsePower);
    dest.torqueNm = Utils.convertToInt(src.torqueNm);
    dest.performance0To100kmh = Utils.convertToFloat(src.performance0To100kmh);
    dest.weightKg = Utils.convertToInt(src.weightKg);
    dest.lengthMeter = Utils.convertToFloat(src.lengthMeter);
    dest.widthMeter = Utils.convertToFloat(src.widthMeter);
    dest.heightMeter = Utils.convertToFloat(src.heightMeter);
    dest.releasedOn = Utils.convertToDate(src.releasedOn);
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateOcpiEndpoint(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }

    dest.name = src.name;
    dest.status = src.status;
    dest.baseUrl = src.baseUrl;
    dest.version = src.version;
    dest.versionUrl = src.versionUrl;
    dest.availableEndpoints = src.availableEndpoints;
    dest.businessDetails = src.businessDetails;
    dest.localToken = src.localToken;
    dest.token = src.token;
    dest.countryCode = src.countryCode;
    dest.partyId = src.partyId;

    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateSetting(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    } 

    dest.identifier = src.identifier;
    dest.content = src.content;

    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateAddress(src, dest) {
    if (src) {
      dest.address1 = src.address1;
      dest.address2 = src.address2;
      dest.postalCode = src.postalCode;
      dest.city = src.city;
      dest.department = src.department;
      dest.region = src.region;
      dest.country = src.country;
      dest.latitude = src.latitude;
      dest.longitude = src.longitude;
    }
  }

  static updateSiteArea(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.image = src.image;
      dest.siteID = Database.validateId(src.siteID);
    } else {
      dest.siteID = Utils.convertToObjectID(src.siteID);
    }
    dest.name = src.name;
    dest.accessControl = src.accessControl;
    Database.updateCreatedAndLastChanged(src, dest);
  }

  static updateLogging(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.userID = Database.validateId(src.userID);
      dest.actionOnUserID = Database.validateId(src.actionOnUserID);
    } else {
      dest.userID = Utils.convertToObjectID(src.userID);
      dest.actionOnUserID = Utils.convertToObjectID(src.actionOnUserID);
    }
    dest.level = src.level;
    dest.source = src.source;
    dest.type = src.type;
    dest.module = src.module;
    dest.method = src.method;
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.action = src.action;
    dest.message = src.message;
    dest.detailedMessages = src.detailedMessages;
    if (forFrontEnd && src.user && typeof src.user == "object") {
      dest.user = {};
      Database.updateUser(src.user, dest.user);
    }
    if (forFrontEnd && src.actionOnUser && typeof src.actionOnUser == "object") {
      dest.actionOnUser = {};
      Database.updateUser(src.actionOnUser, dest.actionOnUser);
    }
  }

  static updateTransaction(src, dest, forFrontEnd = true) {
    Database.updateID(src, dest);
    //User
    if (!Utils.isEmptyJSon(src.user) && forFrontEnd) {
      dest.user = {};
      Database.updateUser(src.user, dest.user, forFrontEnd);
    }
    forFrontEnd && src.userID ? dest.userID = Database.validateId(src.userID) : dest.userID = Utils.convertToObjectID(src.userID);
    dest.chargeBoxID = src.chargeBoxID;
    dest.connectorId = Utils.convertToInt(src.connectorId);
    dest.meterStart = Utils.convertToInt(src.meterStart);
    dest.tagID = src.tagID;
    dest.timestamp = Utils.convertToDate(src.timestamp);
    if (src.stateOfCharge) {
      dest.stateOfCharge = Utils.convertToInt(src.stateOfCharge);
    }
    if (!Utils.isEmptyJSon(src.stop)) {
      dest.stop = {};
      if (!Utils.isEmptyJSon(src.stop.user) && forFrontEnd) {
        dest.stop.user = {};
        Database.updateUser(src.stop.user, dest.stop.user, forFrontEnd);
      }
      forFrontEnd && src.stop.userID ? dest.stop.userID = Database.validateId(src.stop.userID) : dest.stop.userID = Utils.convertToObjectID(src.stop.userID);
      dest.stop.timestamp = Utils.convertToDate(src.stop.timestamp);
      dest.stop.tagID = src.stop.tagID;
      dest.stop.meterStop = Utils.convertToInt(src.stop.meterStop);
      dest.stop.transactionData = src.stop.transactionData;
      if (src.stop.stateOfCharge) {
        dest.stop.stateOfCharge = Utils.convertToInt(src.stop.stateOfCharge);
      }
      dest.stop.totalConsumption = Utils.convertToInt(src.stop.totalConsumption);
      dest.stop.totalInactivitySecs = Utils.convertToInt(src.stop.totalInactivitySecs);
      dest.stop.totalDurationSecs = Utils.convertToInt(src.stop.totalDurationSecs);
    }
    if (!Utils.isEmptyJSon(src.remotestop)) {
      dest.remotestop = {};
      dest.remotestop.timestamp = src.remotestop.timestamp;
      dest.remotestop.tagID = src.remotestop.tagID;
    }
    if (!Utils.isEmptyJSon(src.internalMeterValues) && Utils.isEmptyJSon(src.stop)) {
      dest.internalMeterValues = [];
      src.internalMeterValues.forEach(meterValue => {
        const destMeterValue = {};
        Database.updateMeterValue(meterValue, destMeterValue);
        dest.internalMeterValues.push(destMeterValue);
      });
    }
    if (forFrontEnd) {
      dest.meterValues = [];
      if (!Utils.isEmptyJSon(src.meterValues)) {
        src.meterValues.forEach(meterValue => {
          const destMeterValue = {};
          Database.updateMeterValue(meterValue, destMeterValue);
          dest.meterValues.push(destMeterValue);
        });
      }
      if (!Utils.isEmptyJSon(src.pricing)) {
        dest.pricing = {};
        Database.updatePricing(src.pricing, dest.pricing);
      }
      if (!Utils.isEmptyJSon(src.chargeBox)) {
        dest.chargeBox = {};
        Database.updateChargingStation(src.chargeBox, dest.chargeBox);
      }
    }
  }
}

module.exports = Database;
