import { AccountVerificationNotification, BillingInvoiceSynchronizationFailedNotification, BillingNewInvoiceNotification, BillingPeriodicOperationFailedNotification, BillingUserSynchronizationFailedNotification, CarCatalogSynchronizationFailedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, ComputeAndApplyChargingProfilesFailedNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, EndUserErrorNotification, NewRegisteredUserNotification, NotificationSeverity, OCPIPatchChargingStationsStatusesErrorNotification, OICPPatchChargingStationsErrorNotification, OICPPatchChargingStationsStatusesErrorNotification, OfflineChargingStationNotification, OptimalChargeReachedNotification, PreparingSessionNotStartedNotification, RequestPasswordNotification, SessionNotStartedNotification, SmtpErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountInactivityNotification, UserAccountStatusChangedNotification, UserNotificationType, VerificationEmailNotification } from '../../types/UserNotifications';
import User, { UserStatus } from '../../types/User';

import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import I18nManager from '../../utils/I18nManager';
import Logging from '../../utils/Logging';
import NotificationTask from '../NotificationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import admin from 'firebase-admin';

const MODULE_NAME = 'RemotePushNotificationTask';

export default class RemotePushNotificationTask implements NotificationTask {
  private firebaseConfig = Configuration.getFirebaseConfig();
  private initialized = false;

