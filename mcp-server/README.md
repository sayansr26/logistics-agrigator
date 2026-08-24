# Logistics Aggregator MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes the Logistics
Aggregator **External Shipment API** as tools, so an assistant can quote, book,
track, edit and cancel shipments directly.

## Getting credentials

In the portal, go to **Developers → API Credentials** and create a credential.
You get a `clientId` (`lgk_live_…`) and a `clientSecret` (`sk_live_…`). The
secret is shown **once** — store it somewhere safe.

The credential is bound to a single outlet: everything this server does happens
as that outlet, scoped to that outlet's shipments.

## Setup

Add the server to your MCP client's configuration.

**Claude Desktop** — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "logistics": {
      "command": "npx",
      "args": ["-y", "@subsolution/mcp-server"],
      "env": {
        "LOGISTICS_BASE_URL": "https://ops.subsolution.in",
        "LOGISTICS_CLIENT_ID": "lgk_live_...",
        "LOGISTICS_CLIENT_SECRET": "sk_live_..."
      }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add logistics \
  --env LOGISTICS_BASE_URL=https://ops.subsolution.in \
  --env LOGISTICS_CLIENT_ID=lgk_live_... \
  --env LOGISTICS_CLIENT_SECRET=sk_live_... \
  -- npx -y @subsolution/mcp-server
```

| Variable                  | Required | Description                                         |
| ------------------------- | -------- | --------------------------------------------------- |
| `LOGISTICS_CLIENT_ID`     | yes      | Credential client id                                |
| `LOGISTICS_CLIENT_SECRET` | yes      | Credential secret                                   |
| `LOGISTICS_BASE_URL`      | no       | API base URL (default `https://ops.subsolution.in`) |

## Tools

| Tool                   | What it does                                                 |
| ---------------------- | ------------------------------------------------------------ |
| `get_quotes`           | Price a route across all serviceable partners                |
| `book_shipment`        | Quote, pick a partner and book in one call — **moves money** |
| `list_shipments`       | List shipments, with status/date filters                     |
| `get_shipment`         | Full details by shipment id, AWB or your order id            |
| `track_shipment`       | Tracking history and current status                          |
| `edit_shipment`        | Update a shipment before carrier handover                    |
| `cancel_shipment`      | Cancel and refund where the state allows                     |
| `recalculate_rates`    | Re-price an existing shipment against current rates          |
| `check_serviceability` | Which partners cover a route                                 |

### Booking

`book_shipment` is one-step: it prices the route, picks a partner
(`selection: "cheapest" | "fastest"`, or an explicit `partnerId`), and books —
debiting the outlet's wallet. Every booking carries an idempotency key, so a
retried call replays the original result instead of booking twice.

## Notes

- Tokens are handled for you: minted on demand, cached for their hour, and
  refreshed once automatically if the API returns 401.
- Errors surface the API's own `code` and `request_id`; quote the request id in
  any support conversation.
- Requests are rate limited per credential (60/min by default, 20/min for
  bookings). The tools surface `rate_limit_exceeded` with a retry hint.

## Development

```bash
npm install
LOGISTICS_CLIENT_ID=… LOGISTICS_CLIENT_SECRET=… npm start   # stdio
npm run inspect                                             # MCP Inspector
```
