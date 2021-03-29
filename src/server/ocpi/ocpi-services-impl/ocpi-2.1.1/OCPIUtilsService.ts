import { CdrDimensionType, OCPIChargingPeriod } from '../../../../types/ocpi/OCPIChargingPeriod';
import ChargingStation, { ChargePoint, Connector, ConnectorType, CurrentType } from '../../../../types/ChargingStation';
import { OCPICapability, OCPIEvse, OCPIEvseStatus } from '../../../../types/ocpi/OCPIEvse';
import { OCPIConnector, OCPIConnectorFormat, OCPIConnectorType, OCPIPowerType } from '../../../../types/ocpi/OCPIConnector';
import { OCPILocation, OCPILocationType } from '../../../../types/ocpi/OCPILocation';
import { OCPISession, OCPISessionStatus } from '../../../../types/ocpi/OCPISession';
import { OCPITariff, OCPITariffDimensionType } from '../../../../types/ocpi/OCPITariff';
import { OCPIToken, OCPITokenType, OCPITokenWhitelist } from '../../../../types/ocpi/OCPIToken';
import { PricingSettings, PricingSettingsType, SimplePricingSetting } from '../../../../types/Setting';
import Transaction, { InactivityStatus } from '../../../../types/Transaction';
import User, { UserRole, UserStatus } from '../../../../types/User';

