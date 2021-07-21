import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { ServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class UserApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    const url = this.buildRestEndpointUrl(1, ServerRoute.REST_USER, { id });
    return super.readById(id, url);
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(1, ServerRoute.REST_USERS));
  }

  public async readAllInError(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll({ Status: 'in-error', ...params }, paging, ordering, this.buildRestEndpointUrl(2, ServerRoute.REST_USERS));
  }

  public async create(data) {
    const url = this.buildRestEndpointUrl(1, ServerRoute.REST_USERS);
    return super.create(data, url);
  }

  public async update(data) {
    const url = this.buildRestEndpointUrl(1, ServerRoute.REST_USER, { id: data.id });
    return super.update(data, url);
  }

  public async delete(id) {
    const url = this.buildRestEndpointUrl(1, ServerRoute.REST_USER, { id });
    return super.delete(id, url);
  }

  public async getByEmail(email) {
    return this.readAll({ Search: email });
  }

  public async readTags(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(1, ServerRoute.REST_TAGS));
  }

  public async readTag(id) {
    return super.read({ ID: id }, this.buildRestEndpointUrl(1, ServerRoute.REST_TAG, { id }));
  }

  public async updateTag(data) {
    return super.update(data, this.buildRestEndpointUrl(1, ServerRoute.REST_TAG, { id: data.id }));
  }

  public async createTag(data) {
    return super.create(data, this.buildRestEndpointUrl(1, ServerRoute.REST_TAGS));
  }

  public async deleteTag(id) {
    return super.delete(id, this.buildRestEndpointUrl(1, ServerRoute.REST_TAG, { id }));
  }

  public async exportTags(params) {
    return await super.read(params, this.buildRestEndpointUrl(1, ServerRoute.REST_TAGS_EXPORT));
  }

  public async exportUsers(params) {
    return await super.read(params, this.buildRestEndpointUrl(1, ServerRoute.REST_USERS_EXPORT));
  }

  public async updateMobileToken(userID: string, mobileToken: string, mobileOS: string) {
    const url = this.buildRestEndpointUrl(1, ServerRoute.REST_USER_UPDATE_MOBILE_TOKEN, { id: userID });
    return await super.update({
      mobileToken, mobileOS
    }, url);
  }

  public async getImage(userID: string) {
    const url = this.buildRestEndpointUrl(1, ServerRoute.REST_USER_IMAGE, { id: userID });
    return await super.read({}, url);
  }

  public async getDefaultTagCar(userID: string) {
    const url = this.buildRestEndpointUrl(1, ServerRoute.REST_USER_DEFAULT_TAG_CAR, { id: userID });
    return await super.read({}, url);
  }
}
