"use client";

import { useEffect, useMemo, useState } from "react";

const emptyOptions = { models: [], variants: [], colors: [], locations: [] };

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) q.set(k, v);
  });
  return q.toString();
}

export default function Home() {
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [color, setColor] = useState("");
  const [location, setLocation] = useState("");

  const [options, setOptions] = useState(emptyOptions);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const query = useMemo(
    () =>
      buildQuery({
        model,
        variant,
        color,
        location,
      }),
    [model, variant, color, location]
  );

  useEffect(() => {
    setVariant("");
    setColor("");
  }, [model]);

  useEffect(() => {
    setColor("");
  }, [variant]);

  useEffect(() => {
    setLocation("");
  }, [color]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/stock?${query}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load stock data.");
        }

        if (!cancelled) {
          setOptions(data.options || emptyOptions);
          setResults(data.results || []);
          setMeta(data.meta || null);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f1f5ff,_#eef2f7,_#f8fafc)] px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Balu Honda Live Stock
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                Stock Lookup
              </h1>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Live availability from Zoho Sheet. Only bikes without{" "}
                <span className="font-semibold text-slate-900">INVOICED</span>{" "}
                in Location are shown.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-lg">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                Available
              </p>
              <p className="text-lg font-semibold">
                {meta ? meta.availableRecords : "--"}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Model"
              value={model}
              onChange={setModel}
              options={options.models}
            />
            <Select
              label="Variant"
              value={variant}
              onChange={setVariant}
              options={options.variants}
            />
            <Select
              label="Color"
              value={color}
              onChange={setColor}
              options={options.colors}
            />
            <Select
              label="Location"
              value={location}
              onChange={setLocation}
              options={options.locations}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <button
              type="button"
              onClick={() => {
                setModel("");
                setVariant("");
                setColor("");
                setLocation("");
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Clear filters
            </button>
            {loading ? (
              <span className="text-slate-500">Loading...</span>
            ) : (
              meta && (
                <span>
                  Showing <span className="font-semibold">{meta.filteredRecords}</span>{" "}
                  of <span className="font-semibold">{meta.availableRecords}</span>
                </span>
              )
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </section>

        <section className="grid gap-4">
        {results.map((row) => (
          <article
            key={row.engineNumber}
            className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    Engine No
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {row.engineNumber}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {row.color || "Color N/A"}
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Location
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {row.location || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Executive
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {row.executiveName || "-"}
                  </p>
                </div>
              </div>
            </article>
          ))}

          {!loading && results.length === 0 && !error && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center text-sm text-slate-500">
              No matching stock found. Try adjusting the filters.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-slate-400 focus:outline-none"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
