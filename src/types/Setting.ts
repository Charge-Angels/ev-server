import CreatedUpdatedProps from './CreatedUpdatedProps';
import TenantComponents from './TenantComponents';

export enum TechnicalSettings {
  USER = 'user',
  CRYPTO = 'crypto'
}

export interface Setting extends CreatedUpdatedProps {
  id?: string;
  identifier: TenantComponents | TechnicalSettings;
  sensitiveData?: string[];
  backupSensitiveData?: Record<string, unknown>;
  category?: 'business' | 'technical';
}

export interface SettingDB extends CreatedUpdatedProps, Setting {
  content: SettingDBContent;
}

export interface SettingLink {
  id: string;
  name: string;
  description: string;
  role: string;
  url: string;
}

export interface SettingDBContent {
  type:
  RoamingSettingsType
  | AnalyticsSettingsType
  | RefundSettingsType
  | PricingSettingsType
  | BillingSettingsType
  | SmartChargingSettingsType
  | AssetSettingsType
  | SmartChargingContentType
  | CryptoSettingsType
  | UserSettingsType
  | CarConnectorSettingsType;
  ocpi?: OcpiSetting;
  oicp?: OicpSetting;
  // pricing?: PricingSetting;  // TODO - reorg pricing similar to billing
  simple?: SimplePricingSetting;
  convergentCharging?: ConvergentChargingPricingSetting;
  billing?: BillingSetting;
  stripe?: StripeBillingSetting;
  sac?: SacAnalyticsSetting;
  links?: SettingLink[];
  concur?: ConcurRefundSetting;
  sapSmartCharging?: SapSmartChargingSetting;
  asset?: AssetSetting;
  carConnector?: CarConnectorSetting;
  crypto?: CryptoSetting;
  user?: UserSetting;
}

export enum PricingSettingsType {
  SIMPLE = 'simple',
  CONVERGENT_CHARGING = 'convergentCharging',
}

