const CACHE_TABLE = "balu_honda_live_stock_cache";
const SYNC_STATE_TABLE = "balu_honda_live_stock_sync_state";
const CACHE_NAME = "balu_honda_live_stock";

function requireEnv(nameList) {
  for (const name of nameList) {
    const value = process.env[name];
    if (value) return value;
  }

  throw new Error(`Missing env var: ${nameList.join(" or ")}`);
}

function getBaseUrl() {
  const projectUrl = requireEnv(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
  return `${projectUrl.replace(/\/$/, "")}/rest/v1`;
}

function getHeaders(extra = {}) {
  const serviceRoleKey = requireEnv([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE",
  ]);

  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function parseResponse(res) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(
      `Supabase REST failed: ${res.status} ${JSON.stringify(data)}`
    );
  }

  return data;
}

export async function fetchActiveBatchState() {
  const url = new URL(`${getBaseUrl()}/${SYNC_STATE_TABLE}`);
  url.searchParams.set("cache_name", `eq.${CACHE_NAME}`);
  url.searchParams.set("select", "*");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: getHeaders(),
    cache: "no-store",
  });

  const rows = await parseResponse(res);
  return rows?.[0] || null;
}

export async function fetchCachedLiveStockRows() {
  const state = await fetchActiveBatchState();
  if (!state?.active_batch_id) {
    return { rows: [], state: null };
  }

  const url = new URL(`${getBaseUrl()}/${CACHE_TABLE}`);
  url.searchParams.set("sync_batch_id", `eq.${state.active_batch_id}`);
  url.searchParams.set("select", "*");
  url.searchParams.set("order", "color.asc,frame_number.asc");

  const res = await fetch(url.toString(), {
    headers: getHeaders(),
    cache: "no-store",
  });

  const rows = await parseResponse(res);
  return { rows: rows || [], state };
}

export async function replaceLiveStockCache({
  batchId,
  rows,
  sourceDocumentId,
  sourceWorksheetName,
}) {
  const syncedAt = new Date().toISOString();
  const payload = rows.map((row) => ({
    cache_name: CACHE_NAME,
    sync_batch_id: batchId,
    frame_number: row.frameNumber,
    model_name: row.model,
    model_variant: row.variant,
    color: row.color,
    location: row.location,
    executive_name: row.executiveName,
    source_document_id: sourceDocumentId,
    source_worksheet_name: sourceWorksheetName,
    synced_at: syncedAt,
  }));

  if (payload.length) {
    const cacheUrl = new URL(`${getBaseUrl()}/${CACHE_TABLE}`);
    cacheUrl.searchParams.set("on_conflict", "sync_batch_id,frame_number");

    await parseResponse(
      await fetch(cacheUrl.toString(), {
        method: "POST",
        headers: getHeaders({
          Prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify(payload),
      })
    );
  }

  const stateUrl = new URL(`${getBaseUrl()}/${SYNC_STATE_TABLE}`);
  stateUrl.searchParams.set("on_conflict", "cache_name");

  await parseResponse(
    await fetch(stateUrl.toString(), {
      method: "POST",
      headers: getHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify([
        {
          cache_name: CACHE_NAME,
          active_batch_id: batchId,
          last_synced_at: syncedAt,
          source_document_id: sourceDocumentId,
          source_worksheet_name: sourceWorksheetName,
          row_count: payload.length,
        },
      ]),
    })
  );

  const cleanupUrl = new URL(`${getBaseUrl()}/${CACHE_TABLE}`);
  cleanupUrl.searchParams.set("cache_name", `eq.${CACHE_NAME}`);
  cleanupUrl.searchParams.set("sync_batch_id", `neq.${batchId}`);

  await parseResponse(
    await fetch(cleanupUrl.toString(), {
      method: "DELETE",
      headers: getHeaders({
        Prefer: "return=minimal",
      }),
    })
  );

  return {
    syncedAt,
    rowCount: payload.length,
  };
}

export { CACHE_NAME, CACHE_TABLE, SYNC_STATE_TABLE };
