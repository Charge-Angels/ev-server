import { OCPPAttribute, OCPPLocation, OCPPMeasurand, OCPPPhase, OCPPReadingContext, OCPPUnitOfMeasure, OCPPValueFormat } from '../types/ocpp/OCPPServer';

import DbParams from '../types/database/DbParams';
import { OcppParameter } from '../types/ChargingStation';
import Tenant from '../types/Tenant';

export default class Constants {
  public static readonly ONE_BILLION = 1000000000;

  public static readonly BOOT_NOTIFICATION_WAIT_TIME = 60;

  public static readonly CSV_SEPARATOR = ',';
  public static readonly CR_LF = '\r\n';

  public static readonly PERF_MAX_DATA_VOLUME_KB = 128;
  public static readonly PERF_MAX_RESPONSE_TIME_MILLIS = 500;

  public static readonly AXIOS_DEFAULT_TIMEOUT = 60000;

  public static readonly LAST_SEEN_UPDATE_INTERVAL_MILLIS = 60000;

  public static readonly DC_CHARGING_STATION_DEFAULT_EFFICIENCY_PERCENT = 80;
  public static readonly AMPERAGE_DETECTION_THRESHOLD = 0.5;

  public static readonly DB_RECORD_COUNT_DEFAULT = 100;
  public static readonly DB_RECORD_COUNT_CEIL = 500;
  public static readonly DB_RECORD_COUNT_NO_LIMIT = Number.MAX_SAFE_INTEGER;
  public static readonly DB_UNDETERMINED_NBR_OF_RECORDS = -1;
  public static readonly DB_EMPTY_DATA_RESULT = Object.freeze({ count: 0, result: [] });

  public static readonly DB_PARAMS_MAX_LIMIT: DbParams = Object.freeze({ limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0, sort: null });
  public static readonly DB_PARAMS_SINGLE_RECORD: DbParams = Object.freeze({ limit: 1, skip: 0, sort: null });
  public static readonly DB_PARAMS_DEFAULT_RECORD: DbParams = Object.freeze({ limit: Constants.DB_RECORD_COUNT_DEFAULT, skip: 0, sort: null });
  public static readonly DB_PARAMS_COUNT_ONLY: DbParams = Object.freeze({ limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0, onlyRecordCount: true, sort: null });

  public static readonly EXPORT_PDF_PAGE_SIZE = 100;
  public static readonly EXPORT_PAGE_SIZE = 1000;
  public static readonly EXPORT_RECORD_MAX_COUNT = 100000;
  public static readonly IMPORT_PAGE_SIZE = 1000;
  public static readonly IMPORT_BATCH_INSERT_SIZE = 250;
  public static readonly BATCH_PAGE_SIZE = 1000;

  public static readonly CHARGING_STATION_LOCK_SECS = 5;

  public static readonly HEALTH_CHECK_ROUTE = '/health-check';

  public static readonly DEFAULT_TENANT = 'default';
  public static readonly DEFAULT_TENANT_OBJECT = Object.freeze({
    id: Constants.DEFAULT_TENANT,
    name: Constants.DEFAULT_TENANT
  } as Tenant);

