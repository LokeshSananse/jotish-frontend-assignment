# Employee Insights Dashboard

A 4-screen React application built for the Jotish Frontend Internship Assignment.

---

## 🎥 Screen Recording

> End-to-end walkthrough including Image Merging logic + Scroll Offset explanation

📹 **Drive Link:** [Click here to watch](https://drive.google.com/your-link-here)

> *(Replace the link above after uploading your recording to Google Drive)*

---

## Tech Stack

| Layer       | Choice                       |
|-------------|------------------------------|
| Build tool  | Vite 6                       |
| UI library  | **None** – raw Tailwind CSS  |
| Router      | React Router DOM v6          |
| Map         | Leaflet + react-leaflet       |
| State       | React Context API            |
| Charts      | Raw `<svg>` elements         |
| Persistence | `localStorage` / `sessionStorage` |

---

## Screens

### 1. Login (`/login`)
- Credentials: `testuser` / `Test123`
- Auth state lives in `AuthContext` (Context API)
- Session persists across refreshes via `localStorage`
- Unauthenticated access to any protected route redirects here

### 2. Employee List (`/list`)
- Fetches data from `POST https://backend.jotish.in/backend_dev/gettabledata.php`
- **Custom virtualization** – only renders rows visible in the viewport plus a configurable buffer
- Client-side full-text search and sortable columns
- Footer shows how many rows are currently DOM-mounted vs total

### 3. Identity Verification (`/details/:id`)
- **Step 1 – Camera:** Uses `navigator.mediaDevices.getUserMedia` to open the device camera
- **Step 2 – Capture:** Draws one video frame onto an offscreen `<canvas>` (snapshot)
- **Step 3 – Signature:** Overlays a transparent `<canvas>` on top of the photo preview; mouse / touch events draw a freehand signature stroke
- **Step 4 – Merge:**
  1. A new `<canvas>` is created matching the photo dimensions
  2. `ctx.drawImage(photoCanvas)` renders the photo as layer 1
  3. `ctx.globalAlpha = 0.85; ctx.drawImage(sigCanvas)` renders the signature as layer 2
  4. A timestamp + employee-ID watermark is drawn as layer 3
  5. `canvas.toDataURL("image/png")` produces a Base64 string
  6. `canvas.toBlob(...)` produces a binary `Blob`; `FileReader.readAsDataURL` converts it and stores it in `sessionStorage` for the Analytics page

### 4. Analytics (`/analytics`)
- Displays the merged audit image (retrieved from `sessionStorage`)
- **SVG salary chart:** Pure `<svg>` bar chart – no Chart.js, no D3. Axes, grid lines, bar gradients, rotated labels, and value badges are all hand-drawn SVG elements
- **Geospatial map:** Leaflet + CartoDB dark tiles. City-to-coordinate mapping is explained below

---

## Virtualization Math

```
Given:
  totalItems  – rows in filtered dataset
  ROW_HEIGHT  – 52 px (fixed)
  containerH  – measured via ResizeObserver
  buffer      – 8 extra rows above/below

At scroll offset `scrollTop`:
  firstVisible = Math.floor(scrollTop / ROW_HEIGHT)
  lastVisible  = Math.floor((scrollTop + containerH) / ROW_HEIGHT)
  startIdx     = Math.max(0, firstVisible - buffer)
  endIdx       = Math.min(totalItems - 1, lastVisible + buffer)

DOM contains only rows [startIdx … endIdx].

paddingTop    = startIdx * ROW_HEIGHT         → pushes rendered rows to correct position
paddingBottom = (totalItems - 1 - endIdx) * ROW_HEIGHT  → maintains correct scrollbar height
```

The total scroll-container height equals `totalItems × ROW_HEIGHT` because `paddingTop + renderedHeight + paddingBottom = totalItems × ROW_HEIGHT`. This keeps the native scrollbar proportional to the full dataset.

---

## City-to-Coordinate Mapping (Geospatial Map)

A static lookup table in `Analytics.jsx` maps ~40 major Indian city names to their approximate latitude/longitude. The lookup is case-insensitive. When a city in the API response is found in the table, a Leaflet `CircleMarker` is placed at those coordinates. Cities not in the table are silently skipped. Bubble radius scales linearly:

```
radius = 6 + (cityEmployeeCount / maxCityCount) × 18
```

This gives a minimum radius of 6 px and a maximum of 24 px, making the map a proportional bubble chart overlaid on geography.

---

## ⚠️ Intentional Vulnerability

**What:** Stale closure in the scroll event handler of `useVirtualList`

**Where:** `src/hooks/useVirtualList.js`, the `useEffect` that registers the `handleScroll` listener

**Code excerpt:**
```js
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;

  function handleScroll() {
    // totalItems is captured here from the initial render (value = 0)
    const end = Math.min(totalItems - 1, last + buffer); // ← stale!
    setScrollTop(top);
  }

  el.addEventListener("scroll", handleScroll, { passive: true });
  return () => el.removeEventListener("scroll", handleScroll);
}, []); // ← missing [totalItems, itemHeight, buffer] in deps
```

**Why it's a bug:** Because the `useEffect` dependency array is empty `[]`, the closure captures `totalItems = 0` from the initial render. The API call is async – data arrives after mount. So the first time the user scrolls, `end = Math.min(-1, ...)` = -1, producing an empty slice and a visually blank grid. The next render after `setScrollTop` fires recalculates the slice correctly because the *render-phase* math always uses the *current* React state, so the bug heals itself. The symptom is a single-frame blank flash on first scroll after data loads.

**Why I chose it:** It demonstrates a real, subtle React pitfall (stale closures in effects) that experienced developers encounter. The bug is non-trivial – the app doesn't crash, data isn't lost, and the visual glitch is brief – yet the root cause reveals deep understanding of React's closure semantics and the event loop. Fixing it requires adding `[totalItems, itemHeight, buffer]` to the dependency array and using `useCallback` to re-register the listener safely.

---

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and log in with `testuser` / `Test123`.
