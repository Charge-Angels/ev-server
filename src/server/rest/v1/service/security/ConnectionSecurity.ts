import Connection from '../../../../../types/Connection';
import { HttpConnectionsRequest } from '../../../../../types/requests/v1/HttpConnectionRequest';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class ConnectionSecurity {
  public static filterConnectionDeleteRequest(request: any): Connection {
    const filteredRequest: Connection = {} as Connection;
    // Set
    filteredRequest.userId = sanitize(request.userId);
    filteredRequest.connectorId = sanitize(request.connectorId);
    return filteredRequest;
  }

  public static filterConnectionRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterConnectionsRequest(request: any): HttpConnectionsRequest {
    const filteredRequest: HttpConnectionsRequest = {
      UserID: sanitize(request.UserID)
    } as HttpConnectionsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterConnectionUpdateRequest(request: any): Connection {
    const filteredRequest = ConnectionSecurity.filterConnectionRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterConnectionCreateRequest(request: any): Connection {
    return ConnectionSecurity.filterConnectionRequest(request);
  }

  private static filterConnectionRequest(request: any): Connection {
    return {
      connectorId: sanitize(request.connectorId),
      userId: sanitize(request.userId),
      data: sanitize(request.data),
    };
  }
}