  // Output of crypto.getCiphers()
  public static readonly CRYPTO_SUPPORTED_ALGORITHM = Object.freeze([
    'aes-128-cbc',
    'aes-128-cbc-hmac-sha1',
    'aes-128-cbc-hmac-sha256',
    'aes-128-ccm',
    'aes-128-cfb',
    'aes-128-cfb1',
    'aes-128-cfb8',
    'aes-128-ctr',
    'aes-128-ecb',
    'aes-128-gcm',
    'aes-128-ocb',
    'aes-128-ofb',
    'aes-128-xts',
    'aes-192-cbc',
    'aes-192-ccm',
    'aes-192-cfb',
    'aes-192-cfb1',
    'aes-192-cfb8',
    'aes-192-ctr',
    'aes-192-ecb',
    'aes-192-gcm',
    'aes-192-ocb',
    'aes-192-ofb',
    'aes-256-cbc',
    'aes-256-cbc-hmac-sha1',
    'aes-256-cbc-hmac-sha256',
    'aes-256-ccm',
    'aes-256-cfb',
    'aes-256-cfb1',
    'aes-256-cfb8',
    'aes-256-ctr',
    'aes-256-ecb',
    'aes-256-gcm',
    'aes-256-ocb',
    'aes-256-ofb',
    'aes-256-xts',
    'aes128',
    'aes128-wrap',
    'aes192',
    'aes192-wrap',
    'aes256',
    'aes256-wrap',
    'aria-128-cbc',
    'aria-128-ccm',
    'aria-128-cfb',
    'aria-128-cfb1',
    'aria-128-cfb8',
    'aria-128-ctr',
    'aria-128-ecb',
    'aria-128-gcm',
    'aria-128-ofb',
    'aria-192-cbc',
    'aria-192-ccm',
    'aria-192-cfb',
    'aria-192-cfb1',
    'aria-192-cfb8',
    'aria-192-ctr',
    'aria-192-ecb',
    'aria-192-gcm',
    'aria-192-ofb',
    'aria-256-cbc',
    'aria-256-ccm',
    'aria-256-cfb',
    'aria-256-cfb1',
    'aria-256-cfb8',
    'aria-256-ctr',
    'aria-256-ecb',
    'aria-256-gcm',
    'aria-256-ofb',
    'aria128',
    'aria192',
    'aria256',
    'bf',
    'bf-cbc',
    'bf-cfb',
    'bf-ecb',
    'bf-ofb',
    'blowfish',
    'camellia-128-cbc',
    'camellia-128-cfb',
    'camellia-128-cfb1',
    'camellia-128-cfb8',
    'camellia-128-ctr',
    'camellia-128-ecb',
    'camellia-128-ofb',
    'camellia-192-cbc',
    'camellia-192-cfb',
    'camellia-192-cfb1',
    'camellia-192-cfb8',
    'camellia-192-ctr',
    'camellia-192-ecb',
    'camellia-192-ofb',
    'camellia-256-cbc',
    'camellia-256-cfb',
    'camellia-256-cfb1',
    'camellia-256-cfb8',
    'camellia-256-ctr',
    'camellia-256-ecb',
    'camellia-256-ofb',
    'camellia128',
    'camellia192',
    'camellia256',
    'cast',
    'cast-cbc',
    'cast5-cbc',
    'cast5-cfb',
    'cast5-ecb',
    'cast5-ofb',
    'chacha20',
    'chacha20-poly1305',
    'des',
    'des-cbc',
    'des-cfb',
    'des-cfb1',
    'des-cfb8',
    'des-ecb',
    'des-ede',
    'des-ede-cbc',
    'des-ede-cfb',
    'des-ede-ecb',
    'des-ede-ofb',
    'des-ede3',
    'des-ede3-cbc',
    'des-ede3-cfb',
    'des-ede3-cfb1',
    'des-ede3-cfb8',
    'des-ede3-ecb',
    'des-ede3-ofb',
    'des-ofb',
    'des3',
    'des3-wrap',
    'desx',
    'desx-cbc',
    'id-aes128-CCM',
    'id-aes128-GCM',
    'id-aes128-wrap',
    'id-aes128-wrap-pad',
    'id-aes192-CCM',
    'id-aes192-GCM',
    'id-aes192-wrap',
    'id-aes192-wrap-pad',
    'id-aes256-CCM',
    'id-aes256-GCM',
    'id-aes256-wrap',
    'id-aes256-wrap-pad',
    'id-smime-alg-CMS3DESwrap',
    'idea',
    'idea-cbc',
    'idea-cfb',
    'idea-ecb',
    'idea-ofb',
    'rc2',
    'rc2-128',
    'rc2-40',
    'rc2-40-cbc',
    'rc2-64',
    'rc2-64-cbc',
    'rc2-cbc',
    'rc2-cfb',
    'rc2-ecb',
    'rc2-ofb',
    'rc4',
    'rc4-40',
    'rc4-hmac-md5',
    'seed',
    'seed-cbc',
    'seed-cfb',
    'seed-ecb',
    'seed-ofb',
    'sm4',
    'sm4-cbc',
    'sm4-cfb',
    'sm4-ctr',
    'sm4-ecb',
    'sm4-ofb'
  ]);

