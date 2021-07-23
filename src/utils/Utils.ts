import { AnalyticsSettingsType, AssetSettingsType, BillingSettingsType, CarConnectorSettingsType, CryptoKeyProperties, PricingSettingsType, RefundSettingsType, RoamingSettingsType, SettingDBContent, SmartChargingContentType } from '../types/Setting';
import { Car, CarCatalog } from '../types/Car';
import { ChargePointStatus, OCPPProtocol, OCPPVersion, OCPPVersionURLPath } from '../types/ocpp/OCPPServer';
import ChargingStation, { ChargePoint, ChargingStationEndpoint, Connector, ConnectorCurrentLimitSource, CurrentType, Voltage } from '../types/ChargingStation';
import PerformanceRecord, { PerformanceRecordGroup } from '../types/Performance';
import Transaction, { CSPhasesUsed, InactivityStatus } from '../types/Transaction';
import User, { UserRole, UserStatus } from '../types/User';
import crypto, { CipherGCMTypes } from 'crypto';

import Address from '../types/Address';
import { AxiosError } from 'axios';
import BackendError from '../exception/BackendError';
import Configuration from './Configuration';
import ConnectorStats from '../types/ConnectorStats';
import Constants from './Constants';
import Cypher from './Cypher';
import { Decimal } from 'decimal.js';
import Logging from './Logging';
import QRCode from 'qrcode';
import { Request } from 'express';
import { ServerAction } from '../types/Server';
import Tag from '../types/Tag';
import Tenant from '../types/Tenant';
import TenantComponents from '../types/TenantComponents';
import UserToken from '../types/UserToken';
import { WebSocketCloseEventStatusString } from '../types/WebSocket';
import _ from 'lodash';
import bcrypt from 'bcryptjs';
import cfenv from 'cfenv';
import cluster from 'cluster';
import fs from 'fs';
import global from '../types/GlobalType';
import http from 'http';
import moment from 'moment';
import os from 'os';
import passwordGenerator from 'password-generator';
import path from 'path';
import tzlookup from 'tz-lookup';
import { v4 as uuid } from 'uuid';
import validator from 'validator';

const MODULE_NAME = 'Utils';

export default class Utils {
  public static getConnectorsFromChargePoint(chargingStation: ChargingStation, chargePoint: ChargePoint): Connector[] {
    const connectors: Connector[] = [];
    if (!chargingStation || !chargePoint || Utils.isEmptyArray(chargePoint.connectorIDs)) {
      return connectors;
    }
    for (const connectorID of chargePoint.connectorIDs) {
      const connector = Utils.getConnectorFromID(chargingStation, connectorID);
      if (connector) {
        connectors.push(connector);
      }
    }
    return connectors;
  }

  public static convertAddressToOneLine(address: Address): string {
    const oneLineAddress: string[] = [];
    if (address?.address1) {
      oneLineAddress.push(address.address1);
    }
    if (address?.address2) {
      oneLineAddress.push(address.address2);
    }
    return oneLineAddress.join(' ');
  }

  public static handleAxiosError(axiosError: AxiosError, urlRequest: string, action: ServerAction, module: string, method: string): void {
    // Handle Error outside 2xx range
    if (axiosError.response) {
      throw new BackendError({
        action, module, method,
        message: `HTTP Error '${axiosError.response.status}' while processing the URL '${urlRequest}'`,
      });
    }
    throw new BackendError({
      action, module, method,
      message: `HTTP error while processing the URL '${urlRequest}'`,
    });
  }

  public static isTransactionInProgressOnThreePhases(chargingStation: ChargingStation, transaction: Transaction): boolean {
    const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
    if (currentType === CurrentType.AC &&
      (transaction.currentInstantAmpsL1 > 0 && (transaction.currentInstantAmpsL2 === 0 || transaction.currentInstantAmpsL3 === 0)) ||
      (transaction.currentInstantAmpsL2 > 0 && (transaction.currentInstantAmpsL1 === 0 || transaction.currentInstantAmpsL3 === 0)) ||
      (transaction.currentInstantAmpsL3 > 0 && (transaction.currentInstantAmpsL1 === 0 || transaction.currentInstantAmpsL2 === 0))) {
      return false;
    }
    return true;
  }

  public static getUsedPhasesInTransactionInProgress(chargingStation: ChargingStation, transaction: Transaction): CSPhasesUsed {
    const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
    // AC Chargers
    if (currentType === CurrentType.AC && Utils.checkIfPhasesProvidedInTransactionInProgress(transaction)) {
      const cSPhasesUsed: CSPhasesUsed = {
        csPhase1: false,
        csPhase2: false,
        csPhase3: false
      };
      // Check current consumption
      if (transaction.currentInstantAmpsL1 > Constants.AMPERAGE_DETECTION_THRESHOLD) {
        cSPhasesUsed.csPhase1 = true;
      }
      if (transaction.currentInstantAmpsL2 > Constants.AMPERAGE_DETECTION_THRESHOLD) {
        cSPhasesUsed.csPhase2 = true;
      }
      if (transaction.currentInstantAmpsL3 > Constants.AMPERAGE_DETECTION_THRESHOLD) {
        cSPhasesUsed.csPhase3 = true;
      }
      return cSPhasesUsed;
    }
    // Standard on three phases
    return {
      csPhase1: true,
      csPhase2: true,
      csPhase3: true
    };
  }

  public static checkIfPhasesProvidedInTransactionInProgress(transaction: Transaction): boolean {
    return transaction.currentInstantAmps > Constants.AMPERAGE_DETECTION_THRESHOLD &&
      (transaction.currentInstantAmpsL1 > Constants.AMPERAGE_DETECTION_THRESHOLD ||
        transaction.currentInstantAmpsL2 > Constants.AMPERAGE_DETECTION_THRESHOLD ||
        transaction.currentInstantAmpsL3 > Constants.AMPERAGE_DETECTION_THRESHOLD);
  }