  public constructor() {
    // Init
    if (this.firebaseConfig?.type?.length > 0) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: this.firebaseConfig.projectID,
            clientEmail: this.firebaseConfig.clientEmail,
            privateKey: this.firebaseConfig.privateKey
          }),
          databaseURL: this.firebaseConfig.databaseURL
        });
        // Ok
        this.initialized = true;
      } catch (error) {
        void Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.REMOTE_PUSH_NOTIFICATION,
          module: MODULE_NAME, method: 'constructor',
          message: `Error initializing Firebase: '${error.message}'`,
          detailedMessages: { error: error.stack }
        });
      }
    }
  }

  public async sendUserAccountInactivity(data: UserAccountInactivityNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.userAccountInactivity.title');
    const body = i18nManager.translate('notifications.userAccountInactivity.body',
      { lastLogin: data.lastLogin, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.USER_ACCOUNT_INACTIVITY, title, body, user, {
      lastLogin: data.lastLogin
    },
    severity
    );
  }

  public async sendPreparingSessionNotStarted(data: PreparingSessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.preparingSessionNotStarted.title');
    const body = i18nManager.translate('notifications.preparingSessionNotStarted.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.PREPARING_SESSION_NOT_STARTED, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId
    },
    severity
    );
  }

  public async sendSessionNotStarted(data: SessionNotStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.sessionNotStarted.title');
    const body = i18nManager.translate('notifications.sessionNotStarted.body',
      { chargeBoxID: data.chargeBoxID });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.SESSION_NOT_STARTED_AFTER_AUTHORIZE, title, body, user, {
      chargeBoxID: data.chargeBoxID,
    },
    severity
    );
  }

  public async sendOfflineChargingStations(data: OfflineChargingStationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.offlineChargingStation.title');
    const body = i18nManager.translate('notifications.offlineChargingStation.body',
      { chargeBoxIDs: data.chargeBoxIDs, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OFFLINE_CHARGING_STATION, title, body, user, null,
      severity
    );
  }

  public async sendNewRegisteredUser(data: NewRegisteredUserNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  public async sendRequestPassword(data: RequestPasswordNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  public async sendOptimalChargeReached(data: OptimalChargeReachedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.optimalChargeReached.title');
    const body = i18nManager.translate('notifications.optimalChargeReached.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OPTIMAL_CHARGE_REACHED, title, body, user, {
      transactionId: data.transactionId.toString(),
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId
    },
    severity
    );
  }

  public async sendEndOfCharge(data: EndOfChargeNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.endOfCharge.title');
    const body = i18nManager.translate('notifications.endOfCharge.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.END_OF_CHARGE, title, body, user, {
      transactionId: data.transactionId.toString(),
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId
    },
    severity
    );
  }

  public async sendEndOfSession(data: EndOfSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.endOfSession.title');
    const body = i18nManager.translate('notifications.endOfSession.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.END_OF_SESSION, title, body, user, {
      transactionId: data.transactionId.toString(),
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId
    },
    severity
    );
  }

  public async sendEndOfSignedSession(data: EndOfSignedSessionNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  public async sendCarCatalogSynchronizationFailed(data: CarCatalogSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  public async sendEndUserErrorNotification(data: EndUserErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.endUserErrorNotification.title');
    const body = i18nManager.translate('notifications.endUserErrorNotification.body',
      { userName: data.name, errorTitle: data.errorTitle, errorDescription: data.errorDescription ,tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.END_USER_ERROR_NOTIFICATION, title, body, user, null,
      severity
    );
  }

  public async sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.chargingStationStatusError.title');
    const body = i18nManager.translate('notifications.chargingStationStatusError.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, error: data.error, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.CHARGING_STATION_STATUS_ERROR, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      connectorId: data.connectorId
    },
    severity
    );
  }

  public async sendChargingStationRegistered(data: ChargingStationRegisteredNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.chargingStationRegistered.title');
    const body = i18nManager.translate('notifications.chargingStationRegistered.body',
      { chargeBoxID: data.chargeBoxID, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.CHARGING_STATION_REGISTERED, title, body, user, {
      chargeBoxID: data.chargeBoxID
    },
    severity
    );
  }

  public async sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    const status = user.status === UserStatus.ACTIVE ?
      i18nManager.translate('notifications.userAccountStatusChanged.activated') :
      i18nManager.translate('notifications.userAccountStatusChanged.suspended');
    // Get Message Text
    const title = i18nManager.translate('notifications.userAccountStatusChanged.title',
      { status: Utils.firstLetterInUpperCase(status) });
    const body = i18nManager.translate('notifications.userAccountStatusChanged.body',
      { status, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.USER_ACCOUNT_STATUS_CHANGED, title, body, user, {
      userID: user.id
    },
    severity
    );
  }

  public async sendUnknownUserBadged(data: UnknownUserBadgedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.unknownUserBadged.title');
    const body = i18nManager.translate('notifications.unknownUserBadged.body',
      { chargeBoxID: data.chargeBoxID, badgeID: data.badgeID, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.UNKNOWN_USER_BADGED, title, body, user, {
      chargeBoxID: data.chargeBoxID,
      badgeID: data.badgeID
    },
    severity
    );
  }

  public async sendSessionStarted(data: TransactionStartedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.sessionStarted.title');
    const body = i18nManager.translate('notifications.sessionStarted.body',
      { chargeBoxID: data.chargeBoxID, connectorId: data.connectorId, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.SESSION_STARTED, title, body, user, {
      'transactionId': data.transactionId.toString(),
      'chargeBoxID': data.chargeBoxID,
      'connectorId': data.connectorId
    },
    severity
    );
  }

  public async sendVerificationEmail(data: VerificationEmailNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  public async sendVerificationEmailUserImport(data: VerificationEmailNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  public async sendSmtpError(data: SmtpErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.smtpError.title');
    const body = i18nManager.translate('notifications.smtpError.body', { tenantName: tenant.name });
    // Send Notification
    // TODO: Remove the cast to deprecated SmtpAuthError user notification type and use SMTP_ERROR once mobile app version <= 1.3.35 is no more used
    return this.sendRemotePushNotificationToUser(tenant, 'SmtpAuthError' as UserNotificationType, title, body, user, null, severity);
  }

  public async sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.ocpiPatchChargingStationsStatusesError.title');
    const body = i18nManager.translate('notifications.ocpiPatchChargingStationsStatusesError.body',
      { location: data.location, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OCPI_PATCH_STATUS_ERROR, title, body, user, null, severity);
  }

  public async sendOICPPatchChargingStationsStatusesError(data: OICPPatchChargingStationsStatusesErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.oicpPatchChargingStationsStatusesError.title');
    const body = i18nManager.translate('notifications.oicpPatchChargingStationsStatusesError.body',
      { tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OICP_PATCH_STATUS_ERROR, title, body, user, null, severity);
  }

  public async sendOICPPatchChargingStationsError(data: OICPPatchChargingStationsErrorNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.oicpPatchChargingStationsError.title');
    const body = i18nManager.translate('notifications.oicpPatchChargingStationsError.body',
      { tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.OICP_PATCH_EVSE_ERROR, title, body, user, null, severity);
  }

  public async sendBillingSynchronizationFailed(data: BillingUserSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.billingUserSynchronizationFailed.title');
    const body = i18nManager.translate('notifications.billingUserSynchronizationFailed.body',
      { nbrUsersInError: data.nbrUsersInError, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_USER_SYNCHRONIZATION_FAILED,
      title, body, user, { 'error': data.nbrUsersInError.toString() }, severity);
  }

  public async sendBillingInvoiceSynchronizationFailed(data: BillingInvoiceSynchronizationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.billingInvoiceSynchronizationFailed.title');
    const body = i18nManager.translate('notifications.billingInvoiceSynchronizationFailed.body',
      { nbrInvoicesInError: data.nbrInvoicesInError, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_INVOICE_SYNCHRONIZATION_FAILED,
      title, body, user, { 'error': data.nbrInvoicesInError.toString() }, severity);
  }

  public async sendBillingPeriodicOperationFailed(data: BillingPeriodicOperationFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.billingPeriodicOperationFailed.title');
    const body = i18nManager.translate('notifications.billingPeriodicOperationFailed.body',
      { nbrInvoicesInError: data.nbrInvoicesInError, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_PERIODIC_OPERATION_FAILED,
      title, body, user, { 'error': data.nbrInvoicesInError.toString() }, severity);
  }

  public async sendComputeAndApplyChargingProfilesFailed(data: ComputeAndApplyChargingProfilesFailedNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.computeAndApplyChargingProfilesFailed.title');
    const body = i18nManager.translate('notifications.computeAndApplyChargingProfilesFailed.body',
      { chargeBoxID: data.chargeBoxID, siteAreaName: data.siteAreaName, tenantName: tenant.name });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.CHECK_AND_APPLY_SMART_CHARGING_FAILED,
      title, body, user, null, severity);

  }

  public async sendBillingNewInvoice(data: BillingNewInvoiceNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    let title: string;
    let body: string;
    if (data.invoiceStatus === 'paid') {
      title = i18nManager.translate('notifications.billingNewInvoicePaid.title');
      body = i18nManager.translate('notifications.billingNewInvoicePaid.body',
        { invoiceNumber: data.invoiceNumber, amount: data.invoiceAmount });
    } else {
      // if status is 'open'
      title = i18nManager.translate('notifications.billingNewInvoiceOpen.title');
      body = i18nManager.translate('notifications.billingNewInvoiceOpen.body',
        { invoiceNumber: data.invoiceNumber, amount: data.invoiceAmount });
    }
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_NEW_INVOICE,
      title, body, user, { 'invoiceNumber': data.invoiceNumber }, severity);
  }

  public async sendBillingNewInvoicePaid(data: BillingNewInvoiceNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.billingNewInvoicePaid.title');
    const body = i18nManager.translate('notifications.billingNewInvoicePaid.body',
      { invoiceNumber: data.invoiceNumber });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_NEW_INVOICE,
      title, body, user, { 'invoiceNumber': data.invoiceNumber }, severity);
  }

  public async sendBillingNewInvoiceOpen(data: BillingNewInvoiceNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.billingNewInvoiceOpen.title');
    const body = i18nManager.translate('notifications.billingNewInvoiceOpen.body',
      { invoiceNumber: data.invoiceNumber });
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.BILLING_NEW_INVOICE,
      title, body, user, { 'invoiceNumber': data.invoiceNumber }, severity);
  }

  public async sendAccountVerificationNotification(data: AccountVerificationNotification, user: User, tenant: Tenant, severity: NotificationSeverity): Promise<void> {
    // Set the locale
    const i18nManager = I18nManager.getInstanceForLocale(user.locale);
    // Get Message Text
    const title = i18nManager.translate('notifications.accountVerificationNotification.title');
    let body: string;
    if (data.userStatus === UserStatus.ACTIVE) {
      body = i18nManager.translate('notifications.accountVerificationNotification.bodyVerifiedAndActivated');
    } else {
      body = i18nManager.translate('notifications.accountVerificationNotification.bodyVerified');
    }
    // Send Notification
    return this.sendRemotePushNotificationToUser(tenant, UserNotificationType.ACCOUNT_VERIFICATION_NOTIFICATION, title, body, user, null,
      severity
    );
  }

  public async sendAdminAccountVerificationNotification(): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  public async sendUserCreatePassword(): Promise<void> {
    // Nothing to send
    return Promise.resolve();
  }

  private async sendRemotePushNotificationToUser(tenant: Tenant, notificationType: UserNotificationType,
      title: string, body: string, user: User, data?: Record<string, string>, severity?: NotificationSeverity): Promise<void> {
    // Checks
    if (!this.initialized) {
      return Promise.resolve();
    }
    if (!user || !user.mobileToken || user.mobileToken.length === 0) {
      await Logging.logWarning({
        tenantID: tenant.id,
        source: (data && Utils.objectHasProperty(data, 'chargeBoxID') ? data['chargeBoxID'] : null),
        action: ServerAction.REMOTE_PUSH_NOTIFICATION,
        module: MODULE_NAME, method: 'sendRemotePushNotificationToUsers',
        message: `'${notificationType}': No mobile token found for this User`,
        actionOnUser: user.id,
        detailedMessages: [title, body]
      });
      // Send nothing
      return Promise.resolve();
    }
    // Create message
    const message = this.createMessage(tenant, notificationType, title, body, data, severity);
    // Send message
    admin.messaging().sendToDevice(
      user.mobileToken,
      message,
      { priority: 'high', timeToLive: 60 * 60 * 24 }
    ).then((response) => {
      // Response is a message ID string.
      Logging.logDebug({
        tenantID: tenant.id,
        source: (data && Utils.objectHasProperty(data, 'chargeBoxID') ? data['chargeBoxID'] : null),
        action: ServerAction.REMOTE_PUSH_NOTIFICATION,
        module: MODULE_NAME, method: 'sendRemotePushNotificationToUsers',
        message: `Notification Sent: '${notificationType}' - '${title}'`,
        actionOnUser: user.id,
        detailedMessages: [message, response]
      });
    }).catch((error: Error) => {
      Logging.logError({
        tenantID: tenant.id,
        source: (data && Utils.objectHasProperty(data, 'chargeBoxID') ? data['chargeBoxID'] : null),
        action: ServerAction.REMOTE_PUSH_NOTIFICATION,
        module: MODULE_NAME, method: 'sendRemotePushNotificationToUsers',
        message: `Error when sending Notification: '${notificationType}' - '${error.message}'`,
        actionOnUser: user.id,
        detailedMessages: { error: error.stack }
      });
    });
  }

  private createMessage(tenant: Tenant, notificationType: UserNotificationType, title: string, body: string,
      data: Record<string, unknown>, severity: NotificationSeverity): admin.messaging.MessagingPayload {
    // Build message
    const message: admin.messaging.MessagingPayload = {
      notification: {
        title,
        body,
        icon: '@drawable/ic_stat_ic_notification',
        sound: 'default',
        badge: '0',
        color: severity ? severity : NotificationSeverity.INFO,
        android_channel_id: 'e-Mobility'
      },
      data: {
        tenantID: tenant.id,
        tenantSubdomain: tenant.subdomain,
        notificationType,
        ...data
      }
    };
    return message;
  }
}
