import User, { UserStatus } from './User';

import ChargingStation from './ChargingStation';
import NotificationTask from '../notification/NotificationTask';
import { SMTPError } from 'emailjs';

export default interface UserNotifications {
  sendSessionStarted: boolean;
  sendOptimalChargeReached: boolean;
  sendEndOfCharge: boolean;
  sendEndOfSession: boolean;
  sendUserAccountStatusChanged: boolean;
  sendNewRegisteredUser: boolean;
  sendUnknownUserBadged: boolean;
  sendChargingStationStatusError: boolean;
  sendChargingStationRegistered: boolean;
  sendOcpiPatchStatusError: boolean;
  sendOicpPatchStatusError: boolean;
  sendSmtpError: boolean;
  sendUserAccountInactivity: boolean;
  sendPreparingSessionNotStarted: boolean;
  sendOfflineChargingStations: boolean;
  sendBillingSynchronizationFailed: boolean;
  sendBillingNewInvoice: boolean;
  sendBillingPeriodicOperationFailed: boolean;
  sendCarCatalogSynchronizationFailed: boolean;
  sendComputeAndApplyChargingProfilesFailed: boolean;
  sendSessionNotStarted: boolean;
  sendEndUserErrorNotification: boolean;
  sendAccountVerificationNotification: boolean;
  sendAdminAccountVerificationNotification: boolean;
}

export type UserNotificationKeys =
 'sendSessionStarted' |
 'sendOptimalChargeReached' |
 'sendEndOfCharge' |
 'sendEndOfSession' |
 'sendUserAccountStatusChanged' |
 'sendUnknownUserBadged' |
 'sendChargingStationStatusError' |
 'sendChargingStationRegistered' |
 'sendOcpiPatchStatusError' |
 'sendOicpPatchStatusError' |
 'sendSmtpError' |
 'sendUserAccountInactivity' |
 'sendPreparingSessionNotStarted' |
 'sendOfflineChargingStations' |
 'sendBillingSynchronizationFailed' |
 'sendBillingNewInvoice' |
 'sendSessionNotStarted' |
 'sendCarCatalogSynchronizationFailed' |
 'sendEndUserErrorNotification' |
 'sendAccountVerificationNotification' |
 'sendAdminAccountVerificationNotification'
;

export enum UserNotificationType {
  SESSION_STARTED = 'SessionStarted',
  OPTIMAL_CHARGE_REACHED = 'OptimalChargeReached',
  END_OF_CHARGE = 'EndOfCharge',
  END_OF_SESSION = 'EndOfSession',
  USER_ACCOUNT_STATUS_CHANGED = 'UserAccountStatusChanged',
  UNKNOWN_USER_BADGED = 'UnknownUserBadged',
  CHARGING_STATION_STATUS_ERROR = 'ChargingStationStatusError',
  CHARGING_STATION_REGISTERED = 'ChargingStationRegistered',
  OCPI_PATCH_STATUS_ERROR = 'OcpiPatchStatusError',
  OICP_PATCH_STATUS_ERROR = 'OicpPatchStatusError',
  OICP_PATCH_EVSE_ERROR = 'OicpPatchEvseError',
  SMTP_ERROR = 'SmtpError',
  PREPARING_SESSION_NOT_STARTED = 'PreparingSessionNotStarted',
  USER_ACCOUNT_INACTIVITY = 'UserAccountInactivity',
  OFFLINE_CHARGING_STATION = 'OfflineChargingStation',
  BILLING_USER_SYNCHRONIZATION_FAILED = 'BillingUserSynchronizationFailed',
  BILLING_INVOICE_SYNCHRONIZATION_FAILED = 'BillingInvoiceSynchronizationFailed',
  BILLING_PERIODIC_OPERATION_FAILED = 'BillingPeriodicOperationFailed',
  BILLING_NEW_INVOICE = 'BillingNewInvoice',
  CAR_CATALOG_SYNCHRONIZATION_FAILED = 'CarCatalogSynchronizationFailed',
  CHECK_AND_APPLY_SMART_CHARGING_FAILED = 'ComputeAndApplyChargingProfilesFailed',
  SESSION_NOT_STARTED_AFTER_AUTHORIZE = 'SessionNotStartedAfterAuthorize',
  END_USER_ERROR_NOTIFICATION = 'EndUserErrorNotification',
  ACCOUNT_VERIFICATION_NOTIFICATION = 'AccountVerificationNotification'
}

export enum NotificationSeverity {
  INFO = '#00376C',
  WARNING = '#FB8C00',
  ERROR = '#ee0000'
}

export interface EmailNotificationMessage {
  to: string;
  cc?: string;
  bccNeeded?: boolean;
  bcc?: string;
  subject: string;
  text: string;
  html: string;
}

interface BaseNotification {
  tenantLogoURL?: string;
}

export interface EndOfChargeNotification extends BaseNotification {
  user: User;
  transactionId: number;
  chargeBoxID: string;
  connectorId: string;
  totalConsumption: string;
  stateOfCharge: number;
  totalDuration: string;
  evseDashboardChargingStationURL: string;
  evseDashboardURL: string;
}

export interface OptimalChargeReachedNotification extends BaseNotification {
  user: User;
  transactionId: number;
  chargeBoxID: string;
  connectorId: string;
  totalConsumption: string;
  stateOfCharge: number;
  evseDashboardChargingStationURL: string;
  evseDashboardURL: string;
}

export interface EndOfSessionNotification extends BaseNotification {
  user: User;
  alternateUser: User;
  transactionId: number;
  chargeBoxID: string;
  connectorId: string;
  totalConsumption: string;
  totalInactivity: string;
  stateOfCharge: number;
  totalDuration: string;
  evseDashboardChargingStationURL: string;
  evseDashboardURL: string;
}

