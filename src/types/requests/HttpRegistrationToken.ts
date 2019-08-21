import RegistrationToken from '../RegistrationToken';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpRegistrationTokenRequest {
  description: string;
  siteAreaID: string;
  expirationDate: Date;
}

export interface HttpRegistrationTokensRequest extends HttpDatabaseRequest {
  siteAreaID: string;
}

export interface HttpRegistrationTokensResponse {
  count: number;
  result: RegistrationToken[];
}

