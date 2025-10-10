const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'License Service API',
      version: '1.0.0',
      description: 'License management and activation service for logistics platform',
      contact: {
        name: 'Logistics Team',
        email: 'support@logistics.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3011/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://api.logistics.com/license/api/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authorization token'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for service-to-service communication'
        }
      },
      schemas: {
        License: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'License ID'
            },
            key: {
              type: 'string',
              description: 'Encrypted license key'
            },
            clientId: {
              type: 'string',
              format: 'uuid',
              description: 'Client ID'
            },
            type: {
              type: 'string',
              enum: ['TRIAL', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'],
              description: 'License type'
            },
            plan: {
              type: 'string',
              enum: ['MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME', 'COMMISSION_BASED', 'PAY_AS_YOU_GO'],
              description: 'Subscription plan'
            },
            status: {
              type: 'string',
              enum: ['INACTIVE', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED'],
              description: 'License status'
            },
            allowedServices: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of allowed services'
            },
            maxActivations: {
              type: 'integer',
              description: 'Maximum number of activations allowed'
            },
            validFrom: {
              type: 'string',
              format: 'date-time',
              description: 'License validity start date'
            },
            validUntil: {
              type: 'string',
              format: 'date-time',
              description: 'License expiry date'
            }
          }
        },
        Activation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            licenseId: {
              type: 'string',
              format: 'uuid'
            },
            machineId: {
              type: 'string',
              description: 'Hardware fingerprint'
            },
            serverIP: {
              type: 'string',
              format: 'ipv4',
              description: 'Server IP address'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'REVOKED']
            },
            deployedServices: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            activatedAt: {
              type: 'string',
              format: 'date-time'
            },
            lastSeenAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Subscription: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            clientId: {
              type: 'string',
              format: 'uuid'
            },
            plan: {
              type: 'string',
              enum: ['MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME']
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']
            },
            amount: {
              type: 'number',
              format: 'float'
            },
            currency: {
              type: 'string',
              default: 'INR'
            },
            billingCycle: {
              type: 'string',
              enum: ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'LIFETIME']
            },
            nextBillingDate: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'error'
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            code: {
              type: 'string',
              example: 'ERROR_CODE'
            },
            details: {
              type: 'object'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [__dirname + '/../routes/*.js', __dirname + '/../controllers/*.js'] // Path to the API routes
};

const specs = swaggerJsdoc(options);

const setup = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'License Service API Documentation',
    customfavIcon: '/favicon.ico'
  }));
};

module.exports = {
  setup,
  specs
};