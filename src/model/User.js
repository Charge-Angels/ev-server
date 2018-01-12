var Database = require('../utils/Database');

class User {
	constructor(user) {
		// Init model
		this._model = {};

		// Set it
		Database.updateUser(user, this._model);
	}

	setEulaAcceptedHash(eulaAcceptedHash) {
		this._model.eulaAcceptedHash = eulaAcceptedHash;
	}

	getEulaAcceptedHash() {
		return this._model.eulaAcceptedHash;
	}

	setEulaAcceptedVersion(eulaAcceptedVersion) {
		this._model.eulaAcceptedVersion = eulaAcceptedVersion;
	}

	getEulaAcceptedVersion() {
		return this._model.eulaAcceptedVersion;
	}

	setEulaAcceptedOn(eulaAcceptedOn) {
		this._model.eulaAcceptedOn = eulaAcceptedOn;
	}

	getEulaAcceptedOn() {
		return this._model.eulaAcceptedOn;
	}

	getModel() {
		return this._model;
	}

	getID() {
		return this._model.id;
	}

	getName() {
		return this._model.name;
	}

	setName(name) {
		this._model.name = name;
	}

	getPassword() {
		return this._model.password;
	}

	setPassword(password) {
		this._model.password = password;
	}

	getPasswordResetHash() {
		return this._model.passwordResetHash;
	}

	setPasswordResetHash(passwordResetHash) {
		this._model.passwordResetHash = passwordResetHash;
	}

	getPasswordWrongNbrTrials() {
		return this._model.passwordWrongNbrTrials;
	}

	setPasswordWrongNbrTrials(passwordWrongNbrTrials) {
		this._model.passwordWrongNbrTrials = passwordWrongNbrTrials;
	}

	getPasswordBlockedUntil() {
		return this._model.passwordBlockedUntil;
	}

	setPasswordBlockedUntil(passwordBlockedUntil) {
		this._model.passwordBlockedUntil = passwordBlockedUntil;
	}

	getLocale() {
		return (this._model.locale?this._model.locale:"en_US");
	}

	getLanguage() {
		return this._model.locale.substring(0,2);
	}

	setLocale(locale) {
		this._model.locale = locale;
	}

	getRole() {
		return this._model.role;
	}

	setRole(role) {
		this._model.role = role;
	}

	getFirstName() {
		return this._model.firstName;
	}

	setFirstName(firstName) {
		this._model.firstName = firstName;
	}

	getFullName(withID=false) {
		return Utils.buildUserFullName(this.getModel(), withID)
	}

	getTagIDs() {
		return this._model.tagIDs;
	}

	setTagIDs(tagIDs) {
		this._model.tagIDs = tagIDs;
	}

	addTagID(tagID) {
		if (!this._model.tagIDs) {
			this._model.tagIDs = [];
		}
		this._model.tagIDs.push(tagID);
	}

	getImage() {
		return this._model.image;
	}

	setImage(image) {
		this._model.image = image;
	}

	getEMail() {
		return this._model.email;
	}

	setEMail(email) {
		this._model.email = email;
	}

	getPhone() {
		return this._model.phone;
	}

	setPhone(phone) {
		this._model.phone = phone;
	}

	getINumber() {
		return this._model.iNumber;
	}

	setINumber(iNumber) {
		this._model.iNumber = iNumber;
	}

	getCostCenter() {
		return this._model.costCenter;
	}

	setCostCenter(costCenter) {
		this._model.costCenter = costCenter;
	}

	getStatus() {
		return this._model.status;
	}

	setStatus(status) {
		this._model.status = status;
	}

	getCreatedBy() {
		return this._model.createdBy;
	}

	setCreatedBy(createdBy) {
		this._model.createdBy = createdBy;
	}

	getCreatedOn() {
		return this._model.createdOn;
	}

	setCreatedOn(createdOn) {
		this._model.createdOn = createdOn;
	}

	getLastChangedBy() {
		return this._model.lastChangedBy;
	}

	setLastChangedBy(lastChangedBy) {
		this._model.lastChangedBy = lastChangedBy;
	}

	getLastChangedOn() {
		return this._model.lastChangedOn;
	}

	setLastChangedOn(lastChangedOn) {
		this._model.lastChangedOn = lastChangedOn;
	}

	setDeleted(deleted) {
		this._model.deleted = deleted;
	}

	isDeleted() {
		return this._model.deleted;
	}

	getTransactions(filter, withImage) {
		if (!filter) {
			filter = {};
		}
		// Set the user ID
		filter.userId = this.getID();
		// Get the consumption
		return global.storage.getTransactions(null, filter, withImage);
	}

	save() {
		return global.storage.saveUser(this.getModel());
	}

	delete() {
		// Check if the user has a transaction
		return this.getTransactions().then((transactions) => {
			if (transactions && transactions.length > 0) {
				// Delete logically
				// Set deleted
				this.setDeleted(true);
				// Delete
				return this.save();
			} else {
				// Delete physically
				return global.storage.deleteUser(this.getID());
			}
		})
	}
}

module.exports = User;
