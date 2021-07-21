import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpOCPIEndpointsRequest extends HttpDatabaseRequest{
  ID?: string;
  Search?: string;
}
