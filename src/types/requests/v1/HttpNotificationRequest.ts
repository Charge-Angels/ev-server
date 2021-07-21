import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpNotificationRequest extends HttpDatabaseRequest {
  UserID: string;
  DateFrom: Date;
  Channel: string;
}

export interface HttpEndUserReportErrorRequest {
  subject: string;
  description: string;
  mobile: string;
}