  public static readonly UNKNOWN_OBJECT_ID: string = '000000000000000000000000';
  public static readonly UNKNOWN_STRING_ID: string = '000000000000000000000000';
  public static readonly UNKNOWN_NUMBER_ID: number = -1;

  public static readonly REST_RESPONSE_SUCCESS = Object.freeze({ status: 'Success' });

  public static readonly DELAY_SMART_CHARGING_EXECUTION_MILLIS = 3000;
  public static readonly DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS = 10000;

  public static readonly CHARGING_STATION_CONFIGURATION = 'Configuration';

  public static readonly CENTRAL_SERVER = 'Central Server';

  public static readonly OCPI_SERVER = 'OCPI Server';
  public static readonly OCPI_SEPARATOR = '*';
  public static readonly OCPI_RECORDS_LIMIT = 25;
  public static readonly OCPI_MAX_PARALLEL_REQUESTS = 2;

  public static readonly OICP_SERVER = 'OICP Server';

  // OICP constants
  public static readonly OICP_PROGRESS_NOTIFICATION_MAX_INTERVAL = 300; // Hubject restriction: "Progress Notification can be sent only at interval of at least 300 seconds." (5 Minutes)
  public static readonly OICP_VIRTUAL_USER_EMAIL = 'virtual@oicp.com';
  public static readonly OCPP_SERVER = 'OCPP Server';
  public static readonly DATABASE_SERVER = 'Database Server';
  public static readonly REST_SERVER = 'REST Server';
  public static readonly AXIOS_CLIENT = 'Axios Client';

  public static readonly WITH_CHARGING_STATIONS = true; // Not used
  public static readonly WITHOUT_CHARGING_STATIONS = false; // Not used
  public static readonly WITH_SITE = true; // Not used
  public static readonly WITHOUT_SITE = false; // Not used

  // Password constants
  public static readonly PWD_MIN_LENGTH = 15;
  public static readonly PWD_MAX_LENGTH = 20;
  public static readonly PWD_UPPERCASE_MIN_COUNT = 1;
  public static readonly PWD_LOWERCASE_MIN_COUNT = 1;
  public static readonly PWD_NUMBER_MIN_COUNT = 1;
  public static readonly PWD_SPECIAL_MIN_COUNT = 1;

