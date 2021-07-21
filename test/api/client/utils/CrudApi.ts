import AuthenticatedBaseApi from './AuthenticatedBaseApi';
import { ServerRoute } from '../../../../src/types/Server';
import TestConstants from './TestConstants';

/**
 * CRUD API (Create Read Update Delete)
 *
 * @class CrudApi
 */
export default class CrudApi {

  protected _authenticatedApi: AuthenticatedBaseApi;

  /**
   * Creates an instance of CrudApi.
   * Only deals with secure connection
   *
   * @param {*} authenticatedApi The authenticated API to perform the requests
   * @memberof CrudApi
   */
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    this._authenticatedApi = authenticatedApi;
  }

  /**
   * Change the authenticated Api used for connection
   *
   * @param {*} authenticatedApi
   * @memberof CrudApi
   */
  public setAutheticatedApi(authenticatedApi): void {
    this._authenticatedApi = authenticatedApi;
  }

  /**
   * Request one object from the backend with its ID
   *
   * @param {*} path The URL path
   * @param {*} id The ID of the object to request
   * @returns The HTTP response
   * @memberof CrudApi
   */
  public async readById(id, path): Promise<any> {
    return await this.read({ ID: id }, path);
  }

  /**
   * Generic Read
   *
   * @param {*} path The URL path
   * @param {*} params
   * @returns The HTTP response
   * @memberof CrudApi
   */
  public async read(params, path): Promise<any> {
    return await this._authenticatedApi.send({
      method: 'GET',
      url: path,
      params
    });
  }

  /**
   * Request a list of objects from the backend
   *
   * @param {*} path The URL path
   * @param {*} params The request parameters (filters)
   * @param {*} [paging=Constants.DEFAULT_PAGING] The paging params
   * @param {*} [ordering=Constants.DEFAULT_ORDERING] The ordering params
   * @returns The HTTP response
   * @memberof CrudApi
   */
  public async readAll(params = {}, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING, path): Promise<any> {
    // Build Paging
    this._buildPaging(paging, params);
    // Build Ordering
    this._buildOrdering(ordering, params);
    // Call
    return await this._authenticatedApi.send({
      method: 'GET',
      url: path,
      params: params
    });
  }

  /**
   * Create an object in the backend
   *
   * @param {*} path The URL path
   * @param {*} data The object to create
   * @returns The HTTP response
   * @memberof CrudApi
   */
  public async create(data, path): Promise<any> {
    return await this._authenticatedApi.send({
      method: 'POST',
      url: path,
      data: data,
    });
  }

  /**
   * Update an object in the backend
   *
   * @param {*} path The URL path
   * @param {*} data The object to update
   * @returns The HTTP response
   * @memberof CrudApi
   */
  public async update(data, path): Promise<any> {
    return await this._authenticatedApi.send({
      method: 'PUT',
      url: path,
      data: data,
    });
  }

  /**
   * Delete an object in the backend
   *
   * @param {*} path The URL path
   * @param {*} id The ID of the object to delete
   * @returns
   * @memberof CrudApi
   */
  public async delete(id, path): Promise<any> {
    return await this._authenticatedApi.send({
      method: 'DELETE',
      url: path,
      params: {
        ID: id
      }
    });
  }

  // Build URL targeting REST endpoints
  protected buildRestEndpointUrl(apiVersion: number, urlPatternAsString: ServerRoute, params: { [name: string]: string | number | null } = {}): string {
    let resolvedUrlPattern = urlPatternAsString as string;
    for (const key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        resolvedUrlPattern = resolvedUrlPattern.replace(`:${key}`, encodeURIComponent(params[key]));
      }
    }
    return `/v${apiVersion}/api/${resolvedUrlPattern}`;
  }

  // Build the paging in the Queryparam
  private _buildPaging(paging, queryString): void {
    // Check
    if (paging) {
      // Limit
      if (paging.limit) {
        queryString.Limit = paging.limit;
      }
      // Skip
      if (paging.skip) {
        queryString.Skip = paging.skip;
      }
    }
  }

  // Build the ordering in the Queryparam
  private _buildOrdering(ordering, queryString): void {
    // Check
    if (ordering && ordering.length) {
      if (!queryString.SortFields) {
        Object.assign(queryString, { SortFields: [] });
      }
      // Set
      ordering.forEach((order) => {
        queryString.SortFields.push(order.field);
      });
    }
  }
}
