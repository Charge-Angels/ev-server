import HttpDatabaseRequest, { HttpDatabaseProjectRequest } from './HttpDatabaseRequest';

import HttpByIDRequest from './HttpByIDRequest';

export interface HttpUserRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpSynchronizeUserRequest {
  id?: string;
  email?: string;
}

export interface HttpForceSynchronizeUserInvoicesRequest {
  userID?: string;
}

export interface HttpCreateTransactionInvoiceRequest {
  transactionID?: string;
}

export interface HttpUserMobileTokenRequest {
  id: string;
  mobileToken: string;
  mobileOS: string;
}

export interface HttpUserAssignSitesRequest extends HttpDatabaseProjectRequest {
  userID: string;
  siteIDs: string[];
}

export interface HttpUsersRequest extends HttpDatabaseRequest {
  Issuer: boolean;
  WithTag?: boolean;
  Search: string;
  SiteID: string;
  UserID: string;
  Role: string;
  Status: string;
  ErrorType?: string;
  VisualTagID?: string;
  ExcludeSiteID: string;
  NotAssignedToCarID: string;
}

export interface HttpUsersInErrorRequest extends HttpDatabaseRequest {
  Search: string;
  Role?: string;
  ErrorType?: string;
}

export interface HttpUserSitesRequest extends HttpDatabaseRequest {
  Search: string;
  UserID: string;
}

export interface HttpLoginRequest {
  email: string;
  password: string;
  tenant: string;
  acceptEula: boolean;
}

export interface HttpResetPasswordRequest {
  email: string;
  tenant: string;
  captcha: string;
  password: string;
  hash: string;
}
export interface HttpCheckEulaRequest {
  Email: string;
  Tenant: string;
}
export interface HttpRegisterUserRequest extends HttpLoginRequest {
  name: string;
  firstName: string;
  password: string;
  captcha: string;
  status: string;
  locale: string;
}

export interface HttpVerifyEmailRequest {
  Email: string;
  Tenant: string;
  VerificationToken: string;
}

export interface HttpResendVerificationMailRequest {
  email: string;
  tenant: string;
  captcha: string;
}

export interface HttpEulaRequest {
  Language: string;
}

export interface HttpUserDefaultTagCar {
  UserID: string;
}