  public static readonly PWD_UPPERCASE_RE = /([A-Z])/g; // Cannot store regex in enum
  public static readonly PWD_LOWERCASE_RE = /([a-z])/g; // Cannot store regex in enum
  public static readonly PWD_NUMBER_RE = /([\d])/g; // Cannot store regex in enum
  public static readonly PWD_SPECIAL_CHAR_RE = /([!#$%^&*.?-])/g; // Cannot store regex in enum

  public static readonly SUPPORTED_LOCALES = Object.freeze(['en_US', 'fr_FR', 'es_ES', 'de_DE', 'pt_PT', 'it_IT']);
  public static readonly SUPPORTED_LANGUAGES = Object.freeze(['en', 'fr', 'es', 'de', 'pt', 'it']);
  public static readonly DEFAULT_LOCALE = 'en_US';
  public static readonly DEFAULT_LANGUAGE = 'en';

  public static readonly ANONYMIZED_VALUE = '####';

  public static readonly WS_DEFAULT_KEEP_ALIVE_MILLIS = 180 * 1000;
  public static readonly WS_RECONNECT_DISABLED = 0;
  public static readonly WS_RECONNECT_UNLIMITED = -1;
  public static readonly WS_DEFAULT_RECONNECT_MAX_RETRIES = -1;
  public static readonly WS_DEFAULT_RECONNECT_TIMEOUT = 30; // Seconds

  public static readonly OCPP_SOCKET_TIMEOUT = 30000; // 30 sec
  public static readonly OCPP_HEARTBEAT_KEYS = Object.freeze(['HeartbeatInterval', 'HeartBeatInterval']);

  public static readonly MAX_DATE = new Date('9999-12-31Z23:59:59:999');
  public static readonly MIN_DATE = new Date('1970-01-01Z00:00:00:000');

  public static readonly REGEX_VALIDATION_LATITUDE = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)$/;
  public static readonly REGEX_VALIDATION_LONGITUDE = /^[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
  public static readonly REGEX_URL_PATTERN = /^(?:https?|wss?):\/\/((?:[\w-]+)(?:\.[\w-]+)*)(?:[\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?$/;
  public static readonly MAX_GPS_DISTANCE_METERS = 40000000; // Earth

  public static readonly EXCEPTION_JSON_KEYS_IN_SENSITIVE_DATA = Object.freeze([
    'stack'
  ]);

  public static readonly SENSITIVE_DATA = Object.freeze([
    'firstName', 'name', 'repeatPassword', 'password', 'plainPassword','captcha', 'email', 'coordinates', 'latitude', 'longitude',
    'Authorization', 'authorization', 'client_id', 'client_secret', 'refresh_token', 'localToken', 'token', 'Bearer',
  ]);

  public static readonly MONGO_USER_MASK = Object.freeze({
    '_id': 0,
    '__v': 0,
    'email': 0,
    'phone': 0,
    'mobile': 0,
    'notificationsActive': 0,
    'notifications': 0,
    'iNumber': 0,
    'costCenter': 0,
    'status': 0,
    'createdBy': 0,
    'createdOn': 0,
    'lastChangedBy': 0,
    'lastChangedOn': 0,
    'role': 0,
    'password': 0,
    'locale': 0,
    'passwordWrongNbrTrials': 0,
    'passwordBlockedUntil': 0,
    'passwordResetHash': 0,
    'eulaAcceptedOn': 0,
    'eulaAcceptedVersion': 0,
    'eulaAcceptedHash': 0,
    'image': 0,
    'address': 0,
    'plateID': 0,
    'verificationToken': 0,
    'mobileLastChangedOn': 0,
    'issuer': 0,
    'mobileOs': 0,
    'mobileToken': 0,
    'verifiedAt': 0,
  });

  public static readonly DEFAULT_OCPP_16_CONFIGURATION: OcppParameter[] = Object.freeze([
    { 'key': 'AllowOfflineTxForUnknownId', 'readonly': false, 'value': null },
    { 'key': 'AuthorizationCacheEnabled', 'readonly': false, 'value': null },
    { 'key': 'AuthorizeRemoteTxRequests', 'readonly': false, 'value': null },
    { 'key': 'BlinkRepeat', 'readonly': false, 'value': null },
    { 'key': 'ClockAlignedDataInterval', 'readonly': false, 'value': null },
    { 'key': 'ConnectionTimeOut', 'readonly': false, 'value': null },
    { 'key': 'GetConfigurationMaxKeys', 'readonly': false, 'value': null },
    { 'key': 'HeartbeatInterval', 'readonly': false, 'value': null },
    { 'key': 'LightIntensity', 'readonly': false, 'value': null },
    { 'key': 'LocalAuthorizeOffline', 'readonly': false, 'value': null },
    { 'key': 'LocalPreAuthorize', 'readonly': false, 'value': null },
    { 'key': 'MaxEnergyOnInvalidId', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesAlignedData', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesAlignedDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesSampledData', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesSampledDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'MeterValueSampleInterval', 'readonly': false, 'value': null },
    { 'key': 'MinimumStatusDuration', 'readonly': false, 'value': null },
    { 'key': 'NumberOfConnectors', 'readonly': false, 'value': null },
    { 'key': 'ResetRetries', 'readonly': false, 'value': null },
    { 'key': 'ConnectorPhaseRotation', 'readonly': false, 'value': null },
    { 'key': 'ConnectorPhaseRotationMaxLength', 'readonly': false, 'value': null },
    { 'key': 'StopTransactionOnEVSideDisconnect', 'readonly': false, 'value': null },
    { 'key': 'StopTransactionOnInvalidId', 'readonly': false, 'value': null },
    { 'key': 'StopTxnAlignedData', 'readonly': false, 'value': null },
    { 'key': 'StopTxnAlignedDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'StopTxnSampledData', 'readonly': false, 'value': null },
    { 'key': 'StopTxnSampledDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'SupportedFeatureProfiles', 'readonly': false, 'value': null },
    { 'key': 'SupportedFeatureProfilesMaxLength', 'readonly': false, 'value': null },
    { 'key': 'TransactionMessageAttempts', 'readonly': false, 'value': null },
    { 'key': 'TransactionMessageRetryInterval', 'readonly': false, 'value': null },
    { 'key': 'UnlockConnectorOnEVSideDisconnect', 'readonly': false, 'value': null },
    { 'key': 'WebSocketPingInterval', 'readonly': false, 'value': null },
    { 'key': 'LocalAuthListEnabled', 'readonly': false, 'value': null },
    { 'key': 'LocalAuthListMaxLength', 'readonly': false, 'value': null },
    { 'key': 'SendLocalListMaxLength', 'readonly': false, 'value': null },
    { 'key': 'ReserveConnectorZeroSupported', 'readonly': false, 'value': null },
    { 'key': 'ChargeProfileMaxStackLevel', 'readonly': false, 'value': null },
    { 'key': 'ChargingScheduleAllowedChargingRateUnit', 'readonly': false, 'value': null },
    { 'key': 'ChargingScheduleMaxPeriods', 'readonly': false, 'value': null },
    { 'key': 'ConnectorSwitch3to1PhaseSupported', 'readonly': false, 'value': null },
    { 'key': 'MaxChargingProfilesInstalled', 'readonly': false, 'value': null }
  ]) as OcppParameter[];

  public static readonly OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE: OCPPAttribute = Object.freeze({
    unit: OCPPUnitOfMeasure.WATT_HOUR,
    context: OCPPReadingContext.SAMPLE_PERIODIC,
    measurand: OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER,
    location: OCPPLocation.OUTLET,
    format: OCPPValueFormat.RAW,
  });

  public static readonly OCPP_SOC_ATTRIBUTE: OCPPAttribute = Object.freeze({
    unit: OCPPUnitOfMeasure.PERCENT,
    context: OCPPReadingContext.SAMPLE_PERIODIC,
    measurand: OCPPMeasurand.STATE_OF_CHARGE,
    location: OCPPLocation.EV,
    format: OCPPValueFormat.RAW,
  });

  public static readonly OCPP_START_SIGNED_DATA_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.SIGNED_DATA,
    context: OCPPReadingContext.TRANSACTION_BEGIN,
  });

  public static readonly OCPP_STOP_SIGNED_DATA_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.SIGNED_DATA,
    context: OCPPReadingContext.TRANSACTION_END,
  });

  public static readonly OCPP_VOLTAGE_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.RAW,
    measurand: OCPPMeasurand.VOLTAGE,
    unit: OCPPUnitOfMeasure.VOLT,
    location: OCPPLocation.OUTLET,
    context: OCPPReadingContext.SAMPLE_PERIODIC
  });

