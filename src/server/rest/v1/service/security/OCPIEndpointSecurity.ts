import { HttpOCPIEndpointsRequest } from '../../../../../types/requests/v1/HttpOCPIEndpointRequest';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class OCPIEndpointSecurity {
  static filterOcpiEndpointDeleteRequest(request: any): HttpOCPIEndpointsRequest {
    const filteredRequest: HttpOCPIEndpointsRequest = {} as HttpOCPIEndpointsRequest;
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterOcpiEndpointRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterOcpiEndpointsRequest(request: any): HttpOCPIEndpointsRequest {
    const filteredRequest: HttpOCPIEndpointsRequest = {} as HttpOCPIEndpointsRequest;
    filteredRequest.Search = sanitize(request.Search);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterOcpiEndpointUpdateRequest(request: any): Partial<OCPIEndpoint> {
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiEndpointCreateRequest(request: any): Partial<OCPIEndpoint> {
    return OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
  }

  static filterOcpiEndpointPingRequest(request: any): OCPIEndpoint {
    return OCPIEndpointSecurity._filterOcpiEndpointRequest(request) as OCPIEndpoint;
  }

  static filterOcpiEndpointTriggerJobRequest(request: any): Partial<OCPIEndpoint> {
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiEndpointSendEVSEStatusesRequest(request: any): Partial<OCPIEndpoint> {
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiCheckCdrsRequest(request: any): Partial<OCPIEndpoint> {
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiCheckSessionsRequest(request: any): Partial<OCPIEndpoint> {
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiCheckLocationsRequest(request: any): Partial<OCPIEndpoint> {
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiEndpointSendTokensRequest(request: any): Partial<OCPIEndpoint> {
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiEndpointRegisterRequest(request: any): Partial<OCPIEndpoint> {
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterOcpiEndpointGenerateLocalTokenRequest(request: any): Partial<OCPIEndpoint> {
    const filteredRequest = OCPIEndpointSecurity._filterOcpiEndpointRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static _filterOcpiEndpointRequest(request: any): Partial<OCPIEndpoint> {
    const filteredRequest: Partial<OCPIEndpoint> = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.role = sanitize(request.role);
    filteredRequest.baseUrl = sanitize(request.baseUrl);
    filteredRequest.countryCode = sanitize(request.countryCode);
    filteredRequest.partyId = sanitize(request.partyId);
    filteredRequest.localToken = sanitize(request.localToken);
    filteredRequest.token = sanitize(request.token);
    filteredRequest.backgroundPatchJob = sanitize(request.backgroundPatchJob);
    return filteredRequest;
  }
}

