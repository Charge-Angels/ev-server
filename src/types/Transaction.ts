import { Car, CarCatalog } from './Car';
import { ChargePointStatus, OCPP15TransactionData, OCPPMeterValue } from './ocpp/OCPPServer';
import Consumption, { AbstractCurrentConsumption } from './Consumption';

import { BillingTransactionData } from './Billing';
import ChargingStation from '../types/ChargingStation';
import { OCPICdr } from './ocpi/OCPICdr';
import { OCPISession } from './ocpi/OCPISession';
import { PricingModel } from './Pricing';
import { RefundTransactionData } from './Refund';
import Tag from './Tag';
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

export default interface Transaction extends AbstractCurrentConsumption {
  id?: number;
  carID?: string;
  car?: Car;
  carCatalogID?: number;
  carCatalog?: CarCatalog;
  phasesUsed?: CSPhasesUsed;
  siteID?: string;
  siteAreaID?: string;
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
  refundData?: RefundTransactionData;
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
  billingData?: BillingTransactionData;
  ocpi?: boolean;
  ocpiWithCdr?: boolean;
  ocpiData?: OcpiData;
  migrationTag?: string;
}

export interface OcpiData {
  session?: OCPISession;
  cdr?: OCPICdr;
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
