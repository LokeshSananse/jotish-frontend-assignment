import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useVirtualList } from "../hooks/useVirtualList";

const ROW_HEIGHT = 52; // px – each employee row

const COLUMNS = [
  { key: "id",         label: "ID",         width: "w-16"  },
  { key: "name",       label: "Name",        width: "w-44"  },
  { key: "email",      label: "Email",       width: "flex-1"},
  { key: "city",       label: "City",        width: "w-32"  },
  { key: "salary",     label: "Salary",      width: "w-32"  },
  { key: "department", label: "Department",  width: "w-36"  },
];

function formatSalary(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return val ?? "—";
  return "₹" + n.toLocaleString("en-IN");
}

export default function List() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [employees, setEmployees]     = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState("");
  const [search, setSearch]           = useState("");
  const [sortCfg, setSortCfg]         = useState({ key: null, dir: "asc" });

  const containerRef = useRef(null);

  // ─── Fetch data ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchEmployees() {
      try {
        setLoading(true);

        // Try form-encoded first (most PHP backends prefer this)
        const formBody = new URLSearchParams();
        formBody.append("username", "test");
        formBody.append("password", "123456");

        const res = await fetch(
          "https://backend.jotish.in/backend_dev/gettabledata.php",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formBody.toString(),
          }
        );

        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error("API returned invalid JSON: " + text.slice(0, 120));
        }

        // Handle all common response shapes
        let rows = [];
        if (Array.isArray(json)) {
          rows = json;
        } else if (Array.isArray(json?.data)) {
          rows = json.data;
        } else if (Array.isArray(json?.employees)) {
          rows = json.employees;
        } else if (Array.isArray(json?.records)) {
          rows = json.records;
        } else if (typeof json === "object" && json !== null) {
          // Some APIs return { "0": {...}, "1": {...} }
          const vals = Object.values(json);
          if (vals.length && typeof vals[0] === "object") rows = vals;
        }

        if (!cancelled) {
          setEmployees(rows);
          setFiltered(rows);
        }
      } catch (err) {
        if (!cancelled) setFetchError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchEmployees();
    return () => { cancelled = true; };
  }, []);

  // ─── Search + sort ─────────────────────────────────────────────
  useEffect(() => {
    let result = [...employees];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((emp) =>
        Object.values(emp).some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        )
      );
    }
    if (sortCfg.key) {
      result.sort((a, b) => {
        const av = String(a[sortCfg.key] ?? "").toLowerCase();
        const bv = String(b[sortCfg.key] ?? "").toLowerCase();
        const num = !isNaN(parseFloat(av)) && !isNaN(parseFloat(bv));
        const cmp = num
          ? parseFloat(av) - parseFloat(bv)
          : av.localeCompare(bv);
        return sortCfg.dir === "asc" ? cmp : -cmp;
      });
    }
    setFiltered(result);
  }, [search, sortCfg, employees]);

  const handleSort = useCallback((key) => {
    setSortCfg((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }, []);

  // ─── Virtualization ────────────────────────────────────────────
  const { startIdx, endIdx, paddingTop, paddingBottom, forceUpdate } =
    useVirtualList({
      containerRef,
      totalItems: filtered.length,
      itemHeight: ROW_HEIGHT,
      buffer: 8,
    });

  // Nudge virtualizer when data arrives (works around the stale-closure bug)
  useEffect(() => {
    if (!loading) forceUpdate();
  }, [loading, filtered.length, forceUpdate]);

  const visibleRows = filtered.slice(startIdx, endIdx + 1);

  // ─── Render helpers ────────────────────────────────────────────
  function SortIcon({ col }) {
    if (sortCfg.key !== col)
      return (
        <svg className="w-3 h-3 text-slate-500 ml-1 inline" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5 8l3-4 3 4H5zm6 0l-3 4-3-4h6z" />
        </svg>
      );
    return sortCfg.dir === "asc" ? (
      <svg className="w-3 h-3 text-indigo-400 ml-1 inline" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 4l-4 5h8L8 4z" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-indigo-400 ml-1 inline" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 12l4-5H4l4 5z" />
      </svg>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* ── Top Navbar ── */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="font-semibold text-white text-sm">Employee Insights</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm hidden sm:block">
            Welcome, <span className="text-slate-200 font-medium">{user?.username}</span>
          </span>
          <button
            onClick={() => navigate("/analytics")}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
          >
            Analytics
          </button>
          <button
            onClick={logout}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-800/40 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Sub-header: search + stats ── */}
      <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-700/50 shrink-0 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search employees…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-700/60 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <p className="text-slate-400 text-sm shrink-0">
          {loading ? "Loading…" : (
            <>
              Showing <span className="text-white font-medium">{filtered.length}</span> of{" "}
              <span className="text-white font-medium">{employees.length}</span> employees
              {" · "}rendering rows{" "}
              <span className="text-indigo-400">{startIdx + 1}–{Math.min(endIdx + 1, filtered.length)}</span>
              {" "}(virtual)
            </>
          )}
        </p>
      </div>

      {/* ── Column Headers ── */}
      <div className="flex items-center px-6 py-2 bg-slate-800/80 border-b border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 select-none">
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            onClick={() => handleSort(col.key)}
            className={`${col.width} flex items-center gap-0.5 text-left hover:text-slate-200 transition pr-3`}
          >
            {col.label}
            <SortIcon col={col.key} />
          </button>
        ))}
        <div className="w-20 text-center">Action</div>
      </div>

      {/* ── Virtual Scroll Container ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-thin"
        style={{ overflowAnchor: "none" }}
      >
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <svg className="w-10 h-10 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-slate-500 text-sm">Fetching employee data…</p>
          </div>
        )}

        {!loading && fetchError && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-red-400 font-medium">Failed to fetch data</p>
            <p className="text-slate-500 text-sm mt-1">{fetchError}</p>
          </div>
        )}

        {!loading && !fetchError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-slate-400">No employees match your search.</p>
          </div>
        )}

        {!loading && !fetchError && filtered.length > 0 && (
          <div
            style={{
              paddingTop,
              paddingBottom,
              // Total height = full dataset height (keeps scrollbar correct)
            }}
          >
            {visibleRows.map((emp, localIdx) => {
              const absoluteIdx = startIdx + localIdx;
              return (
                <div
                  key={emp.id ?? absoluteIdx}
                  className="flex items-center px-6 border-b border-slate-700/50 hover:bg-slate-800/70 transition cursor-pointer group"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => navigate(`/details/${emp.id}`)}
                >
                  <span className="w-16 text-slate-500 text-xs pr-3 font-mono">
                    {String(emp.id ?? absoluteIdx + 1).padStart(4, "0")}
                  </span>
                  <span className="w-44 text-sm text-slate-200 font-medium pr-3 truncate">
                    {emp.name ?? emp.employee_name ?? "—"}
                  </span>
                  <span className="flex-1 text-sm text-slate-400 pr-3 truncate">
                    {emp.email ?? "—"}
                  </span>
                  <span className="w-32 text-sm text-slate-300 pr-3 truncate">
                    {emp.city ?? "—"}
                  </span>
                  <span className="w-32 text-sm text-emerald-400 font-mono pr-3">
                    {formatSalary(emp.salary)}
                  </span>
                  <span className="w-36 text-xs px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-800/40 truncate pr-3 hidden lg:block">
                    {emp.department ?? "—"}
                  </span>
                  <div className="w-20 flex justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/details/${emp.id}`);
                      }}
                      className="text-xs px-2.5 py-1 rounded-md bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-600/40 transition opacity-0 group-hover:opacity-100"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="px-6 py-2 bg-slate-800 border-t border-slate-700 text-slate-600 text-xs flex justify-between shrink-0">
        <span>Custom virtualization · Only DOM-mounted: {visibleRows.length} rows</span>
        <span>Employee Insights Dashboard</span>
      </footer>
    </div>
  );
}
