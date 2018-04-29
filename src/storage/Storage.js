require('source-map-support').install();

class Storage {
	constructor(dbConfig) {
		if (new.target === Storage) {
			throw new TypeError("Cannot construct Storage instances directly");
		}
	}

	start() {
	}

	getEndUserLicenseAgreement(language="en") {
	}

	setCentralRestServer(centralRestServer) {
	}

	getConfigurationParamValue(chargeBoxID, paramName) {
	}

	getLogs(dateFrom, level, type, chargingStation, searchValue, numberOfLogs=500, sortDate) {
	}

	saveLog(log) {
	}

	deleteLogs(deleteUpToDate) {
	}

	deleteSecurityLogs(deleteUpToDate) {
	}

	getConfiguration(chargeBoxID) {
	}

	getStatusNotifications(chargeBoxID, connectorId) {
	}

	getPricing() {
	}

	savePricing(pricing) {
	}

	getLastStatusNotification(chargeBoxID, connectorId) {
	}

	getMeterValuesFromTransaction(transactionId) {
	}

	saveBootNotification(bootNotification) {
	}

	saveNotification(notification) {
	}

	getNotifications(sourceId) {
	}

	saveDataTransfer(dataTransfer) {
	}

	saveConfiguration(configuration) {
	}

	saveStatusNotification(statusNotification) {
	}

	saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
	}

	saveFirmwareStatusNotification(firmwareStatusNotification) {
	}

	saveAuthorize(authorize) {
	}

	saveStartTransaction(startTransaction) {
	}

	saveStopTransaction(stopTransaction) {
	}

	getTransactionYears() {
	}

	deleteTransaction(transaction) {
	}

	getMigrations() {
	}

	saveMigration(migration) {
	}

	saveMeterValues(meterValues) {
	}

	getTransactions(searchValue=null, filter={}, siteID=null, numberOfTransactions=500) {
	}

	getActiveTransaction(chargeBoxID, connectorID) {
	}

	getTransaction(transactionId) {
	}

	saveChargingStation(chargingStation) {
	}

	saveChargingStationConnector(chargingStation, connectorId) {
	}

	saveChargingStationURL(chargingStation) {
	}

	saveChargingStationHeartBeat(chargingStation) {
	}

	saveChargingStationSiteArea(chargingStation) {
	}

	deleteChargingStation(id) {
	}

	getChargingStations(searchValue, siteAreaID, withNoSiteArea, numberOfChargingStation=500) {
	}

	getChargingStation(id) {
	}

	getUsers(searchValue, companyID, numberOfUser=500) {
	}

	saveUser(user) {
	}

	saveUserImage(user) {
	}

	deleteUser(id) {
	}

	getUser(id) {
	}

	getUserImage(id) {
	}

	getUserImages() {
	}

	getCompanies(searchValue, userID, withSites=false, numberOfCompanies=500) {
	}

	getCompanyLogos() {
	}

	getCompany(id, withUsers=false) {
	}

	getCompanyLogo(id) {
	}

	saveCompany(company) {
	}

	saveCompanyLogo(company) {
	}

	deleteCompany(id) {
	}

	getSites(searchValue, companyID, withCompany=false, withSiteAreas=false,
		withChargeBoxes=false, numberOfSite=500) {
	}

	saveSite(site) {
	}

	saveSiteImage(site) {
	}

	deleteSite(id) {
	}

	getSite(id) {
	}

	getSiteImage(id) {
	}

	getSiteImages() {
	}

	getSiteAreas(searchValue, siteID=null, withChargeBoxes=false, numberOfSiteArea=500) {
	}

	getSiteArea(id, withChargingStations=false, withSite=false) {
	}

	getSiteAreaImage(id) {
	}

	getSiteAreaImages() {
	}

	saveSiteArea(siteArea) {
	}

	saveSiteAreaImage(siteArea) {
	}

	deleteSiteArea(id) {
	}

	getUserByEmail(email) {
	}

	getUserByTagId(tagID) {
	}

	getCars(searchValue, vehicleManufacturerID=null, numberOfCar=500) {
	}

	saveCar(car) {
	}

	saveCarImages(car) {
	}

	deleteCar(id) {
	}

	getCar(id) {
	}

	getCarImage(id) {
	}

	getCarImages() {
	}

	getVehicleManufacturers(searchValue, withCars=false, numberOfVehicleManufacturers=500) {
	}

	getVehicleManufacturer(id) {
	}

	deleteVehicleManufacturer(id) {
	}

	saveVehicleManufacturer(vehicleManufacturer) {
	}

	getVehicleManufacturerLogo(id) {
	}

	getVehicleManufacturerLogos() {
	}

	saveVehicleManufacturerLogo(car) {
	}
}

module.exports=Storage;
