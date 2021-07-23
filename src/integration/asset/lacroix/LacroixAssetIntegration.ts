import Asset, { LacroixPeriods, LacroixResponse } from '../../../types/Asset';
import { AssetConnectionSetting, AssetSetting } from '../../../types/Setting';

import { AbstractCurrentConsumption } from '../../../types/Consumption';
import AssetIntegration from '../AssetIntegration';
import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import Constants from '../../../utils/Constants';
import ConsumptionStorage from '../../../storage/mongodb/ConsumptionStorage';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import Tenant from '../../../types/Tenant';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import Utils from '../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'LacroixAssetIntegration';

export default class LacroixAssetIntegration extends AssetIntegration<AssetSetting> {
  private axiosInstance: AxiosInstance;

  public constructor(tenant: Tenant, settings: AssetSetting, connection: AssetConnectionSetting) {
    super(tenant, settings, connection);
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant.id);
  }

  public async checkConnection(): Promise<void> {
    await this.connect();
  }

  public async retrieveConsumptions(asset: Asset, manualCall: boolean): Promise<AbstractCurrentConsumption[]> {
    // Check if refresh interval of connection is exceeded
    if (!manualCall && !this.checkIfIntervalExceeded(asset)) {
      return [];
    }
    // Check if last consumption available --> if not set it to start of day
    if (Utils.isNullOrUndefined(asset.lastConsumption)) {
      asset.lastConsumption = {
        timestamp: moment().startOf('day').toDate(),
        value: 0
      };
    }
    const timeSinceLastConsumption = moment().diff(asset.lastConsumption.timestamp, 'minutes');
    let period = LacroixPeriods.FIVE_MINUTES;
    if (timeSinceLastConsumption > 5 && timeSinceLastConsumption <= 60) {
      period = LacroixPeriods.ONE_HOUR;
    } else if (timeSinceLastConsumption > 60) {
      period = LacroixPeriods.ONE_DAY;
    }
    const request = manualCall ?
      `${this.connection.url}/${asset.meterID}/getPowerData?period=${LacroixPeriods.LAST}&group_by=1m` :
      `${this.connection.url}/${asset.meterID}/getPowerData?period=${period}&group_by=1m`;
    try {
      // Get consumption
      const response = await this.axiosInstance.get(
        request,
        {
          auth: {
            username: this.connection.lacroixConnection.user,
            password: await Cypher.decrypt(this.tenant.id, this.connection.lacroixConnection.password)
          }
        }
      );
      await Logging.logDebug({
        tenantID: this.tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
        message: `${asset.name} > Lacroix web service has been called successfully`,
        module: MODULE_NAME, method: 'retrieveConsumption',
        detailedMessages: { response: response.data }
      });
      return await this.filterConsumptionRequest(asset, response.data, manualCall);
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'retrieveConsumption',
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
        message: 'Error while retrieving the asset consumption',
        detailedMessages: { request, error: error.stack, asset }
      });
    }
  }

  private async filterConsumptionRequest(asset: Asset, responseData: LacroixResponse, manualCall: boolean): Promise<AbstractCurrentConsumption[]> {
    const consumptions: AbstractCurrentConsumption[] = [];
    // Check returned data and delete consumptions before the last saved asset consumption
    const currentIndex = responseData.data.findIndex((data) => moment(data.date).isSame(asset.lastConsumption.timestamp));
    if (currentIndex >= 0) {
      responseData.data.splice(0, currentIndex);
    }
    // Create consumptions from response
    for (const dataPoint of responseData.data) {
      const consumption = {} as AbstractCurrentConsumption;
      consumption.currentInstantWatts = dataPoint.powerApparentConsumedTotal;
      consumption.currentInstantWattsL1 = dataPoint.powerApparentConsumed1;
      consumption.currentInstantWattsL2 = dataPoint.powerApparentConsumed2;
      consumption.currentInstantWattsL3 = dataPoint.powerApparentConsumed3;
      consumption.currentTotalConsumptionWh = Utils.createDecimal(consumption.currentInstantWatts).mul(60).toNumber();
      consumption.lastConsumption = {
        timestamp: moment(dataPoint.date).toDate(),
        value: consumption.currentTotalConsumptionWh
      };
      consumptions.push(consumption);
    }
    // Check if history needs to be taken into account
    if ((moment().diff(moment(asset.lastConsumption?.timestamp), 'minutes')) > 1) {
      // Get consumptions from charging stations in the missing time period
      const consumptionsDB = await ConsumptionStorage.getSiteAreaChargingStationConsumptions(this.tenant,
        { siteAreaID: asset.siteAreaID, startDate: asset.lastConsumption.timestamp, endDate: consumptions[consumptions.length - 1].lastConsumption.timestamp },
        Constants.DB_PARAMS_MAX_LIMIT, ['instantWatts', 'instantWattsL1','instantWattsL2','instantWattsL3', 'endedAt']);
      for (const consumption of consumptions) {
        const timestamp = consumption.lastConsumption.timestamp;
        // Create consumption with charging station consumption at this time
        const consumptionToSubtract = consumptionsDB.result.find((consumptionDB) =>
          consumptionDB.endedAt.getTime() === timestamp.getTime());
        // Check if consumption is existing and older than one minute
        if (!Utils.isNullOrUndefined(consumptionToSubtract) && (moment().diff(moment(consumption.lastConsumption?.timestamp), 'minutes')) > 1) {
          consumption.currentInstantWatts -= consumptionToSubtract.instantWatts;
          consumption.currentInstantWattsL1 -= consumptionToSubtract.instantWattsL1;
          consumption.currentInstantWattsL2 -= consumptionToSubtract.instantWattsL2;
          consumption.currentInstantWattsL3 -= consumptionToSubtract.instantWattsL3;
        }
      }
    }
    // Get transactions to calculate asset consumption of the current minute
    if (moment().diff(moment(consumptions[consumptions.length - 1].lastConsumption.timestamp), 'minutes') <= 1) {
      const transactionResponse = await TransactionStorage.getTransactions(this.tenant.id, { siteAreaIDs:[asset.siteAreaID],
        stop: { $exists: false } }, Constants.DB_PARAMS_MAX_LIMIT, ['currentInstantWatts', 'currentInstantWattsL1','currentInstantWattsL2','currentInstantWattsL3']);
      for (const transaction of transactionResponse.result) {
        consumptions[consumptions.length - 1].currentInstantWatts -= transaction.currentInstantWatts;
        consumptions[consumptions.length - 1].currentInstantWattsL1 -= transaction.currentInstantWattsL1;
        consumptions[consumptions.length - 1].currentInstantWattsL2 -= transaction.currentInstantWattsL2;
        consumptions[consumptions.length - 1].currentInstantWattsL3 -= transaction.currentInstantWattsL3;
      }
    }
    // Create amperage values
    if (asset.siteArea?.voltage) {
      for (const consumption of consumptions) {
        consumption.currentInstantAmps = Utils.createDecimal(consumption.currentInstantWatts).div(asset.siteArea.voltage).toNumber();
        consumption.currentInstantAmps = Utils.createDecimal(consumption.currentInstantWattsL1).div(asset.siteArea.voltage).toNumber();
        consumption.currentInstantAmps = Utils.createDecimal(consumption.currentInstantWattsL2).div(asset.siteArea.voltage).toNumber();
        consumption.currentInstantAmps = Utils.createDecimal(consumption.currentInstantWattsL3).div(asset.siteArea.voltage).toNumber();
      }
    }
    if (manualCall) {
      return !Utils.isEmptyArray(consumptions) ? [consumptions[consumptions.length - 1]] : [];
    }
    return consumptions;
  }

  private async connect(): Promise<void> {
    // Check if connection is initialized
    this.checkConnectionIsProvided();
    // Get credential params
    const credentials = await this.getCredentialParams();
    // Send request to check if credentials are valid
    await Utils.executePromiseWithTimeout(5000,
      this.axiosInstance.post(`${this.connection.url}/login`,
        credentials,
        {
          'axios-retry': {
            retries: 0
          },
          transformResponse: [
            () => ('###')
          ],
          headers: this.buildFormHeaders(),
        }),
      `Time out error (5s) when getting the token with the connection URL '${this.connection.url}'`
    );
  }

  private checkConnectionIsProvided(): void {
    if (!this.connection) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkConnectionIsProvided',
        action: ServerAction.CHECK_CONNECTION,
        message: 'No connection provided'
      });
    }
  }

  private buildFormHeaders(): any {
    return {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
  }

  private async getCredentialParams(): Promise<URLSearchParams> {
    const params = new URLSearchParams();
    params.append('email', this.connection.lacroixConnection.user);
    params.append('plainPassword', await Cypher.decrypt(this.tenant.id, this.connection.lacroixConnection.password));
    return params;
  }
}
