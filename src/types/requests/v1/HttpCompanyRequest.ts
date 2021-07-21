import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpCompanyRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpCompaniesRequest extends HttpDatabaseRequest {
  Search?: string;
  Issuer?: boolean;
  WithSites?: boolean;
  WithLogo?: boolean;
  LocCoordinates?: number[];
  LocMaxDistanceMeters?: number;
}

export interface HttpCompanyLogoRequest extends HttpCompanyRequest {
  TenantID: string;
}
