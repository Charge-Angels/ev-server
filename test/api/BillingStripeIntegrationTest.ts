import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import StripeIntegrationTestData from './BillingStripeTestData';
import chai from 'chai';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

const testData: StripeIntegrationTestData = new StripeIntegrationTestData();

describe('Billing Stripe Service', function() {
  // Do not run the tests when the settings are not properly set
  this.pending = !testData.isBillingProperlyConfigured();
  this.timeout(1000000);

  describe('With component Billing (tenant utbilling)', () => {
    before(async () => {
      global.database = new MongoDBStorage(config.get('storage'));
      await global.database.start();
      await testData.initialize();
    });

    describe('immediate billing OFF', () => {
      before(async () => {
        const immediateBilling = false;
        await testData.forceBillingSettings(immediateBilling);
      });

      after(async () => {
        // Cleanup of the utbilling tenant is useless
        // Anyway, there is no way to cleanup the utbilling stripe account!
      });

      it('Should add a payment method to BILLING-TEST user', async () => {
        await testData.assignPaymentMethod('tok_visa');
      });

      it('should create and pay a first invoice for BILLING-TEST user', async () => {
        await testData.checkBusinessProcessBillToPay();
      });

    });

    describe('immediate billing ON', () => {
      before(async () => {
        /* ------------------------------------------------------
          Billing settings are forced to check the complete flow
          Invoice State - DRAFT => OPEN => PAID
          -------------------------------------------------------*/
        const immediateBilling = true;
        await testData.forceBillingSettings(immediateBilling);
      });

      it('Should add a different payment method to BILLING-TEST user', async () => {
        await testData.assignPaymentMethod('tok_fr');
      });

      it('should create and pay a second invoice for BILLING-TEST user', async () => {
        await testData.checkImmediateBillingWithTaxes();
      });

    });

  });

});
