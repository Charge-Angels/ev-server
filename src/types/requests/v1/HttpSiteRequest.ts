import HttpDatabaseRequest, { HttpDatabaseProjectRequest } from './HttpDatabaseRequest';

import HttpByIDRequest from './HttpByIDRequest';

export interface HttpSiteRequest extends HttpByIDRequest {
  ID: string;
  WithCompany?: boolean;
}

export interface HttpSitesRequest extends HttpDatabaseRequest {
  Search: string;
  Issuer: boolean;
  WithAvailableChargers: boolean;
  WithCompany: boolean;
  UserID: string;
  CompanyID: string;
  SiteID: string;
  ExcludeSitesOfUserID: boolean;
  LocCoordinates?: number[];
  LocMaxDistanceMeters?: number;
}

export interface HttpSiteImageRequest extends HttpByIDRequest {
  ID: string;
  TenantID: string;
}

export interface HttpSiteAssignUsersRequest extends HttpDatabaseProjectRequest {
  siteID: string;
  userIDs: string[];
}

export interface HttpSiteUserAdminRequest {
  userID: string;
  siteID: string;
  siteAdmin: boolean;
}

export interface HttpSiteOwnerRequest {
  userID: string;
  siteID: string;
  siteOwner: boolean;
}

export interface HttpSiteUsersRequest extends HttpDatabaseRequest {
  Search: string;
  SiteID: string;
}

