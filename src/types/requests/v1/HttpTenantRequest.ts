import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpTenantVerifyRequest {
  tenant: string;
}

export interface HttpTenantRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpTenantsRequest extends HttpDatabaseRequest {
  Search?: string;
  WithLogo?: boolean;
  WithComponents?: boolean;
}

export interface HttpTenantLogoRequest {
  ID?: string;
  Subdomain?: string;
}
