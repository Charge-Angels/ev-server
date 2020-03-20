import axios from 'axios';
import axiosRetry from 'axios-retry';
import jwt from 'jsonwebtoken';
import moment from 'moment-timezone';
import querystring from 'querystring';
import AbstractConnector from '../../AbstractConnector';
import AppError from '../../../exception/AppError';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import ConnectionStorage from '../../../storage/mongodb/ConnectionStorage';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import { HTTPError } from '../../../types/HTTPError';
import Logging from '../../../utils/Logging';
import Site from '../../../types/Site';
import SiteAreaStorage from '../../../storage/mongodb/SiteAreaStorage';
import Transaction from '../../../types/Transaction';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import BackendError from '../../../exception/BackendError';
import Company from '../../../types/Company';
import CompanyStorage from '../../../storage/mongodb/CompanyStorage';
import RefundConnector from '../RefundConnector';
import { RefundStatus, RefundType } from '../../../types/Refund';
import { Action } from '../../../types/Authorization';

const MODULE_NAME = 'ConcurRefundConnector';
const CONNECTOR_ID = 'concur';

/**
 * A concur connector creates connection with the following data attributes
 * Instance_URL  string  -  Identifies the Concur datacenter where the user’s data resides. For example, if the Instance_Url is https://www.ea1.concursolutions.com, then all API calls for this user should use this URL as a prefix in subsequent API calls
 * Token  string  -  The access token value passed in the Authorization header when making API calls. It is a long-lived token which is currently set to expire after one year from creation. You should securely store the token and use it for all subsequent API requests until the token expires. Before it does, you should send a request to refresh the token prior to the expiration date.
 * Expiration_Date  string  -  The Universal Coordinated Time (UTC) date and time when the access token expires.
 * Refresh_Token  string  -  Token with a new expiration date of a year from the refresh date. You should securely store the refresh token for a user and use it for all subsequent API requests.
 */
export default class ConcurRefundConnector extends AbstractConnector implements RefundConnector {

  constructor(tenantID, setting) {
    super(tenantID, 'concur', setting);
    axiosRetry(axios,
      {
        retries: 3,
        retryCondition: (error) => error.response.status === HTTPError.GENERAL_ERROR,
        retryDelay: (retryCount, error) => {
          try {
            if (error.config.method === 'post') {
              if (error.config.url.endsWith('/token')) {
                throw new BackendError({
                  source: Constants.CENTRAL_SERVER,
                  module: MODULE_NAME,
                  method: 'retryDelay',
                  message: `Unable to request token, response status ${error.response.status}, attempt ${retryCount}`,
                  action: Action.REFUND,
                  detailedMessages: { response: error.response }
                });
              } else {
                const payload = {
                  error: error.response.data,
                  payload: JSON.parse(error.config.data)
                };
                throw new BackendError({
                  source: Constants.CENTRAL_SERVER,
                  module: MODULE_NAME,
                  method: 'retryDelay',
                  message: `Unable to post data on ${error.config.url}, response status ${error.response.status}, attempt ${retryCount}`,
                  action: Action.REFUND,
                  detailedMessages: { payload }
                });
              }
            } else {
              throw new BackendError({
                source: Constants.CENTRAL_SERVER,
                module: MODULE_NAME,
                method: 'retryDelay',
                message: `Unable to ${error.config.url} data on ${error.config.url}, response status ${error.response.status}, attempt ${retryCount}`,
                action: Action.REFUND,
                detailedMessages: { response: error.response.data }
              });
            }
          } catch (err) {
            Logging.logException(err, Action.REFUND, Constants.CENTRAL_SERVER, MODULE_NAME, 'anonymous', tenantID, null);
          }
          return retryCount * 200;
        },
        shouldResetTimeout: true
      });
  }

  static computeValidUntilAt(result) {
    return new Date(result.data.refresh_expires_in * 1000);
  }

  static isConnectionExpired(connection) {
    return moment(connection.data.refresh_expires_in).isBefore(moment.now());
  }

  static isTokenExpired(connection) {
    return moment(connection.getUpdatedAt()).add(connection.getData().expires_in, 'seconds').isBefore(moment.now());
  }

  getAuthenticationUrl() {
    return this.getSetting().authenticationUrl;
  }

  getApiUrl() {
    return this.getSetting().apiUrl;
  }

  getClientId() {
    return this.getSetting().clientId;
  }

  getClientSecret() {
    return this.getSetting().clientSecret;
  }

