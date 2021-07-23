const convict = require('convict');
const fs = require('fs');

// Define a schema
const config = convict({
  env: {
    doc: 'The test environment.',
    format: ['local', 'production', 'development'],
    default: 'local',
    env: 'TEST_ENV'
  },
  trace_logs: {
    doc: 'Set to true to trace communication with servers',
    format: Boolean,
    default: 'false',
    env: 'TRACE_LOGS'
  },
  ocpp: {
    soap: {
      scheme: {
        doc: 'The OCPP server scheme.',
        format: ['http', 'https'],
        default: 'http',
        env: 'OCPP_SOAP_SCHEME',
      },
      host: {
        doc: 'The OCPP server IP address to bind.',
        format: String,
        default: '127.0.0.1',
        env: 'OCPP_SOAP_HOSTNAME'
      },
      port: {
        doc: 'The OCPP server port to bind.',
        format: 'port',
        default: 8000,
        env: 'OCPP_SOAP_PORT',
        arg: 'ocpp_soap_port'
      },
      logs: {
        doc: '"json"/"xml" to trace ocpp communication according to type, "none" to not trace them',
        format: ['json', 'xml', 'none'],
        default: 'none',
        env: 'OCPP_SOAP_LOGS'
      }
    },
    json: {
      scheme: {
        doc: 'The OCPP server scheme.',
        format: ['ws', 'wss'],
        default: 'ws',
        env: 'OCPP_JSON_SCHEME',
      },
      host: {
        doc: 'The OCPP server IP address to bind.',
        format: String,
        default: '127.0.0.1',
        env: 'OCPP_JSON_HOSTNAME'
      },
      port: {
        doc: 'The OCPP server port to bind.',
        format: 'port',
        default: 8010,
        env: 'OCPP_JSON_PORT',
        arg: 'ocpp_json_port'
      },
      logs: {
        doc: '"json" to trace ocpp communication according to type, "none" to not trace them',
        format: ['json', 'none'],
        default: 'none',
        env: 'OCPP_JSON_LOGS'
      }
    }
  },
  ocpi: {
    scheme: {
      doc: 'The OCPI server scheme.',
      format: ['http', 'https'],
      default: 'http',
      env: 'OCPI_SCHEME',
    },
    host: {
      doc: 'The OCPI server host address to bind.',
      format: String,
      default: 'localhost',
      env: 'OCPI_HOSTNAME'
    },
    port: {
      doc: 'The OCPI server port to bind.',
      format: 'port',
      default: 9090,
      env: 'OCPI_PORT',
      arg: 'ocpi_port'
    },
    cpoToken: {
      doc: 'OCPI CPO token',
      format: String,
      default: 'eyJhayI6IkNQTyIsInRpZCI6InV0YWxsIiwiemsiOiJDUE8ifQ==',
      env: 'OCPI_TOKEN'
    },
    emspToken: {
      doc: 'OCPI eMSP token',
      format: String,
      default: 'eyJhayI6IkVNU1AiLCJ0aWQiOiJ1dGFsbCIsInprIjoiRU1TUCJ9',
      env: 'OCPI_TOKEN'
    },
    logs: {
      doc: '"json" to trace ocpi communication, "none" to not trace them',
      format: ['json', 'none'],
      default: 'none',
      env: 'OCPI_LOGS'
    },
    enabled: {
      doc: 'Tests enabled flag',
      format: Boolean,
      default: false,
      env: 'OCPI_TESTS_ENABLED'
    }
  },
  server: {
    scheme: {
      doc: 'The SERVER server scheme.',
      format: ['http', 'https'],
      default: 'http',
      env: 'SERVER_SCHEME',
    },
    host: {
      doc: 'The SERVER server IP address to bind.',
      format: String,
      default: '127.0.0.1',
      env: 'SERVER_HOSTNAME'
    },
    port: {
      doc: 'The SERVER server port to bind.',
      format: 'port',
      default: 8081,
      env: 'SERVER_PORT',
      arg: 'server_port'
    },
    logs: {
      doc: '"json" to trace central server communication, "none" to not trace them',
      format: ['json', 'none'],
      default: 'none',
      env: 'SERVER_LOGS'
    }
  },
  admin: {
    username: {
      doc: 'The admin username',
      format: String,
      default: 'slf.admin@ev.com',
      env: 'ADMIN_USERNAME'
    },
    password: {
      doc: 'The admin password',
      format: String,
      default: 'Slf.admin00',
      env: 'ADMIN_PASSWORD'
    }
  },
  superadmin: {
    username: {
      doc: 'The super admin email',
      format: String,
      default: 'super.admin@ev.com',
      env: 'SUPERADMIN_USERNAME'
    },
    password: {
      doc: 'The super admin password',
      format: String,
      default: 'Super.admin00',
      env: 'SUPERADMIN_PASSWORD'
    }
  },
  mailServer: {
    host: {
      doc: 'The mail server IP address to bind.',
      format: String,
      default: '127.0.0.1',
    },
    port: {
      doc: 'The mail server port to bind.',
      format: 'port',
      default: 1080,
    },
  },
  wsClient: {
    autoReconnectMaxRetries: {
      doc: 'WebSocket client re-connection max retries.',
      format: 'int',
      default: 10,
    },
    autoReconnectTimeout: {
      doc: 'WebSocket client re-connection timeout.',
      format: 'int',
      default: 0,
    },
  },
  axios: {
    timeout: {
      doc: 'Axios HTTP client connection timeout',
      format: 'int',
      default: 60000,
    },
    retries: {
      doc: 'Axios HTTP client re-connection max retries.',
      format: 'int',
      default: 0,
    },
  },
  storage: {
    implementation: {
      doc: 'DB type',
      format: String,
      default: 'mongodb'
    },
    uri: {
      doc: 'connection string URI',
      default: null
    },
    host: {
      doc: 'host name',
      format: String,
      default: 'localhost'
    },
    port: {
      doc: 'port number',
      format: 'port',
      default: 32500
    },
    user: {
      doc: 'user name',
      format: String,
      default: ''
    },
    password: {
      doc: 'password',
      format: String,
      default: ''
    },
    database: {
      doc: 'db name',
      format: String,
      default: 'evse'
    },
    poolSize: {
      doc: 'pool size',
      format: Number,
      default: 20
    },
    replicaSet: {
      doc: 'replica set name',
      format: String,
      default: 'rs0'
    },
    monitorDBChange: {
      doc: 'monitor changes',
      format: Boolean,
      default: false
    },
    debug: {
      doc: 'debug',
      format: Boolean,
      default: false
    }
  },
  billing: {
    isTransactionBillingActivated: {
      doc: 'Activates the billing of transactions feature',
      format: Boolean,
      default: true
    },
    immediateBillingAllowed: {
      doc: 'Allow immediate billing',
      format: Boolean,
      default: true
    },
    periodicBillingAllowed: {
      doc: 'Allow periodic billing',
      format: Boolean,
      default: false
    },
    taxID: {
      doc: 'taxes to apply by default',
      format: String,
      default: ''
    }
  },
  stripe: {
    url: {
      doc: 'Billing provider dashboard',
      format: String,
      default: ''
    },
    publicKey: {
      doc: 'Public key',
      format: String,
      default: ''
    },
    secretKey: {
      doc: 'Secret Key',
      format: String,
      default: ''
    },
  },
  smartCharging: {
    optimizerUrl: {
      doc: 'Smart charging url',
      format: String,
      default: ''
    },
    user: {
      doc: 'Smart charging user',
      format: String,
      default: ''
    },
    password: {
      doc: 'Smart charging password',
      format: String,
      default: ''
    },
    stickyLimitation: {
      doc: 'Sticky limitation',
      format: Boolean,
      default: ''
    },
    limitBufferDC: {
      doc: 'Limit buffer dc',
      format: Number,
      default: ''
    },
    limitBufferAC: {
      doc: 'Limit buffer ac',
      format: Number,
      default: ''
    }
  }
});

// Load environment dependent configuration
const env = config.get('env');
const fileName = './test/config/' + env + '.json';

if (fs.existsSync(fileName)) {
  config.loadFile(fileName);
}

// Perform validation
config.validate({
  allowed: 'strict'
});

module.exports = config;
