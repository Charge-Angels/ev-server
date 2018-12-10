const AbstractTenantEntity = require('./AbstractTenantEntity');
const Database = require('../utils/Database');
const Constants = require('../utils/Constants');
const AppError = require('../exception/AppError');
const SettingStorage = require('../storage/mongodb/SettingStorage');
const User = require('./User');

class Setting extends AbstractTenantEntity {
  constructor(tenantID, setting) {
    super(tenantID);
    // Set it
    Database.updateSetting(setting, this._model);
  }

  getID() {
    return this._model.id;
  }

  /**
   * Identifier of the setting
   */
  getIdentifier() {
    return this._model.identifier;
  }

  setIdentifier(identifier) {
    this._model.identifier = identifier;
  }

  /**
   * get content
   */
  getContent() {
    return this._model.content;
  }

  setContent(content) {
    this._model.content = content;
  }

  getCreatedBy() {
    if (this._model.createdBy) {
      return new User(this.getTenantID(), this._model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this._model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn) {
    this._model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this._model.lastChangedBy) {
      return new User(this.getTenantID(), this._model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this._model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this._model.lastChangedOn = lastChangedOn;
  }

  save() {
    return SettingStorage.saveSetting(this.getTenantID(), this.getModel());
  }

  delete() {
    return SettingStorage.deleteSetting(this.getTenantID(), this.getID());
  }

  static checkIfSettingValid(request, httpRequest) {
    // Update model?
    if (httpRequest.method !== 'POST' && !request.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Setting ID is mandatory`, 500,
        'Setting', 'checkIfSettingValid');
    }
  }

  static getSetting(tenantID, id) {
    return SettingStorage.getSetting(tenantID, id);
  }

  static async getSettingByIdentifier(tenantID, identifier) {
    return await SettingStorage.getSettingByIdentifier(tenantID, identifier);
  }
}

module.exports = Setting;
