import { HttpRegistrationTokensRequest } from '../../../../../types/requests/v1/HttpRegistrationToken';
import RegistrationToken from '../../../../../types/RegistrationToken';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class RegistrationTokenSecurity {
  public static filterRegistrationTokenCreateRequest(request: any): Partial<RegistrationToken> {
    return {
      description: sanitize(request.description),
      siteAreaID: sanitize(request.siteAreaID),
      expirationDate: sanitize(request.expirationDate)
    };
  }

  public static filterRegistrationTokenUpdateRequest(request: any): Partial<RegistrationToken> {
    return {
      id: sanitize(request.id),
      description: sanitize(request.description),
      siteAreaID: sanitize(request.siteAreaID),
      expirationDate: sanitize(request.expirationDate)
    };
  }

  public static filterRegistrationTokenByIDRequest(request: any): string {
    return sanitize(request.ID);
  }

  static filterRegistrationTokensRequest(request: any): HttpRegistrationTokensRequest {
    const filteredRequest = {
      SiteAreaID: sanitize(request.SiteAreaID)
    };

    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest as HttpRegistrationTokensRequest;
  }
}
