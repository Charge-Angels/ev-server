import { HttpAssetConsumptionRequest, HttpAssetImageRequest, HttpAssetRequest, HttpAssetsRequest } from '../../../../../types/requests/v1/HttpAssetRequest';

import Asset from '../../../../../types/Asset';
import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class AssetSecurity {

  public static filterAssetRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterAssetImageRequest(request: any): HttpAssetImageRequest {
    return {
      ID: sanitize(request.ID),
      TenantID: sanitize(request.TenantID),
    };
  }

  public static filterAssetRequest(request: any): HttpAssetRequest {
    return {
      ID: sanitize(request.ID),
      WithSiteArea: UtilsSecurity.filterBoolean(request.WithSiteArea)
    } as HttpAssetRequest;
  }

  public static filterAssetsRequest(request: any): HttpAssetsRequest {
    const filteredRequest: HttpAssetsRequest = {
      Search: sanitize(request.Search),
      SiteAreaID: sanitize(request.SiteAreaID),
      SiteID: sanitize(request.SiteID),
      WithSiteArea: UtilsSecurity.filterBoolean(request.WithSiteArea),
      WithNoSiteArea: UtilsSecurity.filterBoolean(request.WithNoSiteArea),
      DynamicOnly: UtilsSecurity.filterBoolean(request.DynamicOnly),
      ErrorType: sanitize(request.ErrorType)
    } as HttpAssetsRequest;
    if (Utils.objectHasProperty(request, 'Issuer')) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterAssetUpdateRequest(request: any): Partial<Asset> {
    const filteredRequest = AssetSecurity._filterAssetRequest(request);
    return {
      id: sanitize(request.id),
      ...filteredRequest
    };
  }

  public static filterAssetCreateRequest(request: any): Partial<Asset> {
    return AssetSecurity._filterAssetRequest(request);
  }

  public static filterAssetConsumptionRequest(request: any): HttpAssetConsumptionRequest {
    return {
      AssetID: sanitize(request.AssetID),
      StartDate: sanitize(request.StartDate),
      EndDate: sanitize(request.EndDate)
    };
  }

  private static _filterAssetRequest(request: any): Partial<Asset> {
    const filteredRequest: Partial<Asset> = {};
    filteredRequest.name = sanitize(request.name),
    filteredRequest.siteAreaID = sanitize(request.siteAreaID),
    filteredRequest.assetType = sanitize(request.assetType),
    filteredRequest.excludeFromSmartCharging = UtilsSecurity.filterBoolean(sanitize(request.excludeFromSmartCharging));
    filteredRequest.variationThresholdPercent = sanitize(request.variationThresholdPercent),
    filteredRequest.fluctuationPercent = sanitize(request.fluctuationPercent),
    filteredRequest.staticValueWatt = sanitize(request.staticValueWatt),
    filteredRequest.image = request.image;
    filteredRequest.dynamicAsset = UtilsSecurity.filterBoolean(request.dynamicAsset);
    filteredRequest.usesPushAPI = UtilsSecurity.filterBoolean(request.usesPushAPI);
    if (Utils.objectHasProperty(request, 'coordinates') && !Utils.isEmptyArray(request.coordinates) && request.coordinates.length === 2) {
      filteredRequest.coordinates = [
        sanitize(request.coordinates[0]),
        sanitize(request.coordinates[1])
      ];
    }
    if (Utils.objectHasProperty(request, 'dynamicAsset')) {
      filteredRequest.connectionID = sanitize(request.connectionID);
      filteredRequest.meterID = sanitize(request.meterID);
    }
    return filteredRequest;
  }
}
