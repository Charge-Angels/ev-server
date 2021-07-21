import { CarConverter, CarType } from '../Car';

import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpCarCatalogsRequest extends HttpDatabaseRequest {
  Search?: string;
  CarMaker?: string;
}

export interface HttpCarMakersRequest extends HttpDatabaseRequest {
  Search?: string;
}

export interface HttpCarCatalogImagesRequest extends HttpByIDRequest, HttpDatabaseRequest {
  ID: number;
}

export interface HttpCarCatalogRequest extends HttpByIDRequest {
  ID: number;
}

export interface HttpCarRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpCarCreateRequest {
  id?: string;
  vin: string;
  licensePlate: string;
  carCatalogID: number;
  forced?: boolean;
  type: CarType;
  converter?: CarConverter;
  userID: string;
  default: boolean;
}

export interface HttpCarUpdateRequest {
  id?: string;
  vin: string;
  licensePlate: string;
  carCatalogID: number;
  forced?: boolean;
  type: CarType;
  converter?: CarConverter;
  userID: string;
  default: boolean;
}

export interface HttpCarsRequest extends HttpDatabaseRequest {
  Search: string;
  CarMaker: string;
  WithUser: boolean;
  UserID: string;
}
