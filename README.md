# mcp-paraguay-dncp

Paraguay DNCP MCP — Paraguay government procurement / public contracts (keyless).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Paraguay Dncp data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
