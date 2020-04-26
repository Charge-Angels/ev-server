import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import OCPIEndpointStorage from '../../../storage/mongodb/OCPIEndpointStorage';
import { ServerAction } from '../../../types/Server';
import OCPIEndpoint from '../../../types/ocpi/OCPIEndpoint';
import { OCPIRegistrationStatus } from '../../../types/ocpi/OCPIRegistrationStatus';
import { OCPIRole } from '../../../types/ocpi/OCPIRole';
import { TaskConfig } from '../../../types/TaskConfig';
import Tenant from '../../../types/Tenant';
import TenantComponents from '../../../types/TenantComponents';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import SchedulerTask from '../../SchedulerTask';

const MODULE_NAME = 'OCPIGetLocationsTask';

export default class OCPIGetLocationsTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      // Check if OCPI component is active
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        Logging.logDebug({
          tenantID: tenant.id,
          action: ServerAction.OCPI_GET_LOCATIONS,
          module: MODULE_NAME, method: 'run',
          message: 'OCPI Inactive for this tenant. The task \'OCPIGetLocationsTask\' is skipped.'
        });
        // Skip execution
        return;
      }
      // Get all available endpoints
      const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(tenant.id, { role: OCPIRole.EMSP }, Constants.DB_PARAMS_MAX_LIMIT);
      for (const ocpiEndpoint of ocpiEndpoints.result) {
        await this.processOCPIEndpoint(tenant, ocpiEndpoint);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPI_GET_LOCATIONS, error);
    }
  }

  // eslint-disable-next-line no-unused-vars
  async processOCPIEndpoint(tenant: Tenant, ocpiEndpoint: OCPIEndpoint) {
    // Check if OCPI endpoint is registered
    if (ocpiEndpoint.status !== OCPIRegistrationStatus.REGISTERED) {
      Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.OCPI_GET_LOCATIONS,
        module: MODULE_NAME, method: 'processOCPIEndpoint',
        message: `The OCPI Endpoint ${ocpiEndpoint.name} is not registered. Skipping the ocpiendpoint.`
      });
      return;
    } else if (!ocpiEndpoint.backgroundPatchJob) {
      Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.OCPI_GET_LOCATIONS,
        module: MODULE_NAME, method: 'processOCPIEndpoint',
        message: `The OCPI Endpoint ${ocpiEndpoint.name} is inactive.`
      });
      return;
    }
    Logging.logInfo({
      tenantID: tenant.id,
      action: ServerAction.OCPI_GET_LOCATIONS,
      module: MODULE_NAME, method: 'processOCPIEndpoint',
      message: `The patching Locations process for endpoint ${ocpiEndpoint.name} is being processed`
    });
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
    // Send EVSE statuses
    const result = await ocpiClient.pullLocations();
    Logging.logInfo({
      tenantID: tenant.id,
      action: ServerAction.OCPI_GET_LOCATIONS,
      module: MODULE_NAME, method: 'processOCPIEndpoint',
      message: `The GET Locations process for endpoint ${ocpiEndpoint.name} is completed`,
      detailedMessages: { result }
    });
  }
}

