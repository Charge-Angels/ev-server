import cfenv from 'cfenv';
import os from 'os';
import Configuration from './Configuration';
import Utils from './Utils';

export default class Database {
  public static updateID(src, dest): void {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    if (!dest.id && src._id) {
      dest.id = src._id;
    }
    dest.id = Database.validateId(dest.id);
  }

  public static validateId(id): string {
    let changedID = id;
    // Object?
    if (changedID && (typeof changedID === 'object')) {
      // Mongo DB?
      if (changedID instanceof Buffer) {
        changedID = changedID.toString('hex');
      } else {
        changedID = changedID.toString();
      }
    }
    return changedID;
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

  static updateLock(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.type = src.type;
    dest.name = src.name;
    if (!src.hostname) {
      dest.hostname = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname();
    } else {
      dest.hostname = src.hostname;
    }
  }

  static updateRunLock(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.type = 'runLock';
    dest.name = src.name;
    if (!src.hostname) {
      dest.hostname = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname();
    } else {
      dest.hostname = src.hostname;
    }
  }

  static updateMeterValue(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.chargeBoxID = src.chargeBoxID;
    dest.connectorId = Utils.convertToInt(src.connectorId);
    dest.transactionId = Utils.convertToInt(src.transactionId);
    dest.timestamp = Utils.convertToDate(src.timestamp);
    if (src.attribute.format === 'SignedData') {
      dest.value = src.value;
    } else {
      dest.value = Utils.convertToInt(src.value);
    }
    dest.attribute = src.attribute;
  }

  static updateConnection(src, dest, forFrontEnd = true) {
    dest.connectorId = src.connectorId;
    dest.createdAt = Utils.convertToDate(src.createdAt);
    dest.updatedAt = Utils.convertToDate(src.updatedAt);
    dest.validUntil = Utils.convertToDate(src.validUntil);
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.userId = Database.validateId(src.userId);
    } else {
      dest.userId = Utils.convertToObjectID(src.userId);
    }
    dest.data = src.data;
  }
}
