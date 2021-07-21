import { HttpAssignAssetsToSiteAreaRequest, HttpAssignChargingStationToSiteAreaRequest, HttpSiteAreaConsumptionsRequest, HttpSiteAreaImageRequest, HttpSiteAreaRequest, HttpSiteAreasRequest } from '../../../../../types/requests/v1/HttpSiteAreaRequest';

import SiteArea from '../../../../../types/SiteArea';
import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class SiteAreaSecurity {

  public static filterSiteAreaRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterSiteImageRequest(request: any): HttpSiteAreaImageRequest {
    return {
      ID: sanitize(request.ID),
      TenantID: sanitize(request.TenantID),
    };
  }

  public static filterAssignAssetsToSiteAreaRequest(request: any): HttpAssignAssetsToSiteAreaRequest {
    return {
      siteAreaID: sanitize(request.siteAreaID),
      assetIDs: request.assetIDs?.map(sanitize)
    };
  }

  public static filterAssignChargingStationsToSiteAreaRequest(request: any): HttpAssignChargingStationToSiteAreaRequest {
    return {
      siteAreaID: sanitize(request.siteAreaID),
      chargingStationIDs: request.chargingStationIDs?.map(sanitize)
    };
  }

  public static filterSiteAreaRequest(request: any): HttpSiteAreaRequest {
    // Filter request
    return {
      ID: sanitize(request.ID),
      WithChargingStations: !request.WithChargeBoxes ? false : sanitize(request.WithChargingStations),
      WithSite: !request.WithSite ? false : sanitize(request.WithSite)
    } as HttpSiteAreaRequest;
  }

  public static filterSiteAreasRequest(request: any): HttpSiteAreasRequest {
    const filteredRequest: HttpSiteAreasRequest = {
      Search: sanitize(request.Search),
      WithSite: !request.WithSite ? false : UtilsSecurity.filterBoolean(request.WithSite),
      WithChargeBoxes: !request.WithChargeBoxes ? false : UtilsSecurity.filterBoolean(request.WithChargeBoxes),
      WithAvailableChargers: !request.WithAvailableChargers ? false : UtilsSecurity.filterBoolean(request.WithAvailableChargers),
      SiteID: sanitize(request.SiteID),
      CompanyID: sanitize(request.CompanyID)
    } as HttpSiteAreasRequest;
    if (Utils.objectHasProperty(request, 'Issuer')) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
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
    return filteredRequest;
  }

  public static filterSiteAreaConsumptionRequest(request: any): HttpSiteAreaConsumptionsRequest {
    return {
      SiteAreaID: sanitize(request.SiteAreaID),
      StartDate: sanitize(request.StartDate),
      EndDate: sanitize(request.EndDate)
    };
  }

  public static filterSiteAreaUpdateRequest(request: any): Partial<SiteArea> {
    return {
      id: sanitize(request.id),
      ...SiteAreaSecurity._filterSiteAreaRequest(request)
    };
  }

  public static filterSiteAreaCreateRequest(request: any): Partial<SiteArea> {
    return SiteAreaSecurity._filterSiteAreaRequest(request);
  }

  private static _filterSiteAreaRequest(request: any): Partial<SiteArea> {
    const filteredRequest = {
      name: sanitize(request.name),
      address: UtilsSecurity.filterAddressRequest(request.address),
      maximumPower: sanitize(request.maximumPower),
      numberOfPhases: sanitize(request.numberOfPhases),
      voltage: sanitize(request.voltage),
      smartCharging: UtilsSecurity.filterBoolean(request.smartCharging),
      accessControl: UtilsSecurity.filterBoolean(request.accessControl),
      siteID: sanitize(request.siteID)
    } as Partial<SiteArea>;
    if (Utils.objectHasProperty(request, 'image')) {
      filteredRequest.image = sanitize(request.image);
    }
    return filteredRequest;
  }
}
