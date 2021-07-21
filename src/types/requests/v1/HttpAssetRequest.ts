import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpAssetRequest extends HttpByIDRequest {
  ID: string;
  WithSiteArea?: boolean;
}

export interface HttpAssetsRequest extends HttpDatabaseRequest {
  Issuer?: boolean;
  Search?: string;
  SiteAreaID?: string;
  SiteID?: string;
  WithSiteArea?: boolean;
  WithNoSiteArea?: boolean;
  DynamicOnly?: boolean;
  ErrorType?: string;
}

export interface HttpAssetConsumptionRequest {
  AssetID: string;
  StartDate: Date;
  EndDate: Date;
}

export interface HttpAssetImageRequest extends HttpByIDRequest {
  ID: string;
  TenantID: string;
}
