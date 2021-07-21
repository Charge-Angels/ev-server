import express from 'express';
import fs from 'fs';
import global from '../../../../../types/GlobalType';
import swaggerUi from 'swagger-ui-express';

const options = {
  explorer: false
};

export default class SwaggerRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    const oasDocument = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v2/docs/e-mobility-oas.json`, 'utf8'));
    this.router.use('/', swaggerUi.serve);
    this.router.get('/', swaggerUi.setup(oasDocument, options));
    return this.router;
  }
}

