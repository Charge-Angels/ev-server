import { HttpChargingStationConnectorRequest, HttpChargingStationGetDiagnosticsRequest, HttpChargingStationGetOcppConfigurationRequest, HttpChargingStationLimitPowerRequest, HttpChargingStationOcppParametersRequest, HttpChargingStationOcppRequest, HttpChargingStationParamsUpdateRequest, HttpChargingStationRemoteStartRequest, HttpChargingStationRemoteStopRequest, HttpChargingStationRequest, HttpChargingStationResetRequest, HttpChargingStationUnlockConnectorRequest, HttpChargingStationUpdateFirmwareRequest, HttpChargingStationUpdateOcppConfigurationRequest, HttpChargingStationsRequest, HttpDownloadQrCodeRequest } from '../../../../types/requests/HttpChargingStationRequest';

import { ChargingProfile } from '../../../../types/ChargingProfile';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class ChargingStationValidator extends SchemaValidator {
  private static instance: ChargingStationValidator|null = null;
  private chargingStationsGet: Schema;
  private chargingStationGet: Schema;
  private chargingStationDelete: Schema;
  private chargingStationReset: Schema;
  private chargingStationOcppConfigurationGet: Schema;
  private chargingStationOcppConfigurationUpdate: Schema;
  private chargingStationRemoteStart: Schema;
  private chargingStationRemoteStop: Schema;
  private chargingStationUnlockConnector: Schema;
  private chargingStationGetCompositeSchedule: Schema;
  private chargingStationGetDiagnostics: Schema;
  private chargingStationFirmwareUpdate: Schema;
  private chargingStationAvailabilityChange: Schema;
  private chargingStationAction: Schema;
  private chargingStationQRCodeGenerate: Schema;
  private chargingStationQRCodeDownload: Schema;
  private chargingStationOcppParametersGet: Schema;
  private chargingProfileCreate: Schema;
  private chargingStationRequestOCPPParameters: Schema;
  private chargingStationUpdateParameters: Schema;
  private chargingStationLimitPower: Schema;


  private constructor() {
    super('ChargingStationValidator');
    this.chargingStationsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstations-get.json`, 'utf8'));
    this.chargingStationGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-get.json`, 'utf8'));
    this.chargingStationDelete = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-delete.json`, 'utf8'));
    this.chargingStationReset = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/actions/chargingstation-reset.json`, 'utf8'));
    this.chargingStationOcppConfigurationGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/actions/chargingstation-get-ocpp-configuration.json`, 'utf8'));
    this.chargingStationOcppConfigurationUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/actions/chargingstation-update-ocpp-configuration.json`, 'utf8'));
    this.chargingStationRemoteStart = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/actions/chargingstation-remote-start.json`, 'utf8'));
    this.chargingStationRemoteStop = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/actions/chargingstation-remote-stop.json`, 'utf8'));
    this.chargingStationUnlockConnector = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/actions/chargingstation-unlock-connector.json`, 'utf8'));
    this.chargingStationGetCompositeSchedule = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/actions/chargingstation-get-composite-schedule.json`, 'utf8'));
    this.chargingStationGetDiagnostics = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/actions/chargingstation-get-diagnostics.json`, 'utf8'));
    this.chargingStationFirmwareUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/actions/chargingstation-update-firmware.json`, 'utf8'));
    this.chargingStationAvailabilityChange = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/actions/chargingstation-change-availability.json`, 'utf8'));
    this.chargingStationAction = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action.json`, 'utf8'));
    this.chargingStationQRCodeGenerate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-qrcode-generate.json`, 'utf8'));
    this.chargingStationQRCodeDownload = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-qrcode-download.json`, 'utf8'));
    this.chargingStationOcppParametersGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-ocpp-parameters-get.json`, 'utf8'));
    this.chargingProfileCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingprofile-create.json`, 'utf8'));
    this.chargingStationRequestOCPPParameters = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-ocpp-request-parameters.json`, 'utf8'));
    this.chargingStationUpdateParameters = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-update-parameters.json`, 'utf8'));
    this.chargingStationLimitPower = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-limit-power.json`, 'utf8'));
  }

  public static getInstance(): ChargingStationValidator {
    if (!ChargingStationValidator.instance) {
      ChargingStationValidator.instance = new ChargingStationValidator();
    }
    return ChargingStationValidator.instance;
  }

  public validateChargingStationsGetReq(data: any): HttpChargingStationsRequest {
    // Validate schema
    this.validate(this.chargingStationsGet, data);
    return data;
  }

  public validateChargingStationGetReq(data: any): HttpChargingStationRequest {
    // Validate schema
    this.validate(this.chargingStationGet, data);
    return data;
  }

  public validateChargingStationDeleteReq(data: any): HttpByIDRequest {
    // Validate schema
    this.validate(this.chargingStationDelete, data);
    return data;
  }

  public validateChargingStationResetReq(data: any): HttpChargingStationResetRequest {
    // Validate schema
    this.validate(this.chargingStationReset, data);
    return data;
  }

  public validateChargingStationGetOcppConfigurationReq(data: any): HttpChargingStationGetOcppConfigurationRequest {
    // Validate schema
    this.validate(this.chargingStationOcppConfigurationGet, data);
    return data;
  }

  public validateChargingStationUpdateOcppConfigurationReq(data: any): HttpChargingStationUpdateOcppConfigurationRequest {
    // Validate schema
    this.validate(this.chargingStationOcppConfigurationUpdate, data);
    return data;
  }

  public validateChargingStationRemoteStartReq(data: any): HttpChargingStationRemoteStartRequest {
    // Validate schema
    this.validate(this.chargingStationRemoteStart, data);
    return data;
  }

  public validateChargingStationRemoteStopReq(data: any): HttpChargingStationRemoteStopRequest {
    // Validate schema
    this.validate(this.chargingStationRemoteStop, data);
    return data;
  }

  public validateChargingStationUnlockConnectorReq(data: any): HttpChargingStationUnlockConnectorRequest {
    // Validate schema
    this.validate(this.chargingStationUnlockConnector, data);
    return data;
  }

  public validateChargingStationGetCompositeScheduleReq(data: any): HttpChargingStationUnlockConnectorRequest {
    // Validate schema
    this.validate(this.chargingStationGetCompositeSchedule, data);
    return data;
  }

  public validateChargingStationGetDiagnosticsReq(data: any): HttpChargingStationGetDiagnosticsRequest {
    // Validate schema
    this.validate(this.chargingStationGetDiagnostics, data);
    return data;
  }

  public validateChargingStationUpdateFirmwareReq(data: any): HttpChargingStationUpdateFirmwareRequest {
    // Validate schema
    this.validate(this.chargingStationFirmwareUpdate, data);
    return data;
  }

  public validateChargingStationChangeAvailabilityReq(data: any): HttpChargingStationUpdateFirmwareRequest {
    // Validate schema
    this.validate(this.chargingStationAvailabilityChange, data);
    return data;
  }

  public validateChargingStationQRCodeGenerateReq(data: any): HttpChargingStationConnectorRequest {
    // Validate schema
    this.validate(this.chargingStationQRCodeGenerate, data);
    return data;
  }

  public validateChargingStationQRCodeDownloadReq(data: HttpDownloadQrCodeRequest): HttpDownloadQrCodeRequest {
    // Validate schema
    this.validate(this.chargingStationQRCodeDownload, data);
    return data;
  }

  public validateChargingStationOcppParametersGetReq(data: any): HttpChargingStationOcppRequest {
    // Validate schema
    this.validate(this.chargingStationOcppParametersGet, data);
    return data;
  }


  public validateChargingProfileCreateReq(data: ChargingProfile): ChargingProfile {
    // Validate schema
    this.validate(this.chargingProfileCreate, data);
    return data;
  }

  public validateChargingStationRequestOCPPParametersReq(data: any): HttpChargingStationOcppParametersRequest {
    // Validate schema
    this.validate(this.chargingStationRequestOCPPParameters, data);
    return data;
  }

  public validateChargingStationUpdateParametersReq(data: any): HttpChargingStationParamsUpdateRequest {
    // Validate schema
    this.validate(this.chargingStationUpdateParameters, data);
    return data;
  }

  public validateChargingStationLimitPowerReq(data: any): HttpChargingStationLimitPowerRequest {
    // Validate schema
    this.validate(this.chargingStationLimitPower, data);
    return data;
  }
}
