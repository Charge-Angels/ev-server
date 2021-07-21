import { HttpCarCatalogImagesRequest, HttpCarCatalogRequest, HttpCarCatalogsRequest, HttpCarCreateRequest, HttpCarMakersRequest, HttpCarRequest, HttpCarUpdateRequest, HttpCarsRequest } from '../../../../../types/requests/v1/HttpCarRequest';

import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class CarSecurity {

  public static filterCarMakersRequest(request: any): HttpCarMakersRequest {
    const filteredRequest: HttpCarMakersRequest = {
      Search: sanitize(request.Search),
    } as HttpCarMakersRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarCatalogsRequest(request: any): HttpCarCatalogsRequest {
    const filteredRequest: HttpCarCatalogsRequest = {
      Search: sanitize(request.Search),
      CarMaker: sanitize(request.CarMaker),
    } as HttpCarCatalogsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarCatalogImagesRequest(request: any): HttpCarCatalogImagesRequest {
    const filteredRequest: HttpCarCatalogImagesRequest = {
      ID: sanitize(request.ID),
    } as HttpCarCatalogImagesRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarCatalogRequest(request: any): HttpCarCatalogRequest {
    return {
      ID: Utils.convertToInt(sanitize(request.ID)),
    };
  }

  public static filterCarCreateRequest(request: any): HttpCarCreateRequest {
    return {
      vin: sanitize(request.vin),
      licensePlate: sanitize(request.licensePlate),
      carCatalogID: Utils.convertToInt(sanitize(request.carCatalogID)),
      forced: UtilsSecurity.filterBoolean(request.forced),
      type: sanitize(request.type),
      userID: sanitize(request.userID),
      default: UtilsSecurity.filterBoolean(request.isDefault),
      converter: {
        amperagePerPhase: sanitize(request.converter.amperagePerPhase),
        numberOfPhases: sanitize(request.converter.numberOfPhases),
        type: sanitize(request.converter.type),
        powerWatts: sanitize(request.converter.powerWatts)
      },
    };
  }

  public static filterCarUpdateRequest(request: any): HttpCarUpdateRequest {
    const filteredRequest: HttpCarUpdateRequest = {
      id: sanitize(request.id),
      vin: sanitize(request.vin),
      licensePlate: sanitize(request.licensePlate),
      carCatalogID: Utils.convertToInt(sanitize(request.carCatalogID)),
      type: sanitize(request.type),
      userID: sanitize(request.userID),
      default: UtilsSecurity.filterBoolean(request.isDefault),
      converter: {
        amperagePerPhase: sanitize(request.converter.amperagePerPhase),
        numberOfPhases: sanitize(request.converter.numberOfPhases),
        type: sanitize(request.converter.type),
        powerWatts: sanitize(request.converter.powerWatts)
      },
    };
    return filteredRequest;
  }

  public static filterCarsRequest(request: any): HttpCarsRequest {
    const filteredRequest: HttpCarsRequest = {
      Search: sanitize(request.Search),
      CarMaker: sanitize(request.CarMaker),
      WithUser: UtilsSecurity.filterBoolean(request.WithUser),
      UserID: sanitize(request.UserID)
    } as HttpCarsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterCarRequest(request: any): HttpCarRequest {
    const filteredRequest: HttpCarRequest = {
      ID: sanitize(request.ID),
    } as HttpCarRequest;
    return filteredRequest;
  }
}
