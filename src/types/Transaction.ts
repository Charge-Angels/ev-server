import { Car, CarCatalog } from './Car';
import { ChargePointStatus, OCPP15TransactionData, OCPPMeterValue } from './ocpp/OCPPServer';
import Consumption, { AbstractCurrentConsumption } from './Consumption';

import ChargingStation from '../types/ChargingStation';
import Company from './Company';
import { OCPICdr } from './ocpi/OCPICdr';
import { OCPISession } from './ocpi/OCPISession';
import { OICPChargeDetailRecord } from './oicp/OICPChargeDetailRecord';
import { OICPSession } from './oicp/OICPSession';
import { PricingModel } from './Pricing';
import Site from './Site';
import SiteArea from './SiteArea';
import Tag from './Tag';
import { TransactionBillingData } from './Billing';
import { TransactionRefundData } from './Refund';
import User from './User';

export type InactivityStatusLevel =
 'info' |
 'warning' |
 'danger'
;

export enum InactivityStatus {
  INFO = 'I',
  WARNING = 'W',
  ERROR = 'E'
}

export enum TransactionAction {
  START = 'start',
  UPDATE = 'update',
  STOP = 'stop',
  END = 'end'
}

export interface UserDefaultTagCar {
  car: Car;
  tag: Tag;
  errorCodes?: StartTransactionErrorCode[];
}

export enum StartTransactionErrorCode {
  BILLING_NO_PAYMENT_METHOD = 'no_payment_method', // start transaction is not possible - user has no payment method
  BILLING_NO_TAX = 'billing_no_tax', // start transaction is not possible - the tax ID is not set or inconsistent
  BILLING_NO_SETTINGS = 'billing_no_settings', // start transaction not possible - billing settings are not set (or partially set)
  BILLING_INCONSISTENT_SETTINGS = 'billing_inconsistent_settings', // start transaction not possible - billing settings are inconsistent
  // EULA not accepted : should never be possible with remote start from the app - to be checked if needed in frontend
  EULA_NOT_ACCEPTED = 'eula_not_accepted', // start transaction not possible - user has never accepted the eula (use case : user import + user has never log into the app)
}

export default interface Transaction extends AbstractCurrentConsumption {
  id?: number;
  carID?: string;
  car?: Car;
  carCatalogID?: number;
  carCatalog?: CarCatalog;
  phasesUsed?: CSPhasesUsed;
  companyID?: string;
  company?: Company;
  siteID?: string;
  site?: Site;
  siteAreaID?: string;
  siteArea?: SiteArea;
  issuer: boolean;
  connectorId: number;
  tagID: string;
  tag?: Tag;
  userID: string;
  chargeBoxID: string;
  signedData?: string;
  user?: User;
  stop?: TransactionStop;
  remotestop?: {
    timestamp: Date;
    tagID: string;
    userID: string;
  };
  chargeBox?: ChargingStation;
  meterStart: number;
  timestamp: Date;
  price?: number;
  roundedPrice?: number;
  priceUnit?: string;
  pricingSource?: string;
  pricingModel?: PricingModel,
  stateOfCharge: number;
  timezone: string;
  currentTimestamp?: Date;
  currentTotalInactivitySecs: number;
  currentInactivityStatus?: InactivityStatus;
  currentStateOfCharge: number;
  currentTotalDurationSecs?: number;
  transactionEndReceived?: boolean;
  currentCumulatedPrice?: number;
  currentSignedData?: string;
  status?: ChargePointStatus;
  numberOfMeterValues: number;
  uniqueId?: string;
  values?: Consumption[];
  ocpi?: boolean;
  ocpiWithCdr?: boolean;
  ocpiData?: TransactionOcpiData;
  oicpData?: TransactionOicpData;
  billingData?: TransactionBillingData;
  refundData?: TransactionRefundData;
  migrationTag?: string;
}

export interface TransactionOcpiData {
  session?: OCPISession;
  cdr?: OCPICdr;
  sessionCheckedOn?: Date;
  cdrCheckedOn?: Date;
}

export interface TransactionOicpData {
  session?: OICPSession;
  cdr?: OICPChargeDetailRecord;
  sessionCheckedOn?: Date;
  cdrCheckedOn?: Date;
}

export interface CSPhasesUsed {
  csPhase1: boolean;
  csPhase2: boolean;
  csPhase3: boolean;
}

export interface TransactionStop {
  timestamp: Date;
  meterStop: number;
  reason?: string;
  tagID: string;
  userID: string;
  user?: User;
  price?: number;
  roundedPrice?: number;
  priceUnit?: string;
  pricingSource?: string;
  stateOfCharge?: number;
  totalInactivitySecs?: number;
  extraInactivitySecs?: number;
  extraInactivityComputed?: boolean;
  totalConsumptionWh?: number;
  totalDurationSecs?: number;
  inactivityStatus?: InactivityStatus;
  transactionData?: OCPP15TransactionData|OCPPMeterValue[];
  signedData?: string;
}
