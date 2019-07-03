import HttpByIDRequest from "./HttpByIDRequest";
import HttpDatabaseRequest from "./HttpDatabaseRequest";
import User from "../User";

export interface HttpUserRequest extends Partial<User> {
  name: string;
  passwords: {password?: string}
}

export interface HttpSitesAssignUserRequest {
  userID: string;
  siteIDs: string[];
}

export interface HttpUsersRequest extends HttpDatabaseRequest {
  Search: string;
  SiteID: string;
  Role: string;
  Status: string;
  ExcludeSiteID: string;
}

export interface HttpIsAuthorizedRequest {
  Action: string;
  Arg1: any;
  Arg2: any;
  Arg3: any;
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
  hash: string;
}

export interface HttpRegisterUserRequest extends HttpLoginRequest {
  name: string;//Used in frontend thus in request
  lastName: string;//Used in backend
  firstName: string;
  captcha: string;
  status: string;
  passwords: {password: string}; //frontend... 
}

export interface HttpVerifyEmailRequest {
  Email:string;
  tenant: string;
  VerificationToken: string;
}

export interface HttpResendVerificationMailRequest {
  email: string;
  tenant: string;
  captcha: string;
}