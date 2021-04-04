import ChargingStation, { Connector, RemoteAuthorization } from '../../types/ChargingStation';
import { OICPDefaultTagId, OICPIdentification, OICPSessionID } from '../../types/oicp/OICPIdentification';
import User, { UserStatus } from '../../types/User';

import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import { OICPAcknowledgment } from '../../types/oicp/OICPAcknowledgment';
import { OICPEvseID } from '../../types/oicp/OICPEvse';
import { OICPSession } from '../../types/oicp/OICPSession';
import { OICPStatusCode } from '../../types/oicp/OICPStatusCode';
import { OicpSetting } from '../../types/Setting';
import RoamingUtils from '../../utils/RoamingUtils';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import Transaction from '../../types/Transaction';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';
import moment from 'moment';
import sanitize from 'mongo-sanitize';

export default class OICPUtils {

  /**
   * Return OICP Success Body Response
   *
   * @param {Partial<OICPSession>} session
   * @param {*} data
   */
  public static success(session: Partial<OICPSession>, data?: any): OICPAcknowledgment {
    return {
      Result: true,
      StatusCode: {
        Code: OICPStatusCode.Code000
      },
      EMPPartnerSessionID: session.empPartnerSessionID,
      SessionID: session.id
    };
  }

  /**
   * Return OICP no success Body Response
   *
   * @param {Partial<OICPSession>} session
   * @param {*} data
   */
  public static noSuccess(session: Partial<OICPSession>, data?: any): OICPAcknowledgment {
    return {
      Result: false,
      StatusCode: {
        Code: OICPStatusCode.Code022,
        Description: data
      },
      EMPPartnerSessionID: session.empPartnerSessionID,
      SessionID: session.id
    };
  }

  /**
   * Return OICP Error Body Response
   *
   * @param {Error} error
   */
  public static toErrorResponse(error: Error): OICPAcknowledgment {
    return {
      Result: false,
      StatusCode: {
        Code: OICPStatusCode.Code022,
        Description: error.message
      }
    };
  }

  public static async getChargingStationConnectorFromEvseID(tenant: Tenant, evseID: OICPEvseID): Promise<{ chargingStation: ChargingStation, connector: Connector }> {
    // It is not save to derive charging station id from evseID
    const evseIDComponents = RoamingUtils.getEvseIdComponents(evseID);
    // TODO: Perfs/Memory issue in Prod: that does not scale with 100k charging stations, use oicpData in charging station to find it
    const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {
      issuer: true
    }, Constants.DB_PARAMS_MAX_LIMIT);
    let chargingStation: ChargingStation;
    let connector: Connector;
    if (chargingStations && chargingStations.result) {
      for (const cs of chargingStations.result) {
        cs.connectors.forEach((conn) => {
          if (evseID === RoamingUtils.buildEvseID(evseIDComponents.countryCode, evseIDComponents.partyId, cs.id, conn.connectorId)) {
            chargingStation = cs;
            connector = conn;
          }
        });
        if (chargingStation && connector) {
          return {
            chargingStation: chargingStation,
            connector: connector
          };
        }
      }
    }
    return {
      chargingStation: chargingStation,
      connector: connector
    };
  }

  public static isAuthorizationValid(authorizationDate: Date): boolean {
    return authorizationDate && moment(authorizationDate).isAfter(moment().subtract(2, 'minutes'));
  }

  public static convertOICPIdentification2TagID(identification: OICPIdentification): string {
    let tagID: string;
    // No tag ID in case of remote Identification, QR Code Identification and Plug and Charge Identification
    if (identification.RFIDMifareFamilyIdentification) {
      tagID = identification.RFIDMifareFamilyIdentification.UID;
    } else if (identification.RFIDIdentification) {
      tagID = identification.RFIDIdentification.UID;
    } else if (identification.QRCodeIdentification) {
      tagID = OICPDefaultTagId.QRCodeIdentification;
    } else if (identification.PlugAndChargeIdentification) {
      tagID = OICPDefaultTagId.PlugAndChargeIdentification;
    } else if (identification.RemoteIdentification) {
      tagID = OICPDefaultTagId.RemoteIdentification;
    }
    return tagID;
  }

  public static convertTagID2OICPIdentification(tagID: string): OICPIdentification {
    // RFID Mifare Family as default for tag IDs because we get no information about the card type from the charging station over OCPP
    return {
      RFIDMifareFamilyIdentification: {
        UID: tagID
      }
    };
  }

  public static getOICPIdentificationFromRemoteAuthorization(tenantID: string, chargingStation: ChargingStation, connectorId: number, action?: ServerAction): { sessionId: OICPSessionID; identification: OICPIdentification; } {
    if (chargingStation.remoteAuthorizations && chargingStation.remoteAuthorizations.length > 0) {
      const existingAuthorization: RemoteAuthorization = chargingStation.remoteAuthorizations.find(
        (authorization) => authorization.connectorId === connectorId && authorization.oicpIdentification);
      if (existingAuthorization) {
        if (action === ServerAction.START_TRANSACTION) {
          if (OICPUtils.isAuthorizationValid(existingAuthorization.timestamp)) {
            return {
              sessionId: existingAuthorization.id,
              identification: existingAuthorization.oicpIdentification
            };
          }
        } else {
          return {
            sessionId: existingAuthorization.id,
            identification: existingAuthorization.oicpIdentification
          };
        }
      }
    }
  }

  public static async getOICPIdentificationFromAuthorization(tenantID: string,
      transaction: Transaction): Promise<{ sessionId: OICPSessionID; identification: OICPIdentification; }> {
    // Retrieve Session Id from Authorization ID
    let sessionId: OICPSessionID;
    const authorizations = await OCPPStorage.getAuthorizes(tenantID, {
      dateFrom: moment(transaction.timestamp).subtract(10, 'minutes').toDate(),
      chargeBoxID: transaction.chargeBoxID,
      tagID: transaction.tagID
    }, Constants.DB_PARAMS_MAX_LIMIT);
    // Found ID?
    if (!Utils.isEmptyArray(authorizations.result)) {
      // Get the first non used Authorization OICP ID / Session ID
      for (const authorization of authorizations.result) {
        if (authorization.authorizationId) {
          const oicpTransaction = await TransactionStorage.getOICPTransaction(tenantID, authorization.authorizationId);
          // OICP SessionID not used yet
          if (!oicpTransaction) {
            sessionId = authorization.authorizationId;
            break;
          }
        }
      }
      return {
        sessionId: sessionId,
        identification: OICPUtils.convertTagID2OICPIdentification(transaction.tagID)
      };
    }
    return null;
  }

  public static async createOICPVirtualUser(tenantID: string): Promise<void> {
    // Create the virtual OICP user
    const newVirtualOICPUser = UserStorage.createNewUser() as User;
    newVirtualOICPUser.email = Constants.OICP_VIRTUAL_USER_EMAIL;
    newVirtualOICPUser.name = 'OICP';
    newVirtualOICPUser.firstName = 'Virtual';
    newVirtualOICPUser.issuer = false;
    newVirtualOICPUser.status = UserStatus.ACTIVE;
    newVirtualOICPUser.notificationsActive = false;
    // Save User
    newVirtualOICPUser.id = await UserStorage.saveUser(tenantID, newVirtualOICPUser);
    // Save User Status
    await UserStorage.saveUserStatus(tenantID, newVirtualOICPUser.id, UserStatus.ACTIVE);
  }

}
