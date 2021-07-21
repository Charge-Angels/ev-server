import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpOICPEndpointsRequest extends HttpDatabaseRequest{
  ID?: string;
  Search?: string;
}
