require('source-map-support').install();

module.exports = {
	CONN_STATUS_AVAILABLE: "Available",
	CONN_STATUS_OCCUPIED: "Occupied",

	STATS_GROUP_BY_CONSUMPTION: "C",
	STATS_GROUP_BY_USAGE: "U",

	// Statuses
	ENTITY_SITE: "Site",
	ENTITY_SITES: "Sites",
	ENTITY_SITE_AREA: "SiteArea",
	ENTITY_SITE_AREAS: "SiteAreas",
	ENTITY_COMPANY: "Company",
	ENTITY_COMPANIES: "Companies",
	ENTITY_CHARGING_STATION: "ChargingStation",
	ENTITY_CHARGING_STATIONS: "ChargingStations",
	ENTITY_TRANSACTION: "Transaction",
	ENTITY_TRANSACTIONS: "Transactions",
	ENTITY_TRANSACTION_METER_VALUES: "MeterValues",
	ENTITY_TRANSACTION_STOP: "Stop",
	ENTITY_USER: "User",
	ENTITY_USERS: "Users",
	ENTITY_VEHICLE_MANUFACTURER: "VehicleManufacturer",
	ENTITY_VEHICLE_MANUFACTURERS: "VehicleManufacturers",
	ENTITY_VEHICLES: "Vehicles",
	ENTITY_VEHICLE: "Vehicle",
	ENTITY_LOGGINGS: "Loggings",
	ENTITY_LOGGING: "Logging",
	ENTITY_PRICING: "Pricing",

	NOTIF_TYPE_CHARGING_STATION_CONFIGURATION: "Configuration",

	ACTION_CREATE: "Create",
	ACTION_UPDATE: "Update",
	ACTION_DELETE: "Delete",

	NO_LIMIT: 0,

	CENTRAL_SERVER: "Central Server",

	WITH_CONNECTORS: true,
	WITHOUT_CONNECTORS: false,

	WITH_CHARGING_STATIONS: true,
	WITHOUT_CHARGING_STATIONS: false,
	WITH_SITE: true,
	WITHOUT_SITE: false,

	VEHICLE_TYPE_CAR: 'C',

	// Statuses
	USER_STATUS_PENDING: 'P',
	USER_STATUS_ACTIVE: 'A',
	USER_STATUS_DELETED: 'D',
	USER_STATUS_INACTIVE: 'I',
	USER_STATUS_BLOCKED: 'B',
	USER_STATUS_LOCKED: 'L',

	// Roles
	ROLE_SUPER_ADMIN: "S",
	ROLE_ADMIN: "A",
	ROLE_BASIC: "B",
	ROLE_DEMO: "D",
	ACTION_READ  : "Read",
	ACTION_CREATE: "Create",
	ACTION_UPDATE: "Update",
	ACTION_DELETE: "Delete",
	ACTION_LOGOUT: "Logout",
	ACTION_LIST: "List",
	ACTION_RESET: "Reset",
	ACTION_AUTHORIZE: "Authorize",
	ACTION_CLEAR_CACHE: "ClearCache",
	ACTION_STOP_TRANSACTION: "StopTransaction",
	ACTION_START_TRANSACTION: "StartTransaction",
	ACTION_REFUND_TRANSACTION: "RefundTransaction",
	ACTION_UNLOCK_CONNECTOR: "UnlockConnector",
	ACTION_GET_CONFIGURATION: "GetConfiguration",

	// Password constants
	PWD_MIN_LENGTH: 15,
	PWD_MAX_LENGTH: 20,
	PWD_UPPERCASE_MIN_COUNT: 1,
	PWD_LOWERCASE_MIN_COUNT: 1,
	PWD_NUMBER_MIN_COUNT: 1,
	PWD_SPECIAL_MIN_COUNT: 1,

	PWD_UPPERCASE_RE: /([A-Z])/g,
	PWD_LOWERCASE_RE: /([a-z])/g,
	PWD_NUMBER_RE: /([\d])/g,
	PWD_SPECIAL_CHAR_RE: /([!#\$%\^&\*\.\?\-])/g,

	DEFAULT_LOCALE: 'en_US',

	ANONIMIZED_VALUE: '####',

	DEFAULT_DB_LIMIT: 100,

	METER_VALUE_CTX_SAMPLE_PERIODIC: 'Sample.Periodic',
	METER_VALUE_CTX_SAMPLE_CLOCK: 'Sample.Clock'
};
