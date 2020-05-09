import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import { DataResult } from '../../../../types/DataResult';
import { Log } from '../../../../types/Log';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpLogsRequest } from '../../../../types/requests/HttpLoggingRequest';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';

export default class LoggingSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterLoggingsRequest(request: any): HttpLogsRequest {
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

  // eslint-disable-next-line no-unused-vars
  static filterLoggingRequest(request: any): HttpByIDRequest {
    return {
      ID: sanitize(request.ID)
    };
  }

  static filterLoggingResponse(logging, loggedUser: UserToken, withDetailedMessage = false): Log {
    const filteredLogging: any = {};

    if (!logging) {
      return null;
    }
    if (!Authorizations.canReadLogging(loggedUser)) {
      return null;
    }
    filteredLogging.id = logging.id;
    filteredLogging.level = logging.level;
    filteredLogging.timestamp = logging.timestamp;
    filteredLogging.type = logging.type;
    filteredLogging.source = logging.source;
    filteredLogging.host = logging.host;
    filteredLogging.process = logging.process;
    filteredLogging.userFullName = logging.userFullName;
    filteredLogging.action = logging.action;
    filteredLogging.message = logging.message;
    filteredLogging.module = logging.module;
    filteredLogging.method = logging.method;
    filteredLogging.hasDetailedMessages = (logging.detailedMessages && logging.detailedMessages.length > 0);
    if (withDetailedMessage) {
      filteredLogging.detailedMessages = logging.detailedMessages;
    }
    if (logging.user && typeof logging.user === 'object') {
      // Build user
      filteredLogging.user = Utils.buildUserFullName(logging.user, false);
    }
    if (logging.actionOnUser && typeof logging.actionOnUser === 'object') {
      // Build user
      filteredLogging.actionOnUser = Utils.buildUserFullName(logging.actionOnUser, false);
    }
    return filteredLogging;
  }

  static filterLoggingsResponse(logs: DataResult<Log>, loggedUser): void {
    const filteredLogs = [];
    if (!logs.result) {
      return null;
    }
    for (const logging of logs.result) {
      // Filter
      const filteredLogging = LoggingSecurity.filterLoggingResponse(logging, loggedUser);
      // Ok?
      if (filteredLogging) {
        // Add
        filteredLogs.push(filteredLogging);
      }
    }
    logs.result = filteredLogs;
  }
}

