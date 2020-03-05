import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import { ChargePointStatus, OCPPFirmwareStatus } from '../../src/types/ocpp/OCPPServer';
import ChargingStationContext from './contextProvider/ChargingStationContext';
import CONTEXTS from './contextProvider/ContextConstants';
import ContextProvider from './contextProvider/ContextProvider';
import SiteAreaContext from './contextProvider/SiteAreaContext';
import SiteContext from './contextProvider/SiteContext';
import TenantContext from './contextProvider/TenantContext';

chai.use(chaiSubset);

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public siteContext: SiteContext;
  public siteAreaContext: SiteAreaContext;
  public chargingStationContext: ChargingStationContext;
}

const testData: TestData = new TestData();

describe('Firmware Update Status Tests', function() {
  this.timeout(1000000); // Will automatically stop test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    await ContextProvider.DefaultInstance.prepareContexts();
  });

  afterEach(() => {
    // Can be called after each UT to clean up created data
  });

  after(async () => {
    // Final cleanup at the end
    await ContextProvider.DefaultInstance.cleanUpCreatedContent();
  });

  describe('With all components (tenant ut-all)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      testData.centralUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.siteContext = testData.tenantContext.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      await testData.chargingStationContext.sendHeartbeat()
    });

    after(async () => {
      await testData.chargingStationContext.cleanUpCreatedData();
    });

    describe('Where any user', () => {

      after(async () => {
        // After tests ensure that the charging station are Idle
        const response = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.IDLE);
        expect(response.data).to.eql({});
      });

      it('An idle Charging station should have the firmwareUpdateStatus set to Idle or be empty', async () => {
        const response = await testData.chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
        expect(response.data.firmwareUpdateStatus).to.satisfy((firmwareUpdateStatus) => {
          if (!firmwareUpdateStatus || firmwareUpdateStatus === OCPPFirmwareStatus.IDLE) {
            return true;
          }
          return false;
        });
      });

      it('Should correctly assign Downloading Status', async () => {
        let response = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.DOWNLOADING);
        expect(response.data).to.eql({});
        response = await testData.chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
        expect(response.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.DOWNLOADING);
      });

      it('Should correctly assign Downloaded Status', async () => {
        let response = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.DOWNLOADED);
        expect(response.data).to.eql({});
        response = await testData.chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
        expect(response.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.DOWNLOADED);
      });

      it('Should correctly assign Download Failed Status', async () => {
        let response = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.DOWNLOAD_FAILED);
        expect(response.data).to.eql({});
        response = await testData.chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
        expect(response.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.DOWNLOAD_FAILED);
      });

      it('Should have the connectors to available before Installing', async () => {
        const response = await testData.chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
        const chargingStation = response.data;
        for (let i = 0; i < chargingStation.connectors.length; i++) {
          expect(chargingStation.connectors[i].status).to.equal(ChargePointStatus.AVAILABLE);
        }
      });

      it('Should correctly assign Installing Status', async () => {
        let response = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.INSTALLING);
        expect(response.data).to.eql({});
        response = await testData.chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
        expect(response.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.INSTALLING);
      });

      it('Should make the connectors unavailable while Installing', async () => {
        const response = await testData.chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
        const chargingStation = response.data;
        for (let i = 0; i < chargingStation.connectors.length; i++) {
          expect(chargingStation.connectors[i].status).to.equal(ChargePointStatus.UNAVAILABLE);
        }
      });

      it('Should correctly assign Installed Status', async () => {
        let response = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.INSTALLED);
        expect(response.data).to.eql({});
        response = await testData.chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
        expect(response.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.INSTALLED);
      });

      it('Should restore the connectors to available after Installing', async () => {
        const response = await testData.chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
        const chargingStation = response.data;
        for (let i = 0; i < chargingStation.connectors.length; i++) {
          expect(chargingStation.connectors[i].status).to.equal('Available');
        }
      });

      it('Should correctly assign Installation Failed Status', async () => {
        let response = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.INSTALLATION_FAILED);
        expect(response.data).to.eql({});
        response = await testData.chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
        expect(response.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.INSTALLATION_FAILED);
      });

      it('Should correctly assign Idle Status', async () => {
        let response = await testData.chargingStationContext.sendFirmwareStatusNotification(OCPPFirmwareStatus.IDLE);
        expect(response.data).to.eql({});
        response = await testData.chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
        expect(response.data.firmwareUpdateStatus).to.equal(OCPPFirmwareStatus.IDLE);
      });

    });

  });

});
