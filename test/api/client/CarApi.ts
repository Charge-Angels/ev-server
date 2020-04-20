import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class CarApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.read({ CarID: id }, '/client/api/Car');
  }

  public async readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Cars');
  }

  public async readCarMakers(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/CarMakers');
  }

  public async readCarImages(id) {
    return super.read({ CarID: id }, '/client/api/CarImages');
  }

}
