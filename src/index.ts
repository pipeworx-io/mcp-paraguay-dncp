interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Paraguay DNCP MCP — Paraguay government procurement / public contracts (keyless).
 *
 * Wraps the public, no-auth Open Contracting (OCDS) API of the Dirección Nacional
 * de Contrataciones Públicas (DNCP) at
 * https://contrataciones.gov.py/datos/api/v3/doc
 *
 * Data is OCDS 1.1 (Open Contracting Data Standard). Field VALUES are in Spanish
 * (e.g. tender titles, procurement method details, statuses); output KEYS are
 * English. Monetary values are typically in PYG (Paraguayan guaraní).
 *
 * All tools return shaped, LLM-friendly objects (not raw API passthrough) and
 * never throw — fetch/parse failures resolve to { error }.
 */


const BASE = 'https://contrataciones.gov.py/datos/api/v3/doc';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'paraguay_search_tenders',
    description:
      'Search Paraguay government procurement processes (tenders/contracts) from the official DNCP Open Contracting (OCDS) API. Results are date-scoped: the API requires a date range, so if you omit date_from/date_to it defaults to roughly the last 30 days. Returns a paginated list of processes with ocid, id, title, buyer (convocante), procurement method, and dates. Field values are in Spanish; monetary amounts are in PYG. Detailed value/status/items live in the full record — pass an id to paraguay_get_record. Note: the API has no free-text search parameter, so "query" is applied as a case-insensitive client-side filter over the current page of results.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Optional keyword to filter the returned page by title/buyer (client-side, case-insensitive). The DNCP API has no server-side text search, so results are still bounded by the date range.',
        },
        date_from: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD), inclusive. Maps to fecha_desde. Defaults to ~30 days ago if both dates omitted.',
        },
        date_to: {
          type: 'string',
          description: 'End date (YYYY-MM-DD), inclusive. Maps to fecha_hasta. Defaults to today if both dates omitted.',
        },
        page: {
          type: ['number', 'string'],
          description: 'Page number (10 processes per page). Defaults to 1.',
        },
      },
    },
  },
  {
    name: 'paraguay_get_record',
    description:
      'Get the full Paraguay procurement record for a process from the official DNCP Open Contracting (OCDS) API. Pass the numeric process id (e.g. 291566) or the ocid (e.g. "ocds-03ad3f-291566-1"). Returns the compiled OCDS release: ocid, title, buyer, contract value + currency (PYG), status, procurement method, key dates, tender items, and awards (suppliers + award amounts). Field values are in Spanish; keys are English.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: ['string', 'number'],
          description: 'Process id (e.g. 291566) or full ocid (e.g. "ocds-03ad3f-291566-1").',
        },
      },
      required: ['id'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'paraguay_search_tenders':
        return await searchTenders(args);
      case 'paraguay_get_record':
        return await getRecord(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function searchTenders(args: Record<string, unknown>): Promise<unknown> {
  let dateFrom = strArg(args.date_from);
  let dateTo = strArg(args.date_to);
  // The API demands at least one filter; default to ~last 30 days when no dates given.
  if (!dateFrom && !dateTo) {
    const now = new Date();
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    dateFrom = ymd(past);
    dateTo = ymd(now);
  }
  const page = strArg(args.page) ?? '1';
  const params = new URLSearchParams();
  if (dateFrom) params.set('fecha_desde', dateFrom);
  if (dateTo) params.set('fecha_hasta', dateTo);
  params.set('page', page);

  const data = (await dncpGet(`/search/processes?${params.toString()}`)) as {
    records?: any[];
    pagination?: any;
  };

  let processes = (data.records ?? []).map((r) => shapeSearchRecord(r));

  const query = strArg(args.query);
  if (query) {
    const q = query.toLowerCase();
    processes = processes.filter(
      (p) =>
        (p.title && String(p.title).toLowerCase().includes(q)) ||
        (p.buyer && String(p.buyer).toLowerCase().includes(q)),
    );
  }

  const pg = data.pagination ?? {};
  return {
    date_from: dateFrom,
    date_to: dateTo,
    page: Number(page),
    ...(query ? { query, note: 'query applied as client-side filter over this page (API has no text search)' } : {}),
    pagination: {
      total_items: pg.total_items,
      total_pages: pg.total_pages,
      current_page: pg.current_page,
      items_per_page: pg.items_per_page,
    },
    count: processes.length,
    processes,
  };
}

function shapeSearchRecord(r: any): Record<string, unknown> {
  const cr = r?.compiledRelease ?? {};
  const t = cr.tender ?? {};
  const ocid: string | undefined = r?.ocid ?? cr.ocid;
  return {
    ocid,
    id: idFromOcid(ocid),
    title: t.title ?? null,
    buyer: cr.buyer?.name ?? null,
    method: t.procurementMethodDetails ?? t.procurementMethod ?? null,
    category: t.mainProcurementCategory ?? null,
    status: t.status ?? null,
    value: shapeValue(t.value),
    date_published: t.datePublished ?? cr.date ?? null,
  };
}

async function getRecord(args: Record<string, unknown>): Promise<unknown> {
  const raw = reqIdArg(args, 'id', '291566');
  const id = idFromOcid(raw) ?? raw;
  const data = (await dncpGet(`/ocds/record/${encodeURIComponent(id)}`)) as { records?: any[] };
  const rec = (data.records ?? [])[0];
  const cr = rec?.compiledRelease;
  if (!cr) return { error: 'record not found', id };
  const t = cr.tender ?? {};

  return {
    ocid: cr.ocid ?? rec?.ocid,
    id,
    title: t.title ?? null,
    buyer: cr.buyer ?? null,
    procuring_entity: t.procuringEntity ?? null,
    status: t.status ?? null,
    status_details: t.statusDetails ?? null,
    method: t.procurementMethod ?? null,
    method_details: t.procurementMethodDetails ?? null,
    category: t.mainProcurementCategory ?? null,
    value: shapeValue(t.value),
    dates: {
      published: t.datePublished ?? cr.date ?? null,
      tender_period: t.tenderPeriod ?? null,
      award_period: t.awardPeriod ?? null,
      contract_period: t.contractPeriod ?? null,
      enquiry_period: t.enquiryPeriod ?? null,
    },
    items: (t.items ?? []).map((it: any) => ({
      id: it.id,
      description: it.description,
      classification: it.classification?.description ?? it.classification?.id ?? null,
      quantity: it.quantity ?? null,
      unit: it.unit?.name ?? null,
      unit_value: shapeValue(it.unit?.value),
    })),
    awards: (cr.awards ?? []).map((a: any) => ({
      id: a.id,
      status: a.statusDetails ?? a.status ?? null,
      date: a.date ?? null,
      value: shapeValue(a.value),
      suppliers: (a.suppliers ?? []).map((s: any) => ({ name: s.name, id: s.id })),
    })),
    tag: cr.tag ?? null,
    source: rec?.ocid ? `${BASE}/ocds/record/${id}` : undefined,
  };
}

function shapeValue(v: any): { amount: number; currency: string } | null {
  if (!v || typeof v.amount !== 'number') return null;
  return { amount: v.amount, currency: v.currency ?? 'PYG' };
}

// ocds-03ad3f-291566-1  ->  291566 ; leaves plain numeric ids untouched.
function idFromOcid(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (/^\d+$/.test(v)) return v;
  const m = v.match(/^ocds-[^-]+-(\d+)/);
  return m ? m[1] : undefined;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function dncpGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    throw new Error(`DNCP API: ${res.status} ${body}`.trim());
  }
  return res.json();
}

function strArg(v: unknown): string | undefined {
  if (typeof v === 'string') {
    const t = v.trim();
    return t ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function reqIdArg(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string' && v.trim()) return v.trim();
  throw new Error(`Required argument "${key}" is missing. Pass a process id or ocid like ${example}.`);
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