export interface PricingSettings extends Setting {
  identifier: TenantComponents.PRICING;
  type: PricingSettingsType;
  simple?: SimplePricingSetting;
  convergentCharging?: ConvergentChargingPricingSetting;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PricingSetting {
}

export enum PricingContentType {
  SIMPLE = 'simple',
  CONVERGENT_CHARGING = 'convergentCharging',
}

export interface SimplePricingSetting extends PricingSetting {
  price: number;
  currency: string;
  last_updated?: Date;
}

export interface ConvergentChargingPricingSetting extends PricingSetting {
  url: string;
  chargeableItemName: string;
  user: string;
  password: string;
}

export enum RoamingSettingsType {
  OCPI = 'ocpi',
  OICP = 'oicp',
}

export interface RoamingSettings extends Setting {
  identifier: TenantComponents.OCPI | TenantComponents.OICP;
  type: RoamingSettingsType;
  ocpi?: OcpiSetting;
  oicp?: OicpSetting;
}

export interface OcpiSetting {
  cpo: OcpiIdentifier;
  emsp: OcpiIdentifier;
  currency: string;
  businessDetails: OcpiBusinessDetails;
}

export interface OicpSetting {
  cpo: OicpIdentifier;
  emsp: OicpIdentifier;
  currency: string;
  businessDetails: OicpBusinessDetails;
}

export interface RoamingIdentifier {
  countryCode: string;
  partyID: string;
}

export type OcpiIdentifier = RoamingIdentifier;

// Should be renamed. Certificate and Key are bundled with OperatorID / ProviderID at this moment.
// Because the roles CPO and EMSP probably need different certificates to call the Hubject Backend
export interface OicpIdentifier extends RoamingIdentifier {
  key?: string;
  cert?: string;
}

export interface OcpiBusinessDetails {
  name: string;
  website: string;
  logo?: {
    url: string;
    thumbnail: string;
    category: string;
    type: string;
    width: string;
    height: string;
  };
}

export interface OicpBusinessDetails {
  name: string;
  website: string;
  logo?: {
    url: string;
    thumbnail: string;
    category: string;
    type: string;
    width: string;
    height: string;
  };
}

export enum AnalyticsSettingsType {
  SAC = 'sac'
}

export interface AnalyticsSettings extends Setting {
  identifier: TenantComponents.ANALYTICS;
  type: AnalyticsSettingsType;
  sac?: SacAnalyticsSetting;
  links: SettingLink[];
}

export interface SacAnalyticsSetting {
  mainUrl: string;
  timezone: string;
}

export enum SmartChargingSettingsType {
  SAP_SMART_CHARGING = 'sapSmartCharging'
}

export interface SmartChargingSettings extends Setting {
  identifier: TenantComponents.SMART_CHARGING;
  type: SmartChargingSettingsType;
  sapSmartCharging?: SapSmartChargingSetting;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SmartChargingSetting {
}

export enum SmartChargingContentType {
  SAP_SMART_CHARGING = 'sapSmartCharging',
}

export interface SapSmartChargingSetting extends SmartChargingSetting {
  optimizerUrl: string;
  user: string;
  password: string;
  stickyLimitation: boolean;
  limitBufferDC: number;
  limitBufferAC: number;
}

export enum RefundSettingsType {
  CONCUR = 'concur',
}

export interface RefundSettings extends Setting {
  identifier: TenantComponents.REFUND;
  type: RefundSettingsType;
  concur?: ConcurRefundSetting;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RefundSetting {
}

export interface ConcurRefundSetting extends RefundSetting {
  authenticationUrl: string;
  apiUrl: string;
  appUrl: string;
  clientId: string;
  clientSecret: string;
  paymentTypeId: string;
  expenseTypeCode: string;
  policyId: string;
  reportName: string;
}

export enum BillingSettingsType {
  STRIPE = 'stripe'
}

export interface BillingSettings extends Setting {
  identifier: TenantComponents.BILLING;
  type: BillingSettingsType;
  billing: BillingSetting;
  stripe?: StripeBillingSetting;
}

export interface BillingSetting {
  isTransactionBillingActivated: boolean;
  immediateBillingAllowed: boolean;
  periodicBillingAllowed: boolean;
  taxID: string;
  usersLastSynchronizedOn?: Date;
}

export interface StripeBillingSetting {
  url: string;
  secretKey: string;
  publicKey: string;
}

export enum BillingContentType {
  STRIPE = 'stripe',
}

export interface AssetSettings extends Setting {
  identifier: TenantComponents.ASSET;
  type: AssetSettingsType;
  asset?: AssetSetting;
}

export enum AssetSettingsType {
  ASSET = 'asset',
}

export interface AssetSetting {
  connections: AssetConnectionSetting[];
}

export interface AssetConnectionSetting {
  id: string;
  name: string;
  description: string;
  url: string;
  timestamp: Date;
  type: AssetConnectionType;
  refreshIntervalMins?: number;
  schneiderConnection?: AssetSchneiderConnectionType;
  greencomConnection?: AssetGreencomConnectionType;
  iothinkConnection?: AssetIothinkConnectionType;
  witConnection?: AssetWitConnectionType;
  lacroixConnection?: AssetLacroixConnectionType
}

export enum AssetConnectionType {
  SCHNEIDER = 'schneider',
  GREENCOM = 'greencom',
  IOTHINK = 'iothink',
  WIT = 'wit',
  LACROIX = 'lacroix'
}

export interface AssetUserPasswordConnectionType {
  user: string;
  password: string;
}

export interface AssetGreencomConnectionType {
  clientId: string;
  clientSecret: string;
}

export type AssetSchneiderConnectionType = AssetUserPasswordConnectionType;

export type AssetIothinkConnectionType = AssetUserPasswordConnectionType;

export type AssetLacroixConnectionType = AssetUserPasswordConnectionType;

export interface AssetWitConnectionType extends AssetUserPasswordConnectionType {
  clientId: string;
  clientSecret: string;
  authenticationUrl: string;
}

export enum CarConnectorSettingsType {
  CAR_CONNECTOR = 'carConnector',
}

export interface CarConnectorSettings extends Setting {
  identifier: TenantComponents.CAR_CONNECTOR;
  type: CarConnectorSettingsType;
  carConnector?: CarConnectorSetting;
}

export interface CarConnectorSetting {
  connections: CarConnectorConnectionSetting[];
}

export interface CarConnectorConnectionSetting {
  id: string;
  name: string;
  description: string;
  timestamp: Date;
  type: CarConnectorConnectionType;
  mercedesConnection?: CarConnectorMercedesConnectionType;
}

export enum CarConnectorConnectionType {
  NONE = '',
  MERCEDES = 'mercedes',
}

export interface CarConnectorMercedesConnectionType {
  authenticationUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
}

export enum CryptoSettingsType {
  CRYPTO = 'crypto'
}

export interface CryptoSettings extends Setting {
  identifier: TechnicalSettings.CRYPTO;
  type: CryptoSettingsType;
  crypto: CryptoSetting;
}

export interface CryptoKeyProperties {
  blockCypher: string;
  blockSize: number;
  operationMode: string;
}

export interface CryptoSetting {
  key: string;
  keyProperties: CryptoKeyProperties;
  formerKey?: string;
  formerKeyProperties?: CryptoKeyProperties;
  migrationToBeDone?: boolean;
}

export enum UserSettingsType {
  USER = 'user',
}

export interface UserSettings extends Setting {
  identifier: TechnicalSettings.USER;
  type: UserSettingsType;
  user?: UserSetting;
}

export interface UserSetting {
  autoActivateAccountAfterValidation: boolean;
}
