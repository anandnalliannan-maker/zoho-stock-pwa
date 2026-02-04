// app/api/stock/route.js
import { NextResponse } from "next/server";
import { fetchAllRecords } from "../../../lib/zoho";

const WORKSHEET_NAME = "Allocation Sheet";

// Helper: safe string
const s = (v) => (v === undefined || v === null ? "" : String(v)).trim();

// Case-insensitive "contains"
const containsCI = (text, needle) => s(text).toLowerCase().includes(String(needle).toLowerCase());

// ====== IMPORTANT ======
// This API assumes row-1 of "Allocation Sheet" has headers.
// We will try to auto-detect your relevant columns by name.
// If headers are different, we can adjust the mapping in 1 minute.
// =======================

function detectColumns(sampleRecord) {
  const keys = Object.keys(sampleRecord || {});
  const norm = (x) => x.toLowerCase().replace(/\s+/g, "");

  // Try to map likely header names -> actual sheet keys
  const pick = (candidates) => {
    const found = keys.find((k) => candidates.includes(norm(k)));
    return found || null;
  };

  // You can tweak candidate lists once you see actual keys from your sheet.
  return {
    frameNo: pick([
      "framnumber",
      "frame",
      "framenumber",
      "frameno",
      "frameno.",
      "frame#",
    ]),
    type: pick(["type", "mc/sc", "mcsc", "modelcategory", "vehicle", "vehicletype", "vechicle"]),
    model: pick(["model", "modelname", "modelnames"]),
    variant: pick(["variant", "variantname", "modelvariant"]),
    color: pick(["color", "colour"]),
    location: pick(["location", "branch"]),
    bookingDate: pick(["bookingdate", "booking"]),
    executive: pick(["salesexecutivename", "salesexecutive", "executivename", "executive", "exe.name", "exename"]),
  };
}

function getField(rec, keyName) {
  if (!keyName) return "";
  return rec[keyName];
}

export async function GET(req) {
  try {
    const resourceId = process.env.ZOHO_DOCUMENT_ID;
    if (!resourceId) {
      return NextResponse.json(
        { error: "Missing ZOHO_DOCUMENT_ID in .env.local" },
        { status: 500 }
      );
    }

    // Read query params for cascading filters
    const { searchParams } = new URL(req.url);
    const modelQ = s(searchParams.get("model"));
    const variantQ = s(searchParams.get("variant"));
    const colorQ = s(searchParams.get("color"));
    const locationQ = s(searchParams.get("location"));

    // 1) Fetch all worksheet records (up to 1000 per call, auto-paged)
    const records = await fetchAllRecords({
      resourceId,
      worksheetName: WORKSHEET_NAME,
    });

    if (!records.length) {
      return NextResponse.json({
        options: { types: [], models: [], variants: [], colors: [] },
        results: [],
        note: "No records returned from sheet (or sheet empty).",
      });
    }

    // 2) Detect column keys from the first record
    const col = detectColumns(records[0]);

    // If detection fails, return keys so we can fix mapping fast
    const required = ["frameNo", "model", "variant", "color", "location", "executive"];
    const missing = required.filter((r) => !col[r]);

    // NOTE: even if some missing, we can still proceed, but results may be empty.
    // We'll return debug info so you can tell me the exact header names.
    const debug = {
      detectedColumns: col,
      availableKeysInSheet: Object.keys(records[0]),
      missingDetected: missing,
    };

    // 3) Apply stock availability logic:
    // - Column L (location) should NOT contain "INVOICED"
    const available = records.filter((rec) => {
      const loc = getField(rec, col.location);

      const notInvoiced = !containsCI(loc, "INVOICED");

      return notInvoiced;
    });

    // 4) Cascading filter options (based on current selection)
    // Apply selection step-by-step
    const models = Array.from(
      new Set(available.map((r) => s(getField(r, col.model))).filter(Boolean))
    ).sort();

    const step2 = modelQ
      ? available.filter((r) => s(getField(r, col.model)) === modelQ)
      : available;
    const variants = Array.from(
      new Set(step2.map((r) => s(getField(r, col.variant))).filter(Boolean))
    ).sort();

    const step3 = variantQ ? step2.filter((r) => s(getField(r, col.variant)) === variantQ) : step2;
    const colors = Array.from(new Set(step3.map((r) => s(getField(r, col.color))).filter(Boolean))).sort();

    const step4 = colorQ ? step3.filter((r) => s(getField(r, col.color)) === colorQ) : step3;
    const locations = Array.from(
      new Set(step4.map((r) => s(getField(r, col.location))).filter(Boolean))
    ).sort();

    const step5 = locationQ
      ? step4.filter((r) => s(getField(r, col.location)) === locationQ)
      : step4;

    // 5) Final results (only required columns)
    const results = step5
      .map((rec) => ({
        frameNumber: s(getField(rec, col.frameNo)),
        color: s(getField(rec, col.color)),
        location: s(getField(rec, col.location)),
        executiveName: s(getField(rec, col.executive)),
        // optional extra fields (useful for debugging)
        model: s(getField(rec, col.model)),
        variant: s(getField(rec, col.variant)),
      }))
      .filter((r) => r.frameNumber)
      .sort((a, b) => a.color.localeCompare(b.color)); // keep only rows with engine no

    return NextResponse.json({
      options: { models, variants, colors, locations },
      results,
      meta: {
        totalRecords: records.length,
        availableRecords: available.length,
        filteredRecords: results.length,
      },
      debug, // keep this for now; later we can remove in production
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Unknown error", stack: String(err?.stack || "") },
      { status: 500 }
    );
  }
}
