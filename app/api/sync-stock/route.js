import { NextResponse } from "next/server";
import { fetchAllRecords } from "../../../lib/zoho";
import { replaceLiveStockCache } from "../../../lib/supabase";

const WORKSHEET_NAME = "Allocation Sheet";

const s = (v) => (v === undefined || v === null ? "" : String(v).trim());

function detectColumns(sampleRecord) {
  const keys = Object.keys(sampleRecord || {});
  const norm = (x) => x.toLowerCase().replace(/\s+/g, "");

  const pick = (candidates) => {
    const found = keys.find((k) => candidates.includes(norm(k)));
    return found || null;
  };

  return {
    frameNo: pick([
      "framnumber",
      "framenumber",
      "frameno",
      "frameno.",
      "frame#",
    ]),
    model: pick(["model", "modelname", "modelnames"]),
    variant: pick(["variant", "variantname", "modelvariant"]),
    color: pick(["color", "colour"]),
    location: pick(["location", "branch"]),
    executive: pick([
      "salesexecutivename",
      "salesexecutive",
      "executivename",
      "executive",
      "exe.name",
      "exename",
    ]),
  };
}

function getField(rec, keyName) {
  return keyName ? rec[keyName] : "";
}

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return true;

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token && token === secret) return true;

  const key = new URL(req.url).searchParams.get("key");
  return key === secret;
}

async function runSync() {
  const resourceId = process.env.ZOHO_DOCUMENT_ID;
  if (!resourceId) {
    throw new Error("Missing ZOHO_DOCUMENT_ID");
  }

  const records = await fetchAllRecords({
    resourceId,
    worksheetName: WORKSHEET_NAME,
  });

  if (!records.length) {
    throw new Error("Zoho sync returned no records");
  }

  const col = detectColumns(records[0]);
  const required = ["frameNo", "model", "variant", "color", "location"];
  const missing = required.filter((key) => !col[key]);
  if (missing.length) {
    throw new Error(`Missing expected sheet columns: ${missing.join(", ")}`);
  }

  const rows = records
    .filter((rec) => !s(getField(rec, col.location)).toLowerCase().includes("invoiced"))
    .map((rec) => ({
      frameNumber: s(getField(rec, col.frameNo)),
      model: s(getField(rec, col.model)),
      variant: s(getField(rec, col.variant)),
      color: s(getField(rec, col.color)),
      location: s(getField(rec, col.location)),
      executiveName: s(getField(rec, col.executive)),
    }))
    .filter((row) => row.frameNumber);

  const batchId = new Date().toISOString();
  const result = await replaceLiveStockCache({
    batchId,
    rows,
    sourceDocumentId: resourceId,
    sourceWorksheetName: WORKSHEET_NAME,
  });

  return {
    batchId,
    ...result,
  };
}

export async function GET(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSync();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Unknown error", stack: String(err?.stack || "") },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  return GET(req);
}
