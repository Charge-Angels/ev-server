import { OCPIBusinessDetails } from './OCPIBusinessDetails';
import { OCPIEvse } from './OCPIEvse';

export interface OCPILocation {
  id: string;
  type: OCPILocationType;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  coordinates: {
    latitude: string;
    longitude: string;
  };
  operator?: OCPIBusinessDetails;
  evses: OCPIEvse[];
  last_updated: Date;
}

export enum OCPILocationType {
  ON_STREET = 'ON_STREET',
  PARKING_GARAGE = 'PARKING_GARAGE',
  UNDERGROUND_GARAGE = 'UNDERGROUND_GARAGE',
  PARKING_LOT = 'PARKING_LOT',
  OTHER = 'OTHER',
  UNKNOWN = 'UNKNOWN'
}

export interface OCPILocationReference {
  location_id: string;
  evse_uids: string[];
  connector_ids?: string[];
}

