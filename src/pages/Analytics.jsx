import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

// ─── City → approximate lat/lon lookup ──────────────────────────
// Manually curated from known Indian city coordinates.
// Each city that appears in the API data is mapped here.
const CITY_COORDS = {
  "Mumbai":      [19.076, 72.877],
  "Delhi":       [28.704, 77.102],
  "Bengaluru":   [12.972, 77.594],
  "Bangalore":   [12.972, 77.594],
  "Hyderabad":   [17.385, 78.486],
  "Chennai":     [13.083, 80.270],
  "Kolkata":     [22.572, 88.363],
  "Pune":        [18.520, 73.856],
  "Ahmedabad":   [23.022, 72.572],
  "Jaipur":      [26.912, 75.787],
  "Surat":       [21.170, 72.831],
  "Lucknow":     [26.847, 80.947],
  "Kanpur":      [26.449, 80.331],
  "Nagpur":      [21.145, 79.088],
  "Indore":      [22.719, 75.857],
  "Bhopal":      [23.259, 77.412],
  "Patna":       [25.594, 85.137],
  "Vadodara":    [22.307, 73.181],
  "Ludhiana":    [30.901, 75.857],
  "Agra":        [27.177, 78.008],
  "Nashik":      [20.000, 73.790],
  "Coimbatore":  [11.017, 76.955],
  "Visakhapatnam":[17.686, 83.218],
  "Kochi":       [9.931, 76.267],
  "Chandigarh":  [30.733, 76.779],
  "Guwahati":    [26.144, 91.736],
  "Bhubaneswar": [20.296, 85.824],
  "Mysuru":      [12.295, 76.639],
  "Noida":       [28.535, 77.391],
  "Gurgaon":     [28.460, 77.026],
  "Gurugram":    [28.460, 77.026],
  "Faridabad":   [28.408, 77.317],
  "Meerut":      [28.984, 77.706],
  "Rajkot":      [22.303, 70.801],
  "Amritsar":    [31.634, 74.872],
  "Jodhpur":     [26.295, 73.016],
  "Ranchi":      [23.344, 85.310],
  "Jabalpur":    [23.182, 79.986],
  "Thiruvananthapuram": [8.524, 76.936],
  "Mangalore":   [12.914, 74.855],
  "Raipur":      [21.251, 81.629],
  "Aurangabad":  [19.877, 75.340],
};

function resolveCoords(city) {
  if (!city) return null;
  // Try exact match first, then case-insensitive
  const exact = CITY_COORDS[city];
  if (exact) return exact;
  const key = Object.keys(CITY_COORDS).find(
    (k) => k.toLowerCase() === city.toLowerCase()
  );
  return key ? CITY_COORDS[key] : null;
}

