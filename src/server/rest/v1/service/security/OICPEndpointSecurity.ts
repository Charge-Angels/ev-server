import { HttpOICPEndpointsRequest } from '../../../../../types/requests/v1/HttpOICPEndpointRequest';
import OICPEndpoint from '../../../../../types/oicp/OICPEndpoint';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class OICPEndpointSecurity {
  public static filterOicpEndpointDeleteRequest(request: any): HttpOICPEndpointsRequest {
    const filteredRequest: HttpOICPEndpointsRequest = {} as HttpOICPEndpointsRequest;
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  public static filterOicpEndpointRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterOicpEndpointUpdateRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterOicpEndpointCreateRequest(request: any): Partial<OICPEndpoint> {
    return OICPEndpointSecurity.filterOicpEndpointRequest(request);
  }

  public static filterOicpEndpointsRequest(request: any): Partial<HttpOICPEndpointsRequest> {
    const filteredRequest: Partial<HttpOICPEndpointsRequest> = {
      Search: sanitize(request.Search)
    };
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterOicpEndpointPingRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterOicpEndpointSendEVSEStatusesRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterOicpEndpointSendEVSEsRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterOicpEndpointRegisterRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest = OICPEndpointSecurity.filterOicpEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  private static filterOicpEndpointRequest(request: any): Partial<OICPEndpoint> {
    const filteredRequest: Partial<OICPEndpoint> = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.role = sanitize(request.role);
    filteredRequest.baseUrl = sanitize(request.baseUrl);
    filteredRequest.countryCode = sanitize(request.countryCode);
    filteredRequest.partyId = sanitize(request.partyId);
    filteredRequest.backgroundPatchJob = sanitize(request.backgroundPatchJob);
    return filteredRequest;
  }
}