  getClientSecretDecrypted() {
    return Cypher.decrypt(this.getSetting().clientSecret);
  }

  getExpenseTypeCode() {
    return this.getSetting().expenseTypeCode;
  }

  getPolicyID() {
    return this.getSetting().policyId;
  }

  getReportName() {
    return this.getSetting().reportName;
  }

  getPaymentTypeID() {
    return this.getSetting().paymentTypeId;
  }

  async createConnection(userId, data) {
    try {
      Logging.logDebug({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'createConnection',
        action: Action.REFUND, message: `request concur access token for ${userId}`
      });
      const result = await axios.post(`${this.getAuthenticationUrl()}/oauth2/v0/token`,
        querystring.stringify({
          code: data.code,
          client_id: this.getClientId(),
          client_secret: this.getClientSecretDecrypted(),
          redirect_uri: data.redirectUri,
          grant_type: 'authorization_code'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
      Logging.logDebug({
        tenantID: this.getTenantID(),
        module: MODULE_NAME, method: 'createConnection',
        action: Action.REFUND, message: `Concur access token granted for ${userId}`
      });
      const now = new Date();
      return ConnectionStorage.saveConnection(this.getTenantID(), {
        data: result.data,
        userId: userId,
        connectorId: CONNECTOR_ID,
        createdAt: now,
        updatedAt: now,
        validUntil: ConcurRefundConnector.computeValidUntilAt(result)
      });
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Concur access token not granted for ${userId}`,
        module: MODULE_NAME,
        method: 'GetAccessToken',
        user: userId,
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  async refund(tenantID: string, userId: string, transactions: Transaction[], quickRefund = false): Promise<any> {
    const startDate = moment();
    const refundedTransactions = [];
    const connection = await this.getRefreshedConnection(userId);
    let expenseReportId;

    if (!quickRefund) {
      expenseReportId = await this.createExpenseReport(connection, transactions[0].timezone, userId);
    }

    await Promise.map(transactions,
      async (transaction: Transaction) => {
        try {
          const chargingStation = await ChargingStationStorage.getChargingStation(tenantID, transaction.chargeBoxID);
          let site;
          if (chargingStation.siteArea && chargingStation.siteArea.site) {
            site = chargingStation.siteArea.site;
          } else {
            site = (await SiteAreaStorage.getSiteArea(tenantID, chargingStation.siteAreaID, { withSite: true })).site;
          }
          const locationId = await this.getLocation(tenantID, connection, site);
          if (quickRefund) {
            const entryId = await this.createQuickExpense(connection, transaction, locationId, userId);
            transaction.refundData = { refundId: entryId, type: RefundType.QUICK, refundedAt: new Date() };
          } else {
            const entryId = await this.createExpenseReportEntry(connection, expenseReportId, transaction, locationId, userId);
            transaction.refundData = {
              refundId: entryId,
              type: RefundType.REPORT,
              status: RefundStatus.SUBMITTED,
              reportId: expenseReportId,
              refundedAt: new Date()
            };
          }
          await TransactionStorage.saveTransaction(tenantID, transaction);
          refundedTransactions.push(transaction);
        } catch (exception) {
          Logging.logException(exception, Action.REFUND, MODULE_NAME, MODULE_NAME, 'refund', this.getTenantID(), userId);
        }
      },
      { concurrency: 10 });

    Logging.logInfo({
      tenantID: this.getTenantID(),
      user: userId,
      source: MODULE_NAME, action: Action.REFUND,
      module: MODULE_NAME, method: 'Refund',
      message: `${refundedTransactions.length} transactions have been transferred to Concur in ${moment().diff(startDate, 'milliseconds')} ms`
    });

    return refundedTransactions;
  }

  async updateRefundStatus(tenantID: string, transaction: Transaction): Promise<string> {
    if (transaction.refundData) {
      const connection = await this.getRefreshedConnection(transaction.userID);
      const report = await this.getExpenseReport(connection, transaction.refundData.reportId);
      if (report) {
        // Approved
        if (report.ApprovalStatusCode === 'A_APPR') {
          transaction.refundData.status = RefundStatus.APPROVED;
          await TransactionStorage.saveTransaction(tenantID, transaction);
          Logging.logDebug({
            tenantID: tenantID,
            module: 'ConcurRefundConnector', method: 'updateRefundStatus', action: 'RefundSynchronize',
            message: `The Transaction ID '${transaction.id}' has been marked 'Approved'`,
            user: transaction.userID
          });
          return RefundStatus.APPROVED;
        }
        Logging.logDebug({
          tenantID: tenantID,
          module: 'ConcurRefundConnector', method: 'updateRefundStatus', action: 'RefundSynchronize',
          message: `The Transaction ID '${transaction.id}' has not been updated`,
          user: transaction.userID
        });
      } else {
        // Cancelled
        transaction.refundData.status = RefundStatus.CANCELLED;
        await TransactionStorage.saveTransaction(tenantID, transaction);
        Logging.logDebug({
          tenantID: tenantID,
          module: 'ConcurRefundConnector', method: 'updateRefundStatus', action: 'RefundSynchronize',
          message: `The Transaction ID '${transaction.id}' has been marked 'Cancelled'`,
          user: transaction.userID
        });
        return RefundStatus.CANCELLED;
      }
    }
  }

  canBeDeleted(transaction: Transaction): boolean {
    if (transaction.refundData && transaction.refundData.status) {
      switch (transaction.refundData.status) {
        case RefundStatus.CANCELLED:
        case RefundStatus.NOT_SUBMITTED:
          return true;
        default:
          return false;
      }
    }
    return true;
  }

  async getLocation(tenantID: string, connection, site: Site) {
    let response = await axios.get(`${this.getApiUrl()}/api/v3.0/common/locations?city=${site.address.city}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${connection.getData().access_token}`
      }
    });
    if (response.data && response.data.Items && response.data.Items.length > 0) {
      return response.data.Items[0];
    }
    // Get the company
    const company: Company = await CompanyStorage.getCompany(tenantID, site.companyID);
    response = await axios.get(`${this.getApiUrl()}/api/v3.0/common/locations?city=${company.address.city}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${connection.getData().access_token}`
      }
    });
    if (response.data && response.data.Items && response.data.Items.length > 0) {
      return response.data.Items[0];
    }
    throw new AppError({
      source: Constants.CENTRAL_SERVER,
      errorCode: HTTPError.CONCUR_CITY_UNKNOWN_ERROR,
      message: `The city '${site.address.city}' of the station is unknown to Concur`,
      module: MODULE_NAME,
      method: 'getLocation',
      action: Action.REFUND
    });
  }

  async createQuickExpense(connection, transaction: Transaction, location, userId: string) {
    try {
      const startDate = moment();
      const response = await axios.post(`${this.getAuthenticationUrl()}/quickexpense/v4/users/${jwt.decode(connection.getData().access_token).sub}/context/TRAVELER/quickexpenses`, {
        'comment': `Session started the ${moment.tz(transaction.timestamp, transaction.timezone).format('YYYY-MM-DD HH:mm:ss')} during ${moment.duration(transaction.stop.totalDurationSecs, 'seconds').format('h[h]mm', { trim: false })}`,
        'vendor': this.getReportName(),
        'entryDetails': `Refund of transaction ${transaction.id}`,
        'expenseTypeID': this.getExpenseTypeCode(),
        'location': {
          'name': location.Name
        },
        'transactionAmount': {
          'currencyCode': transaction.stop.priceUnit,
          'value': transaction.stop.price
        },
        'transactionDate': moment.tz(transaction.timestamp, transaction.timezone).format('YYYY-MM-DD')
      }, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      Logging.logDebug({
        tenantID: this.getTenantID(),
        user: userId,
        source: MODULE_NAME, action: Action.REFUND,
        module: MODULE_NAME, method: 'createQuickExpense',
        message: `Transaction ${transaction.id} has been successfully transferred in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.quickExpenseIdUri;
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Unable to create Quick Expense',
        module: MODULE_NAME,
        method: 'createQuickExpense',
        user: userId,
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  async createExpenseReportEntry(connection, expenseReportId, transaction: Transaction, location, userId: string) {
    try {
      const startDate = moment();
      const response = await axios.post(`${this.getApiUrl()}/api/v3.0/expense/entries`, {
        'Description': `E-Mobility reimbursement ${moment.tz(transaction.timestamp, transaction.timezone).format('YYYY-MM-DD')}`,
        'Comment': `Session started the ${moment.tz(transaction.timestamp, transaction.timezone).format('YYYY-MM-DD HH:mm:ss')} during ${moment.duration(transaction.stop.totalDurationSecs, 'seconds').format('h[h]mm', { trim: false })}`,
        'VendorDescription': 'E-Mobility',
        'Custom1': transaction.id,
        'ExpenseTypeCode': this.getExpenseTypeCode(),
        'IsBillable': true,
        'IsPersonal': false,
        'PaymentTypeID': this.getPaymentTypeID(),
        'ReportID': expenseReportId,
        'TaxReceiptType': 'N',
        'TransactionAmount': transaction.stop.price,
        'TransactionCurrencyCode': transaction.stop.priceUnit,
        'TransactionDate': moment.tz(transaction.timestamp, transaction.timezone).format('YYYY-MM-DD'),
        'SpendCategoryCode': 'COCAR',
        'LocationID': location.ID

      }, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      Logging.logDebug({
        tenantID: this.getTenantID(),
        user: userId,
        source: MODULE_NAME, action: Action.REFUND,
        module: MODULE_NAME, method: 'createExpenseReportEntry',
        message: `Transaction ${transaction.id} has been successfully transferred in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.ID;
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Unable to create an Expense Report',
        module: MODULE_NAME,
        method: 'createExpenseReport',
        user: userId,
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  async createExpenseReport(connection, timezone, userId: string) {
    try {
      const startDate = moment();
      const response = await axios.post(`${this.getApiUrl()}/api/v3.0/expense/reports`, {
        'Name': `${this.getReportName()} - ${moment.tz(timezone).format('DD/MM/YY HH:mm')}`,
        'PolicyID': this.getPolicyID()
      }, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      Logging.logDebug({
        tenantID: this.getTenantID(),
        user: userId,
        source: MODULE_NAME, action: Action.REFUND,
        module: MODULE_NAME, method: 'createExpenseReport',
        message: `Report has been successfully created in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      return response.data.ID;
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Unable to create an Expense Report',
        module: MODULE_NAME,
        method: 'createExpenseReport',
        user: userId,
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  getRetryCount(response) {
    if (response && response.config) {
      return response.config['axios-retry'].retryCount;
    }
    return 0;
  }

  private async getExpenseReport(connection, reportId) {
    try {
      const response = await axios.get(`${this.getApiUrl()}/api/v3.0/expense/reports/${reportId}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      return response.data;
    } catch (error) {
      if (error.response.status === 404) {
        return null;
      }
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Unable to get Report details with ID '${reportId}'`,
        module: MODULE_NAME,
        method: 'getExpenseReport',
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  private async getExpenseReports(connection) {
    try {
      const response = await axios.get(`${this.getApiUrl()}/api/v3.0/expense/reports?approvalStatusCode=A_NOTF`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.getData().access_token}`
        }
      });
      return response.data.Items;
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Unable to get expense Reports',
        module: MODULE_NAME,
        method: 'getExpenseReports',
        action: Action.REFUND,
        detailedMessages: { error }
      });
    }
  }

  private async refreshToken(userId, connection) {
    try {
      const startDate = moment();
      const response = await axios.post(`${this.getAuthenticationUrl()}/oauth2/v0/token`,
        querystring.stringify({
          client_id: this.getClientId(),
          client_secret: this.getClientSecretDecrypted(),
          refresh_token: connection.getData().refresh_token,
          scope: connection.getData().scope,
          grant_type: 'refresh_token'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

      Logging.logDebug({
        tenantID: this.getTenantID(),
        user: userId,
        source: MODULE_NAME, action: Action.REFUND,
        module: MODULE_NAME, method: 'refreshToken',
        message: `Concur access token has been successfully generated in ${moment().diff(startDate, 'milliseconds')} ms with ${this.getRetryCount(response)} retries`
      });
      connection.updateData(response.data, new Date(), ConcurRefundConnector.computeValidUntilAt(response));
      return ConnectionStorage.saveConnection(this.getTenantID(), connection.getModel());
    } catch (error) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Concur access token not refreshed (ID: '${userId}')`,
        module: MODULE_NAME,
        method: 'refreshToken',
        action: Action.REFUND,
        user: userId,
        detailedMessages: { error }
      });
    }
  }

  private async getRefreshedConnection(userId: string) {
    let connection = await this.getConnectionByUserId(userId);
    if (!connection) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.CONCUR_NO_CONNECTOR_CONNECTION_ERROR,
        message: `The user with ID '${userId}' does not have a connection to connector '${CONNECTOR_ID}'`,
        module: MODULE_NAME,
        method: 'getRefreshedConnection',
        action: Action.REFUND,
        user: userId
      });
    }

    if (ConcurRefundConnector.isTokenExpired(connection)) {
      connection = await this.refreshToken(userId, connection);
    }
    return connection;
  }
}