  public static getNumberOfUsedPhasesInTransactionInProgress(chargingStation: ChargingStation, transaction: Transaction): number {
    const currentType = Utils.getChargingStationCurrentType(chargingStation, null, transaction.connectorId);
    let nbrOfPhases = -1;
    if (currentType === CurrentType.AC && transaction.phasesUsed) {
      nbrOfPhases = 0;
      if (transaction.phasesUsed.csPhase1) {
        nbrOfPhases++;
      }
      if (transaction.phasesUsed.csPhase2) {
        nbrOfPhases++;
      }
      if (transaction.phasesUsed.csPhase3) {
        nbrOfPhases++;
      }
    }
    return nbrOfPhases;
  }

  public static getEndOfChargeNotificationIntervalMins(chargingStation: ChargingStation, connectorId: number): number {
    let intervalMins = 0;
    if (!chargingStation || !chargingStation.connectors) {
      return 0;
    }
    const connector = Utils.getConnectorFromID(chargingStation, connectorId);
    if (connector) {
      if (connector.power <= 3680) {
        // Notify every 120 mins
        intervalMins = 120;
      } else if (connector.power <= 7360) {
        // Notify every 60 mins
        intervalMins = 60;
      } else if (connector.power < 50000) {
        // Notify every 30 mins
        intervalMins = 30;
      } else if (connector.power >= 50000) {
        // Notify every 15 mins
        intervalMins = 15;
      }
    }
    return intervalMins;
  }