export interface EndOfSignedSessionNotification extends BaseNotification {
  user: User;
  alternateUser: User;
  transactionId: number;
  chargeBoxID: string;
  connectorId: string;
  tagId: string;
  startDate: string;
  endDate: string;
  meterStart: string;
  meterStop: string;
  totalConsumption: string;
  price: number;
  relativeCost: number;
  startSignedData: string;
  endSignedData: string;
  evseDashboardURL: string;
}

export interface RequestPasswordNotification extends BaseNotification {
  user: User;
  evseDashboardResetPassURL: string;
  evseDashboardURL: string;
}

export interface UserAccountStatusChangedNotification extends BaseNotification {
  user: User;
  evseDashboardURL: string;
}

export interface NewRegisteredUserNotification extends BaseNotification {
  tenant: string;
  user: User;
  evseDashboardURL: string;
  evseDashboardVerifyEmailURL: string;
}

export interface VerificationEmailNotification extends BaseNotification {
  user: User;
  tenantName?: string;
  evseDashboardURL: string;
  evseDashboardVerifyEmailURL: string;
}

export interface ChargingStationStatusErrorNotification extends BaseNotification {
  chargeBoxID: string;
  connectorId: string;
  error: string;
  evseDashboardURL: string;
  evseDashboardChargingStationURL: string;
}

export interface ChargingStationRegisteredNotification extends BaseNotification {
  chargeBoxID: string;
  evseDashboardURL: string;
  evseDashboardChargingStationURL: string;
}

export interface UnknownUserBadgedNotification extends BaseNotification {
  chargeBoxID: string;
  badgeID: string;
  evseDashboardURL: string;
  evseDashboardTagURL: string;
}

export interface TransactionStartedNotification extends BaseNotification {
  user: User;
  transactionId: number;
  chargeBoxID: string;
  connectorId: string;
  evseDashboardURL: string;
  evseDashboardChargingStationURL: string;
}

export interface SmtpErrorNotification extends BaseNotification {
  SMTPError: SMTPError;
  evseDashboardURL: string;
}

export interface OICPPatchChargingStationsErrorNotification extends BaseNotification {
  evseDashboardURL: string;
}

export interface OICPPatchChargingStationsStatusesErrorNotification extends BaseNotification {
  evseDashboardURL: string;
}

export interface OCPIPatchChargingStationsStatusesErrorNotification extends BaseNotification {
  location: string;
  evseDashboardURL: string;
}

export interface UserAccountInactivityNotification extends BaseNotification {
  user: User;
  lastLogin: string;
  evseDashboardURL: string;
}

export interface PreparingSessionNotStartedNotification extends BaseNotification {
  user: User;
  chargeBoxID: string;
  connectorId: string;
  startedOn: string;
  evseDashboardURL: string;
  evseDashboardChargingStationURL: string;
}

export interface OfflineChargingStationNotification extends BaseNotification {
  chargeBoxIDs: string;
  evseDashboardURL: string;
}

export interface BillingUserSynchronizationFailedNotification extends BaseNotification {
  nbrUsersInError: number;
  evseDashboardURL: string;
  evseDashboardBillingURL: string;
}

export interface BillingInvoiceSynchronizationFailedNotification extends BaseNotification {
  nbrInvoicesInError: number;
  evseDashboardURL: string;
  evseDashboardBillingURL: string;
}

export interface BillingPeriodicOperationFailedNotification extends BaseNotification {
  nbrInvoicesInError: number;
  evseDashboardURL: string;
  evseDashboardBillingURL: string;
}

// TODO: delete unused Utils.build urls
export interface BillingNewInvoiceNotification extends BaseNotification {
  evseDashboardURL: string;
  evseDashboardInvoiceURL: string;
  user: User;
  invoiceDownloadUrl: string;
  payInvoiceUrl: string;
  invoiceNumber: string;
  invoiceAmount: string;
  invoiceStatus: string;
}

export interface CarCatalogSynchronizationFailedNotification extends BaseNotification {
  nbrCarsInError: number;
  evseDashboardURL: string;
}

export interface ComputeAndApplyChargingProfilesFailedNotification extends BaseNotification {
  siteAreaName: string;
  chargeBoxID: string;
  evseDashboardURL: string;
}
export interface NotificationSource {
  channel: 'email'|'remote-push-notification';
  notificationTask: NotificationTask;
  enabled: boolean;
}

export interface Notification {
  id: string;
  userID: string;
  user?: User;
  timestamp: Date;
  channel: string;
  sourceId: string;
  sourceDescr: string;
  chargeBoxID: string;
  data: any;
}

export interface SessionNotStartedNotification extends BaseNotification {
  chargeBoxID: string;
  user: User;
  evseDashboardURL: string;
  evseDashboardChargingStationURL: string;
}

export interface EndUserErrorNotification extends BaseNotification {
  userID: string;
  email: string;
  name: string;
  errorTitle: string;
  errorDescription: string;
  phone: string;
  evseDashboardURL: string;
}

export interface AccountVerificationNotification extends BaseNotification {
  user: User;
  userStatus: UserStatus;
  evseDashboardURL: string;
}

export interface NotifySessionNotStarted extends BaseNotification {
  chargingStation: ChargingStation;
  tagID: string;
  authDate: Date;
  user: User;
}

export interface AdminAccountVerificationNotification extends BaseNotification {
  user: User;
  evseDashboardURL: string;
  evseUserToVerifyURL: string;
}

export interface UserCreatePassword extends BaseNotification {
  user: User;
  tenantName: string;
  evseDashboardURL: string;
  evseDashboardCreatePasswordURL: string;
}
