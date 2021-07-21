import { HttpUsersRequest } from '../../../../types/requests/v2/HttpUserRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class UserValidator extends SchemaValidator {
  private static instance: UserValidator|null = null;
  private usersGet: Schema;

  private constructor() {
    super('UserValidatorV2');
    this.usersGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v2/schemas/user/users-get.json`, 'utf8'));
  }

  public static getInstance(): UserValidator {
    if (!UserValidator.instance) {
      UserValidator.instance = new UserValidator();
    }
    return UserValidator.instance;
  }

  validateUsersGet(data: any): HttpUsersRequest {
    this.validate(this.usersGet, data);
    return data;
  }
}