// ─── Salary distribution per city (custom SVG bar chart) ────────
function SalaryBarChart({ data }) {
  const CHART_W = 600;
  const CHART_H = 300;
  const PADDING = { top: 20, right: 20, bottom: 80, left: 70 };
  const innerW = CHART_W - PADDING.left - PADDING.right;
  const innerH = CHART_H - PADDING.top  - PADDING.bottom;

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        No salary data available
      </div>
    );
  }

  const maxAvg = Math.max(...data.map((d) => d.avg), 1);
  const barW   = Math.floor(innerW / data.length) - 4;

  // Y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxAvg));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full max-w-2xl"
        role="img"
        aria-label="Average salary per city bar chart"
      >
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="barHover" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#a5b4fc" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>

        {/* Grid lines + Y axis labels */}
        {ticks.map((tick) => {
          const y = PADDING.top + innerH - (tick / maxAvg) * innerH;
          return (
            <g key={tick}>
              <line
                x1={PADDING.left} y1={y}
                x2={PADDING.left + innerW} y2={y}
                stroke="#334155" strokeWidth="1" strokeDasharray="4 4"
              />
              <text
                x={PADDING.left - 8} y={y + 4}
                textAnchor="end" fill="#64748b" fontSize="11"
              >
                {tick >= 100000
                  ? `₹${(tick / 100000).toFixed(1)}L`
                  : tick >= 1000
                  ? `₹${(tick / 1000).toFixed(0)}K`
                  : `₹${tick}`}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const barH  = Math.max(2, (d.avg / maxAvg) * innerH);
          const x     = PADDING.left + i * (innerW / data.length) + (innerW / data.length - barW) / 2;
          const y     = PADDING.top + innerH - barH;
          return (
            <g key={d.city}>
              <rect
                x={x} y={y}
                width={barW} height={barH}
                fill="url(#barGrad)"
                rx="3" ry="3"
                className="transition-all duration-200 hover:fill-[url(#barHover)]"
              />
              {/* Count badge */}
              <text
                x={x + barW / 2} y={y - 5}
                textAnchor="middle" fill="#94a3b8" fontSize="10"
              >
                {d.count}
              </text>
              {/* City label */}
              <text
                x={x + barW / 2}
                y={PADDING.top + innerH + 14}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="10"
                transform={`rotate(-45 ${x + barW / 2} ${PADDING.top + innerH + 14})`}
              >
                {d.city}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line
          x1={PADDING.left} y1={PADDING.top}
          x2={PADDING.left} y2={PADDING.top + innerH}
          stroke="#475569" strokeWidth="1.5"
        />
        <line
          x1={PADDING.left} y1={PADDING.top + innerH}
          x2={PADDING.left + innerW} y2={PADDING.top + innerH}
          stroke="#475569" strokeWidth="1.5"
        />

        {/* Y axis title */}
        <text
          x={0} y={0}
          transform={`translate(14, ${PADDING.top + innerH / 2}) rotate(-90)`}
          textAnchor="middle" fill="#64748b" fontSize="11"
        >
          Avg Salary
        </text>
      </svg>
    </div>
  );
}

// ─── Main analytics page ────────────────────────────────────────
export default function Analytics() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [auditImg, setAuditImg]   = useState(null);
  const [auditId, setAuditId]     = useState(null);
  const mapRef = useRef(null);

  // Load audit image from sessionStorage
  useEffect(() => {
    const img = sessionStorage.getItem("audit_image");
    const eid = sessionStorage.getItem("audit_emp_id");
    if (img) setAuditImg(img);
    if (eid) setAuditId(eid);
  }, []);

  // Fetch employee data (same endpoint)
  useEffect(() => {
    let cancelled = false;
    async function go() {
      try {
        const res = await fetch(
          "https://backend.jotish.in/backend_dev/gettabledata.php",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "test", password: "123456" }),
          }
        );
        const json = await res.json();
        const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
        if (!cancelled) setEmployees(rows);
      } catch {
        // silent – chart just won't render
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    go();
    return () => { cancelled = true; };
  }, []);

  // ─── Compute salary distribution per city ─────────────────────
  const cityStats = (() => {
    const map = {};
    for (const emp of employees) {
      const city   = emp.city ?? "Unknown";
      const salary = parseFloat(emp.salary) || 0;
      if (!map[city]) map[city] = { total: 0, count: 0 };
      map[city].total += salary;
      map[city].count += 1;
    }
    return Object.entries(map)
      .map(([city, { total, count }]) => ({ city, avg: Math.round(total / count), count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 18); // show top 18 cities max
  })();

  // ─── Map markers ──────────────────────────────────────────────
  const mapMarkers = cityStats.map((d) => {
    const coords = resolveCoords(d.city);
    return coords ? { ...d, coords } : null;
  }).filter(Boolean);

  const maxCount = Math.max(...cityStats.map((d) => d.count), 1);

  return (
    <div className="min-h-screen bg-slate-900 py-6 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/list")}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Employee List
          </button>
          <h1 className="text-xl font-bold text-white ml-2">Analytics Dashboard</h1>
        </div>

        {/* ── Audit Image ── */}
        <section className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Audit Image (Photo + Signature Merge)
          </h2>
          {auditImg ? (
            <div className="space-y-3">
              <img
                src={auditImg}
                alt={`Audit record for employee #${auditId}`}
                className="max-w-md w-full rounded-xl border border-emerald-700/30 shadow-lg"
              />
              <p className="text-slate-500 text-xs">
                Employee #{auditId} · Merged via HTML5 Canvas (photo layer + signature layer + timestamp watermark)
              </p>
              <a
                href={auditImg}
                download={`audit-EID-${auditId}.png`}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-700/40 hover:bg-emerald-700 text-emerald-300 border border-emerald-700/40 transition"
              >
                ⬇ Download Audit PNG
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-slate-700 rounded-xl">
              <p className="text-slate-400 text-sm">No audit image found.</p>
              <p className="text-slate-600 text-xs mt-1">
                Visit a{" "}
                <button
                  onClick={() => navigate("/list")}
                  className="underline text-indigo-400 hover:text-indigo-300"
                >
                  details page
                </button>
                {" "}to capture a photo and sign it first.
              </p>
            </div>
          )}
        </section>

        {/* ── Stats row ── */}
        {!loading && employees.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Employees", value: employees.length },
              { label: "Unique Cities",   value: [...new Set(employees.map((e) => e.city).filter(Boolean))].length },
              {
                label: "Avg Salary",
                value:
                  "₹" +
                  Math.round(
                    employees.reduce((s, e) => s + (parseFloat(e.salary) || 0), 0) /
                      employees.length
                  ).toLocaleString("en-IN"),
              },
              {
                label: "Departments",
                value: [...new Set(employees.map((e) => e.department).filter(Boolean))].length,
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <p className="text-slate-500 text-xs mb-1">{label}</p>
                <p className="text-white text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── SVG Bar Chart ── */}
        <section className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Salary Distribution per City
            <span className="text-slate-600 font-normal text-xs">(raw SVG — no chart library)</span>
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <SalaryBarChart data={cityStats} />
          )}
        </section>

        {/* ── Leaflet Map ── */}
        <section className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Geospatial City Distribution
          </h2>
          <p className="text-slate-500 text-xs mb-3">
            <strong className="text-slate-400">City-to-coordinate mapping:</strong> A static lookup table
            maps each city name (case-insensitive) to its lat/lon. Bubble radius scales with employee count
            (radius = 6 + (count/maxCount) × 18). Cities not in the lookup are omitted gracefully.
            Leaflet renders OpenStreetMap tiles; no custom geocoding API is used.
          </p>
          <div className="rounded-xl overflow-hidden border border-slate-700" style={{ height: 420 }}>
            {!loading && (
              <MapContainer
                center={[20.5, 78.9]}
                zoom={4}
                style={{ height: "100%", width: "100%", background: "#0f172a" }}
                scrollWheelZoom={false}
                ref={mapRef}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  maxZoom={18}
                />
                {mapMarkers.map(({ city, count, avg, coords }) => {
                  const radius = 6 + (count / maxCount) * 18;
                  return (
                    <CircleMarker
                      key={city}
                      center={coords}
                      radius={radius}
                      pathOptions={{
                        color: "#818cf8",
                        fillColor: "#6366f1",
                        fillOpacity: 0.7,
                        weight: 1.5,
                      }}
                    >
                      <Tooltip>
                        <div className="text-xs">
                          <p className="font-bold">{city}</p>
                          <p>{count} employee{count !== 1 ? "s" : ""}</p>
                          <p>Avg ₹{avg.toLocaleString("en-IN")}</p>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            )}
          </div>
          <p className="text-slate-600 text-xs mt-2">
            {mapMarkers.length} of {cityStats.length} cities mapped · using Leaflet + CartoDB dark tiles
          </p>
        </section>

        {/* ── City table ── */}
        {!loading && cityStats.length > 0 && (
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Tabular Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700">
                    <th className="text-left pb-2 pr-4">City</th>
                    <th className="text-right pb-2 pr-4">Employees</th>
                    <th className="text-right pb-2 pr-4">Avg Salary</th>
                    <th className="text-right pb-2">Coordinates</th>
                  </tr>
                </thead>
                <tbody>
                  {cityStats.map(({ city, count, avg }) => {
                    const coords = resolveCoords(city);
                    return (
                      <tr key={city} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                        <td className="py-2 pr-4 text-slate-200">{city}</td>
                        <td className="py-2 pr-4 text-right text-slate-400">{count}</td>
                        <td className="py-2 pr-4 text-right text-emerald-400 font-mono">
                          ₹{avg.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 text-right text-slate-600 font-mono text-xs">
                          {coords ? `${coords[0].toFixed(2)}, ${coords[1].toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
