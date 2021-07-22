import { AccountVerificationNotification, AdminAccountVerificationNotification, BillingInvoiceSynchronizationFailedNotification, BillingNewInvoiceNotification, BillingUserSynchronizationFailedNotification, CarCatalogSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, ComputeAndApplyChargingProfilesFailedNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, EndUserErrorNotification, NewRegisteredUserNotification, NotificationSeverity, OCPIPatchChargingStationsStatusesErrorNotification, OICPPatchChargingStationsErrorNotification, OICPPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SessionNotStartedNotification, SmtpErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, UserCreatePassword, VerificationEmailNotification } from '../types/UserNotifications';

import Tenant from '../types/Tenant';
import User from '../types/User';

export default interface NotificationTask {
  sendEndOfCharge(data: EndOfChargeNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendOptimalChargeReached(data: OptimalChargeReachedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendEndOfSession(data: EndOfSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendEndOfSignedSession(data: EndOfSignedSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendRequestPassword(data: RequestPasswordNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendNewRegisteredUser(data: NewRegisteredUserNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendVerificationEmail(data: VerificationEmailNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendChargingStationRegistered(data: ChargingStationRegisteredNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendUnknownUserBadged(data: UnknownUserBadgedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendSessionStarted(data: TransactionStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendSmtpError(data: SmtpErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendOICPPatchChargingStationsStatusesError(data: OICPPatchChargingStationsStatusesErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendOICPPatchChargingStationsError(data: OICPPatchChargingStationsErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendUserAccountInactivity(data: UserAccountInactivityNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendPreparingSessionNotStarted(data: PreparingSessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendOfflineChargingStations(data: OfflineChargingStationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendBillingSynchronizationFailed(data: BillingUserSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendBillingInvoiceSynchronizationFailed(data: BillingInvoiceSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendBillingPeriodicOperationFailed(data: BillingInvoiceSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendCarCatalogSynchronizationFailed(data: CarCatalogSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendComputeAndApplyChargingProfilesFailed(data: ComputeAndApplyChargingProfilesFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendSessionNotStarted(data: SessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendEndUserErrorNotification(data: Partial<EndUserErrorNotification>, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  // TODO : Delete sendBillingNewInvoice ??
  sendBillingNewInvoice(data: BillingNewInvoiceNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendBillingNewInvoicePaid(data: BillingNewInvoiceNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendBillingNewInvoiceOpen(data: BillingNewInvoiceNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendAccountVerificationNotification(data: AccountVerificationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendAdminAccountVerificationNotification(data: AdminAccountVerificationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendUserCreatePassword(data: UserCreatePassword, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
  sendVerificationEmailUserImport(data: VerificationEmailNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void>;
}
