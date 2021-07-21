import { HttpSiteAssignUsersRequest, HttpSiteImageRequest, HttpSiteOwnerRequest, HttpSiteRequest, HttpSiteUserAdminRequest, HttpSiteUsersRequest, HttpSitesRequest } from '../../../../../types/requests/v1/HttpSiteRequest';

import Site from '../../../../../types/Site';
import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class SiteSecurity {
  public static filterUpdateSiteUserAdminRequest(request: any): HttpSiteUserAdminRequest {
    const filteredRequest: HttpSiteUserAdminRequest = {
      siteID: sanitize(request.siteID),
      userID: sanitize(request.userID)
    } as HttpSiteUserAdminRequest;
    if ('siteAdmin' in request) {
      filteredRequest.siteAdmin = UtilsSecurity.filterBoolean(request.siteAdmin);
    }
    return filteredRequest;
  }

  public static filterUpdateSiteOwnerRequest(request: any): HttpSiteOwnerRequest {
    const filteredRequest: HttpSiteOwnerRequest = {
      siteID: sanitize(request.siteID),
      userID: sanitize(request.userID)
    } as HttpSiteOwnerRequest;
    if ('siteOwner' in request) {
      filteredRequest.siteOwner = UtilsSecurity.filterBoolean(request.siteOwner);
    }
    return filteredRequest;
  }

  public static filterAssignSiteUsers(request: any): HttpSiteAssignUsersRequest {
    const filteredRequest: HttpSiteAssignUsersRequest = {
      siteID: sanitize(request.siteID)
    } as HttpSiteAssignUsersRequest;
    filteredRequest.userIDs = request.userIDs.map(sanitize);
    UtilsSecurity.filterProject(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSiteRequest(request: any): HttpSiteRequest {
    const filteredRequest: HttpSiteRequest = {
      ID: sanitize(request.ID),
      WithCompany: sanitize(request.WithCompany),
    };
    UtilsSecurity.filterProject(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSiteRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterSiteImageRequest(request: any): HttpSiteImageRequest {
    return {
      ID: sanitize(request.ID),
      TenantID: sanitize(request.TenantID),
    };
  }

  public static filterSiteUsersRequest(request: any): HttpSiteUsersRequest {
    const filteredRequest: HttpSiteUsersRequest = {} as HttpSiteUsersRequest;
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.Search = sanitize(request.Search);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    UtilsSecurity.filterProject(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSitesRequest(request: any): HttpSitesRequest {
    const filteredRequest: HttpSitesRequest = {} as HttpSitesRequest;
    if (Utils.objectHasProperty(request, 'Issuer')) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.UserID = sanitize(request.UserID);
    filteredRequest.CompanyID = sanitize(request.CompanyID);
    filteredRequest.SiteID = sanitize(request.SiteID);
    filteredRequest.ExcludeSitesOfUserID = sanitize(request.ExcludeSitesOfUserID);
    filteredRequest.WithCompany = UtilsSecurity.filterBoolean(request.WithCompany);
    filteredRequest.WithAvailableChargers = UtilsSecurity.filterBoolean(request.WithAvailableChargers);
    if (Utils.containsGPSCoordinates([request.LocLongitude, request.LocLatitude])) {
      filteredRequest.LocCoordinates = [
        Utils.convertToFloat(sanitize(request.LocLongitude)),
        Utils.convertToFloat(sanitize(request.LocLatitude))
      ];
      if (Utils.objectHasProperty(request, 'LocMaxDistanceMeters')) {
        request.LocMaxDistanceMeters = Utils.convertToInt(sanitize(request.LocMaxDistanceMeters));
        if (request.LocMaxDistanceMeters > 0) {
          filteredRequest.LocMaxDistanceMeters = request.LocMaxDistanceMeters;
        }
      }
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    UtilsSecurity.filterProject(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSiteUpdateRequest(request: any): Partial<Site> {
    const filteredRequest = SiteSecurity._filterSiteRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterSiteCreateRequest(request: any): Partial<Site> {
    return SiteSecurity._filterSiteRequest(request);
  }

  public static _filterSiteRequest(request: any): Partial<Site> {
    const filteredRequest = {
      name: sanitize(request.name),
      address: UtilsSecurity.filterAddressRequest(request.address),
      public: UtilsSecurity.filterBoolean(request.public),
      autoUserSiteAssignment: UtilsSecurity.filterBoolean(request.autoUserSiteAssignment),
      companyID: sanitize(request.companyID),
    } as Partial<Site>;
    if (Utils.objectHasProperty(request, 'image')) {
      filteredRequest.image = sanitize(request.image);
    }
    return filteredRequest;
  }
}

