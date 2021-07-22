import chai, { assert, expect } from 'chai';

import CentralServerService from '../api/client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { HTTPError } from '../../src/types/HTTPError';
import { ServerRoute } from '../../src/types/Server';
import SiteContext from './context/SiteContext';
import { StartTransactionErrorCode } from '../../src/types/Transaction';
import { StatusCodes } from 'http-status-codes';
import Tag from '../../src/types/Tag';
import TenantContext from './context/TenantContext';
import TestUtils from './TestUtils';
import User from '../../src/types/User';
import chaiSubset from 'chai-subset';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);


class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userContext: any;
  public userService: CentralServerService;
  public siteContext: SiteContext;
  public newUser: User;
  public newTag: Tag;
  public createdUsers: any[] = [];
  public createdTags: any[] = [];
  public siteAreaContext: any;
  public chargingStationContext: ChargingStationContext;
  public tagsToImport: any;
  public importedTags: Tag[];
}

const testData: TestData = new TestData();

describe('User', function() {
  this.timeout(1000000); // Will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    await ContextProvider.defaultInstance.prepareContexts();
  });

  afterEach(() => {
    // Can be called after each UT to clean up created data
  });

  after(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With component Organization (utorg)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_ORGANIZATION);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT);
      testData.centralUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.centralUserContext
      );
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
    });

    after(async () => {
      // Delete any created user
      for (const user of testData.createdUsers) {
        await testData.centralUserService.deleteEntity(
          testData.centralUserService.userApi,
          user,
          false
        );
      }
      testData.createdUsers = [];
      // Delete any created tag
      for (const tag of testData.createdTags) {
        await testData.centralUserService.userApi.deleteTag(tag.id);

      }
      testData.createdTags = [];
    });

    describe('Where admin user', () => {
      before(() => {
        testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        assert(testData.userContext, 'User context cannot be null');
        if (testData.userContext === testData.centralUserContext) {
          // Reuse the central user service (to avoid double login)
          testData.userService = testData.centralUserService;
        } else {
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
        }
        assert(!!testData.userService, 'User service cannot be null');
      });

      describe('Using various basic APIs', () => {

        it('Should have accepted the Eula', async () => {
          // Send
          const response = await testData.userService._baseApi.send({
            method: 'GET',
            url: '/v1/auth/' + ServerRoute.REST_END_USER_LICENSE_AGREEMENT_CHECK + `?Email=${testData.userContext.email}&Tenant=${testData.tenantContext.getTenant().subdomain}`,
            headers: {
              'Content-Type': 'application/json'
            }
          });
          expect(response.status).to.equal(StatusCodes.OK);
          expect(response.data).not.null;
          expect(response.data).to.have.property('eulaAccepted');
          expect(response.data.eulaAccepted).to.eql(true);
        });

        it('Should be able to create a new user', async () => {
          // Create
          testData.newUser = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build()
          );
          testData.newUser.issuer = true;
          delete testData.newUser['password'];
          testData.createdUsers.push(testData.newUser);
        });

        it('Should find the created user in the auto-assign site', async () => {
          // Checks if the sites to which the new user is assigned contains the auto-assign site
          await testData.userService.checkEntityInListWithParams(
            testData.userService.siteApi,
            testData.siteContext.getSite(),
            { 'UserID': testData.newUser.id }
          );
        });

        it('Should find the created user by id', async () => {
          // Check if the created entity can be retrieved with its id
          await testData.userService.getEntityById(
            testData.userService.userApi,
            testData.newUser
          );
        });

        it('Should find the created user in the user list', async () => {
          // Check if the created entity is in the list
          await testData.userService.checkEntityInList(
            testData.userService.userApi,
            testData.newUser
          );
        });

        it('Should be able to update the user', async () => {
          // Change entity
          testData.newUser.name = 'NEW NAME';
          // Update
          await testData.userService.updateEntity(
            testData.userService.userApi,
            { ...testData.newUser, password: testData.newUser.password }
          );
        });

        it('Should be able to create a tag for user', async () => {
          testData.newTag = Factory.tag.build({ userID: testData.newUser.id });
          const response = await testData.userService.userApi.createTag(testData.newTag);
          expect(response.status).to.equal(StatusCodes.CREATED);
          testData.createdTags.push(testData.newTag);
        });

        it('Should be able to deactivate a badge', async () => {
          testData.newTag.active = false;
          const response = await testData.userService.userApi.updateTag(testData.newTag);
          expect(response.status).to.equal(StatusCodes.OK);
          const tag = (await testData.userService.userApi.readTag(testData.newTag.id)).data;
          expect(tag.active).to.equal(false);
        });

        it('Should not be able to start a transaction with a deactivated badge', async () => {
          const connectorId = 1;
          const tagId = testData.newTag.id;
          const meterStart = 180;
          const startDate = moment();
          const response = await testData.chargingStationContext.startTransaction(
            connectorId, tagId, meterStart, startDate.toDate());
          // eslint-disable-next-line @typescript-eslint/unbound-method
          expect(response).to.be.transactionStatus('Invalid');
        });

        it('Should be able to delete a badge that has not been used', async () => {
          testData.newTag = Factory.tag.build({ userID: testData.newUser.id });
          let response = await testData.userService.userApi.createTag(testData.newTag);
          expect(response.status).to.equal(StatusCodes.CREATED);
          response = await testData.userService.userApi.deleteTag(testData.newTag.id);
          expect(response.status).to.equal(StatusCodes.OK);
          response = (await testData.userService.userApi.readTag(testData.newTag.id));
          expect(response.status).to.equal(HTTPError.OBJECT_DOES_NOT_EXIST_ERROR);
        });

        it('Should be able to export tag list', async () => {
          const response = await testData.userService.userApi.exportTags({});
          const tags = await testData.userService.userApi.readTags({});
          const responseFileArray = TestUtils.convertExportFileToObjectArray(response.data);

          expect(response.status).eq(StatusCodes.OK);
          expect(response.data).not.null;
          // Verify we have as many tags inserted as tags in the export
          expect(responseFileArray.length).to.be.eql(tags.data.result.length);
        });

        // // TODO: Need to verify the real logic, not only if we can import (read create) tags
        // // Something like this ?
        // it('Should be able to import tag list', async () => {
        //   const response = await testData.tagService.insertTags(
        //     tenantid,
        //     user,
        //     action,
        //     tagsToBeImported,
        //     result);
        //   expect(response.status).to.equal(??);
        //   testData.importedTags.push(tag);
        // });

        it('Should be able to export users list', async () => {
          const response = await testData.userService.userApi.exportUsers({});
          const users = await testData.userService.userApi.readAll({}, { limit: 1000, skip: 0 });
          const responseFileArray = TestUtils.convertExportFileToObjectArray(response.data);
          expect(response.status).eq(StatusCodes.OK);
          expect(response.data).not.null;
          // Verify we have as many users inserted as users in the export
          expect(responseFileArray.length).to.be.eql(users.data.result.length);
        });

        it('Should find the updated user by id', async () => {
          // Check if the updated entity can be retrieved with its id
          const updatedUser = await testData.userService.getEntityById(
            testData.userService.userApi,
            testData.newUser
          );
          // Check
          expect(updatedUser.name).to.equal(testData.newUser.name);
        });

        it('Should update user\'s mobile token', async () => {
          const response = await testData.userService.userApi.updateMobileToken(
            testData.newUser.id,
            'new_mobile_token',
            'mobile_os'
          );
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data).to.be.deep.eq(Constants.REST_RESPONSE_SUCCESS);
        });

        it('Should get user image', async () => {
          const response = await testData.userService.userApi.getImage(testData.newUser.id);
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.id).to.be.eq(testData.newUser.id);
          expect(response.data.image).to.be.null; // New users have a null image
        });

        it('Should get the user default car tag', async () => {
          // Create a tag
          testData.newTag = Factory.tag.build({ userID: testData.newUser.id });
          let response = await testData.userService.userApi.createTag(testData.newTag);
          expect(response.status).to.equal(StatusCodes.CREATED);
          testData.createdTags.push(testData.newTag);
          // Retrieve it
          response = await testData.userService.userApi.getDefaultTagCar(testData.newUser.id);
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.tag.visualID).to.be.eq(testData.newTag.visualID);
          expect(response.data.car).to.be.undefined;
          expect(response.data.errorCodes).to.be.not.null;
          expect(response.data.errorCodes[0]).to.be.eq(StartTransactionErrorCode.EULA_NOT_ACCEPTED);
        });

        it('Should be able to delete the created user', async () => {
          // Delete the created entity
          await testData.userService.deleteEntity(
            testData.userService.userApi,
            testData.newUser
          );
        });

        it('Should not find the deleted user with its id', async () => {
          // Check if the deleted entity cannot be retrieved with its id
          await testData.userService.checkDeletedEntityById(
            testData.userService.userApi,
            testData.newUser
          );
        });
      });
      describe('Using function "readAllInError"', () => {

        it('Should not find an active user in error', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({ status: 'A' })
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(StatusCodes.OK);
          response.data.result.forEach((u) => expect(u.id).to.not.equal(user.id));
          await testData.userService.deleteEntity(
            testData.userService.userApi,
            user
          );
        });

        it('Should find a pending user', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({ status: 'P' })
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(StatusCodes.OK);
          const found = response.data.result.find((u) => u.id === user.id);
          expect(found).to.not.be.null;

          await testData.userService.deleteEntity(
            testData.userService.userApi,
            user
          );
        });

        it('Should find a blocked user', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({ status: 'B' })
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(StatusCodes.OK);
          const found = response.data.result.find((u) => u.id === user.id);
          expect(found).to.not.be.null;

          await testData.userService.deleteEntity(
            testData.userService.userApi,
            user
          );
        });

        it('Should find a locked user', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({ status: 'L' })
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(StatusCodes.OK);
          const found = response.data.result.find((u) => u.id === user.id);
          expect(found).to.not.be.null;

          await testData.userService.deleteEntity(
            testData.userService.userApi,
            user
          );
        });

        it('Should find an inactive user', async () => {
          const user = await testData.userService.createEntity(
            testData.userService.userApi,
            Factory.user.build({ status: 'I' })
          );
          testData.createdUsers.push(user);
          const response = await testData.userService.userApi.readAllInError({}, {
            limit: 100,
            skip: 0
          });
          expect(response.status).to.equal(StatusCodes.OK);
          const found = response.data.result.find((u) => u.id === user.id);
          expect(found).to.not.be.null;

          await testData.userService.deleteEntity(
            testData.userService.userApi,
            user
          );
        });

      });

    });

  });

});
