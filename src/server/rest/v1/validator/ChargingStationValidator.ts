import { HttpChargingProfilesRequest, HttpChargingStationCommandRequest, HttpChargingStationConnectorRequest, HttpChargingStationGetFirmwareRequest, HttpChargingStationLimitPowerRequest, HttpChargingStationOcppParametersRequest, HttpChargingStationOcppRequest, HttpChargingStationParamsUpdateRequest, HttpChargingStationRequest, HttpChargingStationsInErrorRequest, HttpChargingStationsRequest, HttpDownloadQrCodeRequest, HttpTriggerSmartChargingRequest } from '../../../../types/requests/v1/HttpChargingStationRequest';

import { ChargingProfile } from '../../../../types/ChargingProfile';
import HttpDatabaseRequest from '../../../../types/requests/v1/HttpDatabaseRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class ChargingStationValidator extends SchemaValidator {
  private static instance: ChargingStationValidator | null = null;
  private chargingStationsGet: Schema;
  private chargingStationGet: Schema;
  private chargingStationDelete: Schema;
  private chargingStationAction: Schema;
  private chargingStationQRCodeGenerate: Schema;
  private chargingStationQRCodeDownload: Schema;
  private chargingStationOcppParametersGet: Schema;
  private chargingStationRequestOCPPParameters: Schema;
  private chargingStationUpdateParameters: Schema;
  private chargingStationLimitPower: Schema;
  private chargingStationFirmwareDownload: Schema;
  private smartChargingTrigger: Schema;
  private chargingStationInErrorGet: Schema;
  private chargingProfileCreate: Schema;
  private chargingProfilesGet: Schema;
  private chargingProfileDelete: Schema;
  private chargingProfileUpdate: Schema;
  private chargingStationNotificationsGet: Schema;

  private constructor() {
    super('ChargingStationValidator');
    this.chargingStationsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstations-get.json`, 'utf8'));
    this.chargingStationGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-get.json`, 'utf8'));
    this.chargingStationDelete = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-delete.json`, 'utf8'));
    this.chargingStationAction = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action.json`, 'utf8'));
    this.chargingStationQRCodeGenerate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-qrcode-generate.json`, 'utf8'));
    this.chargingStationQRCodeDownload = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-qrcode-download.json`, 'utf8'));
    this.chargingStationOcppParametersGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-ocpp-parameters-get.json`, 'utf8'));
    this.chargingStationRequestOCPPParameters = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-ocpp-request-parameters.json`, 'utf8'));
    this.chargingStationUpdateParameters = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-update-parameters.json`, 'utf8'));
    this.chargingStationLimitPower = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-limit-power.json`, 'utf8'));
    this.chargingStationFirmwareDownload = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-firmware-download.json`, 'utf8'));
    this.smartChargingTrigger = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/smartcharging-trigger.json`, 'utf8'));
    this.chargingStationInErrorGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstations-inerror-get.json`, 'utf8'));
    this.chargingProfileCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingprofile-create.json`, 'utf8'));
    this.chargingProfilesGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingprofiles-get.json`, 'utf8'));
    this.chargingProfileDelete = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingprofile-delete.json`, 'utf8'));
    this.chargingProfileUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingprofile-update.json`, 'utf8'));
    this.chargingStationNotificationsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-notifications.json`, 'utf8'));
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

  public validateChargingStationDeleteReq(data: any): HttpChargingStationRequest {
    // Validate schema
    this.validate(this.chargingStationDelete, data);
    return data;
  }

  public validateChargingStationActionReq(data: HttpChargingStationCommandRequest): HttpChargingStationCommandRequest {
    // Validate schema
    this.validate(this.chargingStationAction, data);
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

  public validateChargingStationFirmwareDownloadReq(data: any): HttpChargingStationGetFirmwareRequest {
    // Validate schema
    this.validate(this.chargingStationFirmwareDownload, data);
    return data;
  }

  public validateSmartChargingTriggerReq(data: any): HttpTriggerSmartChargingRequest {
    // Validate schema
    this.validate(this.smartChargingTrigger, data);
    return data;
  }

  public validateChargingStationInErrorReq(data: any): HttpChargingStationsInErrorRequest {
    // Validate schema
    this.validate(this.chargingStationInErrorGet, data);
    return data;
  }

  public validateChargingStationNotificationsGetReq(data: any): HttpDatabaseRequest {
    // Validate schema
    this.validate(this.chargingStationNotificationsGet, data);
    return data;
  }

  public validateChargingProfilesGetReq(data: any): HttpChargingProfilesRequest {
    // Validate schema
    this.validate(this.chargingProfilesGet, data);
    return data;
  }

  public validateChargingProfileCreateReq(data: ChargingProfile): ChargingProfile {
    // Validate schema
    this.validate(this.chargingProfileCreate, data);
    return data;
  }

  public validateChargingProfileDeleteReq(data: any): HttpChargingStationRequest {
    // Validate schema
    this.validate(this.chargingProfileDelete, data);
    return data;
  }

  public validateChargingProfileUpdateReq(data: any): ChargingProfile {
    // Validate schema
    this.validate(this.chargingProfileUpdate, data);
    return data;
  }
}
