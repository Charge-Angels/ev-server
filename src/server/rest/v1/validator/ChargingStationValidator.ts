import { HttpChargingStationCommandRequest, HttpChargingStationConnectorRequest, HttpChargingStationLimitPowerRequest, HttpChargingStationOcppParametersRequest, HttpChargingStationOcppRequest, HttpChargingStationParamsUpdateRequest, HttpChargingStationRequest, HttpChargingStationsRequest, HttpDownloadQrCodeRequest } from '../../../../types/requests/HttpChargingStationRequest';

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
