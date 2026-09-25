# mcp-paraguay-dncp

Paraguay DNCP MCP — Paraguay government procurement / public contracts (keyless).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1679+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `paraguay_search_tenders` | Search Paraguay government procurement processes (tenders/contracts) from the official DNCP Open Contracting (OCDS) API. Results are date-scoped: the API requires a date range, so if you omit date_from/date_to it defaults to roughly the last 30 days. Returns a paginated list of processes with ocid, id, title, buyer (convocante), procurement method, and dates. Field values are in Spanish; monetary amounts are in PYG. Detailed value/status/items live in the full record — pass an id to paraguay_get_record. Note: the API has no free-text search parameter, so "query" is applied as a case-insensitive client-side filter over the current page of results. |
| `paraguay_get_record` | Get the full Paraguay procurement record for a process from the official DNCP Open Contracting (OCDS) API. Pass the numeric process id (e.g. 291566) or the ocid (e.g. "ocds-03ad3f-291566-1"). Returns the compiled OCDS release: ocid, title, buyer, contract value + currency (PYG), status, procurement method, key dates, tender items, and awards (suppliers + award amounts). Field values are in Spanish; keys are English. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "paraguay-dncp": {
      "url": "https://gateway.pipeworx.io/paraguay-dncp/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/paraguay-dncp/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1679+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/paraguay_search_tenders \
  -H 'Content-Type: application/json' \
  -d '{"query":"construcción","date_from":"2024-01-01","date_to":"2024-01-31"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/paraguay_search_tenders`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "paraguay-dncp": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-paraguay-dncp"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-paraguay-dncp
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Paraguay Dncp data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
