import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// ─── tiny state machine ─────────────────────────────────────────
// idle → camera_open → photo_taken → signing → merged
const STEP = {
  IDLE:        "idle",
  CAMERA_OPEN: "camera_open",
  PHOTO_TAKEN: "photo_taken",
  SIGNING:     "signing",
  MERGED:      "merged",
};

export default function Details() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [step, setStep]             = useState(STEP.IDLE);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [mergedDataUrl, setMergedDataUrl] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [isDrawing, setIsDrawing]   = useState(false);
  const [streamActive, setStreamActive] = useState(false);

  const videoRef    = useRef(null);
  const snapRef     = useRef(null);   // offscreen canvas for snapshot
  const sigRef      = useRef(null);   // visible signature canvas (over photo)
  const streamRef   = useRef(null);
  const lastPt      = useRef({ x: 0, y: 0 });

  // ─── Camera ────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreamActive(true);
      }
      setStep(STEP.CAMERA_OPEN);
    } catch (err) {
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera in browser settings."
          : `Camera error: ${err.message}`
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreamActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  // ─── Capture photo snapshot ─────────────────────────────────────
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth  || 640;
    const h = video.videoHeight || 480;
    const canvas = document.createElement("canvas");
    canvas.width  = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(video, 0, 0, w, h);
    setPhotoDataUrl(canvas.toDataURL("image/png"));
    snapRef.current = canvas;
    stopCamera();
    setStep(STEP.PHOTO_TAKEN);
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setPhotoDataUrl(null);
    setMergedDataUrl(null);
    setStep(STEP.IDLE);
  }, []);

  const openSignature = useCallback(() => {
    setStep(STEP.SIGNING);
    // give React a tick to render the canvas
    setTimeout(() => {
      const sig = sigRef.current;
      if (!sig || !snapRef.current) return;
      sig.width  = snapRef.current.width;
      sig.height = snapRef.current.height;
      const ctx = sig.getContext("2d");
      ctx.clearRect(0, 0, sig.width, sig.height);
    }, 50);
  }, []);

  // ─── Signature canvas drawing ──────────────────────────────────
  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top)  * scaleY,
    };
  }

  const onSigStart = useCallback((e) => {
    e.preventDefault();
    const canvas = sigRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPt.current = pos;
    setIsDrawing(true);
  }, []);

  const onSigMove = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = sigRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth   = 3;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
    lastPt.current = pos;
  }, [isDrawing]);

  const onSigEnd = useCallback((e) => {
    e.preventDefault();
    setIsDrawing(false);
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = sigRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ─── Merge photo + signature into one Blob / DataURL ──────────
  const mergeImages = useCallback(() => {
    const photo = snapRef.current;
    const sigCanvas = sigRef.current;
    if (!photo || !sigCanvas) return;

    // Create a fresh canvas the same size as the photo
    const merged = document.createElement("canvas");
    merged.width  = photo.width;
    merged.height = photo.height;
    const ctx = merged.getContext("2d");

    // Layer 1: original photo
    ctx.drawImage(photo, 0, 0);

    // Layer 2: semi-transparent signature overlay
    ctx.globalAlpha = 0.85;
    ctx.drawImage(sigCanvas, 0, 0);
    ctx.globalAlpha = 1;

    // Layer 3: timestamp & ID watermark
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, merged.height - 32, merged.width, 32);
    ctx.fillStyle = "#e2e8f0";
    ctx.font      = "bold 14px Inter, sans-serif";
    ctx.fillText(
      `EID-${id}  ·  Verified ${new Date().toLocaleString()}`,
      12, merged.height - 10
    );

    // Produce both a data URL (for immediate display) and a Blob
    const dataUrl = merged.toDataURL("image/png");
    setMergedDataUrl(dataUrl);

    // Also build a Blob and stash it on sessionStorage key for Analytics page
    merged.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          sessionStorage.setItem("audit_image", reader.result);
          sessionStorage.setItem("audit_emp_id", id);
        } catch { /* quota exceeded – silent fail */ }
      };
      reader.readAsDataURL(blob);
    }, "image/png");

    setStep(STEP.MERGED);
  }, [id]);

  // ─── UI ────────────────────────────────────────────────────────
  const cardClass =
    "bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl";

  return (
    <div className="min-h-screen bg-slate-900 py-6 px-4">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate("/list")}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to list
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
            Employee #{String(id).padStart(4, "0")}
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto space-y-5">
        {/* ── Step indicator ── */}
        <div className={cardClass}>
          <h1 className="text-lg font-bold text-white mb-4">Identity Verification</h1>
          <div className="flex items-center gap-0">
            {["Camera", "Capture", "Sign", "Merge"].map((label, i) => {
              const stepVal = [STEP.CAMERA_OPEN, STEP.PHOTO_TAKEN, STEP.SIGNING, STEP.MERGED][i];
              const stepOrder = [STEP.IDLE, STEP.CAMERA_OPEN, STEP.PHOTO_TAKEN, STEP.SIGNING, STEP.MERGED];
              const current = stepOrder.indexOf(step);
              const done  = current > i + 1;
              const active = current === i + 1;
              return (
                <div key={label} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition
                    ${done   ? "bg-emerald-600 text-white"
                    : active ? "bg-indigo-600 text-white ring-2 ring-indigo-400/50"
                    : "bg-slate-700 text-slate-500"}`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`ml-1.5 text-xs hidden sm:block
                    ${active ? "text-indigo-300" : done ? "text-emerald-400" : "text-slate-500"}`}>
                    {label}
                  </span>
                  {i < 3 && <div className="flex-1 h-px mx-2 bg-slate-700" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Camera section ── */}
        {(step === STEP.IDLE || step === STEP.CAMERA_OPEN) && (
          <div className={cardClass}>
            <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.868V19a1 1 0 01-1.447.894L15 17.82V10z" />
                <rect x="3" y="6" width="12" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Live Camera Feed
            </h2>

            <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-slate-700">
              {!streamActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                  <div className="text-4xl">📷</div>
                  <p className="text-slate-400 text-sm">Camera preview will appear here</p>
                  {cameraError && (
                    <p className="text-red-400 text-xs bg-red-900/30 border border-red-700/40 px-3 py-2 rounded-lg">
                      {cameraError}
                    </p>
                  )}
                </div>
              )}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
                style={{ display: streamActive ? "block" : "none" }}
              />
              {streamActive && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-white/80 bg-black/50 px-1.5 py-0.5 rounded">LIVE</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              {step === STEP.IDLE && (
                <button
                  onClick={startCamera}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.868V19a1 1 0 01-1.447.894L15 17.82V10z" />
                    <rect x="3" y="6" width="12" height="13" rx="2" />
                  </svg>
                  Open Camera
                </button>
              )}
              {step === STEP.CAMERA_OPEN && (
                <>
                  <button
                    onClick={capturePhoto}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
                  >
                    📸 Capture Photo
                  </button>
                  <button
                    onClick={() => { stopCamera(); setStep(STEP.IDLE); }}
                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Photo taken – preview & proceed ── */}
        {step === STEP.PHOTO_TAKEN && (
          <div className={cardClass}>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">📸 Photo Captured</h2>
            <img
              src={photoDataUrl}
              alt="Captured employee"
              className="w-full rounded-xl border border-slate-700 mb-4 object-cover"
              style={{ maxHeight: 320 }}
            />
            <div className="flex gap-3">
              <button
                onClick={openSignature}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
              >
                ✍️ Proceed to Sign
              </button>
              <button
                onClick={retakePhoto}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition"
              >
                Retake
              </button>
            </div>
          </div>
        )}

        {/* ── Signature pad ── */}
        {step === STEP.SIGNING && (
          <div className={cardClass}>
            <h2 className="text-sm font-semibold text-slate-300 mb-1">✍️ Sign over your photo</h2>
            <p className="text-slate-500 text-xs mb-3">
              Draw your signature using mouse or touch directly on top of the photo.
            </p>

            {/* Composite: photo bg + transparent drawing canvas on top */}
            <div className="relative rounded-xl overflow-hidden border border-indigo-700/40 mb-4 select-none"
              style={{ lineHeight: 0 }}>
              <img
                src={photoDataUrl}
                alt="employee"
                className="w-full object-cover"
                style={{ maxHeight: 340, display: "block" }}
                draggable={false}
              />
              <canvas
                ref={sigRef}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                onMouseDown={onSigStart}
                onMouseMove={onSigMove}
                onMouseUp={onSigEnd}
                onMouseLeave={onSigEnd}
                onTouchStart={onSigStart}
                onTouchMove={onSigMove}
                onTouchEnd={onSigEnd}
              />
              <div className="absolute top-2 right-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded pointer-events-none">
                Sign here ↙
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={mergeImages}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
              >
                🔗 Merge & Finalise
              </button>
              <button
                onClick={clearSignature}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition"
              >
                Clear Signature
              </button>
              <button
                onClick={retakePhoto}
                className="px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-800/40 text-sm transition"
              >
                Start Over
              </button>
            </div>
          </div>
        )}

        {/* ── Merged result ── */}
        {step === STEP.MERGED && mergedDataUrl && (
          <div className={cardClass}>
            <h2 className="text-sm font-semibold text-emerald-400 mb-1 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Audit Image Generated
            </h2>
            <p className="text-slate-500 text-xs mb-3">
              Photo and signature have been merged into a single PNG. Stored in sessionStorage for the Analytics page.
            </p>
            <img
              src={mergedDataUrl}
              alt="Merged audit"
              className="w-full rounded-xl border border-emerald-700/40 mb-4 object-cover"
              style={{ maxHeight: 360 }}
            />
            <div className="flex flex-wrap gap-3">
              <a
                href={mergedDataUrl}
                download={`audit-EID-${id}.png`}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition inline-flex items-center gap-2"
              >
                ⬇ Download PNG
              </a>
              <button
                onClick={() => navigate("/analytics")}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
              >
                View Analytics →
              </button>
              <button
                onClick={retakePhoto}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition"
              >
                Redo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
