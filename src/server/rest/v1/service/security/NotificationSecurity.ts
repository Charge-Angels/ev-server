import { HttpEndUserReportErrorRequest, HttpNotificationRequest } from '../../../../../types/requests/v1/HttpNotificationRequest';

import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class NotificationSecurity {
  static filterNotificationsRequest(request: any): HttpNotificationRequest {
    const filteredRequest: HttpNotificationRequest = {} as HttpNotificationRequest;
    filteredRequest.UserID = sanitize(request.UserID);
    filteredRequest.DateFrom = sanitize(request.DateFrom);
    filteredRequest.Channel = sanitize(request.Channel);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterEndUserReportErrorRequest(request: any): HttpEndUserReportErrorRequest {
    const filteredRequest: HttpEndUserReportErrorRequest = {
      subject:  sanitize(request.subject),
      description: sanitize(request.description),
      mobile: sanitize(request.mobile),
    };
    return filteredRequest;
  }
}

