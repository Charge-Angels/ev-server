import ChargingStation, { Voltage } from '../types/ChargingStation';

import Address from './Address';
import ConnectorStats from './ConnectorStats';
import Consumption from './Consumption';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { OpeningTimes } from './OpeningTimes';
import Site from '../types/Site';
import { SiteAreaAuthorizationActions } from './Authorization';

export enum SiteAreaValueTypes {
  ASSET_CONSUMPTIONS = 'AssetConsumptions',
  ASSET_PRODUCTIONS = 'AssetProductions',
  CHARGING_STATION_CONSUMPTIONS = 'ChargingStationConsumptions',
  NET_CONSUMPTIONS = 'NetConsumptions'
}

export interface SiteAreaValues {
  assetConsumptions: Consumption[];
  assetProductions: Consumption[];
  chargingStationConsumptions: Consumption[];
  netConsumptions: Consumption[];
}

export default interface SiteArea extends CreatedUpdatedProps, SiteAreaAuthorizationActions {
  id: string;
  name: string;
  issuer: boolean;
  maximumPower: number;
  voltage: Voltage;
  numberOfPhases: number;
  address: Address;
  image: string;
  siteID: string;
  site: Site;
  smartCharging: boolean;
  accessControl: boolean;
  chargingStations: ChargingStation[];
  connectorStats: ConnectorStats;
  values: SiteAreaValues;
  distanceMeters?: number;
  openingTimes?: OpeningTimes;
}
