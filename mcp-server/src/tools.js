/**
 * Tool definitions for the Logistics MCP server.
 *
 * Each entry pairs a JSON Schema (what the model fills in) with a handler that
 * maps those arguments onto one External API call.
 */

import { randomUUID } from "node:crypto";

const ADDRESS_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Contact name" },
    phone: {
      type: "string",
      description: "Indian phone number in +91XXXXXXXXXX format",
    },
    email: { type: "string" },
    addressLine1: { type: "string" },
    addressLine2: { type: "string" },
    landmark: { type: "string" },
    city: { type: "string" },
    state: { type: "string" },
    pincode: { type: "string", description: "6-digit Indian pincode" },
  },
  required: ["name", "phone", "addressLine1", "city", "state", "pincode"],
};

const DIMENSIONS_SCHEMA = {
  type: "object",
  properties: {
    length: { type: "number", description: "Length in cm" },
    width: { type: "number", description: "Width in cm" },
    height: { type: "number", description: "Height in cm" },
  },
  required: ["length", "width", "height"],
};

const PACKAGE_SCHEMA = {
  type: "object",
  properties: {
    weight: { type: "number", description: "Actual weight in kg" },
    dimensions: DIMENSIONS_SCHEMA,
    description: { type: "string" },
    value: { type: "number", description: "Declared value in INR" },
    fragile: { type: "boolean" },
  },
  required: ["weight", "dimensions"],
};

