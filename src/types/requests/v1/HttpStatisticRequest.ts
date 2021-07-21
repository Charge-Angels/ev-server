import { StatsDataCategory, StatsDataScope, StatsDataType } from '../Statistic';

export default interface HttpStatisticsRequest {
  Year?: number;
  StartDateTime?: Date;
  EndDateTime?: Date;
  SiteID?: string;
  SiteIDs?: string[];
  PeriodInMonth?: string|number;
  SiteAreaID?: string;
  SiteAreaIDs?: string[];
  ChargingStationID?: string;
  ChargingStationIDs?: string[];
  UserID?: string;
  UserIDs?: string[];
  DataType?: StatsDataType;
  DataCategory?: StatsDataCategory;
  DataScope?: StatsDataScope;
}

export interface HttpMetricsStatisticsRequest {
  PeriodInMonth: number;
}
