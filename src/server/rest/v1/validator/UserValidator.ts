import { HttpUserAssignSitesRequest, HttpUserDefaultTagCar, HttpUserMobileTokenRequest, HttpUserSitesRequest, HttpUsersInErrorRequest, HttpUsersRequest } from '../../../../types/requests/v1/HttpUserRequest';
import User, { ImportedUser } from '../../../../types/User';

import HttpByIDRequest from '../../../../types/requests/v1/HttpByIDRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class UserValidator extends SchemaValidator {
  private static instance: UserValidator | null = null;
  private importedUserCreation: Schema;
  private userCreate: Schema;
  private userAssignSites: Schema;
  private userGetByID: Schema;
  private usersGet: Schema;
  private usersGetInError: Schema;
  private userGetSites: Schema;
  private userUpdate: Schema;
  private userUpdateMobileToken: Schema;
  private userGetDefaultTagCar: Schema;

  private constructor() {
    super('UserValidator');
    this.importedUserCreation = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/imported-user-create-req.json`, 'utf8'));
    this.userCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-create.json`, 'utf8'));
    this.userAssignSites = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-assign-sites.json`, 'utf8'));
    this.userGetByID = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-get.json`, 'utf8'));
    this.usersGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/users-get.json`, 'utf8'));
    this.usersGetInError = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/users-inerror-get.json`, 'utf8'));
    this.userGetSites = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-get-sites.json`, 'utf8'));
    this.userUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-update.json`, 'utf8'));
    this.userUpdateMobileToken = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-update-mobile-token.json`, 'utf8'));
    this.userGetDefaultTagCar = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-get-default-tag-car.json`, 'utf8'));
  }

  public static getInstance(): UserValidator {
    if (!UserValidator.instance) {
      UserValidator.instance = new UserValidator();
    }
    return UserValidator.instance;
  }

  validateImportedUserCreation(importedUser: ImportedUser): void {
    this.validate(this.importedUserCreation, importedUser);
  }

  validateUserCreate(user: any): User {
    this.validate(this.userCreate, user);
    return user;
  }

  validateUserAssignToSites(data: HttpUserAssignSitesRequest): HttpUserAssignSitesRequest {
    this.validate(this.userAssignSites, data);
    return data;
  }

  validateUserGetByID(data: any): HttpByIDRequest {
    this.validate(this.userGetByID, data);
    return data;
  }

  validateUsersGet(data: any): HttpUsersRequest {
    this.validate(this.usersGet, data);
    return data;
  }

  validateUsersGetInError(data: any): HttpUsersInErrorRequest {
    this.validate(this.usersGetInError, data);
    return data;
  }

  validateUserGetSites(data: any): HttpUserSitesRequest {
    this.validate(this.userGetSites, data);
    return data;
  }

  validateUserUpdate(data: any): User {
    this.validate(this.userUpdate, data);
    return data;
  }

  validateUserUpdateMobileToken(data: any): HttpUserMobileTokenRequest {
    this.validate(this.userUpdateMobileToken, data);
    return data;
  }

  validateUserDefaultTagCar(data: any): HttpUserDefaultTagCar {
    this.validate(this.userGetDefaultTagCar, data);
    return data;
  }
}
