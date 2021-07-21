import { HttpTransactionsRequest } from '../../../../types/requests/v1/HttpTransactionRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TransactionValidator extends SchemaValidator {
  private static instance: TransactionValidator | undefined;
  private transactionsGet: Schema;


  private constructor() {
    super('TransactionValidator');
    this.transactionsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-get.json`, 'utf8'));
  }

  public static getInstance(): TransactionValidator {
    if (!TransactionValidator.instance) {
      TransactionValidator.instance = new TransactionValidator();
    }
    return TransactionValidator.instance;
  }

  public validateTransactionsGetReq(data: any): HttpTransactionsRequest {
    // Validate schema
    this.validate(this.transactionsGet, data);
    return data;
  }
}
