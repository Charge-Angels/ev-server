import { HttpLogRequest, HttpLogsRequest } from '../../../../../types/requests/v1/HttpLoggingRequest';

import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class LoggingSecurity {
  static filterLogsRequest(request: any): HttpLogsRequest {
    const filteredRequest = {} as HttpLogsRequest;
    // Get logs
    filteredRequest.StartDateTime = sanitize(request.StartDateTime);
    filteredRequest.EndDateTime = sanitize(request.EndDateTime);
    filteredRequest.Level = sanitize(request.Level);
    filteredRequest.Source = sanitize(request.Source);
    filteredRequest.Host = sanitize(request.Host);
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.SortDate = sanitize(request.SortDate);
    filteredRequest.Type = sanitize(request.Type);
    filteredRequest.Action = sanitize(request.Action);
    filteredRequest.UserID = sanitize(request.UserID);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterLogRequest(request: any): HttpLogRequest {
    return {
      ID: sanitize(request.ID)
    };
  }
}

