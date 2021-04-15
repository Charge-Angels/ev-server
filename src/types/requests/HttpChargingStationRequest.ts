import { ChargePoint, ConnectorType, CurrentType, PhaseAssignmentToGrid, Voltage } from '../ChargingStation';

import { ChargingRateUnitType } from '../ChargingProfile';
import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import { OCPPAvailabilityType } from '../ocpp/OCPPClient';

export interface HttpTriggerSmartChargingRequest {
  SiteAreaID: string;
}

export interface HttpChargingStationLimitPowerRequest {
  chargeBoxID: string;
  chargePointID: number;
  ampLimitValue: number;
  forceUpdateChargingPlan: boolean;
}

export interface HttpChargingProfilesRequest extends HttpDatabaseRequest {
  Search?: string;
  ChargingStationID?: string;
  ConnectorID?: number;
  WithChargingStation?: boolean;
  WithSiteArea?: boolean;
  SiteID?: string;
}

export interface HttpDownloadQrCodeRequest {
  ChargingStationID?: string;
  ConnectorID?: number;
  SiteID?: string;
  SiteAreaID?: string;
}

export interface HttpChargingStationsRequest extends HttpDatabaseRequest {
  Issuer?: boolean;
  Search?: string;
  WithNoSiteArea?: boolean;
  ConnectorStatus?: string;
  ConnectorType?: string;
  ChargingStationID?: string;
  SiteID?: string;
  WithSite?: boolean;
  SiteAreaID?: string;
  IncludeDeleted?: boolean;
  ErrorType?: string;
  LocCoordinates?: number[];
  LocMaxDistanceMeters?: number;
}

export interface HttpChargingStationParamsUpdateRequest {
  id: string;
  chargingStationURL: string;
  maximumPower: number;
  public: boolean;
  excludeFromSmartCharging: boolean;
  forceInactive: boolean;
  manualConfiguration: boolean;
  siteAreaID: string;
  coordinates: number[];
  chargePoints: ChargePoint[];
  connectors: {
    connectorId: number;
    chargePointID: number;
    type: ConnectorType;
    power: number;
    amperage: number;
    voltage: Voltage;
    currentType: CurrentType;
    numberOfConnectedPhase: number;
    phaseAssignmentToGrid: PhaseAssignmentToGrid;
  }[];
}

export type HttpChargingStationRequest = HttpByIDRequest;

export interface HttpChargingStationOcppRequest {
  ChargeBoxID: string;
}

export interface HttpChargingStationConnectorRequest {
  ChargingStationID: string;
  ConnectorID: number;
}

export interface HttpChargingStationOcppParametersRequest {
  chargeBoxID: string;
  forceUpdateOCPPParamsFromTemplate: boolean;
}

export interface HttpChargingStationSetMaxIntensitySocketRequest extends HttpChargingStationCommandRequest {
  maxIntensity?: number;
  args?: {maxIntensity: number};
}

export interface HttpChargingStationCommandRequest {
  chargeBoxID: string;
  carID?: string;
  args?: any;
}

export interface HttpIsAuthorizedRequest {
  Action: string;
  Arg1: any;
  Arg2: any;
  Arg3: any;
}

export interface HttpChargingStationGetFirmwareRequest {
  FileName: string;
}

export interface HttpChargingStationResetRequest extends HttpChargingStationCommandRequest {
  type: 'Soft' | 'Hard';
}

export interface HttpChargingStationGetOcppConfigurationRequest extends HttpChargingStationCommandRequest {
  type: 'Soft' | 'Hard';
  args: {
    key: string[];
  }
}

export interface HttpChargingStationUpdateOcppConfigurationRequest extends HttpChargingStationCommandRequest {
  type: 'Soft' | 'Hard';
  args: {
    key: string;
    value: string;
  }
}


export interface HttpChargingStationRemoteStartRequest extends HttpChargingStationCommandRequest {
  cardID: string;
  args: {
    tagID: string;
    connectorId: number;
  }
}

export interface HttpChargingStationRemoteStopRequest extends HttpChargingStationCommandRequest {
  args: {
    transactionId: string;
  }
}

export interface HttpChargingStationUnlockConnectorRequest extends HttpChargingStationCommandRequest {
  connectorId: string;
}

export interface HttpChargingStationGetCompositeScheduleRequest extends HttpChargingStationCommandRequest {
  args: {
    connectorId: number;
    duration: number;
    chargingRateUnit: ChargingRateUnitType
  }
}

export interface HttpChargingStationGetDiagnosticsRequest extends HttpChargingStationCommandRequest {
  args: {
    location: string;
    retries: number;
    retryInterval: number,
    startTime: string;
    stopTime: string;
  }
}

export interface HttpChargingStationUpdateFirmwareRequest extends HttpChargingStationCommandRequest {
  args: {
    location: string;
    retries: number;
    retryInterval: number,
    retrieveDate: string;
  }
}

export interface HttpChargingStationChangeAvailabilityRequest extends HttpChargingStationCommandRequest {
  args: {
    connectorId: number;
    type: OCPPAvailabilityType
  }
}