  public static async executePromiseWithTimeout<T>(timeoutMs: number, promise: Promise<T>, failureMessage: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((resolve, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(failureMessage)), timeoutMs);
    });
    return Promise.race([
      promise,
      timeoutPromise,
    ]).then((result) => {
      clearTimeout(timeoutHandle);
      return result;
    });
  }

  public static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public static getInactivityStatusLevel(chargingStation: ChargingStation, connectorId: number, inactivitySecs: number): InactivityStatus {
    if (!inactivitySecs) {
      return InactivityStatus.INFO;
    }
    // Get Notification Interval
    const intervalMins = Utils.getEndOfChargeNotificationIntervalMins(chargingStation, connectorId);
    // Check
    if (inactivitySecs < (intervalMins * 60)) {
      return InactivityStatus.INFO;
    } else if (inactivitySecs < (intervalMins * 60 * 2)) {
      return InactivityStatus.WARNING;
    }
    return InactivityStatus.ERROR;
  }

  public static objectHasProperty(obj: any, key: string): boolean {
    return _.has(obj, key);
  }

  public static isBoolean(obj: any): boolean {
    return typeof obj === 'boolean';
  }

  public static generateUUID(): string {
    return uuid();
  }

  public static generateTagID(name: string, firstName: string): string {
    let tagID = '';
    if (name && name.length > 0) {
      tagID = name[0].toUpperCase();
    } else {
      tagID = 'S';
    }
    if (firstName && firstName.length > 0) {
      tagID += firstName[0].toUpperCase();
    } else {
      tagID += 'F';
    }
    tagID += Utils.getRandomIntSafe();
    return tagID;
  }

  public static isIterable(obj: any): boolean {
    if (obj) {
      return typeof obj[Symbol.iterator] === 'function';
    }
    return false;
  }

  public static isUndefined(obj: any): boolean {
    return typeof obj === 'undefined';
  }

  public static isNullOrUndefined(obj: any): boolean {
    // eslint-disable-next-line no-eq-null, eqeqeq
    return obj == null;
  }

  public static getConnectorStatusesFromChargingStations(chargingStations: ChargingStation[]): ConnectorStats {
    const connectorStats: ConnectorStats = {
      totalChargers: 0,
      availableChargers: 0,
      totalConnectors: 0,
      chargingConnectors: 0,
      suspendedConnectors: 0,
      availableConnectors: 0,
      unavailableConnectors: 0,
      preparingConnectors: 0,
      finishingConnectors: 0,
      faultedConnectors: 0
    };
    // Chargers
    for (const chargingStation of chargingStations) {
      // Check not deleted
      if (chargingStation.deleted) {
        continue;
      }
      // Check connectors
      connectorStats.totalChargers++;
      // Handle Connectors
      if (!chargingStation.connectors) {
        chargingStation.connectors = [];
      }
      for (const connector of chargingStation.connectors) {
        if (!connector) {
          continue;
        }
        connectorStats.totalConnectors++;
        // Not Available?
        if (chargingStation.inactive ||
          connector.status === ChargePointStatus.UNAVAILABLE) {
          connectorStats.unavailableConnectors++;
          // Available?
        } else if (connector.status === ChargePointStatus.AVAILABLE) {
          connectorStats.availableConnectors++;
          // Suspended?
        } else if (connector.status === ChargePointStatus.SUSPENDED_EV ||
          connector.status === ChargePointStatus.SUSPENDED_EVSE) {
          connectorStats.suspendedConnectors++;
          // Charging?
        } else if (connector.status === ChargePointStatus.CHARGING ||
          connector.status === ChargePointStatus.OCCUPIED) {
          connectorStats.chargingConnectors++;
          // Faulted?
        } else if (connector.status === ChargePointStatus.FAULTED) {
          connectorStats.faultedConnectors++;
          // Preparing?
        } else if (connector.status === ChargePointStatus.PREPARING) {
          connectorStats.preparingConnectors++;
          // Finishing?
        } else if (connector.status === ChargePointStatus.FINISHING) {
          connectorStats.finishingConnectors++;
        }
      }
      // Handle Chargers
      for (const connector of chargingStation.connectors) {
        if (!connector) {
          continue;
        }
        // Check if Available
        if (!chargingStation.inactive && connector.status === ChargePointStatus.AVAILABLE) {
          connectorStats.availableChargers++;
          break;
        }
      }
    }
    return connectorStats;
  }

  /**
   * Map user locale (en_US, fr_FR...) to language (en, fr...)
   *
   * @param locale
   */
  public static getLanguageFromLocale(locale: string): string {
    let language = Constants.DEFAULT_LANGUAGE;
    // Get the language
    if (locale && locale.length >= 2) {
      language = locale.substring(0, 2);
    }
    return language;
  }

  /**
   * Map language (en, fr...) to user locale (en_US, fr_FR...)
   *
   * @param language
   */
  static getLocaleFromLanguage(language: string): string {
    if (language === 'fr') {
      return 'fr_FR';
    } else if (language === 'es') {
      return 'es_ES';
    } else if (language === 'de') {
      return 'de_DE';
    } else if (language === 'pt') {
      return 'pt_PT';
    } else if (language === 'it') {
      return 'it_IT';
    }
    return Constants.DEFAULT_LOCALE;
  }

  public static convertLocaleForCurrency(locale: string): string {
    return locale.replace('_', '-');
  }

  public static getConnectorLimitSourceString(limitSource: ConnectorCurrentLimitSource): string {
    switch (limitSource) {
      case ConnectorCurrentLimitSource.CHARGING_PROFILE:
        return 'Charging Profile';
      case ConnectorCurrentLimitSource.CONNECTOR:
        return 'Connector';
      case ConnectorCurrentLimitSource.STATIC_LIMITATION:
        return 'Static Limitation';
    }
  }

  public static getWebSocketCloseEventStatusString(code: number): string {
    if (code >= 0 && code <= 999) {
      return '(Unused)';
    } else if (code >= 1016) {
      if (code <= 1999) {
        return '(For WebSocket standard)';
      } else if (code <= 2999) {
        return '(For WebSocket extensions)';
      } else if (code <= 3999) {
        return '(For libraries and frameworks)';
      } else if (code <= 4999) {
        return '(For applications)';
      }
    }
    if (!Utils.isUndefined(WebSocketCloseEventStatusString[code])) {
      return WebSocketCloseEventStatusString[code];
    }
    return '(Unknown)';
  }

  public static convertToBoolean(value: any): boolean {
    let result = false;
    // Check boolean
    if (value) {
      // Check the type
      if (Utils.isBoolean(value)) {
        // Already a boolean
        result = value;
      } else {
        // Convert
        result = (value === 'true');
      }
    }
    return result;
  }

  public static convertToDate(value: any): Date {
    // Check
    if (!value) {
      return null;
    }
    // Check Type
    if (!(value instanceof Date)) {
      return new Date(value);
    }
    return value;
  }

  public static replaceSpecialCharsInCSVValueParam(value: string): string {
    return value ? value.replace(/\n/g, '') : '';
  }

  public static isEmptyJSon(document: any): boolean {
    // Empty?
    if (!document) {
      return true;
    }
    // Check type
    if (typeof document !== 'object') {
      return true;
    }
    // Check
    return Object.keys(document).length === 0;
  }

  public static removeExtraEmptyLines(tab: string[]): void {
    // Start from the end
    for (let i = tab.length - 1; i > 0; i--) {
      // Two consecutive empty lines?
      if (tab[i].length === 0 && tab[i - 1].length === 0) {
        // Remove the last one
        tab.splice(i, 1);
      }
      // Check last line
      if (i === 1 && tab[i - 1].length === 0) {
        // Remove the first one
        tab.splice(i - 1, 1);
      }
    }
  }

  public static isComponentActiveFromToken(userToken: UserToken, componentName: TenantComponents): boolean {
    return userToken.activeComponents.includes(componentName);
  }

  public static convertToInt(value: any): number {
    let changedValue: number = value;
    if (!value) {
      return 0;
    }
    if (Number.isSafeInteger(value)) {
      return value;
    }
    // Check
    if (typeof value === 'string') {
      // Create Object
      changedValue = parseInt(value);
    }
    return changedValue;
  }

  public static convertToFloat(value: any): number {
    let changedValue: number = value;
    if (!value) {
      return 0;
    }
    // Check
    if (typeof value === 'string') {
      // Create Object
      changedValue = parseFloat(value);
    }
    // Fix float
    return changedValue;
  }

  public static computeSimplePrice(pricePerkWh: number, consumptionWh: number): number {
    return Utils.createDecimal(pricePerkWh).mul(Utils.convertToFloat(consumptionWh)).div(1000).toNumber();
  }

  public static convertAmpToWatt(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID = 0, ampValue: number): number {
    const voltage = Utils.getChargingStationVoltage(chargingStation, chargePoint, connectorID);
    if (voltage) {
      return Utils.createDecimal(voltage).mul(ampValue).toNumber();
    }
    return 0;
  }

  public static convertWattToAmp(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorID = 0, wattValue: number): number {
    const voltage = Utils.getChargingStationVoltage(chargingStation, chargePoint, connectorID);
    if (voltage) {
      return Utils.createDecimal(wattValue).div(voltage).toNumber();
    }
    return 0;
  }

  public static convertWattHourToKiloWattHour(wattHours: number, decimalPlaces?: number): number {
    if (decimalPlaces) {
      return Utils.truncTo((Utils.createDecimal(wattHours).div(1000)).toNumber(), decimalPlaces);
    }
    return Utils.convertToFloat((Utils.createDecimal(wattHours).div(1000)));
  }

  public static createDecimal(value: number): Decimal {
    if (Utils.isNullOrUndefined(value)) {
      value = 0;
    }
    return new Decimal(value);
  }

  public static getChargePointFromID(chargingStation: ChargingStation, chargePointID: number): ChargePoint {
    if (!chargingStation.chargePoints) {
      return null;
    }
    return chargingStation.chargePoints.find((chargePoint) => chargePoint && (chargePoint.chargePointID === chargePointID));
  }

  public static getConnectorFromID(chargingStation: ChargingStation, connectorID: number): Connector {
    if (!chargingStation.connectors) {
      return null;
    }
    return chargingStation.connectors.find((connector) => connector && (connector.connectorId === connectorID));
  }

  public static getBackupConnectorFromID(chargingStation: ChargingStation, connectorID: number): Connector {
    if (!chargingStation.backupConnectors) {
      return null;
    }
    return chargingStation.backupConnectors.find((backupConnector) => backupConnector && (backupConnector.connectorId === connectorID));
  }

  public static computeChargingStationTotalAmps(chargingStation: ChargingStation): number {
    let totalAmps = 0;
    if (chargingStation) {
      // Check at Charging Station
      if (chargingStation.maximumPower) {
        return Utils.convertWattToAmp(chargingStation, null, 0, chargingStation.maximumPower);
      }
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePoint of chargingStation.chargePoints) {
          totalAmps += chargePoint.amperage;
        }
      }
      // Check at connector level
      if (totalAmps === 0 && chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          totalAmps += connector.amperage;
        }
      }
    }
    return totalAmps;
  }

  public static getChargingStationPower(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorId = 0): number {
    let totalPower = 0;
    if (chargingStation) {
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            // Charging Station
            if (connectorId === 0 && chargePointOfCS.power) {
              totalPower += chargePointOfCS.power;
            // Connector
            } else if (chargePointOfCS.connectorIDs.includes(connectorId) && chargePointOfCS.power) {
              if (chargePointOfCS.cannotChargeInParallel || chargePointOfCS.sharePowerToAllConnectors) {
                // Check Connector ID
                const connector = Utils.getConnectorFromID(chargingStation, connectorId);
                if (connector?.power) {
                  return connector.power;
                }
                return chargePointOfCS.power;
              }
              // Power is shared evenly on connectors
              return chargePointOfCS.power / chargePointOfCS.connectorIDs.length;
            }
          }
        }
      }
      // Check at connector level
      if (totalPower === 0 && chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          if (connectorId === 0 && connector.power) {
            totalPower += connector.power;
          }
          if (connector.connectorId === connectorId && connector.power) {
            return connector.power;
          }
        }
      }
    }
    if (!totalPower) {
      const amperage = Utils.getChargingStationAmperage(chargingStation, chargePoint, connectorId);
      const voltage = Utils.getChargingStationVoltage(chargingStation, chargePoint, connectorId);
      if (voltage && amperage) {
        return voltage * amperage;
      }
    }
    return totalPower;
  }

  public static getNumberOfConnectedPhases(chargingStation: ChargingStation, chargePoint?: ChargePoint, connectorId = 0): number {
    if (chargingStation) {
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            // Charging Station
            if (connectorId === 0 && chargePointOfCS.numberOfConnectedPhase) {
              return chargePointOfCS.numberOfConnectedPhase;
            }
            // Connector
            if (chargePointOfCS.connectorIDs.includes(connectorId) && chargePointOfCS.numberOfConnectedPhase) {
              // Check Connector ID
              const connector = Utils.getConnectorFromID(chargingStation, connectorId);
              if (connector?.numberOfConnectedPhase) {
                return connector.numberOfConnectedPhase;
              }
              return chargePointOfCS.numberOfConnectedPhase;
            }
          }
        }
      }
      // Check at connector level
      if (chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          // Take the first
          if (connectorId === 0 && connector.numberOfConnectedPhase) {
            return connector.numberOfConnectedPhase;
          }
          if (connector.connectorId === connectorId && connector.numberOfConnectedPhase) {
            return connector.numberOfConnectedPhase;
          }
        }
      }
    }
    return 1;
  }

  public static getChargingStationVoltage(chargingStation: ChargingStation, chargePoint?: ChargePoint, connectorId = 0): Voltage {
    if (chargingStation) {
      // Check at charging station level
      if (chargingStation.voltage) {
        return chargingStation.voltage;
      }
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            // Charging Station
            if (connectorId === 0 && chargePointOfCS.voltage) {
              return chargePointOfCS.voltage;
            }
            // Connector
            if (chargePointOfCS.connectorIDs.includes(connectorId) && chargePointOfCS.voltage) {
              // Check Connector ID
              const connector = Utils.getConnectorFromID(chargingStation, connectorId);
              if (connector?.voltage) {
                return connector.voltage;
              }
              return chargePointOfCS.voltage;
            }
          }
        }
      }
      // Check at connector level
      if (chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          // Take the first
          if (connectorId === 0 && connector.voltage) {
            return connector.voltage;
          }
          if (connector.connectorId === connectorId && connector.voltage) {
            return connector.voltage;
          }
        }
      }
    }
    // Return a sensible default value to avoid divide by zero
    return Voltage.VOLTAGE_230;
  }

  public static getChargingStationCurrentType(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorId = 0): CurrentType {
    if (chargingStation) {
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            // Charging Station
            if (connectorId === 0 && chargePointOfCS.currentType) {
              return chargePointOfCS.currentType;
            // Connector
            } else if (chargePointOfCS.connectorIDs.includes(connectorId) && chargePointOfCS.currentType) {
              // Check Connector ID
              const connector = Utils.getConnectorFromID(chargingStation, connectorId);
              if (connector?.currentType) {
                return connector.currentType;
              }
              return chargePointOfCS.currentType;
            }
          }
        }
      }
      // Check at connector level
      if (chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          // Take the first
          if (connectorId === 0 && connector.currentType) {
            return connector.currentType;
          }
          if (connector.connectorId === connectorId && connector.currentType) {
            return connector.currentType;
          }
        }
      }
    }
    return null;
  }

  public static getChargingStationAmperage(chargingStation: ChargingStation, chargePoint?: ChargePoint, connectorId = 0): number {
    let totalAmps = 0;
    if (chargingStation) {
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            // Charging Station
            if (connectorId === 0 && chargePointOfCS.amperage) {
              totalAmps += chargePointOfCS.amperage;
            } else if (chargePointOfCS.connectorIDs.includes(connectorId) && chargePointOfCS.amperage) {
              if (chargePointOfCS.cannotChargeInParallel || chargePointOfCS.sharePowerToAllConnectors) {
                // Same power for all connectors
                // Check Connector ID first
                const connector = Utils.getConnectorFromID(chargingStation, connectorId);
                if (connector?.amperage) {
                  return connector.amperage;
                }
                return chargePointOfCS.amperage;
              }
              // Power is split evenly per connector
              return chargePointOfCS.amperage / chargePointOfCS.connectorIDs.length;
            }
          }
        }
      }
      // Check at connector level
      if (totalAmps === 0 && chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          if (connectorId === 0 && connector.amperage) {
            totalAmps += connector.amperage;
          }
          if (connector.connectorId === connectorId && connector.amperage) {
            return connector.amperage;
          }
        }
      }
    }
    return totalAmps;
  }

  public static getChargingStationAmperagePerPhase(chargingStation: ChargingStation, chargePoint?: ChargePoint, connectorId = 0): number {
    const totalAmps = Utils.getChargingStationAmperage(chargingStation, chargePoint, connectorId);
    const numberOfConnectedPhases = Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connectorId);
    if (totalAmps % numberOfConnectedPhases === 0) {
      return totalAmps / numberOfConnectedPhases;
    }
    return Math.round(totalAmps / numberOfConnectedPhases);
  }

  public static getChargingStationAmperageLimit(chargingStation: ChargingStation, chargePoint?: ChargePoint, connectorId = 0): number {
    let amperageLimit = 0;
    if (chargingStation) {
      if (connectorId > 0) {
        return Utils.getConnectorFromID(chargingStation, connectorId)?.amperageLimit;
      }
      // Check at charge point level
      if (chargingStation.chargePoints) {
        for (const chargePointOfCS of chargingStation.chargePoints) {
          if (!chargePoint || chargePoint.chargePointID === chargePointOfCS.chargePointID) {
            if (chargePointOfCS.excludeFromPowerLimitation) {
              continue;
            }
            if (chargePointOfCS.cannotChargeInParallel ||
              chargePointOfCS.sharePowerToAllConnectors) {
              // Add limit amp of one connector
              amperageLimit += Utils.getConnectorFromID(chargingStation, chargePointOfCS.connectorIDs[0])?.amperageLimit;
            } else {
              // Add limit amp of all connectors
              for (const connectorID of chargePointOfCS.connectorIDs) {
                amperageLimit += Utils.getConnectorFromID(chargingStation, connectorID)?.amperageLimit;
              }
            }
          }
        }
      }
      // Check at connector level
      if (amperageLimit === 0 && chargingStation.connectors) {
        for (const connector of chargingStation.connectors) {
          amperageLimit += connector.amperageLimit;
        }
      }
    }
    const amperageMax = Utils.getChargingStationAmperage(chargingStation, chargePoint, connectorId);
    // Check and default
    if (amperageLimit === 0 || amperageLimit > amperageMax) {
      amperageLimit = amperageMax;
    }
    return amperageLimit;
  }

  public static isEmptyArray(array: any): boolean {
    if (!array) {
      return true;
    }
    if (Array.isArray(array) && array.length > 0) {
      return false;
    }
    return true;
  }

  static isEmptyObject(obj: any): boolean {
    return !Object.keys(obj).length;
  }

  public static findDuplicatesInArray(arr: any[]): any[] {
    const sorted_arr = arr.slice().sort();
    const results: any[] = [];
    for (let i = 0; i < sorted_arr.length - 1; i++) {
      if (_.isEqual(sorted_arr[i + 1], sorted_arr[i])) {
        results.push(sorted_arr[i]);
      }
    }
    return results;
  }

  public static buildUserFullName(user: User | UserToken, withID = true, withEmail = false): string {
    let fullName: string;
    if (!user || !user.name) {
      return '-';
    }
    if (user.firstName) {
      fullName = `${user.firstName} ${user.name}`;
    } else {
      fullName = user.name;
    }
    if (withID && user.id) {
      fullName += ` (${user.id})`;
    }
    if (withEmail && user.email) {
      fullName += ` ${user.email}`;
    }
    return fullName;
  }

  public static buildCarCatalogName(carCatalog: CarCatalog, withID = false): string {
    let carCatalogName: string;
    if (!carCatalog) {
      return '-';
    }
    carCatalogName = carCatalog.vehicleMake;
    if (carCatalog.vehicleModel) {
      carCatalogName += ` ${carCatalog.vehicleModel}`;
    }
    if (carCatalog.vehicleModelVersion) {
      carCatalogName += ` ${carCatalog.vehicleModelVersion}`;
    }
    if (withID && carCatalog.id) {
      carCatalogName += ` (${carCatalog.id})`;
    }
    return carCatalogName;
  }

  public static buildCarName(car: Car, withID = false): string {
    let carName: string;
    if (!car) {
      return '-';
    }
    if (car.carCatalog) {
      carName = Utils.buildCarCatalogName(car.carCatalog, withID);
    }
    if (!carName) {
      carName = `VIN '${car.vin}', License Plate '${car.licensePlate}'`;
    } else {
      carName += ` with VIN '${car.vin}' and License Plate '${car.licensePlate}'`;
    }
    if (withID && car.id) {
      carName += ` (${car.id})`;
    }
    return carName;
  }

  // Save the users in file
  public static saveFile(filename: string, content: string): void {
    // Save
    fs.writeFileSync(path.join(__dirname, filename), content, 'UTF-8');
  }

  public static getRandomInt(max: number, min = 0): number {
    if (min) {
      return Math.floor(Math.random() * (max - min + 1) + min);
    }
    return Math.floor(Math.random() * max + 1);
  }

  public static getRandomIntSafe(): number {
    return Utils.getRandomInt(2147483648); // INT32 (signed: issue in Schneider)
  }

  public static buildRestServerURL(): string {
    const centralSystemRestServer = Configuration.getCentralSystemRestServerConfig();
    return `${centralSystemRestServer.protocol}://${centralSystemRestServer.host}:${centralSystemRestServer.port}`;
  }

  public static buildEvseURL(subdomain: string = null): string {
    const centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();
    if (subdomain) {
      return `${centralSystemFrontEndConfig.protocol}://${subdomain}.${centralSystemFrontEndConfig.host}:${centralSystemFrontEndConfig.port}`;
    }
    return `${centralSystemFrontEndConfig.protocol}://${centralSystemFrontEndConfig.host}:${centralSystemFrontEndConfig.port}`;
  }

  public static buildOCPPServerURL(tenantID: string, ocppVersion: OCPPVersion, ocppProtocol: OCPPProtocol, token?: string): string {
    let ocppUrl: string;
    if (Configuration.getJsonEndpointConfig().baseUrl && ocppProtocol === OCPPProtocol.JSON) {
      ocppUrl = `${Configuration.getJsonEndpointConfig().baseUrl}/${Utils.getOCPPServerVersionURLPath(ocppVersion)}/${tenantID}`;
      if (token) {
        ocppUrl += `/${token}`;
      }
    } else if (Configuration.getWSDLEndpointConfig()?.baseUrl && ocppProtocol === OCPPProtocol.SOAP) {
      ocppUrl = `${Configuration.getWSDLEndpointConfig().baseUrl}/${Utils.getOCPPServerVersionURLPath(ocppVersion)}?TenantID=${tenantID}`;
      if (token) {
        ocppUrl += `%26Token=${token}`;
      }
    }
    return ocppUrl;
  }

  public static buildOCPPServerSecureURL(tenantID: string, ocppVersion: OCPPVersion, ocppProtocol: OCPPProtocol, token?: string): string {
    let ocppUrl: string;
    if (Configuration.getJsonEndpointConfig().baseSecureUrl && ocppProtocol === OCPPProtocol.JSON) {
      ocppUrl = `${Configuration.getJsonEndpointConfig().baseSecureUrl}/${Utils.getOCPPServerVersionURLPath(ocppVersion)}/${tenantID}`;
      if (token) {
        ocppUrl += `/${token}`;
      }
    } else if (Configuration.getWSDLEndpointConfig()?.baseSecureUrl && ocppProtocol === OCPPProtocol.SOAP) {
      ocppUrl = `${Configuration.getWSDLEndpointConfig().baseSecureUrl}/${Utils.getOCPPServerVersionURLPath(ocppVersion)}?TenantID=${tenantID}`;
      if (token) {
        ocppUrl += `%26Token=${token}`;
      }
    }
    return ocppUrl;
  }

  public static getOCPPServerVersionURLPath(ocppVersion: OCPPVersion): string {
    if (!Utils.isUndefined(OCPPVersionURLPath[ocppVersion])) {
      return OCPPVersionURLPath[ocppVersion];
    }
    return 'UNKNOWN';
  }

  public static buildEvseTagURL(tenantSubdomain: string, tag: Tag): string {
    return `${Utils.buildEvseURL(tenantSubdomain)}/users#tag?TagID=${tag.id}`;
  }

  public static buildEvseChargingStationURL(tenantSubdomain: string, chargingStation: ChargingStation, hash = ''): string {
    return `${Utils.buildEvseURL(tenantSubdomain)}/charging-stations?ChargingStationID=${chargingStation.id}${hash}`;
  }

  public static buildEvseTransactionURL(tenantSubdomain: string, transactionId: number, hash = ''): string {
    return `${Utils.buildEvseURL(tenantSubdomain)}/transactions?TransactionID=${transactionId.toString()}${hash}`;
  }

  public static buildEvseBillingSettingsURL(tenantSubdomain: string): string {
    return `${Utils.buildEvseURL(tenantSubdomain)}/settings#billing`;
  }

  public static buildEvseBillingInvoicesURL(tenantSubdomain: string): string {
    return `${Utils.buildEvseURL(tenantSubdomain)}/invoices`;
  }

  public static buildEvseBillingDownloadInvoicesURL(tenantSubdomain: string, invoiceID: string): string {
    return `${Utils.buildEvseURL(tenantSubdomain)}/invoices?InvoiceID=${invoiceID}#all`;
  }

  // TODO uodate the route once we handle the payment ui and delete other unused urls
  public static buildEvseBillingPayURL(tenantSubdomain: string, invoiceID: string): string {
    return `${Utils.buildEvseURL(tenantSubdomain)}/invoices?InvoiceID=${invoiceID}#all`;
  }

  public static buildEvseUserToVerifyURL(tenantSubdomain: string, userId: string): string {
    return `${Utils.buildEvseURL(tenantSubdomain)}/users/${userId}`;
  }

  public static hideShowMessage(message: string): string {
    // Check Prod
    if (Utils.isProductionEnv()) {
      return 'An unexpected server error occurred. Check the server\'s logs!';
    }
    return message;
  }

  public static getRequestIP(request: http.IncomingMessage | Partial<Request>): string | string[] {
    if (request['ip']) {
      return request['ip'];
    } else if (request.headers['x-forwarded-for']) {
      return request.headers['x-forwarded-for'];
    } else if (request.connection.remoteAddress) {
      return request.connection.remoteAddress;
    } else if (request.headers.host) {
      const host = request.headers.host.split(':', 2);
      const ip = host[0];
      return ip;
    }
  }

  public static checkRecordLimit(recordLimit: number | string): number {
    // String?
    if (typeof recordLimit === 'string') {
      recordLimit = Utils.convertToInt(recordLimit);
    }
    // Not provided?
    if (isNaN(recordLimit) || recordLimit < 0 || recordLimit === 0) {
      recordLimit = Constants.DB_RECORD_COUNT_DEFAULT;
    }
    // Check max
    if (recordLimit > Number.MAX_SAFE_INTEGER) {
      recordLimit = Number.MAX_SAFE_INTEGER;
    }
    return recordLimit;
  }

  public static roundTo(value: number, scale: number): number {
    const roundPower = Math.pow(10, scale);
    return Math.round(value * roundPower) / roundPower;
  }

  public static truncTo(value: number, scale: number): number {
    const truncPower = Math.pow(10, scale);
    return Math.trunc(value * truncPower) / truncPower;
  }

  public static firstLetterInUpperCase(value: string): string {
    return value[0].toUpperCase() + value.substring(1);
  }

  public static firstLetterInLowerCase(value: string): string {
    return value[0].toLowerCase() + value.substring(1);
  }

  public static cloneObject<T>(object: T): T {
    if (Utils.isNullOrUndefined(object)) {
      return object;
    }
    let cloneObject: T;
    try {
      cloneObject = _.cloneDeep(object);
    } catch (error) {
      void Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: 'cloneObject',
        action: ServerAction.LOGGING,
        message: `Failed to clone object with error: ${error}`,
        detailedMessages: { error }
      });
    }
    return cloneObject;
  }

  public static getConnectorLetterFromConnectorID(connectorID: number): string {
    return String.fromCharCode(65 + connectorID - 1);
  }

  public static getConnectorIDFromConnectorLetter(connectorLetter: string): number {
    return connectorLetter.charCodeAt(0) - 64;
  }

  public static checkRecordSkip(recordSkip: number | string): number {
    // String?
    if (typeof recordSkip === 'string') {
      recordSkip = Utils.convertToInt(recordSkip);
    }
    // Not provided?
    if (isNaN(recordSkip) || recordSkip < 0) {
      // Default
      recordSkip = 0;
    }
    return recordSkip;
  }

  public static generateToken(email: string): string {
    return Cypher.hash(`${crypto.randomBytes(256).toString('hex')}}~${new Date().toISOString()}~${email}`);
  }

  public static getRoleNameFromRoleID(roleID: string): string {
    switch (roleID) {
      case UserRole.BASIC:
        return 'Basic';
      case UserRole.DEMO:
        return 'Demo';
      case UserRole.ADMIN:
        return 'Admin';
      case UserRole.SUPER_ADMIN:
        return 'Super Admin';
      default:
        return 'Unknown';
    }
  }

  public static async hashPasswordBcrypt(password: string): Promise<string> {
    return await new Promise((fulfill, reject) => {
      // Generate a salt with 15 rounds
      bcrypt.genSalt(10, (error, salt) => {
        // Hash
        bcrypt.hash(password, salt, (err, hash) => {
          // Error?
          if (err) {
            reject(err);
          } else {
            fulfill(hash);
          }
        });
      });
    });
  }

  public static async checkPasswordBCrypt(password: string, hash: string): Promise<boolean> {
    return await new Promise((fulfill, reject) => {
      // Compare
      bcrypt.compare(password, hash, (err, match) => {
        // Error?
        if (err) {
          reject(err);
        } else {
          fulfill(match);
        }
      });
    });
  }

  public static containsAddressGPSCoordinates(address: Address): boolean {
    // Check if GPS are available
    if (address && Utils.containsGPSCoordinates(address.coordinates)) {
      return true;
    }
    return false;
  }

  public static containsGPSCoordinates(coordinates: number[]): boolean {
    // Check if GPs are available
    if (!Utils.isEmptyArray(coordinates) && coordinates.length === 2 && coordinates[0] && coordinates[1]) {
      // Check Longitude & Latitude
      if (validator.isLatLong(coordinates[1].toString() + ',' + coordinates[0].toString())) {
        return true;
      }
    }
    return false;
  }

  public static generatePassword(): string {
    let password = '';
    const randomLength = Utils.getRandomInt(Constants.PWD_MAX_LENGTH, Constants.PWD_MIN_LENGTH);
    while (!Utils.isPasswordValid(password)) {
      // eslint-disable-next-line no-useless-escape
      password = passwordGenerator(randomLength, false, /[\w\d!#\$%\^&\*\.\?\-]/);
    }
    return password;
  }

  public static getStatusDescription(status: string): string {
    switch (status) {
      case UserStatus.PENDING:
        return 'Pending';
      case UserStatus.LOCKED:
        return 'Locked';
      case UserStatus.BLOCKED:
        return 'Blocked';
      case UserStatus.ACTIVE:
        return 'Active';
      case UserStatus.INACTIVE:
        return 'Inactive';
      default:
        return 'Unknown';
    }
  }

  public static hashPassword(password: string): string {
    return Cypher.hash(password);
  }

  public static isValidDate(date: any): boolean {
    return moment(date).isValid();
  }

  public static isDevelopmentEnv(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  public static isProductionEnv(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  public static isTestEnv(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  public static getTimezone(coordinates: number[]): string {
    if (coordinates && coordinates.length === 2) {
      return tzlookup(coordinates[1], coordinates[0]);
    }
    return null;
  }

  public static getTenantActiveComponents(tenant: Tenant): string[] {
    const components: string[] = [];
    for (const componentName in tenant.components) {
      if (tenant.components[componentName].active) {
        components.push(componentName);
      }
    }
    return components;
  }

  public static isTenantComponentActive(tenant: Tenant, component: TenantComponents): boolean {
    for (const componentName in tenant.components) {
      if (componentName === component) {
        return tenant.components[componentName].active;
      }
    }
    return false;
  }

  public static getChargingStationEndpoint() : ChargingStationEndpoint {
    return Configuration.isCloudFoundry() ? ChargingStationEndpoint.SCP : ChargingStationEndpoint.AWS;
  }

  public static async generateQrCode(data: string) :Promise<string> {
    return await QRCode.toDataURL(data);
  }

  public static createDefaultSettingContent(activeComponent: any, currentSettingContent: SettingDBContent): SettingDBContent {
    switch (activeComponent.name) {
      // Pricing
      case TenantComponents.PRICING:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Create default settings
          if (activeComponent.type === PricingSettingsType.SIMPLE) {
            // Simple Pricing
            return {
              'type': PricingSettingsType.SIMPLE,
              'simple': {}
            } as SettingDBContent;
          } else if (activeComponent.type === PricingSettingsType.CONVERGENT_CHARGING) {
            // SAP CC
            return {
              'type': PricingSettingsType.CONVERGENT_CHARGING,
              'convergentCharging': {}
            } as SettingDBContent;
          }
        }
        break;
      // Billing
      case TenantComponents.BILLING:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only Stripe
          return {
            'type': BillingSettingsType.STRIPE,
            'stripe': {}
          } as SettingDBContent;
        }
        break;
      // Refund
      case TenantComponents.REFUND:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only Concur
          return {
            'type': RefundSettingsType.CONCUR,
            'concur': {}
          } as SettingDBContent;
        }
        break;
      // OCPI
      case TenantComponents.OCPI:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only Gireve
          return {
            'type': RoamingSettingsType.OCPI,
            'ocpi': {}
          } as SettingDBContent;
        }
        break;
      // OICP
      case TenantComponents.OICP:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only Hubject
          return {
            'type': RoamingSettingsType.OICP,
            'oicp': {}
          } as SettingDBContent;
        }
        break;
      // SAC
      case TenantComponents.ANALYTICS:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only SAP Analytics
          return {
            'type': AnalyticsSettingsType.SAC,
            'sac': {}
          } as SettingDBContent;
        }
        break;
      // Smart Charging
      case TenantComponents.SMART_CHARGING:
        if (!currentSettingContent || currentSettingContent.type !== activeComponent.type) {
          // Only SAP sapSmartCharging
          return {
            'type': SmartChargingContentType.SAP_SMART_CHARGING,
            'sapSmartCharging': {}
          } as SettingDBContent;
        }
        break;
      // Asset
      case TenantComponents.ASSET:
        if (!currentSettingContent) {
          // Only Asset
          return {
            'type': AssetSettingsType.ASSET,
            'asset': {
              connections: []
            }
          } as SettingDBContent;
        }
        break;
      // Car Connector
      case TenantComponents.CAR_CONNECTOR:
        if (!currentSettingContent) {
          // Only Car Connector
          return {
            'type': CarConnectorSettingsType.CAR_CONNECTOR,
            'carConnector': {
              connections: []
            }
          } as SettingDBContent;
        }
        break;
    }
  }

  public static buildTenantName(tenant: Tenant): string {
    return `'${tenant.name}' ('${tenant.subdomain}')`;
  }

  public static isChargingStationIDValid(name: string): boolean {
    // eslint-disable-next-line no-useless-escape
    return /^[A-Za-z0-9_\.\-~]*$/.test(name);
  }

  public static isPasswordValid(password: string): boolean {
    // eslint-disable-next-line no-useless-escape
    return /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!#@:;,<>\/''\$%\^&\*\.\?\-_\+\=\(\)])(?=.{8,})/.test(password);
  }

  public static isPhoneValid(phone: string): boolean {
    return /^\+?([0-9] ?){9,14}[0-9]$/.test(phone);
  }

  public static isUserEmailValid(email: string): boolean {
    return validator.isEmail(email);
  }

  public static areTagsValid(tags: Tag[]): boolean {
    return tags.filter((tag) => /^[A-Za-z0-9,]*$/.test(tag.id)).length === tags.length;
  }

  public static isPlateIDValid(plateID: string): boolean {
    return /^[A-Z0-9- ]*$/.test(plateID);
  }

  public static parseConfigCryptoAlgorithm(algo: string): CryptoKeyProperties {
    const [blockCypher, blockSize, operationMode] = algo.split('-');
    return {
      blockCypher: blockCypher,
      blockSize: Utils.convertToInt(blockSize),
      operationMode: operationMode
    };
  }

  public static buildCryptoAlgorithm(keyProperties: CryptoKeyProperties): string | CipherGCMTypes {
    return `${keyProperties.blockCypher}-${keyProperties.blockSize}-${keyProperties.operationMode}`;
  }

  public static generateRandomKey(keyProperties: CryptoKeyProperties): string {
    // Ensure the key's number of characters is always keyProperties.blockSize / 8
    const keyLength = keyProperties.blockSize / 8;
    return crypto.randomBytes(keyLength).toString('base64').slice(0, keyLength);
  }

  public static getDefaultKeyProperties(): CryptoKeyProperties {
    return {
      blockCypher: 'aes',
      blockSize: 256,
      operationMode: 'gcm'
    };
  }

  public static getPerformanceRecordGroupFromURL(url: string): PerformanceRecordGroup {
    if (!url) {
      return PerformanceRecordGroup.UNKNOWN;
    }
    // REST API
    if (url.startsWith('/client/api/') ||
        url.startsWith('/client/util/') ||
        url.startsWith('/client/auth/') ||
        url.startsWith('/v1/api/') ||
        url.startsWith('/v1/util/') ||
        url.startsWith('/v1/auth/')) {
      return PerformanceRecordGroup.REST;
    }
    // OCPI
    if (url.includes('ocpi')) {
      return PerformanceRecordGroup.OCPI;
    }
    // Hubject
    if (url.includes('hubject')) {
      return PerformanceRecordGroup.OICP;
    }
    // Concur
    if (url.includes('concursolutions')) {
      return PerformanceRecordGroup.SAP_CONCUR;
    }
    // Recaptcha
    if (url.includes('recaptcha')) {
      return PerformanceRecordGroup.RECAPTCHA;
    }
    // Greencom
    if (url.includes('gcn-eibp')) {
      return PerformanceRecordGroup.GREENCOM;
    }
    // Stripe
    if (url.includes('stripe')) {
      return PerformanceRecordGroup.STRIPE;
    }
    // ioThink
    if (url.includes('kheiron')) {
      return PerformanceRecordGroup.IOTHINK;
    }
    // Lacroix
    if (url.includes('esoflink')) {
      return PerformanceRecordGroup.LACROIX;
    }
    // EV Database
    if (url.includes('ev-database')) {
      return PerformanceRecordGroup.EV_DATABASE;
    }
    // SAP Smart Charging
    if (url.includes('smart-charging')) {
      return PerformanceRecordGroup.SAP_SMART_CHARGING;
    }
    return PerformanceRecordGroup.UNKNOWN;
  }

  public static buildPerformanceRecord(params: {
    tenantID: string; durationMs: number; sizeKb?: number; source?: string;
    module: string; method: string; action: ServerAction|string; group?: PerformanceRecordGroup;
    httpUrl?: string; httpMethod?: string; httpCode?: number; chargingStationID?: string,
  }): PerformanceRecord {
    const cpuInfo = os.cpus();
    return {
      tenantID: params.tenantID,
      timestamp: new Date(),
      durationMs: params.durationMs,
      sizeKb: params.sizeKb,
      host: Utils.getHostname(),
      process: cluster.isWorker ? 'worker ' + cluster.worker.id.toString() : 'master',
      processMemoryUsage: process.memoryUsage(),
      processCPUUsage: process.cpuUsage(),
      numberOfCPU: cpuInfo.length,
      modelOfCPU: cpuInfo.length > 0 ? cpuInfo[0].model : '',
      memoryTotalGb: Utils.createDecimal(os.totalmem()).div(Constants.ONE_BILLION).toNumber(),
      memoryFreeGb: Utils.createDecimal(os.freemem()).div(Constants.ONE_BILLION).toNumber(),
      loadAverageLastMin: os.loadavg()[0],
      numberOfChargingStations: global.centralSystemJsonServer?.getNumberOfJsonConnections(),
      source: params.source,
      module: params.module,
      method: params.method,
      action: params.action,
      chargingStationID: params.chargingStationID,
      httpUrl: params.httpUrl,
      httpMethod: params.httpMethod,
      httpCode: params.httpCode,
      group: params.group,
    };
  }

  public static getHostname(): string {
    return Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname();
  }

  // when exporting values
  public static escapeCsvValue(value: any): string {
    // add double quote start and end
    // replace double quotes inside value to double double quotes to display double quote correctly in csv editor
    return typeof value === 'string' ? '"' + value.replace(/"/g, '""') + '"' : value;
  }

  // when importing values
  public static unescapeCsvValue(value: any): void {
    // double quotes are handle by csvToJson
  }
}
