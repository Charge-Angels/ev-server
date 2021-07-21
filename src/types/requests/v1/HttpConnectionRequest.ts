import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpConnectionsRequest extends HttpDatabaseRequest {
  UserID?: string;
}
