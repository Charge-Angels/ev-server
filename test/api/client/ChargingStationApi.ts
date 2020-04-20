import { expect } from 'chai';
import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class ChargingStationApi extends CrudApi {

  private _baseApi;

  public constructor(authenticatedApi, baseApi) {
    super(authenticatedApi);
    // Keep it
    this._baseApi = baseApi;
  }

  public async readById(id) {
    return super.readById(id, '/client/api/ChargingStation');
  }

  public async readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/ChargingStations');
  }

  public async readAllInError(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/ChargingStationsInError');
  }

  public async update(data) {
    return super.update(data, '/client/api/ChargingStationUpdateParams');
  }

  public async delete(id) {
    return super.delete(id, '/client/api/ChargingStationDelete');
  }

  public async readConfiguration(chargeBoxID) {
    return super.read({ ChargeBoxID: chargeBoxID }, '/client/api/ChargingStationOcppParameters');
  }

  public async readConsumptionStatistics(year) {
    return super.read({ Year: year }, '/client/api/ChargingStationConsumptionStatistics');
  }

  public async readUsageStatistics(year) {
    return super.read({ Year: year }, '/client/api/ChargingStationUsageStatistics');
  }

  public async readAllTransactions(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/ChargingStationTransactions');
  }

  public async readAllYears(params) {
    return super.readAll(params, Constants.DEFAULT_PAGING, Constants.DEFAULT_ORDERING, '/client/api/TransactionYears');
  }

  public async isAuthorized(action: string, chargingStationId: string, transactionId?: string) {
    const params = {
      'Action': action,
      'Arg1': chargingStationId,
      'Arg2': transactionId
    };
    return await super.read(params, '/client/api/IsAuthorized');
  }

  public async updateParams(data) {
    return super.update(data, '/client/api/ChargingStationUpdateParams');
  }

  public async checkConnector(chargingStation, connectorId, connectorData) {
    // Check
    expect(chargingStation).to.not.be.null;
    // Always remove the timestamp
    delete connectorData.timestamp;
    // Retrieve it from the backend
    const response = await this.readById(chargingStation.id);
    // Check if ok
    expect(response.status).to.equal(200);
    expect(response.data.id).is.eql(chargingStation.id);
    // Check Connector
    const foundChargingStation = response.data;
    // Check
    expect(foundChargingStation.connectors).to.not.be.null;
    expect(foundChargingStation.connectors[connectorId - 1]).to.include(connectorData);
  }
}
