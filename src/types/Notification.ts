import User from './User';
import ChargingStation from './ChargingStation';

export enum Source {
  CHARGING_STATION_STATUS_ERROR = 'NotifyChargingStationStatusError',
  CHARGING_STATION_REGISTERED = 'NotifyChargingStationRegistered',
  END_OF_CHARGE = 'NotifyEndOfCharge',
  OPTIMAL_CHARGE_REACHED = 'NotifyOptimalChargeReached',
  END_OF_SESSION = 'NotifyEndOfSession',
  REQUEST_PASSWORD = 'NotifyRequestPassword',
  USER_ACCOUNT_STATUS_CHANGED = 'NotifyUserAccountStatusChanged',
  NEW_REGISTERED_USER = 'NotifyNewRegisteredUser',
  UNKNOWN_USER_BADGED = 'NotifyUnknownUserBadged',
  TRANSACTION_STARTED = 'NotifyTransactionStarted',
  VERIFICATION_EMAIL = 'NotifyVerificationEmail',
  AUTH_EMAIL_ERROR = 'NotifyAuthentificationErrorEmailServer',
  PATCH_EVSE_STATUS_ERROR = 'NotifyPatchEVSEStatusError',
  USER_ACCOUNT_INACTIVITY = 'NotifyUserAccountInactivity',
  PREPARING_SESSION_NOT_STARTED = 'NotifyPreparingSessionNotStarted',
  OFFLINE_CHARGING_STATIONS = 'NotifyOfflineChargingStations',
  BILLING_USER_SYNCHRONIZATION_FAILED = 'NotifyBillingUserSynchronizationFailed',
  SESSION_NOT_STARTED_AFTER_AUTHORIZE = 'NotifySessionNotStartedAfterAuthorize'
}

export interface NotifySessionNotStarted {
  chargingStation: ChargingStation;
  tagID: string;
  authDate: Date;
  user: User;
}
