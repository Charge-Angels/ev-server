/* eslint-disable @typescript-eslint/no-misused-promises */
import { ServerAction, ServerRoute } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import ChargingStationService from '../../service/ChargingStationService';
import RouterUtils from '../../../RouterUtils';
import TransactionService from '../../service/TransactionService';

export default class ChargingStationRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteChargingStationsInError();
    this.buildRouteChargingStationsExport();
    this.buildRouteChargingStationGetChargingProfiles();
    this.buildRouteChargingStationRequestOCPPParameters();
    this.buildRouteChargingStationDownloadFirmware();
    this.buildRouteChargingStationDeleteChargingProfile();
    this.buildRouteChargingStationUpdateChargingProfile();
    this.buildRouteChargingStationCreateChargingProfile();
    this.buildRouteChargingStationChangeAvailability();
    this.buildRouteChargingStationTransactions();
    this.buildRouteChargingStations();
    this.buildRouteChargingStation();
    this.buildRouteChargingStationDelete();
    this.buildRouteChargingStationReset();
    this.buildRouteChargingStationClearCache();
    this.buildRouteChargingStationRetrieveConfiguration();
    this.buildRouteChargingStationChangeConfiguration();
    this.buildRouteChargingStationRemoteStart();
    this.buildRouteChargingStationRemoteStop();
    this.buildRouteChargingStationUnlockConnector();
    this.buildRouteChargingStationGenerateQRCode();
    this.buildRouteChargingStationGetCompositeSchedule();
    this.buildRouteChargingStationGetDiagnostics();
    this.buildRouteChargingStationUpdateFirmware();
    this.buildRouteChargingStationDownloadQRCode();
    this.buildRouteChargingStationGetOCPPParameters();
    this.buildRouteChargingStationExportOCPPParameters();
    this.buildRouteChargingStationUpdateParameters();
    this.buildRouteChargingStationLimitPower();
    this.buildRouteChargingStationCheckSmartCharging();
    this.buildRouteChargingStationTriggerSmartCharging();
    this.buildRouteChargingStationGetBootNotifications();
    this.buildRouteChargingStationGetStatusNotifications();
    return this.router;
  }

  protected buildRouteChargingStations(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleGetChargingStations.bind(this), ServerAction.CHARGING_STATIONS, req, res, next);
    });
  }

  protected buildRouteChargingStation(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleGetChargingStation.bind(this), ServerAction.CHARGING_STATION, req, res, next);
    });
  }

  protected buildRouteChargingStationDelete(): void {
    this.router.delete(`/${ServerRoute.REST_CHARGING_STATIONS}/:id`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleDeleteChargingStation.bind(this), ServerAction.CHARGING_STATION_DELETE, req, res, next);
    });
  }

  protected buildRouteChargingStationReset(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_RESET}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleAction.bind(this), ServerAction.CHARGING_STATION_RESET, req, res, next);
    });
  }

  protected buildRouteChargingStationClearCache(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_CACHE_CLEAR}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleAction.bind(this), ServerAction.CHARGING_STATION_CLEAR_CACHE, req, res, next);
    });
  }

  protected buildRouteChargingStationRetrieveConfiguration(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_RETRIEVE_CONFIGURATION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleAction.bind(this), ServerAction.CHARGING_STATION_GET_CONFIGURATION, req, res, next);
    });
  }

  protected buildRouteChargingStationChangeConfiguration(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_CHANGE_CONFIGURATION}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleAction.bind(this), ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION, req, res, next);
    });
  }

  protected buildRouteChargingStationRemoteStart(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_REMOTE_START}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleAction.bind(this), ServerAction.CHARGING_STATION_REMOTE_START_TRANSACTION, req, res, next);
    });
  }

  protected buildRouteChargingStationRemoteStop(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_REMOTE_STOP}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleAction.bind(this), ServerAction.CHARGING_STATION_REMOTE_STOP_TRANSACTION, req, res, next);
    });
  }

  protected buildRouteChargingStationUnlockConnector(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_UNLOCK_CONNECTOR}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      req.body.args = { ...req.body.args, connectorId: req.params.connectorId };
      await RouterUtils.handleServerAction(ChargingStationService.handleAction.bind(this), ServerAction.CHARGING_STATION_UNLOCK_CONNECTOR, req, res, next);
    });
  }

  protected buildRouteChargingStationGetCompositeSchedule(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_GET_COMPOSITE_SCHEDULE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleAction.bind(this), ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE, req, res, next);
    });
  }

  protected buildRouteChargingStationGetDiagnostics(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_GET_DIAGNOSTICS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleAction.bind(this), ServerAction.CHARGING_STATION_GET_DIAGNOSTICS, req, res, next);
    });
  }

  protected buildRouteChargingStationUpdateFirmware(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_FIRMWARE_UPDATE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleAction.bind(this), ServerAction.CHARGING_STATION_UPDATE_FIRMWARE, req, res, next);
    });
  }

  protected buildRouteChargingStationChangeAvailability(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_CHANGE_AVAILABILITY}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleAction.bind(this), ServerAction.CHARGING_STATION_CHANGE_AVAILABILITY, req, res, next);
    });
  }

  protected buildRouteChargingStationGenerateQRCode(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS_QRCODE_GENERATE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ChargingStationID = req.params.id;
      req.query.ConnectorID = req.params.connectorId;
      await RouterUtils.handleServerAction(ChargingStationService.handleGenerateQrCodeForConnector.bind(this), ServerAction.GENERATE_QR_CODE_FOR_CONNECTOR, req, res, next);
    });
  }

  protected buildRouteChargingStationDownloadQRCode(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS_QRCODE_DOWNLOAD}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleDownloadQrCodesPdf.bind(this), ServerAction.CHARGING_STATION_DOWNLOAD_QR_CODE_PDF, req, res, next);
    });
  }

  protected buildRouteChargingStationGetOCPPParameters(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATION_GET_OCPP_PARAMETERS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ChargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleGetChargingStationOcppParameters.bind(this),
        ServerAction.CHARGING_STATIONS_OCPP_PARAMETERS, req, res, next);
    });
  }

  protected buildRouteChargingStationRequestOCPPParameters(): void {
    this.router.post(`/${ServerRoute.REST_CHARGING_STATIONS_REQUEST_OCPP_PARAMETERS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleRequestChargingStationOcppParameters.bind(this),
        ServerAction.CHARGING_STATION_REQUEST_OCPP_PARAMETERS, req, res, next);
    });
  }

  protected buildRouteChargingStationExportOCPPParameters(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS_EXPORT_OCPP_PARAMETERS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleExportChargingStationsOCPPParams.bind(this),
        ServerAction.CHARGING_STATIONS_OCPP_PARAMS_EXPORT, req, res, next);
    });
  }

  protected buildRouteChargingStationUpdateParameters(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_UPDATE_PARAMETERS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleUpdateChargingStationParams.bind(this), ServerAction.CHARGING_STATION_UPDATE_PARAMS, req, res, next);
    });
  }

  protected buildRouteChargingStationLimitPower(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_STATIONS_POWER_LIMIT}`, async (req: Request, res: Response, next: NextFunction) => {
      req.body.chargingStationID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleChargingStationLimitPower.bind(this), ServerAction.CHARGING_STATION_LIMIT_POWER, req, res, next);
    });
  }

  protected buildRouteChargingStationTransactions(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS_TRANSACTIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ChargingStationID = req.params.id;
      await RouterUtils.handleServerAction(TransactionService.handleGetChargingStationTransactions.bind(this), ServerAction.CHARGING_STATION_TRANSACTIONS, req, res, next);
    });
  }

  protected buildRouteChargingStationsInError(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS_IN_ERROR}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleGetChargingStationsInError.bind(this), ServerAction.CHARGING_STATIONS_IN_ERROR, req, res, next);
    });
  }

  protected buildRouteChargingStationsExport(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS_EXPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleExportChargingStations.bind(this), ServerAction.CHARGING_STATIONS_EXPORT, req, res, next);
    });
  }

  protected buildRouteChargingStationDownloadFirmware(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS_DOWNLOAD_FIRMWARE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleGetFirmware.bind(this), ServerAction.FIRMWARE_DOWNLOAD, req, res, next);
    });
  }

  protected buildRouteChargingStationCheckSmartCharging(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATION_CHECK_SMART_CHARGING_CONNECTION}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleCheckSmartChargingConnection.bind(this), ServerAction.CHECK_SMART_CHARGING_CONNECTION, req, res, next);
    });
  }

  protected buildRouteChargingStationTriggerSmartCharging(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATION_TRIGGER_SMART_CHARGING}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleTriggerSmartCharging.bind(this), ServerAction.TRIGGER_SMART_CHARGING, req, res, next);
    });
  }

  protected buildRouteChargingStationGetChargingProfiles(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_PROFILES}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleGetChargingProfiles.bind(this), ServerAction.CHARGING_PROFILES, req, res, next);
    });
  }

  protected buildRouteChargingStationCreateChargingProfile(): void {
    this.router.post(`/${ServerRoute.REST_CHARGING_PROFILES}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleCreateChargingProfile.bind(this), ServerAction.CHARGING_PROFILE_CREATE, req, res, next);
    });
  }

  protected buildRouteChargingStationUpdateChargingProfile(): void {
    this.router.put(`/${ServerRoute.REST_CHARGING_PROFILE}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleUpdateChargingProfile.bind(this), ServerAction.CHARGING_PROFILE_UPDATE, req, res, next);
    });
  }

  protected buildRouteChargingStationDeleteChargingProfile(): void {
    this.router.delete(`/${ServerRoute.REST_CHARGING_PROFILE}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleServerAction(ChargingStationService.handleDeleteChargingProfile.bind(this), ServerAction.CHARGING_PROFILE_DELETE, req, res, next);
    });
  }

  protected buildRouteChargingStationGetBootNotifications(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS_BOOT_NOTIFICATIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleGetBootNotifications.bind(this), ServerAction.BOOT_NOTIFICATIONS, req, res, next);
    });
  }

  protected buildRouteChargingStationGetStatusNotifications(): void {
    this.router.get(`/${ServerRoute.REST_CHARGING_STATIONS_STATUS_NOTIFICATIONS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleServerAction(ChargingStationService.handleGetStatusNotifications.bind(this), ServerAction.STATUS_NOTIFICATIONS, req, res, next);
    });
  }
}
