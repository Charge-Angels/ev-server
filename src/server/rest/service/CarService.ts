import { NextFunction, Request, Response } from 'express';
import Authorizations from '../../../authorization/Authorizations';
import AppAuthError from '../../../exception/AppAuthError';
import BackendError from '../../../exception/AppError';
import CarDatabaseFactory from '../../../integration/car/CarDatabaseFactory';
import CarStorage from '../../../storage/mongodb/CarStorage';
import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import TenantComponents from '../../../types/TenantComponents';
import Constants from '../../../utils/Constants';
import CarSecurity from './security/CarSecurity';
import UtilsService from './UtilsService';

const MODULE_NAME = 'CarService';

export default class CarService {
  public static async handleGetCars(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.LIST, Entity.CARS, MODULE_NAME, 'handleGetCars');
    }
    // Check auth
    if (!Authorizations.canListCars(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CARS,
        module: MODULE_NAME,
        method: 'handleGetCars'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarsRequest(req.query);
    // Get the cars
    const cars = await CarStorage.getCars(
      {
        search: filteredRequest.Search,
        carMaker: filteredRequest.CarMaker ? filteredRequest.CarMaker.split('|') : null
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      ['id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
        'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'image', 'chargeStandardChargeSpeed',
        'chargeStandardPower', 'chargeStandardPhase', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'drivetrainPowerHP']
    );
    // Filter
    CarSecurity.filterCarsResponse(cars, req.user);
    // Return
    res.json(cars);
    next();
  }

  public static async handleGetCar(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.READ, Entity.CAR, MODULE_NAME, 'handleGetCars');
    }
    // Check auth
    if (!Authorizations.canReadCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.CAR,
        module: MODULE_NAME,
        method: 'handleGetCar'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetCar', req.user);

    let car;
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Get the car
      car = await CarStorage.getCar(filteredRequest.ID,
        ['id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
          'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'drivetrainPropulsion',
          'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation', 'drivetrainPowerHP',
          'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
          'miscSegment', 'miscIsofixSeats', 'chargeStandardTables', 'chargeStandardPower', 'chargeStandardPhase']);
    } else {
      // Get the car
      car = await CarStorage.getCar(filteredRequest.ID);
    }
    // Return
    res.json(CarSecurity.filterCarResponse(car, req.user));
    next();
  }

  public static async handleGetCarImages(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.READ, Entity.CAR, MODULE_NAME, 'handleGetCarImages');
    }
    // Check auth
    if (!Authorizations.canReadCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CAR,
        module: MODULE_NAME,
        method: 'handleGetCarImages'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarImagesRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.CarID, MODULE_NAME, 'handleGetCarImages', req.user);
    // Get the car
    const carImages = await CarStorage.getCarImages(
      filteredRequest.CarID,
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip }
    );
    // Return
    res.json(carImages);
    next();
  }

  public static async handleSynchronizeCars(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canSynchronizeCars(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.SYNCHRONIZE_CARS,
        entity: Entity.CARS,
        module: MODULE_NAME,
        method: 'handleSynchronizeCars'
      });
    }
    const carDatabaseImpl = await CarDatabaseFactory.getCarDatabaseImpl();
    if (!carDatabaseImpl) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Car service is not configured',
        module: MODULE_NAME,
        method: 'handleSynchronizeCars'
      });
    }
    const result = await carDatabaseImpl.synchronizeCars();
    res.json({ ...result, ...Constants.REST_RESPONSE_SUCCESS });
    next();
  }

  public static async handleGetCarMakers(action: Action, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isSuperAdmin(req.user)) {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.CAR, Action.READ, Entity.CAR, MODULE_NAME, 'handleGetCarMakers');
    }
    // Check auth
    if (!Authorizations.canReadCar(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.CAR,
        module: MODULE_NAME,
        method: 'handleGetCarMakers'
      });
    }
    // Filter
    const filteredRequest = CarSecurity.filterCarMakersRequest(req.query);
    // Get car makers
    const carMakers = await CarStorage.getCarMakers({ search: filteredRequest.Search });
    // Filter
    CarSecurity.filterCarMakersResponse(carMakers, req.user);
    res.json(carMakers);
    next();
  }
}
