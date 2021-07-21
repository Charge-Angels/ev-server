import { HttpCheckEulaRequest, HttpEulaRequest, HttpLoginRequest, HttpRegisterUserRequest, HttpResendVerificationMailRequest, HttpResetPasswordRequest, HttpVerifyEmailRequest } from '../../../../types/requests/v1/HttpUserRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class AuthValidator extends SchemaValidator {
  private static instance: AuthValidator|null = null;
  private authSignIn: Schema;
  private authSignOn: Schema;
  private authResetPassword: Schema;
  private authCheckEula: Schema;
  private authVerifyEmail: Schema;
  private authResendVerificationEmail: Schema;
  private authEula: Schema;

  private constructor() {
    super('AuthValidator');
    this.authSignIn = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-signin.json`, 'utf8'));
    this.authSignOn = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-signon.json`, 'utf8'));
    this.authResetPassword = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-reset-password.json`, 'utf8'));
    this.authCheckEula = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-check-eula.json`, 'utf8'));
    this.authVerifyEmail = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-verify-email.json`, 'utf8'));
    this.authResendVerificationEmail = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-resend-verification-email.json`, 'utf8'));
    this.authEula = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/auth/auth-eula.json`, 'utf8'));
  }

  public static getInstance(): AuthValidator {
    if (!AuthValidator.instance) {
      AuthValidator.instance = new AuthValidator();
    }
    return AuthValidator.instance;
  }

  public validateAuthSignIn(data: HttpLoginRequest): HttpLoginRequest {
    // Validate schema
    this.validate(this.authSignIn, data);
    return data;
  }

  public validateAuthSignOn(data: HttpRegisterUserRequest): Partial<HttpRegisterUserRequest> {
    // Validate schema
    this.validate(this.authSignOn, data);
    return data;
  }

  public validateAuthResetPassword(data: HttpResetPasswordRequest): Partial<HttpResetPasswordRequest> {
    // Validate schema
    this.validate(this.authResetPassword, data);
    return data;
  }

  public validateAuthCheckEula(data: any): Partial<HttpCheckEulaRequest> {
    // Validate schema
    this.validate(this.authCheckEula, data);
    return data;
  }

  public validateAuthVerifyEmail(data: any): Partial<HttpVerifyEmailRequest> {
    // Validate schema
    this.validate(this.authVerifyEmail, data);
    return data;
  }

  public validateAuthResendVerificationEmail(data: HttpResendVerificationMailRequest): Partial<HttpResendVerificationMailRequest> {
    // Validate schema
    this.validate(this.authResendVerificationEmail, data);
    return data;
  }

  public validateAuthEula(data: any): Partial<HttpEulaRequest> {
    // Validate schema
    this.validate(this.authEula, data);
    return data;
  }
}
