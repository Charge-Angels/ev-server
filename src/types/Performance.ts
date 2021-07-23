import { ServerAction } from './Server';

export default interface PerformanceRecord {
  id?: string;
  tenantID: string;
  timestamp?: Date;
  durationMs?: number;
  sizeKb?: number;
  host: string;
  process: string;
  processMemoryUsage: NodeJS.MemoryUsage;
  processCPUUsage: NodeJS.CpuUsage;
  numberOfCPU: number;
  modelOfCPU: string;
  memoryTotalGb: number;
  memoryFreeGb: number;
  loadAverageLastMin: number;
  numberOfChargingStations?: number;
  source: string;
  module: string;
  method: string;
  action: ServerAction|string;
  httpUrl?: string;
  httpMethod?: string;
  httpCode?: number;
  chargingStationID?: string;
  userID?: string;
  parentID?: string;
  group?: PerformanceRecordGroup;
}

export enum PerformanceRecordGroup {
  MONGO_DB = 'mongo-db',
  OCPP = 'ocpp',
  OCPI = 'ocpi',
  OICP = 'oicp',
  REST = 'rest',
  GREENCOM = 'greencom',
  STRIPE = 'stripe',
  RECAPTCHA = 'recaptcha',
  IOTHINK = 'iothink',
  LACROIX = 'lacroix',
  EV_DATABASE = 'ev-database',
  WIT = 'wit',
  SAP_SMART_CHARGING = 'sap-smart-charging',
  SAP_CONCUR = 'sap-concur',
  UNKNOWN = 'unknown',
}
