import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpSettingRequest extends HttpByIDRequest {
  ContentFilter: boolean;
}

export interface HttpSettingsRequest extends HttpDatabaseRequest {
  Identifier?: string;
  ContentFilter?: boolean;
}
