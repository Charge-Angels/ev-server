var fs = require('fs');
var path = require('path');
var Users = require('./Users');
var User = require('../model/User');
var Configuration = require('./Configuration');
var Logging = require('./Logging');

let _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();
let _userFilename = path.join(__dirname, "../../users.json");
let _userFilenameImported = path.join(__dirname, "../../users-imported.json");

module.exports = {
  // Read the user from file
  getUsers() {
    let users;
    // File exists?
    if(fs.existsSync(_userFilename)) {
      // Read in file
      users = fs.readFileSync(_userFilename, "UTF-8");
    }
    // Read conf
    return (users?JSON.parse(users):null);
  },

  // Save the users in file
  saveFile(filename, content) {
    // Save
    fs.writeFileSync(path.join(__dirname, filename), content, 'UTF-8');
  },

  getRandomInt() {
    return Math.floor((Math.random() * 1000000000) + 1);
  },

  buildEvseURL() {
    return _centralSystemFrontEndConfig.protocol + "://" +
      _centralSystemFrontEndConfig.host + ":" +
      _centralSystemFrontEndConfig.port;
  },

  buildEvseTransactionURL(chargingStation, connectorId, transactionId) {
    let _evseBaseURL = this.buildEvseURL();
    // Add : https://localhost:8080/#/pages/chargers/charger/REE001
    return _evseBaseURL + "/#/pages/chargers/charger/" + chargingStation.getChargeBoxIdentity() +
    "/connector/" + connectorId + "/transaction/" + transactionId;
  },

  importUsers() {
    // Get from the file system
    var users = this.getUsers();
    // Found?
    if (users) {
      // Import them
      for (var i = 0; i < users.length; i++) {
        // Check & Save
        this._checkAndSaveUser(users[i]);
      }
      // Rename the file
      fs.renameSync(_userFilename, _userFilenameImported);
      // Imported
      Logging.logInfo({
        userFullName: "System", source: "Central Server", action: "ImportUser",
        module: "ChargingStationBackgroundTasks", method: "importUsers",
        message: `Users have been imported`,
        detailedMessages: users});
    }
  },

  _checkAndSaveUser(user) {
    // Get user
    global.storage.getUserByEmail(user.email).then((userDB) => {
      // Found
      if (!userDB) {
        var newUser = new User(user);
        // Save
        newUser.save().then(() => {
          Logging.logInfo({
            userFullName: "System", action: "ImportUser", source: "Central Server", module: "ChargingStationBackgroundTasks", method: "importUsers",
            message: `User ${newUser.getFullName()} with email '${newUser.getEMail()}' has been imported successfully`,
            detailedMessages: user});
        }).catch((err) => {
          // Log
          Logging.logError({
            userFullName: "System", action: "ImportUser", source: "Central Server", module: "ChargingStationBackgroundTasks", method: "importUsers",
            message: `Cannot import users: ${err.toString()}`,
            detailedMessages: err.stack });
        });
      }
    });
  }
};
