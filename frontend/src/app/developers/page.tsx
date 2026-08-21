"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  KeyRound,
  Terminal,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Gauge,
  Boxes,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { PageContainer, PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CodeBlock, MethodBadge } from "@/components/developers/code-block";
import {
  API_BASE,
  DOC_SECTIONS,
  ERROR_CODES,
  RATE_LIMITS,
} from "@/docs/external-api/endpoints";
import { cn } from "@/lib/utils";

/** Side-nav entries: the static pages plus one per documented section. */
const NAV = [
  { id: "overview", title: "Overview", icon: BookOpen },
  { id: "quickstart", title: "Quickstart", icon: Zap },
  ...DOC_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    icon: s.id === "authentication" ? ShieldCheck : Boxes,
  })),
  { id: "errors", title: "Errors", icon: AlertTriangle },
  { id: "rate-limits", title: "Rate limits", icon: Gauge },
  { id: "mcp", title: "MCP server", icon: Terminal },
];

export default function DevelopersPage() {
  const [activeId, setActiveId] = useState("overview");

  // Highlight whichever section is nearest the top of the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    NAV.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeader
          title="Developers"
          description="Integrate shipment booking, tracking and management directly into your own systems."
        />

        <div className="flex flex-col gap-8 lg:flex-row">
          <nav className="lg:sticky lg:top-20 lg:h-fit lg:w-56 lg:shrink-0">
            <Button asChild size="sm" className="mb-4 w-full">
              <Link href="/developers/credentials">
                <KeyRound className="mr-2 h-4 w-4" />
                API Credentials
              </Link>
            </Button>
            <ul className="flex flex-wrap gap-1 lg:flex-col">
              {NAV.map(({ id, title, icon: Icon }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      activeId === id
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 flex-1 space-y-12">
            <Overview />
            <Quickstart />

            {DOC_SECTIONS.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-20 space-y-6"
              >
                <h2 className="text-2xl font-semibold tracking-tight">
                  {section.title}
                </h2>
                {section.endpoints.map((endpoint) => (
                  <EndpointCard key={endpoint.id} endpoint={endpoint} />
                ))}
              </section>
            ))}

            <Errors />
            <RateLimitsSection />
            <McpSection />
          </div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}

function Overview() {
  return (
    <section id="overview" className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
      <p className="max-w-3xl text-muted-foreground">
        The External Shipment API lets you book, track and manage shipments from
        your own systems &mdash; an ERP, a storefront, or a script. It is a REST
        API over JSON, authenticated with API credentials you create yourself.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Base URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="break-all font-mono text-sm">{API_BASE}</code>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm text-muted-foreground">
              Bearer token, exchanged from a client id and secret. Valid one
              hour.
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Versioning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm text-muted-foreground">
              Path major (<code className="font-mono">/v1</code>) plus a dated{" "}
              <code className="font-mono">LGK-Version</code> header pinned to
              your credential.
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Response shape</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Every response carries a <code className="font-mono">success</code>{" "}
            flag and a <code className="font-mono">request_id</code>. Quote the
            request id when contacting support.
          </p>
          <CodeBlock
            samples={[
              {
                label: "Success",
                language: "json",
                code: `{
  "success": true,
  "data": { },
  "meta": { "pagination": { } },
  "request_id": "req_9370c0b2d9f2054f"
}`,
              },
              {
                label: "Error",
                language: "json",
                code: `{
  "success": false,
  "error": {
    "type": "invalid_request_error",
    "code": "validation_failed",
    "message": "pincode must be 6 digits",
    "details": [ { "param": "toPincode", "message": "pincode must be 6 digits" } ]
  },
  "request_id": "req_47a71968efc8af73"
}`,
              },
            ]}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function Quickstart() {
  const steps = [
    {
      title: "Create API credentials",
      body: (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Create a key on the API Credentials page. Copy the secret &mdash; it
            is shown only once.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/developers/credentials">
              <KeyRound className="mr-2 h-4 w-4" />
              Create a credential
            </Link>
          </Button>
        </div>
      ),
    },
    {
      title: "Exchange them for a token",
      body: (
        <CodeBlock
          samples={[
            {
              label: "cURL",
              language: "bash",
              code: `TOKEN=$(curl -s -X POST ${API_BASE}/api/v1/external/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"clientId":"lgk_live_...","clientSecret":"sk_live_..."}' \\
  | jq -r .data.accessToken)`,
            },
            {
              label: "Node.js",
              language: "javascript",
              code: `const res = await fetch("${API_BASE}/api/v1/external/auth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    clientId: process.env.LOGISTICS_CLIENT_ID,
    clientSecret: process.env.LOGISTICS_CLIENT_SECRET,
  }),
});

const { data } = await res.json();
const token = data.accessToken; // reuse for data.expiresIn seconds`,
            },
            {
              label: "Python",
              language: "python",
              code: `import os, requests

res = requests.post(
    "${API_BASE}/api/v1/external/auth/token",
    json={
        "clientId": os.environ["LOGISTICS_CLIENT_ID"],
        "clientSecret": os.environ["LOGISTICS_CLIENT_SECRET"],
    },
)

token = res.json()["data"]["accessToken"]  # reuse until it expires`,
            },
          ]}
        />
      ),
    },
    {
      title: "Book a shipment",
      body: (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            One call prices every partner, picks the cheapest, and books.
          </p>
          <CodeBlock
            samples={[
              {
                label: "cURL",
                language: "bash",
                code: `curl -X POST ${API_BASE}/api/v1/external/shipments \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-1042" \\
  -d '{
    "orderId": "ORDER-1042",
    "selection": "cheapest",
    "pickupAddress": { "name": "Warehouse", "phone": "+919876543210",
      "addressLine1": "12 Fort Street", "city": "Mumbai",
      "state": "Maharashtra", "pincode": "400001" },
    "deliveryAddress": { "name": "Riya Sharma", "phone": "+919812345678",
      "addressLine1": "88 Palm Beach Road", "city": "Navi Mumbai",
      "state": "Maharashtra", "pincode": "410210" },
    "packageDetails": { "weight": 5,
      "dimensions": { "length": 30, "width": 20, "height": 15 } }
  }'`,
              },
              {
                label: "Node.js",
                language: "javascript",
                code: `const res = await fetch("${API_BASE}/api/v1/external/shipments", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": "order-1042",
  },
  body: JSON.stringify({
    orderId: "ORDER-1042",
    selection: "cheapest",
    pickupAddress: {
      name: "Warehouse", phone: "+919876543210",
      addressLine1: "12 Fort Street", city: "Mumbai",
      state: "Maharashtra", pincode: "400001",
    },
    deliveryAddress: {
      name: "Riya Sharma", phone: "+919812345678",
      addressLine1: "88 Palm Beach Road", city: "Navi Mumbai",
      state: "Maharashtra", pincode: "410210",
    },
    packageDetails: {
      weight: 5,
      dimensions: { length: 30, width: 20, height: 15 },
    },
  }),
});

const { data } = await res.json();
console.log(data.shipment.awbNumber);`,
              },
              {
                label: "Python",
                language: "python",
                code: `import requests

res = requests.post(
    "${API_BASE}/api/v1/external/shipments",
    headers={
        "Authorization": f"Bearer {token}",
        "Idempotency-Key": "order-1042",
    },
    json={
        "orderId": "ORDER-1042",
        "selection": "cheapest",
        "pickupAddress": {
            "name": "Warehouse", "phone": "+919876543210",
            "addressLine1": "12 Fort Street", "city": "Mumbai",
            "state": "Maharashtra", "pincode": "400001",
        },
        "deliveryAddress": {
            "name": "Riya Sharma", "phone": "+919812345678",
            "addressLine1": "88 Palm Beach Road", "city": "Navi Mumbai",
            "state": "Maharashtra", "pincode": "410210",
        },
        "packageDetails": {
            "weight": 5,
            "dimensions": {"length": 30, "width": 20, "height": 15},
        },
    },
)

data = res.json()["data"]
print(data["shipment"]["awbNumber"])`,
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <section id="quickstart" className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Quickstart</h2>
      <p className="max-w-3xl text-muted-foreground">
        Book your first shipment in three steps.
      </p>

      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <h3 className="font-medium">{step.title}</h3>
              {step.body}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EndpointCard({ endpoint }: { endpoint: any }) {
  return (
    <Card id={endpoint.id} className="scroll-mt-20">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={endpoint.method} />
          <code className="break-all font-mono text-sm">{endpoint.path}</code>
        </div>
        <CardTitle className="text-base">{endpoint.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{endpoint.description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {endpoint.params?.length ? (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Parameters
            </h4>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Name</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoint.params.map((p: any) => (
                    <TableRow key={p.name}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {p.name}
                        {p.required ? (
                          <span className="ml-1 text-rose-500" title="Required">
                            *
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.type}
                      </TableCell>
                      <TableCell className="text-xs">{p.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Request
          </h4>
          <CodeBlock samples={endpoint.samples} />
        </div>

        {endpoint.responseSample ? (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Response
            </h4>
            <CodeBlock
              samples={[
                {
                  label: "200 OK",
                  language: "json",
                  code: endpoint.responseSample,
                },
              ]}
            />
          </div>
        ) : null}

        {endpoint.notes?.length ? (
          <ul className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            {endpoint.notes.map((note: string) => (
              <li
                key={note}
                className="flex gap-2 text-xs text-amber-900 dark:text-amber-200"
              >
                <span aria-hidden>&bull;</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Errors() {
  return (
    <section id="errors" className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Errors</h2>
      <p className="max-w-3xl text-muted-foreground">
        Errors carry a stable <code className="font-mono">code</code> &mdash;
        branch on that, not on the message, which may change.
      </p>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-56">Code</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead>Meaning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ERROR_CODES.map((e) => (
                <TableRow key={e.code}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {e.code}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{e.meaning}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function RateLimitsSection() {
  return (
    <section id="rate-limits" className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Rate limits</h2>
      <p className="max-w-3xl text-muted-foreground">
        Limits apply per credential, not per IP. Every response carries{" "}
        <code className="font-mono">RateLimit-Limit</code>,{" "}
        <code className="font-mono">RateLimit-Remaining</code> and{" "}
        <code className="font-mono">RateLimit-Reset</code>; a 429 adds{" "}
        <code className="font-mono">Retry-After</code>.
      </p>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operation</TableHead>
                <TableHead className="w-36">Limit</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RATE_LIMITS.map((r) => (
                <TableRow key={r.operation}>
                  <TableCell className="text-sm">{r.operation}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {r.limit}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.note}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Idempotency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Send an <code className="font-mono">Idempotency-Key</code> header on
            every booking. Retrying with the same key replays the original
            response &mdash; including the original shipment &mdash; instead of
            booking and charging twice. Reusing a key with a different body is
            rejected with{" "}
            <code className="font-mono">idempotency_key_reuse</code>.
          </p>
          <CodeBlock
            samples={[
              {
                label: "cURL",
                language: "bash",
                code: `# Safe to retry: the second call replays the first result.
curl -X POST ${API_BASE}/api/v1/external/shipments \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: order-1042" \\
  -H "Content-Type: application/json" \\
  -d @shipment.json

# Response header on a replay:
#   Idempotency-Replayed: true`,
              },
              {
                label: "Node.js",
                language: "javascript",
                code: `// One key per order attempt. Retrying with it is always safe:
// you get the original shipment back, not a second booking.
async function book(order, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch("${API_BASE}/api/v1/external/shipments", {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${token}\`,
        "Content-Type": "application/json",
        "Idempotency-Key": \`order-\${order.id}\`,
      },
      body: JSON.stringify(order.payload),
    });

    if (res.ok) {
      if (res.headers.get("Idempotency-Replayed") === "true") {
        console.log("Replayed the original booking - no double charge.");
      }
      return (await res.json()).data;
    }

    // Still processing an identical request; back off and retry.
    const { error } = await res.json();
    if (error.code !== "idempotency_key_in_progress") throw new Error(error.message);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }

  throw new Error("Booking did not settle in time");
}`,
              },
              {
                label: "Python",
                language: "python",
                code: `import time, requests

# One key per order attempt. Retrying with it is always safe:
# you get the original shipment back, not a second booking.
def book(order, attempts=3):
    for i in range(attempts):
        res = requests.post(
            "${API_BASE}/api/v1/external/shipments",
            headers={
                "Authorization": f"Bearer {token}",
                "Idempotency-Key": f"order-{order['id']}",
            },
            json=order["payload"],
        )

        if res.ok:
            if res.headers.get("Idempotency-Replayed") == "true":
                print("Replayed the original booking - no double charge.")
            return res.json()["data"]

        # Still processing an identical request; back off and retry.
        error = res.json()["error"]
        if error["code"] != "idempotency_key_in_progress":
            raise RuntimeError(error["message"])
        time.sleep(2 ** i)

    raise RuntimeError("Booking did not settle in time")`,
              },
            ]}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function McpSection() {
  const mcpTools: Array<[string, string]> = [
    ["get_quotes", "Price a route across all serviceable partners"],
    ["book_shipment", "Quote, pick a partner and book in one call"],
    ["list_shipments", "List shipments with status and date filters"],
    ["get_shipment", "Details by shipment id, AWB or your order id"],
    ["track_shipment", "Tracking history and current status"],
    ["edit_shipment", "Update a shipment before carrier handover"],
    ["cancel_shipment", "Cancel and refund where the state allows"],
    ["recalculate_rates", "Re-price an existing shipment"],
    ["check_serviceability", "Which partners cover a route"],
  ];

  return (
    <section id="mcp" className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">MCP server</h2>
      <p className="max-w-3xl text-muted-foreground">
        The same API is available as an{" "}
        <a
          href="https://modelcontextprotocol.io"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          MCP
        </a>{" "}
        server, so an AI assistant can quote, book, track and cancel shipments
        for you directly. It uses the same credentials as the REST API.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add this to your MCP client&apos;s config, filling in a credential
            from the API Credentials page.
          </p>
          <CodeBlock
            samples={[
              {
                label: "Claude Desktop",
                language: "json",
                code: `{
  "mcpServers": {
    "logistics": {
      "command": "npx",
      "args": ["-y", "@logistics/mcp-server"],
      "env": {
        "LOGISTICS_BASE_URL": "${API_BASE}",
        "LOGISTICS_CLIENT_ID": "lgk_live_...",
        "LOGISTICS_CLIENT_SECRET": "sk_live_..."
      }
    }
  }
}`,
              },
              {
                label: "Claude Code",
                language: "bash",
                code: `claude mcp add logistics \\
  --env LOGISTICS_BASE_URL=${API_BASE} \\
  --env LOGISTICS_CLIENT_ID=lgk_live_... \\
  --env LOGISTICS_CLIENT_SECRET=sk_live_... \\
  -- npx -y @logistics/mcp-server`,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available tools</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Tool</TableHead>
                <TableHead>What it does</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mcpTools.map(([name, desc]) => (
                <TableRow key={name}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {name}
                  </TableCell>
                  <TableCell className="text-xs">{desc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
