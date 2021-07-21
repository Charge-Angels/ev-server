import HttpStatisticsRequest, { HttpMetricsStatisticsRequest } from '../../../../../types/requests/v1/HttpStatisticRequest';

import Utils from '../../../../../utils/Utils';
import sanitize from 'mongo-sanitize';

export default class StatisticSecurity {
  static filterStatisticsRequest(request: any): HttpStatisticsRequest {
    return {
      Year: Utils.convertToInt(sanitize(request.Year)),
      StartDateTime: request.StartDateTime ? sanitize(request.StartDateTime) : null,
      EndDateTime: request.EndDateTime ? sanitize(request.EndDateTime) : null,
      SiteAreaIDs: request.SiteAreaID ? sanitize(request.SiteAreaID).split('|') : null,
      ChargingStationIDs: request.ChargingStationID ? sanitize(request.ChargingStationID).split('|') : null,
      UserIDs: request.UserID ? sanitize(request.UserID).split('|') : null,
      SiteIDs: request.SiteID ? sanitize(request.SiteID).split('|') : null
    };
  }

  static filterMetricsStatisticsRequest(request: any): HttpMetricsStatisticsRequest {
    return { PeriodInMonth: request.PeriodInMonth ? sanitize(request.PeriodInMonth) : null };
  }

  static filterExportStatisticsRequest(request: any): HttpStatisticsRequest {
    return { ...StatisticSecurity.filterStatisticsRequest(request),
      DataType: sanitize(request.DataType),
      DataCategory: sanitize(request.DataCategory),
      DataScope: sanitize(request.DataScope)
    };
  }
}
