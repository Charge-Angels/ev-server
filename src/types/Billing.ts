export interface BillingTransactionData {
  status?: string;
  invoiceStatus?: string;
  invoiceItem?: string;
  lastUpdate?: Date;
}

export interface BillingDataStart {
  cancelTransaction?: boolean;
}

export interface BillingDataUpdate {
  cancelTransaction?: boolean;
}

export interface BillingDataStop {
  status?: string;
  invoiceStatus?: string;
  invoiceItem?: string;
}

export interface BillingUserData {
  customerID?: string;
  method?: string;
  cardID?: string;
  subscriptionID?: string;
  lastChangedOn?: Date;
  hasSynchroError?: boolean;
}

export interface BillingPartialUser {
  email: string;
  name: string;
  billingData: BillingUserData;
}

export interface BillingUserSynchronizeAction {
  synchronized: number;
  error: number;
  billingData?: BillingUserData;
}

export interface BillingTax {
  id: string;
  description: string;
  displayName: string;
  percentage: number;
}

export interface BillingInvoice {
  id: string;
  number: string;
  status: string;
  amountDue: number;
  currency: string;
  customerID: string;
  createdOn: Date;
  downloadUrl: string;
  payUrl: string;
}

export interface BillingInvoiceItem {
  description: string;
  amount: number;
  taxes?: string[];
}

export enum BillingInvoiceStatus {
  PAID = 'paid',
  UNPAID = 'open'
}