import AppError from '../../../../exception/AppError';
import { ChargePointStatus } from '../../../../types/ocpp/OCPPServer';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import Configuration from '../../../../utils/Configuration';
import Constants from '../../../../utils/Constants';
import Consumption from '../../../../types/Consumption';
import ConsumptionStorage from '../../../../storage/mongodb/ConsumptionStorage';
import CountryLanguage from 'country-language';
import { DataResult } from '../../../../types/DataResult';
import { HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import { OCPICdr } from '../../../../types/ocpi/OCPICdr';
import OCPICredential from '../../../../types/ocpi/OCPICredential';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import { OCPIRole } from '../../../../types/ocpi/OCPIRole';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../OCPIUtils';
import RoamingUtils from '../../../../utils/RoamingUtils';
import { ServerAction } from '../../../../types/Server';
import SettingStorage from '../../../../storage/mongodb/SettingStorage';
import Site from '../../../../types/Site';
import SiteArea from '../../../../types/SiteArea';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import { StatusCodes } from 'http-status-codes';
import Tag from '../../../../types/Tag';
import TagStorage from '../../../../storage/mongodb/TagStorage';
import Tenant from '../../../../types/Tenant';
import TransactionStorage from '../../../../storage/mongodb/TransactionStorage';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';
import countries from 'i18n-iso-countries';
import moment from 'moment';

const MODULE_NAME = 'OCPIUtilsService';

export default class OCPIUtilsService {
  /**
   * Convert Site to OCPI Location
   *
   * @param {Tenant} tenant
   * @param {Site} site
   * @param options
   * @param options.countryID
   * @param options.partyID
   * @param options.addChargeBoxID
   * @returns OCPI Location
   */
   static async convertSite2Location(tenant: Tenant, site: Site, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPILocation> {
    // Build object
    return {
      id: site.id,
      type: OCPILocationType.UNKNOWN,
      name: site.name,
      address: `${site.address.address1} ${site.address.address2}`,
      city: site.address.city,
      postal_code: site.address.postalCode,
      country: countries.getAlpha3Code(site.address.country, CountryLanguage.getCountryLanguages(options.countryID, (err, languages) => languages[0].iso639_1)),
      coordinates: {
        latitude: site.address.coordinates[1].toString(),
        longitude: site.address.coordinates[0].toString()
      },
      evses: await OCPIUtilsService.getEvsesFromSite(tenant, site, options),
      last_updated: site.lastChangedOn ? site.lastChangedOn : site.createdOn,
      opening_times: {
        twentyfourseven: true,
      }
    };
  }

  static convertEvseToChargingStation(evseId: string, evse: Partial<OCPIEvse>, location?: OCPILocation): ChargingStation {
    const chargingStation = {
      id: evse.evse_id,
      maximumPower: 0,
      issuer: false,
      connectors: [],
      chargeBoxSerialNumber: evseId,
      ocpiData: {
        evse: evse
      }
    } as ChargingStation;
    if (evse.coordinates && evse.coordinates.latitude && evse.coordinates.longitude) {
      chargingStation.coordinates = [
        Utils.convertToFloat(evse.coordinates.longitude),
        Utils.convertToFloat(evse.coordinates.latitude)
      ];
    } else if (location && location.coordinates && location.coordinates.latitude && location.coordinates.longitude) {
      chargingStation.coordinates = [
        Utils.convertToFloat(location.coordinates.longitude),
        Utils.convertToFloat(location.coordinates.latitude)
      ];
    }
    if (!Utils.isEmptyArray(evse.connectors)) {
      let connectorId = 1;
      for (const ocpiConnector of evse.connectors) {
        const connector: Connector = {
          id: ocpiConnector.id,
          status: OCPIUtilsService.convertOCPIStatus2Status(evse.status),
          amperage: ocpiConnector.amperage,
          voltage: ocpiConnector.voltage,
          connectorId: connectorId,
          currentInstantWatts: 0,
          power: ocpiConnector.amperage * ocpiConnector.voltage,
          type: OCPIUtilsService.convertOCPIConnectorType2ConnectorType(ocpiConnector.standard),
        };
        chargingStation.maximumPower = Math.max(chargingStation.maximumPower, connector.power);
        chargingStation.connectors.push(connector);
        connectorId++;
      }
    }
    return chargingStation;
  }

  /**
   * Get All OCPI Locations from given tenant
   *
   * @param {Tenant} tenant
   * @param limit
   * @param skip
   * @param options
   * @param options.countryID
   * @param options.partyID
   * @param options.addChargeBoxID
   */
  static async getAllLocations(tenant: Tenant, limit: number, skip: number, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<DataResult<OCPILocation>> {
    // Result
    const ocpiLocationsResult: DataResult<OCPILocation> = { count: 0, result: [] };
    // Get all sites
    const sites = await SiteStorage.getSites(tenant.id, { issuer: true, onlyPublicSite: true }, { limit, skip });
    // Convert Sites to Locations
    for (const site of sites.result) {
      ocpiLocationsResult.result.push(await OCPIUtilsService.convertSite2Location(tenant, site, options));
    }
    // Set count
    ocpiLocationsResult.count = sites.count;
    // Return locations
    return ocpiLocationsResult;
  }

  /**
   * Get All OCPI Tokens from given tenant
   *
   * @param {Tenant} tenant
   * @param limit
   * @param skip
   * @param dateFrom
   * @param dateTo
   */
  static async getAllTokens(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPIToken>> {
    // Result
    const tokens: OCPIToken[] = [];
    // Get all tokens
    const tags = await TagStorage.getTags(tenant.id, { issuer: true, dateFrom, dateTo }, { limit, skip });
    // Convert Sites to Locations
    for (const tag of tags.result) {
      const user = await UserStorage.getUser(tenant.id, tag.userID);
      const valid = user && !user.deleted;
      tokens.push({
        uid: tag.id,
        type: OCPITokenType.RFID,
        auth_id: tag.userID,
        visual_number: tag.userID,
        issuer: tenant.name,
        valid: valid,
        whitelist: OCPITokenWhitelist.ALLOWED_OFFLINE,
        last_updated: tag.lastChangedOn ? tag.lastChangedOn : new Date()
      });
    }
    return {
      count: tags.count,
      result: tokens
    };
  }

  /**
   * Get All OCPI Session from given tenant
   *
   * @param {Tenant} tenant
   * @param limit
   * @param skip
   * @param dateFrom
   * @param dateTo
   */
  static async getAllSessions(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPISession>> {
    // Result
    const sessions: OCPISession[] = [];
    // Get all transactions
    const transactions = await TransactionStorage.getTransactions(tenant.id, { issuer: true, ocpiSessionDateFrom: dateFrom, ocpiSessionDateTo: dateTo }, {
      limit,
      skip
    });
    for (const transaction of transactions.result) {
      sessions.push(transaction.ocpiData.session);
    }
    return {
      count: transactions.count,
      result: sessions
    };
  }

  /**
   * Get All OCPI Cdrs from given tenant
   *
   * @param {Tenant} tenant
   * @param limit
   * @param skip
   * @param dateFrom
   * @param dateTo
   */
  static async getAllCdrs(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPICdr>> {
    // Result
    const cdrs: OCPICdr[] = [];
    // Get all transactions
    const transactions = await TransactionStorage.getTransactions(tenant.id, { issuer: true, ocpiCdrDateFrom: dateFrom, ocpiCdrDateTo: dateTo }, {
      limit,
      skip
    });
    for (const transaction of transactions.result) {
      if (transaction.ocpiData && transaction.ocpiData.cdr) {
        cdrs.push(transaction.ocpiData.cdr);
      }
    }
    return {
      count: transactions.count,
      result: cdrs
    };
  }

  /**
   * Get All OCPI Tariffs from given tenant
   *
   * @param {Tenant} tenant
   * @param limit
   * @param skip
   * @param dateFrom
   * @param dateTo
   */
  static async getAllTariffs(tenant: Tenant, limit: number, skip: number, dateFrom?: Date, dateTo?: Date): Promise<DataResult<OCPITariff>> {
    // Result
    const tariffs: OCPITariff[] = [];
    let tariff: OCPITariff;
    if (tenant.components?.pricing?.active) {
      // Get simple pricing settings
      const pricingSettings = await SettingStorage.getPricingSettings(tenant.id, limit, skip, dateFrom, dateTo);
      if (pricingSettings.type === PricingSettingsType.SIMPLE && pricingSettings.simple) {
        tariff = OCPIUtilsService.convertSimplePricingSetting2OCPITariff(pricingSettings.simple);
        if (tariff.currency && tariff.elements[0].price_components[0].price > 0) {
          tariffs.push(tariff);
        } else if (tariff.currency && tariff.elements[0].price_components[0].price === 0) {
          tariff = OCPIUtilsService.convertPricingSettings2ZeroFlatTariff(pricingSettings);
          tariffs.push(tariff);
        }
      }
    }
    return {
      count: tariffs.length,
      result: tariffs
    };
  }

  /**
   * Get OCPI Token from given tenant and token id
   *
   * @param {Tenant} tenant
   * @param countryId
   * @param partyId
   * @param tokenId
   */
  static async getToken(tenant: Tenant, countryId: string, partyId: string, tokenId: string): Promise<OCPIToken> {
    const tag = await TagStorage.getTag(tenant.id, tokenId, { withUser: true });
    if (tag?.user) {
      if (!tag.user.issuer && tag.user.name === OCPIUtils.buildOperatorName(countryId, partyId) && tag.ocpiToken) {
        return tag.ocpiToken;
      }
    }
  }

  /**
   * Convert OCPI Connector type to connector type
   *
   * @param {OCPIConnectorType} ocpiConnectorType ocpi connector type
   */
  static convertOCPIConnectorType2ConnectorType(ocpiConnectorType: OCPIConnectorType): ConnectorType {
    switch (ocpiConnectorType) {
      case OCPIConnectorType.CHADEMO:
        return ConnectorType.CHADEMO;
      case OCPIConnectorType.IEC_62196_T2:
        return ConnectorType.TYPE_2;
      case OCPIConnectorType.IEC_62196_T2_COMBO:
        return ConnectorType.COMBO_CCS;
      case OCPIConnectorType.IEC_62196_T3:
      case OCPIConnectorType.IEC_62196_T3A:
        return ConnectorType.TYPE_3C;
      case OCPIConnectorType.IEC_62196_T1:
        return ConnectorType.TYPE_1;
      case OCPIConnectorType.IEC_62196_T1_COMBO:
        return ConnectorType.TYPE_1_CCS;
      case OCPIConnectorType.DOMESTIC_A:
      case OCPIConnectorType.DOMESTIC_B:
      case OCPIConnectorType.DOMESTIC_C:
      case OCPIConnectorType.DOMESTIC_D:
      case OCPIConnectorType.DOMESTIC_E:
      case OCPIConnectorType.DOMESTIC_F:
      case OCPIConnectorType.DOMESTIC_G:
      case OCPIConnectorType.DOMESTIC_H:
      case OCPIConnectorType.DOMESTIC_I:
      case OCPIConnectorType.DOMESTIC_J:
      case OCPIConnectorType.DOMESTIC_K:
      case OCPIConnectorType.DOMESTIC_L:
        return ConnectorType.DOMESTIC;
      default:
        return ConnectorType.UNKNOWN;
    }
  }

  /**
   * Convert internal status to OCPI Status
   *
   * @param {*} status
   */
  static convertOCPIStatus2Status(status: OCPIEvseStatus): ChargePointStatus {
    switch (status) {
      case OCPIEvseStatus.AVAILABLE:
        return ChargePointStatus.AVAILABLE;
      case OCPIEvseStatus.BLOCKED:
        return ChargePointStatus.OCCUPIED;
      case OCPIEvseStatus.CHARGING:
        return ChargePointStatus.CHARGING;
      case OCPIEvseStatus.INOPERATIVE:
      case OCPIEvseStatus.OUTOFORDER:
        return ChargePointStatus.FAULTED;
      case OCPIEvseStatus.PLANNED:
      case OCPIEvseStatus.RESERVED:
        return ChargePointStatus.RESERVED;
      default:
        return ChargePointStatus.UNAVAILABLE;
    }
  }

  /**
   * Convert internal status to OCPI Status
   *
   * @param {*} status
   */
  static convertStatus2OCPIStatus(status: ChargePointStatus): OCPIEvseStatus {
    switch (status) {
      case ChargePointStatus.AVAILABLE:
        return OCPIEvseStatus.AVAILABLE;
      case ChargePointStatus.OCCUPIED:
        return OCPIEvseStatus.BLOCKED;
      case ChargePointStatus.CHARGING:
        return OCPIEvseStatus.CHARGING;
      case ChargePointStatus.FAULTED:
        return OCPIEvseStatus.INOPERATIVE;
      case ChargePointStatus.PREPARING:
      case ChargePointStatus.SUSPENDED_EV:
      case ChargePointStatus.SUSPENDED_EVSE:
      case ChargePointStatus.FINISHING:
        return OCPIEvseStatus.BLOCKED;
      case ChargePointStatus.RESERVED:
        return OCPIEvseStatus.RESERVED;
      default:
        return OCPIEvseStatus.UNKNOWN;
    }
  }

  static convertSimplePricingSetting2OCPITariff(simplePricingSetting: SimplePricingSetting): OCPITariff {
    let tariff: OCPITariff;
    tariff.id = '1';
    tariff.currency = simplePricingSetting.currency;
    tariff.elements[0].price_components[0].type = OCPITariffDimensionType.TIME;
    tariff.elements[0].price_components[0].price = simplePricingSetting.price;
    tariff.elements[0].price_components[0].step_size = 60;
    tariff.last_updated = simplePricingSetting.last_updated;
    return tariff;
  }

  static convertChargingStationToOCPILocation(tenant: Tenant, site: Site, chargingStation: ChargingStation, connectorId: number, countryId: string, partyId: string): OCPILocation {
    const connectors: OCPIConnector[] = [];
    let status: ChargePointStatus;
    for (const chargingStationConnector of chargingStation.connectors) {
      if (chargingStationConnector.connectorId === connectorId) {
        connectors.push(OCPIUtilsService.convertConnector2OCPIConnector(tenant, chargingStation, chargingStationConnector, countryId, partyId));
        status = chargingStationConnector.status;
        break;
      }
    }
    const ocpiLocation: OCPILocation = {
      id: site.id,
      name: site.name,
      address: `${site.address.address1} ${site.address.address2}`,
      city: site.address.city,
      postal_code: site.address.postalCode,
      country: countries.getAlpha3Code(site.address.country, CountryLanguage.getCountryLanguages(countryId, (err, languages) => languages[0].iso639_1)),
      coordinates: {
        latitude: site.address.coordinates[1].toString(),
        longitude: site.address.coordinates[0].toString()
      },
      type: OCPILocationType.UNKNOWN,
      evses: [{
        uid: OCPIUtils.buildEvseUID(chargingStation, Utils.getConnectorFromID(chargingStation, connectorId)),
        evse_id: RoamingUtils.buildEvseID(countryId, partyId, chargingStation, Utils.getConnectorFromID(chargingStation, connectorId)),
        status: OCPIUtilsService.convertStatus2OCPIStatus(status),
        capabilities: [OCPICapability.REMOTE_START_STOP_CAPABLE, OCPICapability.RFID_READER],
        connectors: connectors,
        coordinates: {
          latitude: chargingStation.coordinates[1].toString(),
          longitude: chargingStation.coordinates[0].toString()
        },
        last_updated: chargingStation.lastSeen
      }],
      last_updated: site.lastChangedOn ? site.lastChangedOn : site.createdOn,
      opening_times: {
        twentyfourseven: true,
      }
    };
    return ocpiLocation;
  }

  static async buildChargingPeriods(tenantID: string, transaction: Transaction): Promise<OCPIChargingPeriod[]> {
    if (!transaction || !transaction.timestamp) {
      return [];
    }
    const chargingPeriods: OCPIChargingPeriod[] = [];
    const consumptions = await ConsumptionStorage.getTransactionConsumptions(
      tenantID, { transactionId: transaction.id });
    if (consumptions.result) {
      // Build based on consumptions
      for (const consumption of consumptions.result) {
        const chargingPeriod = this.buildChargingPeriod(consumption);
        if (chargingPeriod && chargingPeriod.dimensions && chargingPeriod.dimensions.length > 0) {
          chargingPeriods.push(chargingPeriod);
        }
      }
    } else {
      // Build first/last consumption (if no consumptions is gathered)
      const consumption: number = transaction.stop ? transaction.stop.totalConsumptionWh : transaction.currentTotalConsumptionWh;
      chargingPeriods.push({
        start_date_time: transaction.timestamp,
        dimensions: [{
          type: CdrDimensionType.ENERGY,
          volume: consumption / 1000
        }]
      });
      const inactivity: number = transaction.stop ? transaction.stop.totalInactivitySecs : transaction.currentTotalInactivitySecs;
      if (inactivity > 0) {
        const inactivityStart = transaction.stop ? transaction.stop.timestamp : transaction.currentTimestamp;
        chargingPeriods.push({
          start_date_time: moment(inactivityStart).subtract(inactivity, 'seconds').toDate(),
          dimensions: [{
            type: CdrDimensionType.PARKING_TIME,
            volume: Utils.truncTo(inactivity / 3600, 3)
          }]
        });
      }
    }
    return chargingPeriods;
  }

  /**
   * Check if OCPI credential object contains mandatory fields
   *
   * @param {*} credential
   */
  static isValidOCPICredential(credential: OCPICredential): boolean {
    return (!credential ||
      !credential.url ||
      !credential.token ||
      !credential.party_id ||
      !credential.country_code) ? false : true;
  }

  /**
   * Build OCPI Credential Object
   *
   * @param {string} tenantID
   * @param {string} token
   * @param role
   * @param versionUrl
   */
  static async buildOCPICredentialObject(tenantID: string, token: string, role: string, versionUrl?: string): Promise<OCPICredential> {
    // Credential
    const credential: OCPICredential = {} as OCPICredential;
    // Get ocpi service configuration
    const ocpiSetting = await SettingStorage.getOCPISettings(tenantID);
    // Define version url
    credential.url = (versionUrl ? versionUrl : `${Configuration.getOCPIEndpointConfig().baseUrl}/ocpi/${role.toLowerCase()}/versions`);
    // Check if available
    if (ocpiSetting && ocpiSetting.ocpi) {
      credential.token = token;
      if (role === OCPIRole.EMSP) {
        credential.country_code = ocpiSetting.ocpi.emsp.countryCode;
        credential.party_id = ocpiSetting.ocpi.emsp.partyID;
      } else {
        credential.country_code = ocpiSetting.ocpi.cpo.countryCode;
        credential.party_id = ocpiSetting.ocpi.cpo.partyID;
      }
      credential.business_details = ocpiSetting.ocpi.businessDetails;
    }
    // Return credential object
    return credential;
  }

  /**
   * Convert OCPI Endpoints
   *
   * @param endpointsEntity
   */
  static convertEndpoints(endpointsEntity: any): OCPIEndpoint[] {
    const endpoints: OCPIEndpoint[] = [];
    if (endpointsEntity && endpointsEntity.endpoints) {
      for (const endpoint of endpointsEntity.endpoints) {
        endpoints[endpoint.identifier] = endpoint.url;
      }
    }
    return endpoints;
  }

  /**
   * Get evses from SiteArea
   *
   * @param {Tenant} tenant
   * @param {SiteArea} siteArea
   * @param options
   * @param options.countryID
   * @param options.partyID
   * @param options.addChargeBoxID
   * @returns Array of OCPI EVSES
   */
  private static getEvsesFromSiteaArea(tenant: Tenant, siteArea: SiteArea, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): OCPIEvse[] {
    // Build evses array
    const evses: OCPIEvse[] = [];
    // Convert charging stations to evse(s)
    for (const chargingStation of siteArea.chargingStations) {
      if (Utils.isBoolean(chargingStation.issuer) && chargingStation.issuer && chargingStation.public) {
        if (!Utils.isEmptyArray(chargingStation.chargePoints)) {
          for (const chargePoint of chargingStation.chargePoints) {
            if (chargePoint.cannotChargeInParallel) {
              evses.push(...OCPIUtilsService.convertChargingStation2UniqueEvse(tenant, chargingStation, chargePoint, options));
            } else {
              evses.push(...OCPIUtilsService.convertChargingStation2MultipleEvses(tenant, chargingStation, chargePoint, options));
            }
          }
        } else {
          evses.push(...OCPIUtilsService.convertChargingStation2MultipleEvses(tenant, chargingStation, null, options));
        }
      }
    }
    // Return evses
    return evses;
  }

  /**
   * Get evses from Site
   *
   * @param {Tenant} tenant
   * @param {Site} site
   * @param options
   * @param options.countryID
   * @param options.partyID
   * @param options.addChargeBoxID
   * @returns Array of OCPI EVSEs
   */
  private static async getEvsesFromSite(tenant: Tenant, site: Site, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPIEvse[]> {
    // Build evses array
    const evses = [];
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenant.id,
      {
        withOnlyChargingStations: true,
        withChargingStations: true,
        siteIDs: [site.id],
        issuer: true
      },
      Constants.DB_PARAMS_MAX_LIMIT);
    for (const siteArea of siteAreas.result) {
      // Get charging stations from SiteArea
      evses.push(...OCPIUtilsService.getEvsesFromSiteaArea(tenant, siteArea, options));
    }
    // Return evses
    return evses;
  }

  /**
   * Convert ChargingStation to Multiple EVSEs
   *
   * @param {Tenant} tenant
   * @param {*} chargingStation
   * @param chargePoint
   * @param options
   * @param options.countryID
   * @param options.partyID
   * @param options.addChargeBoxID
   * @returns Array of OCPI EVSEs
   */
  private static convertChargingStation2MultipleEvses(tenant: Tenant, chargingStation: ChargingStation, chargePoint: ChargePoint, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): OCPIEvse[] {
    // Loop through connectors and send one evse per connector
    let connectors: Connector[];
    if (chargePoint) {
      connectors = Utils.getConnectorsFromChargePoint(chargingStation, chargePoint);
    } else {
      connectors = chargingStation.connectors.filter((connector) => connector !== null);
    }
    const evses = connectors.map((connector) => {
      const evse: OCPIEvse = {
        uid: OCPIUtils.buildEvseUID(chargingStation, connector),
        evse_id: RoamingUtils.buildEvseID(options.countryID, options.partyID, chargingStation, connector),
        status: OCPIUtilsService.convertStatus2OCPIStatus(connector.status),
        capabilities: [OCPICapability.REMOTE_START_STOP_CAPABLE, OCPICapability.RFID_READER],
        connectors: [OCPIUtilsService.convertConnector2OCPIConnector(tenant, chargingStation, connector, options.countryID, options.partyID)],
        last_updated: chargingStation.lastSeen,
        coordinates: {
          latitude: chargingStation.coordinates[1] ? chargingStation.coordinates[1].toString() : null,
          longitude: chargingStation.coordinates[0] ? chargingStation.coordinates[0].toString() : null
        }
      };
      // Check addChargeBoxID flag
      if (options?.addChargeBoxID) {
        evse.chargeBoxId = chargingStation.id;
      }
      return evse;
    });
    // Return all evses
    return evses;
  }

  /**
   * Convert ChargingStation to Unique EVSE
   *
   * @param {Tenant} tenant
   * @param {ChargingStation} chargingStation
   * @param options
   * @param chargePoint
   * @param options.countryID
   * @param options.partyID
   * @param options.addChargeBoxID
   * @returns OCPI EVSE
   */
  private static convertChargingStation2UniqueEvse(tenant: Tenant, chargingStation: ChargingStation, chargePoint: ChargePoint, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): OCPIEvse[] {
    let connectors: Connector[];
    if (chargePoint) {
      connectors = Utils.getConnectorsFromChargePoint(chargingStation, chargePoint);
    } else {
      connectors = chargingStation.connectors.filter((connector) => connector !== null);
    }
    // Get all connectors
    const ocpiConnectors: OCPIConnector[] = connectors.map(
      (connector: Connector) => OCPIUtilsService.convertConnector2OCPIConnector(tenant, chargingStation, connector, options.countryID, options.partyID));
    // Get connectors aggregated status
    const connectorsAggregatedStatus = OCPIUtilsService.aggregateConnectorsStatus(connectors);
    // Build evse
    const evse: OCPIEvse = {
      // Force the connector id to always be 1 on charging station that have mutually exclusive connectors
      uid: OCPIUtils.buildEvseUID(chargingStation, { connectorId: 1, status: connectorsAggregatedStatus }),
      evse_id: RoamingUtils.buildEvseID(options.countryID, options.partyID, chargingStation, { connectorId: 1, status: connectorsAggregatedStatus }),
      status: OCPIUtilsService.convertStatus2OCPIStatus(connectorsAggregatedStatus),
      capabilities: [OCPICapability.REMOTE_START_STOP_CAPABLE, OCPICapability.RFID_READER],
      connectors: ocpiConnectors,
      last_updated: chargingStation.lastSeen,
      coordinates: {
        latitude: chargingStation.coordinates[1] ? chargingStation.coordinates[1].toString() : null,
        longitude: chargingStation.coordinates[0] ? chargingStation.coordinates[0].toString() : null
      }
    };
    // Check addChargeBoxID flag
    if (options?.addChargeBoxID) {
      evse.chargeBoxId = chargingStation.id;
    }
    return [evse];
  }

  /**
   * As the status is located at EVSE object, it is necessary to aggregate status from the list
   * of connectors
   * The logic may need to be reviewed based on the list of handled status per connector
   *
   * @param {*} connectors
   */
  private static aggregateConnectorsStatus(connectors: Connector[]): ChargePointStatus {
    // Build array with charging station ordered by priority
    const statusesOrdered: ChargePointStatus[] = [ChargePointStatus.AVAILABLE, ChargePointStatus.OCCUPIED, ChargePointStatus.CHARGING, ChargePointStatus.FAULTED];
    let aggregatedConnectorStatusIndex = 0;
    // Loop through connector
    for (const connector of connectors) {
      if (statusesOrdered.indexOf(connector.status) > aggregatedConnectorStatusIndex) {
        aggregatedConnectorStatusIndex = statusesOrdered.indexOf(connector.status);
      }
    }
    // Return value
    return statusesOrdered[aggregatedConnectorStatusIndex];
  }

  // FIXME: We should probably only have charging station output characteristics everywhere
  private static getChargingStationOCPIVoltage(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorId: number): number {
    switch (Utils.getChargingStationCurrentType(chargingStation, chargePoint, connectorId)) {
      case CurrentType.AC:
        return Utils.getChargingStationVoltage(chargingStation, chargePoint, connectorId);
      case CurrentType.DC:
        return 400;
      default:
        return null;
    }
  }

  private static getChargingStationOCPIAmperage(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorId: number): number {
    switch (Utils.getChargingStationCurrentType(chargingStation, chargePoint, connectorId)) {
      case CurrentType.AC:
        return Utils.getChargingStationAmperagePerPhase(chargingStation, chargePoint, connectorId);
      case CurrentType.DC:
        return Math.round(Utils.getChargingStationPower(chargingStation, chargePoint, connectorId) / OCPIUtilsService.getChargingStationOCPIVoltage(chargingStation, chargePoint, connectorId));
      default:
        return null;
    }
  }

  private static getChargingStationOCPINumberOfConnectedPhases(chargingStation: ChargingStation, chargePoint: ChargePoint, connectorId: number): number {
    switch (Utils.getChargingStationCurrentType(chargingStation, chargePoint, connectorId)) {
      case CurrentType.AC:
        return Utils.getNumberOfConnectedPhases(chargingStation, chargePoint, connectorId);
      case CurrentType.DC:
        return 0;
      default:
        return null;
    }
  }

  private static convertConnector2OCPIConnector(tenant: Tenant, chargingStation: ChargingStation, connector: Connector, countryId: string, partyId: string): OCPIConnector {
    let type: OCPIConnectorType, format: OCPIConnectorFormat;
    switch (connector.type) {
      case ConnectorType.CHADEMO:
        type = OCPIConnectorType.CHADEMO;
        format = OCPIConnectorFormat.CABLE;
        break;
      case ConnectorType.TYPE_2:
        type = OCPIConnectorType.IEC_62196_T2;
        format = OCPIConnectorFormat.SOCKET;
        break;
      case ConnectorType.COMBO_CCS:
        type = OCPIConnectorType.IEC_62196_T2_COMBO;
        format = OCPIConnectorFormat.CABLE;
        break;
    }
    const chargePoint = Utils.getChargePointFromID(chargingStation, connector?.chargePointID);
    const voltage = OCPIUtilsService.getChargingStationOCPIVoltage(chargingStation, chargePoint, connector.connectorId);
    const amperage = OCPIUtilsService.getChargingStationOCPIAmperage(chargingStation, chargePoint, connector.connectorId);
    const ocpiNumberOfConnectedPhases = OCPIUtilsService.getChargingStationOCPINumberOfConnectedPhases(chargingStation, chargePoint, connector.connectorId);
    return {
      id: RoamingUtils.buildEvseID(countryId, partyId, chargingStation, connector),
      standard: type,
      format: format,
      voltage: voltage,
      amperage: amperage,
      power_type: OCPIUtilsService.convertOCPINumberOfConnectedPhases2PowerType(ocpiNumberOfConnectedPhases),
      tariff_id: OCPIUtilsService.buildTariffID(tenant, chargingStation),
      last_updated: chargingStation.lastSeen
    };
  }

  // TODO: Implement the tariff module under dev in Gireve, to provide in UI later on
  // FIXME: add tariff id from the simple pricing settings remapping
  private static buildTariffID(tenant: Tenant, chargingStation: ChargingStation): string {
    switch (tenant?.id) {
      // SLF
      case '5be7fb271014d90008992f06':
        // Check Site Area
        // FIXME: siteAreaID must always be an attribute non null
        switch (chargingStation?.siteAreaID) {
          // Mougins - South
          case '5abebb1b4bae1457eb565e98':
            return 'FR*SLF_AC_Sud2';
          // Mougins - South - Fastcharging
          case '5b72cef274ae30000855e458':
            return 'FR*SLF_DC_Sud';
        }
        return '';
      // Proviridis
      case '5e2701b248aaa90007904cca':
        return '1';
    }
    return '';
  }

  /**
   * Convert internal Power (1/3 Phase) to PowerType
   *
   * @param {*} power
   * @param ocpiNumberOfConnectedPhases
   */
  private static convertOCPINumberOfConnectedPhases2PowerType(ocpiNumberOfConnectedPhases: number): OCPIPowerType {
    switch (ocpiNumberOfConnectedPhases) {
      case 0:
        return OCPIPowerType.DC;
      case 1:
        return OCPIPowerType.AC_1_PHASE;
      case 3:
        return OCPIPowerType.AC_3_PHASE;
    }
  }

  private static buildChargingPeriod(consumption: Consumption): OCPIChargingPeriod {
    const chargingPeriod: OCPIChargingPeriod = {
      start_date_time: consumption.endedAt,
      dimensions: []
    };
    if (consumption.consumptionWh > 0) {
      chargingPeriod.dimensions.push({
        type: CdrDimensionType.ENERGY,
        volume: consumption.consumptionWh / 1000
      });
    } else {
      const duration: number = moment(consumption.endedAt).diff(consumption.startedAt, 'hours', true);
      if (duration > 0) {
        chargingPeriod.dimensions.push({
          type: CdrDimensionType.PARKING_TIME,
          volume: Utils.truncTo(duration, 3)
        });
      }
    }
    return chargingPeriod;
  }

  private static convertPricingSettings2ZeroFlatTariff(pricingSettings: PricingSettings): OCPITariff {
    let tariff: OCPITariff;
    tariff.id = '1';
    tariff.elements[0].price_components[0].price = 0;
    tariff.elements[0].price_components[0].type = OCPITariffDimensionType.FLAT;
    tariff.elements[0].price_components[0].step_size = 0;
    switch (pricingSettings.type) {
      case PricingSettingsType.SIMPLE:
        tariff.currency = pricingSettings.simple.currency;
        tariff.last_updated = pricingSettings.simple.last_updated;
        break;
      default:
        // FIXME: get currency from the TZ
        tariff.currency = 'EUR';
        tariff.last_updated = new Date();
        break;
    }
    return tariff;
  }

  /**
   * Get OCPI Location from its id (Site ID)
   *
   * @param {*} tenant
   * @param {*} locationId
   * @param options
   * @param options.countryID
   * @param options.partyID
   * @param options.addChargeBoxID
   */
  static async getLocation(tenant: Tenant, locationId: string, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPILocation> {
    // Get site
    const site = await SiteStorage.getSite(tenant.id, locationId);
    if (!site) {
      return null;
    }
    // Convert
    return await OCPIUtilsService.convertSite2Location(tenant, site, options);
  }

  /**
   * Get OCPI EVSE from its location id/evse_id
   *
   * @param {*} tenant
   * @param {*} locationId
   * @param {*} evseUid
   * @param options
   * @param options.countryID
   * @param options.partyID
   * @param options.addChargeBoxID
   */
  static async getEvse(tenant: Tenant, locationId: string, evseUid: string, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPIEvse> {
    // Get site
    const site = await SiteStorage.getSite(tenant.id, locationId);
    if (!site) {
      return null;
    }
    // Convert to location
    const location = await OCPIUtilsService.convertSite2Location(tenant, site, options);
    // Loop through EVSE
    if (location) {
      for (const evse of location.evses) {
        if (evse.uid === evseUid) {
          return evse;
        }
      }
    }
  }

  /**
   * Get OCPI Connector from its location_id/evse_uid/connector id
   *
   * @param {*} tenant
   * @param {*} locationId
   * @param {*} evseUid
   * @param {*} connectorId
   * @param options
   * @param options.countryID
   * @param options.partyID
   * @param options.addChargeBoxID
   */
  static async getConnector(tenant: Tenant, locationId: string, evseUid: string, connectorId: string, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }): Promise<OCPIConnector> {
    // Get site
    const evse = await this.getEvse(tenant, locationId, evseUid, options);
    // Loop through Connector
    if (evse) {
      for (const connector of evse.connectors) {
        if (connector.id === connectorId) {
          return connector;
        }
      }
    }
  }

  public static async updateTransaction(tenantId: string, session: OCPISession): Promise<void> {
    if (!OCPIUtilsService.validateSession(session)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateTransaction',
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Session object is invalid',
        detailedMessages: { session },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (!session.total_cost) {
      session.total_cost = 0;
    }
    if (!session.kwh) {
      session.kwh = 0;
    }
    let transaction: Transaction = await TransactionStorage.getOCPITransaction(tenantId, session.id);
    if (!transaction) {
      const user = await UserStorage.getUser(tenantId, session.auth_id);
      if (!user) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'updateTransaction',
          errorCode: HTTPError.GENERAL_ERROR,
          message: `No User found for auth_id ${session.auth_id}`,
          detailedMessages: { session },
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      const evse = session.location.evses[0];
      const chargingStationId = OCPIUtils.buildChargingStationId(session.location.id, evse.uid);
      const chargingStation = await ChargingStationStorage.getChargingStationBySerialNumber(tenantId, chargingStationId);
      if (!chargingStation) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'updateTransaction',
          errorCode: HTTPError.GENERAL_ERROR,
          message: `No Charging Station found for ID '${evse.uid}'`,
          detailedMessages: { session },
          ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR
        });
      }
      if (chargingStation.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'updateTransaction',
          errorCode: HTTPError.GENERAL_ERROR,
          message: `OCPI Transaction is not authorized on charging station ${evse.uid} issued locally`,
          detailedMessages: { session },
          ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR
        });
      }
      let connectorId = 1;
      if (evse.connectors && evse.connectors.length === 1) {
        const evseConnectorId = evse.connectors[0].id;
        for (const connector of chargingStation.connectors) {
          if (evseConnectorId === connector.id) {
            connectorId = connector.connectorId;
          }
        }
      }
      transaction = {
        issuer: false,
        userID: user.id,
        tagID: session.auth_id,
        timestamp: session.start_datetime,
        chargeBoxID: chargingStation.id,
        timezone: Utils.getTimezone(chargingStation.coordinates),
        connectorId: connectorId,
        meterStart: 0,
        stateOfCharge: 0,
        currentStateOfCharge: 0,
        currentTotalInactivitySecs: 0,
        pricingSource: 'ocpi',
        currentInactivityStatus: InactivityStatus.INFO,
        currentInstantWatts: 0,
        currentConsumptionWh: 0,
        lastConsumption: {
          value: 0,
          timestamp: session.start_datetime
        },
        signedData: '',
      } as Transaction;
    }
    if (!transaction.lastConsumption) {
      transaction.lastConsumption = {
        value: transaction.meterStart,
        timestamp: transaction.timestamp
      };
    }
    if (moment(session.last_updated).isBefore(transaction.lastConsumption.timestamp)) {
      Logging.logDebug({
        tenantID: tenantId,
        action: ServerAction.OCPI_PUSH_SESSION,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateTransaction',
        message: `Ignore session update session.last_updated < transaction.currentTimestamp for transaction ${transaction.id}`,
        detailedMessages: { session }
      });
      return;
    }
    if (session.kwh > 0) {
      await OCPIUtilsService.computeConsumption(tenantId, transaction, session);
    }
    if (!transaction.ocpiData) {
      transaction.ocpiData = {};
    }
    transaction.ocpiData.session = session;
    transaction.currentTimestamp = session.last_updated;
    transaction.price = session.total_cost;
    transaction.priceUnit = session.currency;
    transaction.roundedPrice = Utils.truncTo(session.total_cost, 2);
    transaction.lastConsumption = {
      value: session.kwh * 1000,
      timestamp: session.last_updated
    };
    if (session.end_datetime || session.status === OCPISessionStatus.COMPLETED) {
      const stopTimestamp = session.end_datetime ? session.end_datetime : new Date();
      transaction.stop = {
        extraInactivityComputed: false,
        extraInactivitySecs: 0,
        meterStop: session.kwh * 1000,
        price: session.total_cost,
        priceUnit: session.currency,
        pricingSource: 'ocpi',
        roundedPrice: Utils.truncTo(session.total_cost, 2),
        stateOfCharge: 0,
        tagID: session.auth_id,
        timestamp: stopTimestamp,
        totalConsumptionWh: session.kwh * 1000,
        totalDurationSecs: Math.round(moment.duration(moment(stopTimestamp).diff(moment(transaction.timestamp))).asSeconds()),
        totalInactivitySecs: transaction.currentTotalInactivitySecs,
        inactivityStatus: transaction.currentInactivityStatus,
        userID: transaction.userID
      };
    }
    await TransactionStorage.saveTransaction(tenantId, transaction);
    await this.updateConnector(tenantId, transaction);
  }

  public static async processCdr(tenantId: string, cdr: OCPICdr): Promise<void> {
    if (!OCPIUtilsService.validateCdr(cdr)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'processCdr',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Cdr object is invalid',
        detailedMessages: { cdr },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const transaction: Transaction = await TransactionStorage.getOCPITransaction(tenantId, cdr.id);
    if (!transaction) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'processCdr',
        errorCode: HTTPError.GENERAL_ERROR,
        message: `No Transaction found for OCPI CDR ID '${cdr.id}'`,
        detailedMessages: { cdr },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (!cdr.total_cost) {
      cdr.total_cost = 0;
    }
    if (!cdr.total_energy) {
      cdr.total_energy = 0;
    }
    if (!cdr.total_time) {
      cdr.total_time = 0;
    }
    if (!cdr.total_parking_time) {
      cdr.total_parking_time = 0;
    }
    transaction.priceUnit = cdr.currency;
    transaction.price = cdr.total_cost;
    transaction.roundedPrice = Utils.truncTo(cdr.total_cost, 2);
    transaction.currentTimestamp = cdr.last_updated;
    transaction.stop = {
      extraInactivityComputed: false,
      extraInactivitySecs: 0,
      meterStop: cdr.total_energy * 1000,
      price: cdr.total_cost,
      priceUnit: cdr.currency,
      pricingSource: 'ocpi',
      roundedPrice: Utils.truncTo(cdr.total_cost, 2),
      stateOfCharge: 0,
      tagID: cdr.auth_id,
      timestamp: cdr.stop_date_time,
      totalConsumptionWh: cdr.total_energy * 1000,
      totalDurationSecs: cdr.total_time * 3600,
      totalInactivitySecs: cdr.total_parking_time * 3600,
      inactivityStatus: transaction.currentInactivityStatus,
      userID: transaction.userID
    };
    if (!transaction.ocpiData) {
      transaction.ocpiData = {};
    }
    transaction.ocpiData.cdr = cdr;
    await TransactionStorage.saveTransaction(tenantId, transaction);
    await this.updateConnector(tenantId, transaction);
  }

  public static async updateConnector(tenantId: string, transaction: Transaction): Promise<void> {
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantId, transaction.chargeBoxID);
    if (chargingStation && chargingStation.connectors) {
      for (const connector of chargingStation.connectors) {
        if (connector.connectorId === transaction.connectorId && connector.currentTransactionID === 0 || connector.currentTransactionID === transaction.id) {
          if (!transaction.stop) {
            connector.status = transaction.status;
            connector.currentTransactionID = transaction.id;
            connector.currentInactivityStatus = transaction.currentInactivityStatus;
            connector.currentTagID = transaction.tagID;
            connector.currentStateOfCharge = transaction.currentStateOfCharge;
            connector.currentInstantWatts = transaction.currentInstantWatts;
            connector.currentTotalConsumptionWh = transaction.currentTotalConsumptionWh;
            connector.currentTransactionDate = transaction.currentTimestamp;
            connector.currentTotalInactivitySecs = transaction.currentTotalInactivitySecs;
          } else {
            connector.status = ChargePointStatus.AVAILABLE;
            connector.currentTransactionID = 0;
            connector.currentTransactionDate = null;
            connector.currentTagID = null;
            connector.currentTotalConsumptionWh = 0;
            connector.currentStateOfCharge = 0;
            connector.currentTotalInactivitySecs = 0;
            connector.currentInstantWatts = 0;
            connector.currentInactivityStatus = null;
          }
          await ChargingStationStorage.saveChargingStation(tenantId, chargingStation);
        }
      }
    }
  }

  private static async computeConsumption(tenantId: string, transaction: Transaction, session: OCPISession): Promise<void> {
    const consumptionWh = Utils.createDecimal(session.kwh).mul(1000).minus(Utils.convertToFloat(transaction.lastConsumption.value)).toNumber();
    const duration = Utils.createDecimal(moment(session.last_updated).diff(transaction.lastConsumption.timestamp, 'milliseconds')).div(1000).toNumber();
    if (consumptionWh > 0 || duration > 0) {
      const sampleMultiplier = duration > 0 ? Utils.createDecimal(3600).div(duration).toNumber() : 0;
      const currentInstantWatts = consumptionWh > 0 ? Utils.createDecimal(consumptionWh).mul(sampleMultiplier).toNumber() : 0;
      const amount = Utils.createDecimal(session.total_cost).minus(transaction.price).toNumber();
      transaction.currentInstantWatts = currentInstantWatts;
      transaction.currentConsumptionWh = consumptionWh > 0 ? consumptionWh : 0;
      transaction.currentTotalConsumptionWh = Utils.createDecimal(transaction.currentTotalConsumptionWh).plus(transaction.currentConsumptionWh).toNumber();
      if (consumptionWh <= 0) {
        transaction.currentTotalInactivitySecs = Utils.createDecimal(transaction.currentTotalInactivitySecs).plus(duration).toNumber();
        transaction.currentInactivityStatus = Utils.getInactivityStatusLevel(
          transaction.chargeBox, transaction.connectorId, transaction.currentTotalInactivitySecs);
      }
      const consumption: Consumption = {
        transactionId: transaction.id,
        connectorId: transaction.connectorId,
        chargeBoxID: transaction.chargeBoxID,
        userID: transaction.userID,
        startedAt: new Date(transaction.lastConsumption.timestamp),
        endedAt: new Date(session.last_updated),
        consumptionWh: transaction.currentConsumptionWh,
        instantWatts: Math.floor(transaction.currentInstantWatts),
        instantAmps: Math.floor(transaction.currentInstantWatts / 230),
        cumulatedConsumptionWh: transaction.currentTotalConsumptionWh,
        cumulatedConsumptionAmps: Math.floor(transaction.currentTotalConsumptionWh / 230),
        totalInactivitySecs: transaction.currentTotalInactivitySecs,
        totalDurationSecs: transaction.stop ?
          moment.duration(moment(transaction.stop.timestamp).diff(moment(transaction.timestamp))).asSeconds() :
          moment.duration(moment(transaction.lastConsumption.timestamp).diff(moment(transaction.timestamp))).asSeconds(),
        stateOfCharge: transaction.currentStateOfCharge,
        amount: amount,
        currencyCode: session.currency,
        cumulatedAmount: session.total_cost
      } as Consumption;
      await ConsumptionStorage.saveConsumption(tenantId, consumption);
    }
  }

  private static validateSession(session: OCPISession): boolean {
    if (!session.id
      || !session.start_datetime
      || !session.auth_id
      || !session.auth_method
      || !session.location
      || !session.currency
      || !session.status
      || !session.last_updated
    ) {
      return false;
    }
    return OCPIUtilsService.validateLocation(session.location);
  }

  private static validateCdr(cdr: OCPICdr): boolean {
    if (!cdr.id
      || !cdr.start_date_time
      || !cdr.stop_date_time
      || !cdr.auth_id
      || !cdr.auth_method
      || !cdr.location
      || !cdr.currency
      || !cdr.charging_periods
      || !cdr.last_updated
    ) {
      return false;
    }
    return OCPIUtilsService.validateLocation(cdr.location);
  }

  private static validateLocation(location: OCPILocation): boolean {
    if (!location.evses || location.evses.length !== 1 || !location.evses[0].uid) {
      return false;
    }
    return true;
  }

  public static async updateToken(tenantId: string, ocpiEndpoint: OCPIEndpoint, token: OCPIToken, tag: Tag, emspUser: User): Promise<void> {
    if (!OCPIUtilsService.validateToken(token)) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateToken',
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Token object is invalid',
        detailedMessages: { token },
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (emspUser) {
      // Existing User: Check local organization
      if (emspUser.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'updateToken',
          errorCode: StatusCodes.CONFLICT,
          message: 'Token already assigned to an internal user',
          actionOnUser: emspUser,
          detailedMessages: { token },
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      // Check the tag
      if (tag && tag.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'checkExistingTag',
          errorCode: StatusCodes.CONFLICT,
          message: 'Token already exists in the current organization',
          detailedMessages: token,
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      const tagToSave = {
        id: token.uid,
        issuer: false,
        userID: emspUser.id,
        active: token.valid === true ? true : false,
        description: token.visual_number,
        lastChangedOn: token.last_updated,
        ocpiToken: token
      };
      // Save Tag
      if (!tag || JSON.stringify(tagToSave.ocpiToken) !== JSON.stringify(tag.ocpiToken)) {
        await TagStorage.saveTag(tenantId, tagToSave);
      }
    } else {
      // Unknown User
      // Check the Tag
      if (tag && tag.issuer) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'checkExistingTag',
          errorCode: StatusCodes.CONFLICT,
          message: 'Token already exists in the current organization',
          detailedMessages: token,
          ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
        });
      }
      // Create User
      emspUser = {
        issuer: false,
        createdOn: token.last_updated,
        lastChangedOn: token.last_updated,
        name: token.issuer,
        firstName: OCPIUtils.buildOperatorName(ocpiEndpoint.countryCode, ocpiEndpoint.partyId),
        email: OCPIUtils.buildEmspEmailFromOCPIToken(token, ocpiEndpoint.countryCode, ocpiEndpoint.partyId),
        locale: Utils.getLocaleFromLanguage(token.language),
      } as User;
      // Save User
      emspUser.id = await UserStorage.saveUser(tenantId, emspUser);
      await UserStorage.saveUserRole(tenantId, emspUser.id, UserRole.BASIC);
      await UserStorage.saveUserStatus(tenantId, emspUser.id, UserStatus.ACTIVE);
      const tagToSave = {
        id: token.uid,
        issuer: false,
        userID: emspUser.id,
        active: token.valid === true ? true : false,
        description: token.visual_number,
        lastChangedOn: token.last_updated,
        ocpiToken: token
      };
      // Save Tag
      if (!tag || JSON.stringify(tagToSave.ocpiToken) !== JSON.stringify(tag.ocpiToken)) {
        await TagStorage.saveTag(tenantId, tagToSave);
      }
    }
  }

  public static validateToken(token: OCPIToken): boolean {
    if (!token.uid ||
        !token.auth_id ||
        !token.type ||
        !token.issuer ||
        !token.whitelist ||
        !token.last_updated) {
      return false;
    }
    return true;
  }
}
