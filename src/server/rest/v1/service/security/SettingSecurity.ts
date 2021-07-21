import { AnalyticsSettingsType, AssetConnectionSetting, AssetConnectionType, AssetSettingsType, BillingSettingsType, CarConnectorConnectionSetting, CarConnectorConnectionType, CarConnectorSettingsType, ConcurRefundSetting, CryptoSettingsType, OcpiBusinessDetails, OcpiSetting, OicpBusinessDetails, OicpSetting, PricingSettingsType, RefundSettingsType, RoamingSettingsType, SettingDB, SettingDBContent, SettingLink, SimplePricingSetting, SmartChargingSettingsType, UserSettingsType } from '../../../../../types/Setting';
import { HttpSettingRequest, HttpSettingsRequest } from '../../../../../types/requests/v1/HttpSettingRequest';

import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class SettingSecurity {

  public static filterSettingRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterSettingRequest(request: any): HttpSettingRequest {
    return {
      ID: sanitize(request.ID),
      ContentFilter: UtilsSecurity.filterBoolean(request.ContentFilter)
    };
  }

  public static filterSettingsRequest(request: any): HttpSettingsRequest {
    const filteredRequest: HttpSettingsRequest = {} as HttpSettingsRequest;
    filteredRequest.Identifier = sanitize(request.Identifier);
    filteredRequest.ContentFilter = UtilsSecurity.filterBoolean(request.ContentFilter);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSettingUpdateRequest(request: any): Partial<SettingDB> {
    const filteredRequest = SettingSecurity._filterSettingRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterSettingCreateRequest(request: any): Partial<SettingDB> {
    return SettingSecurity._filterSettingRequest(request);
  }

  public static filterBillingSettingUpdateRequest(request: any): Partial<SettingDB> {
    const filteredRequest = SettingSecurity._filterSettingRequest(request.body);
    filteredRequest.id = sanitize(request.params.id);
    return filteredRequest;
  }

  private static _filterSettingRequest(request: Partial<SettingDB>): Partial<SettingDB> {
    const settings: SettingDB = {
      identifier: sanitize(request.identifier),
      sensitiveData: request.sensitiveData ? request.sensitiveData.map(sanitize) : []
    } as SettingDB;
    // Check Content
    if (Utils.objectHasProperty(request, 'content')) {
      settings.content = {
        type: request.content.type
      } as SettingDBContent;
      // Check Links
      if (Utils.objectHasProperty(request.content, 'links')) {
        settings.content.links = request.content.links.map((link: SettingLink) => ({
          id: link.id,
          name: link.name,
          description: link.description,
          role: link.role,
          url: link.url
        }));
      }
      // Handle different config types
      switch (request.content.type) {
        case AnalyticsSettingsType.SAC:
          settings.content.sac = {
            mainUrl: sanitize(request.content.sac.mainUrl),
            timezone: sanitize(request.content.sac.timezone)
          };
          break;
        case RoamingSettingsType.OCPI:
          settings.content.ocpi = {} as OcpiSetting;
          if (Utils.objectHasProperty(request.content.ocpi, 'businessDetails')) {
            settings.content.ocpi.businessDetails = {
              name: sanitize(request.content.ocpi.businessDetails.name),
              website: sanitize(request.content.ocpi.businessDetails.website)
            } as OcpiBusinessDetails;
            if (Utils.objectHasProperty(request.content.ocpi.businessDetails, 'logo')) {
              settings.content.ocpi.businessDetails.logo = {
                url: sanitize(request.content.ocpi.businessDetails.logo.url),
                thumbnail: sanitize(request.content.ocpi.businessDetails.logo.thumbnail),
                category: sanitize(request.content.ocpi.businessDetails.logo.category),
                type: sanitize(request.content.ocpi.businessDetails.logo.type),
                width: sanitize(request.content.ocpi.businessDetails.logo.width),
                height: sanitize(request.content.ocpi.businessDetails.logo.height),
              };
            }
          }
          if (Utils.objectHasProperty(request.content.ocpi, 'cpo')) {
            settings.content.ocpi.cpo = {
              countryCode: sanitize(request.content.ocpi.cpo.countryCode),
              partyID: sanitize(request.content.ocpi.cpo.partyID)
            };
          }
          if (Utils.objectHasProperty(request.content.ocpi, 'emsp')) {
            settings.content.ocpi.emsp = {
              countryCode: sanitize(request.content.ocpi.emsp.countryCode),
              partyID: sanitize(request.content.ocpi.emsp.partyID)
            };
          }
          if (Utils.objectHasProperty(request.content.ocpi, 'currency')) {
            settings.content.ocpi.currency = request.content.ocpi.currency;
          }
          break;
        case RoamingSettingsType.OICP:
          settings.content.oicp = {} as OicpSetting;
          if (request.content.oicp.businessDetails) {
            settings.content.oicp.businessDetails = {
              name: sanitize(request.content.oicp.businessDetails.name),
              website: sanitize(request.content.oicp.businessDetails.website)
            } as OicpBusinessDetails;
            if (request.content.oicp.businessDetails.logo) {
              settings.content.oicp.businessDetails.logo = {
                url: sanitize(request.content.oicp.businessDetails.logo.url),
                thumbnail: sanitize(request.content.oicp.businessDetails.logo.thumbnail),
                category: sanitize(request.content.oicp.businessDetails.logo.category),
                type: sanitize(request.content.oicp.businessDetails.logo.type),
                width: sanitize(request.content.oicp.businessDetails.logo.width),
                height: sanitize(request.content.oicp.businessDetails.logo.height),
              };
            }
          }
          if (request.content.oicp.cpo) {
            settings.content.oicp.cpo = {
              countryCode: sanitize(request.content.oicp.cpo.countryCode),
              partyID: sanitize(request.content.oicp.cpo.partyID),
              key: sanitize(request.content.oicp.cpo.key),
              cert:sanitize(request.content.oicp.cpo.cert)
            };
          }
          if (request.content.oicp.emsp) {
            settings.content.oicp.emsp = {
              countryCode: sanitize(request.content.oicp.emsp.countryCode),
              partyID: sanitize(request.content.oicp.emsp.partyID),
              key: sanitize(request.content.oicp.emsp.key),
              cert:sanitize(request.content.oicp.emsp.cert)
            };
          }
          if (request.content.oicp.currency) {
            settings.content.oicp.currency = request.content.oicp.currency;
          }
          break;
        case RefundSettingsType.CONCUR:
          if (!Utils.isEmptyJSon(request.content.concur)) {
            settings.content.concur = {
              authenticationUrl: sanitize(request.content.concur.authenticationUrl),
              apiUrl: sanitize(request.content.concur.apiUrl),
              appUrl: sanitize(request.content.concur.appUrl),
              clientId: sanitize(request.content.concur.clientId),
              clientSecret: sanitize(request.content.concur.clientSecret),
              paymentTypeId: sanitize(request.content.concur.paymentTypeId),
              expenseTypeCode: sanitize(request.content.concur.expenseTypeCode),
              policyId: sanitize(request.content.concur.policyId),
              reportName: sanitize(request.content.concur.reportName),
            };
          } else {
            settings.content.concur = { } as ConcurRefundSetting;
          }
          break;
        case PricingSettingsType.CONVERGENT_CHARGING:
          settings.content.convergentCharging = {
            url: sanitize(request.content.convergentCharging.url),
            chargeableItemName: sanitize(request.content.convergentCharging.chargeableItemName),
            user: sanitize(request.content.convergentCharging.user),
            password: sanitize(request.content.convergentCharging.password),
          };
          break;
        case PricingSettingsType.SIMPLE:
          if (!Utils.isEmptyJSon(request.content.simple)) {
            settings.content.simple = {
              price: sanitize(request.content.simple.price),
              currency: sanitize(request.content.simple.currency),
            };
          } else {
            settings.content.simple = { } as SimplePricingSetting;
          }
          break;
        case BillingSettingsType.STRIPE:
          settings.content.billing = {
            isTransactionBillingActivated : sanitize(request.content.billing.isTransactionBillingActivated),
            immediateBillingAllowed: sanitize(request.content.billing.immediateBillingAllowed),
            periodicBillingAllowed: sanitize(request.content.billing.periodicBillingAllowed),
            taxID: sanitize(request.content.billing.taxID)
          };
          settings.content.stripe = {
            url: sanitize(request.content.stripe.url),
            secretKey: sanitize(request.content.stripe.secretKey),
            publicKey: sanitize(request.content.stripe.publicKey),
          };
          break;
        case SmartChargingSettingsType.SAP_SMART_CHARGING:
          settings.content.sapSmartCharging = {
            optimizerUrl: sanitize(request.content.sapSmartCharging.optimizerUrl),
            user: sanitize(request.content.sapSmartCharging.user),
            password: sanitize(request.content.sapSmartCharging.password),
            stickyLimitation: UtilsSecurity.filterBoolean(request.content.sapSmartCharging.stickyLimitation),
            limitBufferDC: sanitize(request.content.sapSmartCharging.limitBufferDC),
            limitBufferAC: sanitize(request.content.sapSmartCharging.limitBufferAC),
          };
          break;
        case AssetSettingsType.ASSET:
          settings.content.asset = {
            connections: [],
          };
          for (const connection of request.content.asset.connections) {
            const sanitizedConnection: AssetConnectionSetting = {
              id: sanitize(connection.id),
              name: sanitize(connection.name),
              description: sanitize(connection.description),
              url: sanitize(connection.url),
              type: sanitize(connection.type),
              refreshIntervalMins: sanitize(connection.refreshIntervalMins),
              timestamp: new Date(),
            };
            // Check type
            switch (connection.type) {
              case AssetConnectionType.SCHNEIDER:
                sanitizedConnection.schneiderConnection = {
                  user: sanitize(connection.schneiderConnection.user),
                  password: sanitize(connection.schneiderConnection.password),
                };
                break;
              case AssetConnectionType.GREENCOM:
                sanitizedConnection.greencomConnection = {
                  clientId: sanitize(connection.greencomConnection.clientId),
                  clientSecret: sanitize(connection.greencomConnection.clientSecret),
                };
                break;
              case AssetConnectionType.IOTHINK:
                sanitizedConnection.iothinkConnection = {
                  user: sanitize(connection.iothinkConnection.user),
                  password: sanitize(connection.iothinkConnection.password),
                };
                break;
              case AssetConnectionType.WIT:
                sanitizedConnection.witConnection = {
                  authenticationUrl: sanitize(connection.witConnection.authenticationUrl),
                  clientId: sanitize(connection.witConnection.clientId),
                  clientSecret: sanitize(connection.witConnection.clientSecret),
                  user: sanitize(connection.witConnection.user),
                  password: sanitize(connection.witConnection.password),
                };
                break;
            }
            settings.content.asset.connections.push(sanitizedConnection);
          }
          break;
        case CarConnectorSettingsType.CAR_CONNECTOR:
          settings.content.carConnector = {
            connections: [],
          };
          for (const connection of request.content.carConnector.connections) {
            const sanitizedConnection: CarConnectorConnectionSetting = {
              id: sanitize(connection.id),
              name: sanitize(connection.name),
              description: sanitize(connection.description),
              type: sanitize(connection.type),
              timestamp: new Date(),
            };
            // Check type
            switch (connection.type) {
              case CarConnectorConnectionType.MERCEDES:
                sanitizedConnection.mercedesConnection = {
                  authenticationUrl: sanitize(connection.mercedesConnection.authenticationUrl),
                  apiUrl: sanitize(connection.mercedesConnection.apiUrl),
                  clientId: sanitize(connection.mercedesConnection.clientId),
                  clientSecret: sanitize(connection.mercedesConnection.clientSecret),
                };
                break;
            }
            settings.content.carConnector.connections.push(sanitizedConnection);
          }
          break;
        case CryptoSettingsType.CRYPTO:
          settings.content.crypto = {
            key: sanitize(request.content.crypto.key),
            keyProperties: {
              blockCypher: sanitize(request.content.crypto.keyProperties?.blockCypher),
              blockSize: Utils.convertToInt(sanitize(request.content.crypto.keyProperties?.blockSize)),
              operationMode: sanitize(request.content.crypto.keyProperties?.operationMode)
            },
            formerKey: sanitize(request.content.crypto.formerKey),
            formerKeyProperties: {
              blockCypher: sanitize(request.content.crypto.formerKeyProperties?.blockCypher),
              blockSize: Utils.convertToInt(sanitize(request.content.crypto.keyProperties?.blockSize)),
              operationMode: sanitize(request.content.crypto.formerKeyProperties?.operationMode)
            }
          };
          break;
        case UserSettingsType.USER:
          settings.content.user = {
            autoActivateAccountAfterValidation: UtilsSecurity.filterBoolean(request.content.user.autoActivateAccountAfterValidation)
          };
          break;
      }
    }
    return settings;
  }
}
