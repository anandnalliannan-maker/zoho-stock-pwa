import { NextResponse } from "next/server";
import { fetchCachedLiveStockRows } from "../../../lib/supabase";

const WORKSHEET_NAME = "Allocation Sheet";

const s = (v) => (v === undefined || v === null ? "" : String(v).trim());

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const modelQ = s(searchParams.get("model"));
    const variantQ = s(searchParams.get("variant"));
    const colorQ = s(searchParams.get("color"));
    const locationQ = s(searchParams.get("location"));

    const { rows, state } = await fetchCachedLiveStockRows();

    if (!rows.length) {
      return NextResponse.json({
        options: { models: [], variants: [], colors: [], locations: [] },
        results: [],
        note: "No synced data available yet. Run the stock sync first.",
        meta: {
          totalRecords: 0,
          availableRecords: 0,
          filteredRecords: 0,
          lastSyncedAt: state?.last_synced_at || null,
          sourceWorksheetName: state?.source_worksheet_name || WORKSHEET_NAME,
        },
      });
    }

    const models = Array.from(
      new Set(rows.map((row) => s(row.model_name)).filter(Boolean))
    ).sort();

    const step2 = modelQ
      ? rows.filter((row) => s(row.model_name) === modelQ)
      : rows;

    const variants = Array.from(
      new Set(step2.map((row) => s(row.model_variant)).filter(Boolean))
    ).sort();

    const step3 = variantQ
      ? step2.filter((row) => s(row.model_variant) === variantQ)
      : step2;

    const colors = Array.from(
      new Set(step3.map((row) => s(row.color)).filter(Boolean))
    ).sort();

    const step4 = colorQ
      ? step3.filter((row) => s(row.color) === colorQ)
      : step3;

    const locations = Array.from(
      new Set(step4.map((row) => s(row.location)).filter(Boolean))
    ).sort();

    const step5 = locationQ
      ? step4.filter((row) => s(row.location) === locationQ)
      : step4;

    const results = step5
      .map((row) => ({
        frameNumber: s(row.frame_number),
        color: s(row.color),
        location: s(row.location),
        executiveName: s(row.executive_name),
        model: s(row.model_name),
        variant: s(row.model_variant),
      }))
      .filter((row) => row.frameNumber)
      .sort((a, b) => a.color.localeCompare(b.color));

    return NextResponse.json({
      options: { models, variants, colors, locations },
      results,
      meta: {
        totalRecords: rows.length,
        availableRecords: rows.length,
        filteredRecords: results.length,
        lastSyncedAt: state?.last_synced_at || null,
        sourceWorksheetName: state?.source_worksheet_name || WORKSHEET_NAME,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Unknown error", stack: String(err?.stack || "") },
      { status: 500 }
    );
  }
}
