import HttpDatabaseRequest from '../v1/HttpDatabaseRequest';

export interface HttpUsersRequest extends HttpDatabaseRequest {
  Issuer: boolean;
  WithTag?: boolean;
  Search: string;
  SiteID: string;
  UserID: string;
  Role: string;
  UserStatus: string;
  Status: string;
  ErrorType?: string;
  TagID?: string;
  ExcludeSiteID: string;
  NotAssignedToCarID: string;
}
