import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import OCPIEndpoint from '../../../types/ocpi/OCPIEndpoint';
import OCPIEndpointStorage from '../../../storage/mongodb/OCPIEndpointStorage';
import { OCPIRegistrationStatus } from '../../../types/ocpi/OCPIRegistrationStatus';
import { OCPIRole } from '../../../types/ocpi/OCPIRole';
import SchedulerTask from '../../SchedulerTask';
import { ServerAction } from '../../../types/Server';
import { TaskConfig } from '../../../types/TaskConfig';
import Tenant from '../../../types/Tenant';
import TenantComponents from '../../../types/TenantComponents';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'OCPICheckLocationsTask';

export default class OCPICheckLocationsTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      // Check if OCPI component is active
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        Logging.logDebug({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'processTenant',
          action: ServerAction.OCPI_CHECK_SESSIONS,
          message: 'OCPI Inactive for this tenant. The task \'OCPICheckLocationsTask\' is skipped.'
        });
        // Skip execution
        return;
      }
      // Get all available endpoints
      const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(tenant.id, { role: OCPIRole.CPO }, Constants.DB_PARAMS_MAX_LIMIT);
      for (const ocpiEndpoint of ocpiEndpoints.result) {
        await this.processOCPIEndpoint(tenant, ocpiEndpoint);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPI_CHECK_SESSIONS, error);
    }
  }

  // eslint-disable-next-line no-unused-vars
  async processOCPIEndpoint(tenant: Tenant, ocpiEndpoint: OCPIEndpoint) {
    // Check if OCPI endpoint is registered
    if (ocpiEndpoint.status !== OCPIRegistrationStatus.REGISTERED) {
      Logging.logDebug({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'processOCPIEndpoint',
        action: ServerAction.OCPI_CHECK_SESSIONS,
        message: `The OCPI Endpoint ${ocpiEndpoint.name} is not registered. Skipping the ocpiendpoint.`
      });
      return;
    } else if (!ocpiEndpoint.backgroundPatchJob) {
      Logging.logDebug({
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'processOCPIEndpoint',
        action: ServerAction.OCPI_CHECK_SESSIONS,
        message: `The OCPI Endpoint ${ocpiEndpoint.name} is inactive.`
      });
      return;
    }
    Logging.logInfo({
      tenantID: tenant.id,
      module: MODULE_NAME, method: 'processOCPIEndpoint',
      action: ServerAction.OCPI_CHECK_SESSIONS,
      message: `The check locations process for endpoint ${ocpiEndpoint.name} is being processed`
    });
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getCpoOcpiClient(tenant, ocpiEndpoint);
    const result = await ocpiClient.checkLocations();
    Logging.logInfo({
      tenantID: tenant.id,
      module: MODULE_NAME, method: 'processOCPIEndpoint',
      action: ServerAction.OCPI_CHECK_SESSIONS,
      message: `The check locations process for endpoint ${ocpiEndpoint.name} is completed)`,
      detailedMessages: { result }
    });
  }
}