export const tools = [
  {
    name: "get_quotes",
    description:
      "Get shipping rate quotes from all serviceable courier partners for a route and package. Returns each partner's price breakdown and estimated delivery time. Use this to compare options before booking; book_shipment can also quote and book in one step.",
    inputSchema: {
      type: "object",
      properties: {
        fromPincode: { type: "string", description: "6-digit pickup pincode" },
        toPincode: { type: "string", description: "6-digit delivery pincode" },
        weight: { type: "number", description: "Weight in kg" },
        dimensions: DIMENSIONS_SCHEMA,
        numberOfBoxes: { type: "integer", default: 1 },
        paymentType: { type: "string", enum: ["PREPAID", "COD"], default: "PREPAID" },
        codAmount: {
          type: "number",
          description: "Amount to collect on delivery; required when paymentType is COD",
        },
        serviceType: {
          type: "string",
          enum: ["STANDARD", "EXPRESS", "ECONOMY"],
          default: "STANDARD",
        },
        shipmentType: { type: "string", enum: ["B2B", "B2C"], default: "B2C" },
        declaredValue: { type: "number" },
      },
      required: ["fromPincode", "toPincode", "weight", "dimensions"],
    },
    handler: (client, args) =>
      client.request("POST", "/api/v1/external/shipments/rates", { body: args }),
  },

  {
    name: "book_shipment",
    description:
      "Book a shipment in a single call. Prices the route across all partners, picks one (cheapest by default, or fastest, or a specific partnerId), and books it — debiting the outlet wallet. Returns the shipment with its AWB number. This action moves money and creates a real courier booking.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "Your own unique reference for this order",
        },
        pickupAddress: ADDRESS_SCHEMA,
        deliveryAddress: ADDRESS_SCHEMA,
        packageDetails: PACKAGE_SCHEMA,
        numberOfBoxes: { type: "integer", default: 1 },
        paymentType: { type: "string", enum: ["PREPAID", "COD"], default: "PREPAID" },
        codAmount: { type: "number", description: "Required when paymentType is COD" },
        serviceType: {
          type: "string",
          enum: ["STANDARD", "EXPRESS", "ECONOMY"],
          default: "STANDARD",
        },
        shipmentType: { type: "string", enum: ["B2B", "B2C"], default: "B2C" },
        selection: {
          type: "string",
          enum: ["cheapest", "fastest"],
          default: "cheapest",
          description: "How to choose a partner when partnerId is not given",
        },
        partnerId: {
          type: "string",
          description: "Book with this specific partner instead of using `selection`",
        },
        productDescription: { type: "string" },
        specialInstructions: { type: "string" },
      },
      required: ["orderId", "pickupAddress", "deliveryAddress", "packageDetails"],
    },
    handler: (client, args) =>
      client.request("POST", "/api/v1/external/shipments", {
        body: args,
        // Protects against a duplicate booking if this call is retried.
        idempotencyKey: `mcp-${args.orderId}-${randomUUID().slice(0, 8)}`,
      }),
  },

  {
    name: "list_shipments",
    description:
      "List shipments for this account, newest first. Supports filtering by status, payment type and date range.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "integer", default: 1 },
        limit: { type: "integer", default: 20, maximum: 100 },
        status: {
          type: "string",
          enum: [
            "CREATED", "BOOKED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY",
            "DELIVERED", "CANCELLED", "RTO", "NDR", "HOLD",
          ],
        },
        paymentType: { type: "string", enum: ["PREPAID", "COD"] },
        dateFrom: { type: "string", description: "ISO 8601 date" },
        dateTo: { type: "string", description: "ISO 8601 date" },
      },
    },
    handler: (client, args) =>
      client.request("GET", "/api/v1/external/shipments", { query: args }),
  },

  {
    name: "get_shipment",
    description:
      "Get the full details of one shipment. Accepts the shipment id, its AWB number, or your own order id.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: {
          type: "string",
          description: "Shipment id, AWB number, or your order id",
        },
      },
      required: ["identifier"],
    },
    handler: (client, { identifier }) =>
      client.request(
        "GET",
        `/api/v1/external/shipments/${encodeURIComponent(identifier)}`,
      ),
  },

  {
    name: "track_shipment",
    description:
      "Get the tracking history and current status of a shipment, by shipment id, AWB number, or your order id.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: {
          type: "string",
          description: "Shipment id, AWB number, or your order id",
        },
      },
      required: ["identifier"],
    },
    handler: (client, { identifier }) =>
      client.request(
        "GET",
        `/api/v1/external/shipments/${encodeURIComponent(identifier)}/tracking`,
      ),
  },

  {
    name: "edit_shipment",
    description:
      "Update a shipment that has not yet been handed to the courier — addresses, package details, payment type or instructions.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "Shipment id, AWB, or order id" },
        pickupAddress: ADDRESS_SCHEMA,
        deliveryAddress: ADDRESS_SCHEMA,
        packageDetails: PACKAGE_SCHEMA,
        serviceType: { type: "string", enum: ["STANDARD", "EXPRESS", "ECONOMY"] },
        productDescription: { type: "string" },
        specialInstructions: { type: "string" },
      },
      required: ["identifier"],
    },
    handler: (client, { identifier, ...body }) =>
      client.request(
        "PATCH",
        `/api/v1/external/shipments/${encodeURIComponent(identifier)}`,
        { body, idempotencyKey: `mcp-edit-${randomUUID()}` },
      ),
  },

  {
    name: "cancel_shipment",
    description:
      "Cancel a shipment and refund the wallet where its state allows. This is not reversible.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "Shipment id, AWB, or order id" },
        reason: { type: "string", description: "Why the shipment is being cancelled" },
      },
      required: ["identifier", "reason"],
    },
    handler: (client, { identifier, reason }) =>
      client.request(
        "POST",
        `/api/v1/external/shipments/${encodeURIComponent(identifier)}/cancel`,
        { body: { reason }, idempotencyKey: `mcp-cancel-${identifier}` },
      ),
  },

  {
    name: "recalculate_rates",
    description:
      "Re-price an existing shipment against current rates and corrected weight or dimensions. Returns a preview without changing anything.",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "Shipment id, AWB, or order id" },
        weight: { type: "number", description: "Corrected weight in kg" },
        dimensions: DIMENSIONS_SCHEMA,
      },
      required: ["identifier"],
    },
    handler: async (client, { identifier, ...body }) => {
      const shipment = await client.request(
        "GET",
        `/api/v1/external/shipments/${encodeURIComponent(identifier)}`,
      );
      const s = shipment?.data?.shipment || shipment?.data;

      return client.request("POST", "/api/v1/external/shipments/rates", {
        body: {
          fromPincode: s.pickupPincode,
          toPincode: s.deliveryPincode,
          weight: body.weight ?? Number(s.weight),
          dimensions: body.dimensions ?? {
            length: Number(s.length),
            width: Number(s.width),
            height: Number(s.height),
          },
          numberOfBoxes: s.numberOfBoxes,
          paymentType: s.paymentType,
          ...(s.paymentType === "COD" ? { codAmount: Number(s.codAmount) } : {}),
          shipmentType: s.shipmentType,
        },
      });
    },
  },

  {
    name: "check_serviceability",
    description:
      "Check which courier partners can service a route, with distance and zone information.",
    inputSchema: {
      type: "object",
      properties: {
        fromPincode: { type: "string" },
        toPincode: { type: "string" },
        weight: { type: "number" },
        paymentType: { type: "string", enum: ["PREPAID", "COD"], default: "PREPAID" },
      },
      required: ["fromPincode", "toPincode"],
    },
    handler: (client, args) =>
      client.request("POST", "/api/v1/external/shipments/serviceability", {
        body: args,
      }),
  },
];
