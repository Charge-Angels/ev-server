import HttpDatabaseRequest from './HttpDatabaseRequest';
import RegistrationToken from '../RegistrationToken';

export interface HttpRegistrationTokensRequest extends HttpDatabaseRequest {
  SiteAreaID: string;
}

export interface HttpRegistrationTokensResponse {
  count: number;
  result: RegistrationToken[];
}