  public static readonly OCPP_VOLTAGE_L1_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_VOLTAGE_ATTRIBUTE,
    phase: OCPPPhase.L1,
  });

  public static readonly OCPP_VOLTAGE_L2_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_VOLTAGE_ATTRIBUTE,
    phase: OCPPPhase.L2,
  });

  public static readonly OCPP_VOLTAGE_L3_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_VOLTAGE_ATTRIBUTE,
    phase: OCPPPhase.L3,
  });

  public static readonly OCPP_CURRENT_IMPORT_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.RAW,
    measurand: OCPPMeasurand.CURRENT_IMPORT,
    unit: OCPPUnitOfMeasure.AMP,
    location: OCPPLocation.OUTLET,
    context: OCPPReadingContext.SAMPLE_PERIODIC
  });

  public static readonly OCPP_CURRENT_IMPORT_L1_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_CURRENT_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L1,
  });

  public static readonly OCPP_CURRENT_IMPORT_L2_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_CURRENT_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L2,
  });

  public static readonly OCPP_CURRENT_IMPORT_L3_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_CURRENT_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L3,
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.RAW,
    measurand: OCPPMeasurand.POWER_ACTIVE_IMPORT,
    unit: OCPPUnitOfMeasure.WATT,
    location: OCPPLocation.OUTLET,
    context: OCPPReadingContext.SAMPLE_PERIODIC
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_L1_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L1,
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_L2_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L2,
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_L3_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L3,
  });
}
