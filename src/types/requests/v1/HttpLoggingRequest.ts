import { LogLevel, LogType } from '../Log';

import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpLogRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpLogsRequest extends HttpDatabaseRequest {
  Search?: string;
  StartDateTime: Date;
  EndDateTime: Date;
  Level: LogLevel;
  Source: string;
  Host: string;
  SortDate: string;
  Type: LogType;
  Action: string;
  UserID: string;
}
