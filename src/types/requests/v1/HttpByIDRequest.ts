import { HttpDatabaseProjectRequest } from './HttpDatabaseRequest';

export default interface HttpByIDRequest extends HttpDatabaseProjectRequest {
  ID: string | number;
}
