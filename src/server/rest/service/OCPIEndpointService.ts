import { NextFunction, Request, Response } from 'express';
import Authorizations from '../../../authorization/Authorizations';
import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import AppAuthError from '../../../exception/AppAuthError';
import OCPIEndpointStorage from '../../../storage/mongodb/OCPIEndpointStorage';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError } from '../../../types/HTTPError';
import { ServerAction } from '../../../types/Server';
import OCPIEndpoint from '../../../types/ocpi/OCPIEndpoint';
import { OCPIRegistrationStatus } from '../../../types/ocpi/OCPIRegistrationStatus';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import OCPIUtils from '../../ocpi/OCPIUtils';
import OCPIEndpointSecurity from './security/OCPIEndpointSecurity';
import UtilsService from './UtilsService';

const MODULE_NAME = 'OCPIEndpointService';

export default class OCPIEndpointService {
  static async handleDeleteOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointDeleteRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleDeleteOcpiEndpoint', req.user);
    // Check auth
    if (!Authorizations.canDeleteOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleDeleteOcpiEndpoint',
        value: filteredRequest.ID
      });
    }
    // Get
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleDeleteOcpiEndpoint', req.user);
    // Delete
    await OCPIEndpointStorage.deleteOcpiEndpoint(req.user.tenantID, ocpiEndpoint.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteOcpiEndpoint',
      message: `Ocpi Endpoint '${ocpiEndpoint.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { ocpiEndpoint }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  static async handleGetOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Filter
    const endpointID = OCPIEndpointSecurity.filterOcpiEndpointRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, endpointID, MODULE_NAME, 'handleGetOcpiEndpoint', req.user);
    // Check auth
    if (!Authorizations.canReadOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleGetOcpiEndpoint',
        value: endpointID
      });
    }
    // Get it
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, endpointID);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${endpointID}' does not exist`,
      MODULE_NAME, 'handleGetOcpiEndpoint', req.user);
    // Return
    res.json(OCPIEndpointSecurity.filterOcpiEndpointResponse(ocpiEndpoint, req.user));
    next();
  }

  static async handleGetOcpiEndpoints(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListOcpiEndpoints(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.OCPI_ENDPOINTS,
        module: MODULE_NAME,
        method: 'handleGetOcpiEndpoints'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointsRequest(req.query);
    // Get all ocpiendpoints
    const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(req.user.tenantID,
      {
        'search': filteredRequest.Search
      }, {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      });
    OCPIEndpointSecurity.filterOcpiEndpointsResponse(ocpiEndpoints, req.user);
    // Return
    res.json(ocpiEndpoints);
    next();
  }

  static async handleCreateOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canCreateOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleCreateOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointCreateRequest(req.body);
    // Check Mandatory fields
    Utils.checkIfOCPIEndpointValid(filteredRequest, req);
    const ocpiEndpoint: OCPIEndpoint = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date(),
      status: OCPIRegistrationStatus.NEW
    } as OCPIEndpoint;
    const endpointID = await OCPIEndpointStorage.saveOcpiEndpoint(req.user.tenantID, ocpiEndpoint);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateOcpiEndpoint',
      message: `Ocpi Endpoint '${filteredRequest.name}' has been created successfully`,
      action: action,
      detailedMessages: { endpoint: filteredRequest }
    });
    // Ok
    res.json(Object.assign({ id: endpointID }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  static async handleUpdateOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointUpdateRequest(req.body);
    // Check Mandatory fields
    Utils.checkIfOCPIEndpointValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canUpdateOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleUpdateOcpiEndpoint',
        value: filteredRequest.id
      });
    }
    // Get OcpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateOcpiEndpoint', req.user);
    // Update timestamp
    ocpiEndpoint.lastChangedBy = { 'id': req.user.id };
    ocpiEndpoint.lastChangedOn = new Date();
    // Update OcpiEndpoint
    await OCPIEndpointStorage.saveOcpiEndpoint(req.user.tenantID, { ...ocpiEndpoint, ...filteredRequest });
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateOcpiEndpoint',
      message: `Ocpi Endpoint '${ocpiEndpoint.name}' has been updated successfully`,
      action: action,
      detailedMessages: { endpoint: ocpiEndpoint }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  static async handlePingOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canPingOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.PING,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handlePingOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointPingRequest(req.body);
    // Check Mandatory fields
    Utils.checkIfOCPIEndpointValid(filteredRequest, req);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getOcpiClient(tenant, filteredRequest);
    // Try to ping
    const pingResult = await ocpiClient.ping();
    // Check ping result
    if (pingResult.statusCode === 200) {
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handlePingOcpiEndpoint',
        message: `Ocpi Endpoint '${filteredRequest.name}' can be reached successfully`,
        action: action,
        detailedMessages: { pingResult }
      });
      res.json(Object.assign(pingResult, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      Logging.logSecurityError({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handlePingOcpiEndpoint',
        message: `Ocpi Endpoint '${filteredRequest.name}' cannot be reached`,
        action: action,
        detailedMessages: { pingResult }
      });
      res.json(pingResult);
    }
    next();
  }

  static async handleTriggerJobsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleTriggerJobsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointTriggerJobRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleTriggerJobsEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleTriggerJobsEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
    // Send EVSE statuses
    const result = await ocpiClient.triggerJobs();
    // Return result
    res.json(result);
    next();
  }

  static async handlePullLocationsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handlePullLocationsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointTriggerJobRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handlePullLocationsEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullLocationsEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
    const result = await ocpiClient.pullLocations(false);
    // Return result
    res.json(result);
    next();
  }

  static async handlePullSessionsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handlePullLocationsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointTriggerJobRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handlePullSessionsEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullSessionsEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
    const result = await ocpiClient.pullSessions();
    // Return result
    res.json(result);
    next();
  }

  static async handlePullTokensEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handlePullTokensEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointTriggerJobRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handlePullTokensEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullTokensEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getCpoOcpiClient(tenant, ocpiEndpoint);
    const result = await ocpiClient.pullTokens(false);
    // Return result
    res.json(result);
    next();
  }

  static async handlePullCdrsEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handlePullCdrsEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointTriggerJobRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handlePullCdrsEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handlePullCdrsEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
    const result = await ocpiClient.pullCdrs();
    // Return result
    res.json(result);
    next();
  }

  static async handleSendEVSEStatusesOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleSendEVSEStatusesOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointSendEVSEStatusesRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleSendEVSEStatusesOcpiEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleSendEVSEStatusesOcpiEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getCpoOcpiClient(tenant, ocpiEndpoint);
    // Send EVSE statuses
    const sendResult = await ocpiClient.sendEVSEStatuses();
    // Return result
    res.json(sendResult);
    next();
  }

  static async handleSendTokensOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canTriggerJobOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.TRIGGER_JOB,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleSendTokensOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointSendTokensRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleSendTokensOcpiEndpoint', req.user);
    // Get ocpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleSendTokensOcpiEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
    // Send EVSE statuses
    const sendResult = await ocpiClient.sendTokens();
    // Return result
    res.json(sendResult);
    next();
  }

  static async handleUnregisterOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canRegisterOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.REGISTER,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleUnregisterOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointRegisterRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleUnregisterOcpiEndpoint', req.user);
    // Get OcpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUnregisterOcpiEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
    // Try to register
    const result = await ocpiClient.unregister();
    // Check ping result
    if (result.statusCode === 200) {
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint',
        message: `Ocpi Endpoint '${ocpiEndpoint.name}' can be reached successfully`,
        action: action,
        detailedMessages: { result }
      });
      res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      Logging.logSecurityError({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleUnregisterOcpiEndpoint',
        message: `Ocpi Endpoint '${ocpiEndpoint.name}' cannot be reached`,
        action: action,
        detailedMessages: { result }
      });
      res.json(result);
    }
    next();
  }

  static async handleRegisterOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canRegisterOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.REGISTER,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleRegisterOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointRegisterRequest(req.body);
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleRegisterOcpiEndpoint', req.user);
    // Get OcpiEndpoint
    const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, ocpiEndpoint, `OCPIEndpoint with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleRegisterOcpiEndpoint', req.user);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
    // Try to register
    const result = await ocpiClient.register();
    // Check ping result
    if (result.statusCode === 200) {
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleRegisterOcpiEndpoint',
        message: `Ocpi Endpoint '${ocpiEndpoint.name}' can be reached successfully`,
        action: action,
        detailedMessages: { result }
      });
      res.json(Object.assign(result, Constants.REST_RESPONSE_SUCCESS));
    } else {
      // Log
      Logging.logSecurityError({
        tenantID: req.user.tenantID,
        user: req.user, module: MODULE_NAME, method: 'handleRegisterOcpiEndpoint',
        message: `Ocpi Endpoint '${ocpiEndpoint.name}' cannot be reached`,
        action: action,
        detailedMessages: { result }
      });
      res.json(result);
    }
    next();
  }

  static async handleGenerateLocalTokenOcpiEndpoint(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canGenerateLocalTokenOcpiEndpoint(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.GENERATE_LOCAL_TOKEN,
        entity: Entity.OCPI_ENDPOINT,
        module: MODULE_NAME,
        method: 'handleGenerateLocalTokenOcpiEndpoint'
      });
    }
    // Filter
    const filteredRequest = OCPIEndpointSecurity.filterOcpiEndpointGenerateLocalTokenRequest(req.body);
    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    const localToken = OCPIUtils.generateLocalToken(tenant.subdomain);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleGenerateLocalTokenOcpiEndpoint',
      message: `Local Token for Ocpi Endpoint '${filteredRequest.name}' has been generatd successfully`,
      action: action,
      detailedMessages: { token: filteredRequest }
    });
    // Ok
    res.json(Object.assign({
      id: filteredRequest.id,
      localToken: localToken
    }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }
}

