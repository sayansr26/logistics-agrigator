const express = require("express");
const router = express.Router();
const axios = require("axios");
const logger = require("../shared/lib/logger");
const swaggerUi = require("swagger-ui-express");

/**
 * Fetch individual service swagger spec
 * Helper function to retrieve OpenAPI spec from a backend service
 */
async function fetchServiceSpec(service, url) {
  try {
    const response = await axios.get(url, {
      headers: { "X-Internal-Request": process.env.INTERNAL_SECRET },
      timeout: 5000,
    });

    // Update server URL to gateway
    const spec = response.data;
    spec.servers = [
      {
        url: `http://localhost:3001`,
        description: "API Gateway (Development)",
      },
    ];

    return spec;
  } catch (error) {
    logger.error(`Failed to fetch ${service} swagger:`, error.message);
    throw error;
  }
}

// Only enable in development
if (
  process.env.NODE_ENV === "development" ||
  process.env.SWAGGER_ENABLED === "true"
) {
  // Service swagger endpoints (internal)
  const serviceSpecs = {
    auth: "http://auth-service:3002/openapi.json",
    users: "http://user-service:3003/openapi.json",
    shipments: "http://shipment-service:3004/openapi.json",
    partners: "http://partner-service:3005/openapi.json",
    wallet: "http://wallet-service:3006/openapi.json",
    support: "http://support-service:3007/openapi.json",
    platforms: "http://platform-service:3008/openapi.json",
    license: "http://license-service:3011/openapi.json",
  };

  /**
   * Individual service specs endpoints
   * GET /swagger/auth.json - Auth service OpenAPI spec
   * GET /swagger/users.json - User service OpenAPI spec
   * GET /swagger/shipments.json - Shipment service OpenAPI spec
   * etc.
   */
  Object.entries(serviceSpecs).forEach(([service, url]) => {
    router.get(`/${service}.json`, async (req, res) => {
      try {
        const spec = await fetchServiceSpec(service, url);
        res.json(spec);
      } catch (error) {
        res.status(503).json({
          status: "error",
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: `${service} service swagger unavailable`,
          },
        });
      }
    });
  });

  /**
   * Merged spec endpoint
   * GET /swagger/all.json - All services merged into one OpenAPI spec
   * Useful for generating TypeScript types or comprehensive API documentation
   */
  router.get("/all.json", async (req, res) => {
    try {
      const specs = await Promise.all(
        Object.entries(serviceSpecs).map(async ([service, url]) => {
          try {
            return { service, spec: await fetchServiceSpec(service, url) };
          } catch (error) {
            logger.warn(`Skipping ${service} in merged spec: ${error.message}`);
            return null;
          }
        }),
      );

      // Filter out failed fetches
      const validSpecs = specs.filter((s) => s !== null);

      if (validSpecs.length === 0) {
        return res.status(503).json({
          status: "error",
          error: {
            code: "NO_SERVICES_AVAILABLE",
            message: "No service swagger specs available",
          },
        });
      }

      // Create merged spec
      const mergedSpec = {
        openapi: "3.0.0",
        info: {
          title: "Logistics Aggregator Portal - Complete API",
          version: "1.0.0",
          description: "Unified API documentation for all microservices",
        },
        servers: [
          {
            url: "http://localhost:3001",
            description: "API Gateway (Development)",
          },
        ],
        paths: {},
        components: {
          schemas: {},
          securitySchemes: {},
        },
      };

      // Merge paths and components from all services
      validSpecs.forEach(({ spec }) => {
        // Merge paths
        if (spec.paths) {
          Object.entries(spec.paths).forEach(([path, methods]) => {
            mergedSpec.paths[path] = methods;
          });
        }

        // Merge schemas
        if (spec.components?.schemas) {
          Object.entries(spec.components.schemas).forEach(([name, schema]) => {
            mergedSpec.components.schemas[name] = schema;
          });
        }

        // Merge security schemes
        if (spec.components?.securitySchemes) {
          Object.entries(spec.components.securitySchemes).forEach(
            ([name, scheme]) => {
              mergedSpec.components.securitySchemes[name] = scheme;
            },
          );
        }
      });

      res.json(mergedSpec);
    } catch (error) {
      logger.error("Failed to create merged swagger spec:", error);
      res.status(500).json({
        status: "error",
        error: {
          code: "MERGE_FAILED",
          message: "Failed to create merged swagger specification",
        },
      });
    }
  });

  /**
   * Swagger UI endpoints for each service
   * GET /swagger/auth - Auth service Swagger UI
   * GET /swagger/users - User service Swagger UI
   * etc.
   */
  Object.keys(serviceSpecs).forEach((service) => {
    router.use(
      `/${service}`,
      swaggerUi.serveFiles(null, {}),
      async (req, res) => {
        try {
          const spec = await fetchServiceSpec(service, serviceSpecs[service]);
          swaggerUi.setup(spec, {
            explorer: true,
            customSiteTitle: `${service.charAt(0).toUpperCase() + service.slice(1)} Service API`,
          })(req, res);
        } catch (error) {
          res.status(503).send(`
            <html>
              <head><title>Service Unavailable</title></head>
              <body>
                <h1>Service Unavailable</h1>
                <p>The ${service} service swagger documentation is currently unavailable.</p>
                <p>Error: ${error.message}</p>
              </body>
            </html>
          `);
        }
      },
    );
  });

  /**
   * Swagger UI for merged spec
   * GET /swagger - All services combined in one Swagger UI
   */
  router.use("/", swaggerUi.serveFiles(null, {}), async (req, res) => {
    try {
      // Fetch all service specs
      const specs = await Promise.all(
        Object.entries(serviceSpecs).map(async ([service, url]) => {
          try {
            return { service, spec: await fetchServiceSpec(service, url) };
          } catch (error) {
            logger.warn(`Skipping ${service} in merged UI: ${error.message}`);
            return null;
          }
        }),
      );

      const validSpecs = specs.filter((s) => s !== null);

      if (validSpecs.length === 0) {
        return res.status(503).send(`
            <html>
              <head><title>No Services Available</title></head>
              <body>
                <h1>No Services Available</h1>
                <p>No service swagger specifications are currently available.</p>
              </body>
            </html>
          `);
      }

      // Create merged spec
      const mergedSpec = {
        openapi: "3.0.0",
        info: {
          title: "Logistics Aggregator Portal - Complete API",
          version: "1.0.0",
          description: "Unified API documentation for all microservices",
        },
        servers: [
          {
            url: "http://localhost:3001",
            description: "API Gateway (Development)",
          },
        ],
        paths: {},
        components: {
          schemas: {},
          securitySchemes: {},
        },
      };

      // Merge all specs
      validSpecs.forEach(({ spec }) => {
        if (spec.paths) {
          Object.entries(spec.paths).forEach(([path, methods]) => {
            mergedSpec.paths[path] = methods;
          });
        }
        if (spec.components?.schemas) {
          Object.entries(spec.components.schemas).forEach(([name, schema]) => {
            mergedSpec.components.schemas[name] = schema;
          });
        }
        if (spec.components?.securitySchemes) {
          Object.entries(spec.components.securitySchemes).forEach(
            ([name, scheme]) => {
              mergedSpec.components.securitySchemes[name] = scheme;
            },
          );
        }
      });

      swaggerUi.setup(mergedSpec, {
        explorer: true,
        customSiteTitle: "Logistics Aggregator Portal - Complete API",
      })(req, res);
    } catch (error) {
      logger.error("Failed to render merged swagger UI:", error);
      res.status(500).send(`
          <html>
            <head><title>Error</title></head>
            <body>
              <h1>Error</h1>
              <p>Failed to load swagger documentation.</p>
              <p>Error: ${error.message}</p>
            </body>
          </html>
        `);
    }
  });
} else {
  // In production, return message that swagger is disabled
  router.use("/", (req, res) => {
    res.status(404).json({
      status: "error",
      error: {
        code: "SWAGGER_DISABLED",
        message: "Swagger documentation is only available in development mode",
      },
    });
  });
}

module.exports = router;
