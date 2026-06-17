import { useState, useRef, useEffect, useCallback } from "react";
import { DEFAULT_PARAMS, DEFAULT_PRESETS } from "./defaultPresets.js";

// ── Design Tokens ─────────────────────────────────────────────────────────────
const T = {
  bgDeep:       '#0d0a09',   // --obs-bg-deep
  bgMid:        '#131010',   // --obs-bg-mid
  bgSurface:    '#1c1715',   // --obs-bg-surface
  bgElevated:   '#242020',   // --obs-bg-elevated
  bgControl:    '#1a1412',   // --obs-bg-control

  redEmber:     '#3d0e0e',   // --obs-red-ember
  redPrimary:   '#8b1a1a',   // --obs-red-primary
  redBright:    '#c42b2b',   // --obs-red-bright
  redHot:       '#e03535',   // --obs-red-hot

  borderGhost:  '#1a1614',   // --obs-border-ghost
  borderSubtle: '#2a2220',   // --obs-border-subtle
  borderDef:    '#3a2e2a',   // --obs-border-def
  borderActive: '#8b1a1a',   // --obs-border-active

  textPri:      '#ddd0c8',   // --obs-text-primary
  textLabel:    '#9a8878',   // --obs-text-label
  textSec:      '#7a6860',   // --obs-text-sec
  textDim:      '#3f3430',   // --obs-text-dim
  textRed:      '#c42b2b',   // --obs-text-red
};

// ── Arc path helper ────────────────────────────────────────────────────────────
function ap(cx, cy, r, a1, a2) {
  const R = a => (a - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(R(a1));
  const y1 = cy + r * Math.sin(R(a1));
  const x2 = cx + r * Math.cos(R(a2));
  const y2 = cy + r * Math.sin(R(a2));
  const lg = ((a2 - a1 + 360) % 360) > 180 ? 1 : 0;
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${lg},1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
}

// ── Knob Component ─────────────────────────────────────────────────────────────
function Knob({ value = 0.5, onChange, onReset, size = 'md', label, fmt }) {
  const [active, setActive] = useState(false);
  const [hover, setHover]   = useState(false);
  const drag = useRef(null);

  const CFG = {
    sm: { D: 44, cr: 17, fr: 11, ar: 20, range: 120 },
    md: { D: 60, cr: 24, fr: 16, ar: 27, range: 160 },
    lg: { D: 78, cr: 31, fr: 20, ar: 34, range: 200 },
  }[size];
  const { D, cr, fr, ar } = CFG;
  const cx = D / 2, cy = D / 2;
  const rot = -135 + value * 270;

  const ticks = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    const r1 = cr - 5, r2 = cr - 3;
    return <line key={i}
      x1={cx + r1 * Math.sin(a)} y1={cy - r1 * Math.cos(a)}
      x2={cx + r2 * Math.sin(a)} y2={cy - r2 * Math.cos(a)}
      stroke="#222020" strokeWidth="1.2"
    />;
  });

  const onDown = useCallback((e) => {
    e.preventDefault();
    setActive(true);
    drag.current = { y: e.clientY, v: value };
    const onMove = (e2) => {
      const dv = (drag.current.y - e2.clientY) / CFG.range;
      onChange(Math.max(0, Math.min(1, drag.current.v + dv)));
    };
    const onUp = () => {
      setActive(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [value, onChange, CFG.range]);

  const onDoubleClick = () => {
    if (onReset) onReset();
  };

  const arcColor = active ? T.redHot : hover ? T.redBright : T.redPrimary;
  const displayVal = fmt ? fmt(value) : Math.round(value * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', userSelect: 'none' }}>
      {(active || hover) && (
        <div style={{
          position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
          background: T.bgElevated, border: `1px solid ${T.borderActive}`,
          padding: '2px 7px', fontFamily: "'Electrolize', monospace",
          fontSize: 9, color: T.textRed, whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 10, letterSpacing: '0.04em',
        }}>
          {displayVal}
        </div>
      )}

      <svg width={D} height={D}
        style={{ cursor: active ? 'ns-resize' : 'pointer', display: 'block' }}
        onMouseDown={onDown}
        onDoubleClick={onDoubleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <circle cx={cx} cy={cy} r={cr} fill={T.bgControl} />
        <path d={ap(cx, cy, cr, -90, 90)} fill="none" stroke="rgba(255,225,190,0.07)" strokeWidth="1.5" />
        <path d={ap(cx, cy, cr, 90, 270)} fill="none" stroke="rgba(0,0,0,0.38)" strokeWidth="1.5" />
        {ticks}
        <path d={ap(cx, cy, ar, -135, 135)} fill="none" stroke={T.borderSubtle} strokeWidth="2" />
        {value > 0.005 && (
          <path d={ap(cx, cy, ar, -135, -135 + value * 270)} fill="none" stroke={arcColor} strokeWidth="2" />
        )}
        <circle cx={cx} cy={cy} r={fr} fill={T.bgMid} />
        <path d={ap(cx, cy, fr, -90, 90)} fill="none" stroke="rgba(0,0,0,0.32)" strokeWidth="1" />
        <path d={ap(cx, cy, fr, 90, 270)} fill="none" stroke="rgba(255,225,190,0.04)" strokeWidth="1" />
        <g transform={`rotate(${rot},${cx},${cy})`}>
          <rect
            x={cx - 1} y={cy - fr + 2}
            width={2} height={fr - 6}
            fill={active ? T.redHot : T.redBright}
          />
        </g>
        <circle cx={cx} cy={cy} r={2.5} fill={T.bgDeep} />
      </svg>

      {label && (
        <div style={{
          fontFamily: "'Electrolize', monospace",
          fontSize: 8.5, letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: active ? T.textLabel : T.textSec,
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ── WaveMini Component ─────────────────────────────────────────────────────────
function WaveMini({ wave = 'saw', active = false, onClick, W = 32, H = 16 }) {
  const pts = Array.from({ length: 30 }, (_, i) => {
    const t = i / 29;
    const φ = t * Math.PI * 4;   // 2 cycles
    let y;
    switch (wave) {
      case 'sine':     y = Math.sin(φ); break;
      case 'saw':      y = 1 - 2 * ((t * 2) % 1); break;
      case 'square':   y = Math.sin(φ) >= 0 ? 0.82 : -0.82; break;
      case 'triangle': y = (2 / Math.PI) * Math.asin(Math.sin(φ)); break;
      default:         y = 0;
    }
    const px = (t * W).toFixed(1);
    const py = (H / 2 - y * (H / 2 - 2)).toFixed(1);
    return `${i === 0 ? 'M' : 'L'}${px},${py}`;
  }).join(' ');

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-block', lineHeight: 0, cursor: 'pointer',
        border: `1px solid ${active ? T.borderActive : T.borderSubtle}`,
      }}
    >
      <svg width={W} height={H} style={{ display: 'block', background: T.bgDeep }}>
        <line x1={0} y1={H/2} x2={W} y2={H/2} stroke={T.borderGhost} strokeWidth="0.5" />
        {active && <path d={pts} fill="none" stroke="rgba(196,43,43,0.2)" strokeWidth="3" />}
        <path d={pts} fill="none"
          stroke={active ? T.redBright : T.borderDef}
          strokeWidth={active ? 1.2 : 0.8}
        />
      </svg>
    </div>
  );
}

// ── FilterDisplay Component ───────────────────────────────────────────────────
function FilterDisplay({ W = 640, H = 80, cutoff = 0.5, res = 0.5 }) {
  const cvs = useRef(null);
  const raf = useRef(null);

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function lp(f, fc, resonanceVal) {
      const r = f / fc;
      const base = 1 / Math.sqrt(1 + Math.pow(r, 8));
      if (resonanceVal < 0.04) return base;
      const peak = resonanceVal * 2.4 * Math.exp(-Math.pow(Math.log2(r), 2) * resonanceVal * 9);
      return Math.min(2.1, base + peak);
    }

    const freqX = f => Math.log(f / 20) / Math.log(1000) * W;
    const gainY = g => H - 6 - g * (H - 14);

    let t0 = null;
    function frame(ts) {
      if (!t0) t0 = ts;
      const t = (ts - t0) / 1000;

      const fc = 35 * Math.pow(600, Math.max(0, Math.min(1, cutoff)));
      const rv = Math.max(0, Math.min(1, res));

      ctx.fillStyle = T.bgDeep;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.strokeStyle = T.borderGhost;
      ctx.lineWidth = 0.5;
      [100, 500, 2000, 8000].forEach(f => {
        const x = freqX(f);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      });
      [0.5, 0.1, 0.02].forEach(g => {
        const y = gainY(g);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      });
      ctx.restore();

      const pts = Array.from({ length: W }, (_, i) => {
        const f = 20 * Math.pow(1000, i / (W - 1));
        return [i, gainY(lp(f, fc, rv))];
      });

      ctx.save();
      ctx.shadowColor = 'rgba(196,43,43,0.6)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.strokeStyle = 'rgba(196,43,43,0.15)';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.strokeStyle = T.redBright;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      const fcX = freqX(fc);
      if (fcX > 2 && fcX < W - 2) {
        ctx.save();
        ctx.strokeStyle = 'rgba(139,26,26,0.5)';
        ctx.lineWidth = 0.75;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(fcX, 4); ctx.lineTo(fcX, H - 4); ctx.stroke();
        ctx.restore();
      }

      raf.current = requestAnimationFrame(frame);
    }

    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [W, H, cutoff, res]);

  return (
    <div style={{ display: 'block', lineHeight: 0, border: `1px solid ${T.borderSubtle}` }}>
      <canvas ref={cvs} width={W} height={H} style={{ display: 'block', width: `${W}px`, height: `${H}px` }} />
    </div>
  );
}

// ── ADSRDisplay Component ─────────────────────────────────────────────────────
function ADSRDisplay({ attack = 0.5, decay = 0.5, sustain = 0.5, release = 0.5, W = 130, H = 40 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = T.bgDeep;
    ctx.fillRect(0, 0, W, H);

    const aW = 5 + attack * 30;
    const dW = 5 + decay * 30;
    const sW = 30;
    const rW = 5 + release * 30;
    const total = aW + dW + sW + rW;
    const scale = W / total;
    const wA = aW * scale;
    const wD = dW * scale;
    const wS = sW * scale;
    const wR = rW * scale;

    const x0 = 0;
    const y0 = H;

    const x1 = wA;
    const y1 = 2;

    const x2 = wA + wD;
    const y2 = H - 2 - sustain * (H - 4);

    const x3 = wA + wD + wS;
    const y3 = y2;

    const x4 = W;
    const y4 = H;

    ctx.strokeStyle = T.borderGhost;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y2);
    ctx.lineTo(W, y2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(61, 14, 14, 0.55)';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(196, 43, 43, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.stroke();
  }, [attack, decay, sustain, release, W, H]);

  return (
    <div style={{ display: 'inline-block', lineHeight: 0, border: `1px solid ${T.borderSubtle}` }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', width: `${W}px`, height: `${H}px` }} />
    </div>
  );
}

// ── Spectrogram Component ────────────────────────────────────────────────────
function Spectrogram({ analyser, W = 538, H = 52 }) {
  const specCvs = useRef(null);
  const specRaf = useRef(null);

  useEffect(() => {
    const canvas = specCvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const sampleRate = analyser ? (analyser.context.sampleRate || 44100) : 44100;
    const bufferLength = analyser ? analyser.frequencyBinCount : 0;
    const dataArray = analyser ? new Float32Array(bufferLength) : null;

    const logMin = Math.log10(20);
    const logMax = Math.log10(20000);
    const xOfFreq = f => ((Math.log10(f) - logMin) / (logMax - logMin)) * W;

    let t0 = null;
    function draw(ts) {
      if (!t0) t0 = ts;
      const t = (ts - t0) / 1000;

      ctx.fillStyle = T.bgDeep;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = T.borderGhost;
      ctx.lineWidth = 0.5;
      [100, 500, 2000, 8000].forEach(f => {
        const x = xOfFreq(f);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      });

      const pts = [];

      if (analyser && dataArray) {
        analyser.getFloatFrequencyData(dataArray);

        const minDb = analyser.minDecibels || -100;
        const maxDb = analyser.maxDecibels || -30;
        const dbRange = maxDb - minDb;

        for (let x = 0; x < W; x++) {
          const normX = x / (W - 1);
          const f = 20 * Math.pow(1000, normX);
          const binIndex = (f / (sampleRate / 2)) * (bufferLength - 1);
          
          const idx = Math.min(bufferLength - 1, Math.max(0, binIndex));
          const i0 = Math.floor(idx);
          const i1 = Math.min(bufferLength - 1, i0 + 1);
          const fraction = idx - i0;
          const db = dataArray[i0] * (1 - fraction) + dataArray[i1] * fraction;

          const normVal = Math.max(0, Math.min(1, (db - minDb) / dbRange));
          const y = H - 2 - normVal * (H - 6);
          pts.push([x, y]);
        }
      } else {
        // Fallback to dummy math simulation
        for (let x = 0; x < W; x++) {
          const normX = x / W;
          const peak1 = 0.6 * Math.exp(-Math.pow((normX - (0.15 + 0.05 * Math.sin(t * 1.5))), 2) * 150);
          const peak2 = 0.4 * Math.exp(-Math.pow((normX - (0.3 + 0.08 * Math.cos(t * 2.1))), 2) * 100);
          const peak3 = 0.2 * Math.exp(-Math.pow((normX - (0.6 + 0.12 * Math.sin(t * 0.9))), 2) * 50);
          const noise = 0.05 * Math.sin(x * 0.5 + t * 20) * Math.sin(x * 0.05 - t * 10);
          const jitter = 0.02 * Math.random();

          const val = peak1 + peak2 + peak3 + noise + jitter + 0.05;
          const y = H - 2 - Math.max(0, Math.min(1, val)) * (H - 6);
          pts.push([x, y]);
        }
      }

      ctx.fillStyle = 'rgba(61, 14, 14, 0.28)';
      ctx.beginPath();
      ctx.moveTo(0, H);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = T.redBright;
      ctx.lineWidth = 1;
      ctx.beginPath();
      pts.forEach(([x, y], idx) => {
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      specRaf.current = requestAnimationFrame(draw);
    }

    specRaf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(specRaf.current);
  }, [analyser, W, H]);

  return <canvas ref={specCvs} width={W} height={H} style={{ display: 'block', width: '100%', height: '100%' }} />;
}

// ── IndexedDB Helpers for FileSystemDirectoryHandle ──────────────────────────
const DB_NAME = 'obsidian_presets_db';
const STORE_NAME = 'handles_store';
const KEY_NAME = 'obsidian_preset_folder_handle';

function getDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getSavedFolderHandle() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Failed to get handle from IndexedDB', e);
    return null;
  }
}

async function saveFolderHandle(handle) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, KEY_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Failed to save handle to IndexedDB', e);
  }
}

async function deleteFolderHandle() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(KEY_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Failed to delete handle from IndexedDB', e);
  }
}

// ── Main ObsidianPanel Component ────────────────────────────────────────────────
export default function ObsidianPanel({ wam, analyser }) {
  const [params, setParams] = useState(null);

  const [presets, setPresets] = useState(() => DEFAULT_PRESETS);
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const [folderName, setFolderName] = useState('');
  const [syncStatus, setSyncStatus] = useState(''); // 'active', 'unauthorized', 'unsupported', or ''
  const dirHandleRef = useRef(null);

  const wrapperRef = useRef(null);
  const innerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(660);
  const [innerHeight, setInnerHeight] = useState(0);

  // ResizeObserver for the outer wrapper container
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const width = entries[0].contentRect.width;
      if (width > 0) {
        setContainerWidth(width);
      }
    });

    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // ResizeObserver for the inner panel to track height changes
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const height = entries[0].contentRect.height;
      if (height > 0) {
        setInnerHeight(height);
      }
    });

    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  // Calculate layout variables based on containerWidth
  const scale = containerWidth < 660 ? containerWidth / 660 : 1;
  const layoutWidth = containerWidth < 660 ? 660 : Math.min(1100, containerWidth);

  let widthMode = 'wide';
  if (containerWidth < 600) {
    widthMode = 'narrow';
  } else if (containerWidth < 900) {
    widthMode = 'medium';
  }

  const isSupported = typeof window !== 'undefined' && !!window.showDirectoryPicker;

  const statesEqual = (s1, s2) => {
    if (!s1 || !s2) return false;
    for (const key of Object.keys(DEFAULT_PARAMS)) {
      if (s1[key] !== s2[key]) {
        return false;
      }
    }
    return true;
  };

  const matchingPreset = presets.find(p => statesEqual(params, p.state));
  const displayName = matchingPreset ? matchingPreset.name : "Unsaved";

  useEffect(() => {
    if (matchingPreset) {
      const idx = presets.indexOf(matchingPreset);
      if (idx !== -1 && idx !== currentPresetIndex) {
        setCurrentPresetIndex(idx);
      }
    }
  }, [params, presets, matchingPreset, currentPresetIndex]);

  const loadPreset = (preset) => {
    if (!preset) return;
    if (wam) {
      wam.setState(preset.state);
    }
    setParams({ ...preset.state });
  };

  const loadPresetsFromLocalStorage = () => {
    const savedStr = localStorage.getItem('obsidian_presets');
    let loaded = [];
    if (savedStr) {
      try {
        loaded = JSON.parse(savedStr);
      } catch (e) {}
    }
    const custom = loaded.filter(p => p && p.name && !DEFAULT_PRESETS.some(dp => dp.name === p.name));
    setPresets([...DEFAULT_PRESETS, ...custom]);
  };

  const refreshPresetsFromFolder = async (handle) => {
    if (!handle) return;
    try {
      const loaded = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.json')) {
          try {
            const file = await entry.getFile();
            const content = await file.text();
            const parsed = JSON.parse(content);
            const state = parsed.state || parsed;
            const name = parsed.name || entry.name.slice(0, -5);
            loaded.push({ name, state });
          } catch (fileErr) {
            console.error('Error reading preset file:', entry.name, fileErr);
          }
        }
      }
      loaded.sort((a, b) => a.name.localeCompare(b.name));
      const custom = loaded.filter(p => !DEFAULT_PRESETS.some(dp => dp.name === p.name));
      setPresets([...DEFAULT_PRESETS, ...custom]);
    } catch (err) {
      console.error('Failed to read presets from folder:', err);
    }
  };

  useEffect(() => {
    if (!isSupported) {
      setSyncStatus('unsupported');
      loadPresetsFromLocalStorage();
      return;
    }

    const initFolder = async () => {
      const handle = await getSavedFolderHandle();
      if (handle) {
        dirHandleRef.current = handle;
        setFolderName(handle.name);
        try {
          const perm = await handle.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            setSyncStatus('active');
            await refreshPresetsFromFolder(handle);
          } else {
            setSyncStatus('unauthorized');
            loadPresetsFromLocalStorage();
          }
        } catch (e) {
          setSyncStatus('unauthorized');
          loadPresetsFromLocalStorage();
        }
      } else {
        setSyncStatus('');
        loadPresetsFromLocalStorage();
      }
    };

    initFolder();
  }, [isSupported]);

  const handlePrevPreset = () => {
    let nextIdx = currentPresetIndex - 1;
    if (nextIdx < 0) {
      nextIdx = presets.length - 1;
    }
    setCurrentPresetIndex(nextIdx);
    loadPreset(presets[nextIdx]);
  };

  const handleNextPreset = () => {
    let nextIdx = currentPresetIndex + 1;
    if (nextIdx >= presets.length) {
      nextIdx = 0;
    }
    setCurrentPresetIndex(nextIdx);
    loadPreset(presets[nextIdx]);
  };

  const handleConfirmSave = async () => {
    const name = newPresetName.trim();
    if (!name) return;
    if (DEFAULT_PRESETS.some(dp => dp.name === name)) {
      alert(`Cannot overwrite "${name}" default preset.`);
      return;
    }

    const state = { ...params };

    if (syncStatus === 'active' && dirHandleRef.current) {
      try {
        const handle = dirHandleRef.current;
        const fileName = `${name}.json`;
        const fileHandle = await handle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(state, null, 2));
        await writable.close();
        await refreshPresetsFromFolder(handle);
      } catch (err) {
        console.error('Failed to save preset to folder:', err);
        alert('Failed to save preset to folder.');
      }
    } else {
      const existingIdx = presets.findIndex(p => p.name === name);
      let updatedPresets;
      if (existingIdx !== -1) {
        updatedPresets = [...presets];
        updatedPresets[existingIdx] = { name, state };
      } else {
        updatedPresets = [...presets, { name, state }];
      }
      setPresets(updatedPresets);
      const customOnly = updatedPresets.filter(p => !DEFAULT_PRESETS.some(dp => dp.name === p.name));
      localStorage.setItem('obsidian_presets', JSON.stringify(customOnly));
    }

    setIsSaving(false);
    setNewPresetName('');
  };

  const handleDeletePreset = async () => {
    const currentPreset = presets[currentPresetIndex];
    if (!currentPreset || DEFAULT_PRESETS.some(dp => dp.name === currentPreset.name)) return;

    if (syncStatus === 'active' && dirHandleRef.current) {
      try {
        const handle = dirHandleRef.current;
        const fileName = `${currentPreset.name}.json`;
        await handle.removeEntry(fileName);
        await refreshPresetsFromFolder(handle);
        
        const updatedPresets = presets.filter((_, idx) => idx !== currentPresetIndex);
        const nextIdx = Math.max(0, currentPresetIndex - 1);
        setCurrentPresetIndex(nextIdx);
        loadPreset(updatedPresets[nextIdx]);
      } catch (err) {
        console.error('Failed to delete preset from folder:', err);
        alert('Failed to delete preset from folder.');
      }
    } else {
      const updatedPresets = presets.filter((_, idx) => idx !== currentPresetIndex);
      setPresets(updatedPresets);
      const customOnly = updatedPresets.filter(p => !DEFAULT_PRESETS.some(dp => dp.name === p.name));
      localStorage.setItem('obsidian_presets', JSON.stringify(customOnly));

      const nextIdx = Math.max(0, currentPresetIndex - 1);
      setCurrentPresetIndex(nextIdx);
      loadPreset(updatedPresets[nextIdx]);
    }
  };

  const handleSetFolder = async () => {
    if (!isSupported) return;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      dirHandleRef.current = handle;
      setFolderName(handle.name);

      const permission = await handle.requestPermission({ mode: 'readwrite' });
      localStorage.setItem('obsidian_preset_folder', permission);
      await saveFolderHandle(handle);

      if (permission === 'granted') {
        setSyncStatus('active');
        await refreshPresetsFromFolder(handle);
      } else {
        setSyncStatus('unauthorized');
      }
    } catch (err) {
      console.error('Failed to set directory:', err);
    }
  };

  const handleAuthorize = async () => {
    const handle = dirHandleRef.current;
    if (!handle) return;
    try {
      const permission = await handle.requestPermission({ mode: 'readwrite' });
      localStorage.setItem('obsidian_preset_folder', permission);
      if (permission === 'granted') {
        setSyncStatus('active');
        await refreshPresetsFromFolder(handle);
      }
    } catch (err) {
      console.error('Authorization failed:', err);
    }
  };

  // Load parameter values on mount
  useEffect(() => {
    if (wam) {
      setParams(wam.getState());
    } else {
      setParams({ ...DEFAULT_PARAMS });
    }
  }, [wam]);

  const updateParam = (key, rawValue) => {
    let paramValue = rawValue;
    if (key === 'filterResonance') {
      paramValue = rawValue * 3.8;
    } else if (key === 'osc1Coarse' || key === 'osc2Coarse' || key === 'osc3Coarse') {
      paramValue = (rawValue - 0.5) * 48;
    } else if (key === 'osc1Fine' || key === 'osc2Fine' || key === 'osc3Fine') {
      paramValue = (rawValue - 0.5) * 200;
    } else if (key === 'osc1Pan' || key === 'osc2Pan' || key === 'osc3Pan') {
      paramValue = (rawValue - 0.5) * 2;
    } else if (key === 'lfoRate') {
      paramValue = 0.1 + rawValue * 19.9;
    } else if (key === 'pitchEnvAmount') {
      paramValue = (rawValue - 0.5) * 48;
    } else if (key === 'unisonVoices') {
      paramValue = Math.max(1, Math.round(rawValue * 8));
    } else if (key === 'unisonDetune') {
      paramValue = rawValue * 100;
    } else if (key === 'stereoWidth') {
      paramValue = rawValue * 2;
    } else if (key === 'portamentoTime') {
      paramValue = rawValue * 2;
    } else if (key === 'filterEnvAmount') {
      paramValue = (rawValue - 0.5) * 2;
    }

    if (wam) {
      wam.setParam(key, paramValue);
    }
    setParams(prev => prev ? ({ ...prev, [key]: paramValue }) : null);
  };

  const getKnobVal = (key) => {
    if (!params) return DEFAULT_PARAMS[key] !== undefined ? convertToKnob(key, DEFAULT_PARAMS[key]) : 0.5;
    const val = params[key];
    if (val === undefined) return 0.5;
    return convertToKnob(key, val);
  };

  const convertToKnob = (key, val) => {
    if (key === 'filterResonance') {
      return val / 3.8;
    } else if (key === 'osc1Coarse' || key === 'osc2Coarse' || key === 'osc3Coarse') {
      return (val / 48) + 0.5;
    } else if (key === 'osc1Fine' || key === 'osc2Fine' || key === 'osc3Fine') {
      return (val / 200) + 0.5;
    } else if (key === 'osc1Pan' || key === 'osc2Pan' || key === 'osc3Pan') {
      return (val / 2) + 0.5;
    } else if (key === 'lfoRate') {
      return (val - 0.1) / 19.9;
    } else if (key === 'pitchEnvAmount') {
      return (val / 48) + 0.5;
    } else if (key === 'unisonVoices') {
      return val / 8;
    } else if (key === 'unisonDetune') {
      return val / 100;
    } else if (key === 'stereoWidth') {
      return val / 2;
    } else if (key === 'portamentoTime') {
      return val / 2;
    } else if (key === 'filterEnvAmount') {
      return (val / 2) + 0.5;
    }
    return val; // direct 0-1
  };

  const resetParam = (key) => {
    const def = DEFAULT_PARAMS[key];
    if (def !== undefined) {
      if (wam) wam.setParam(key, def);
      setParams(prev => prev ? ({ ...prev, [key]: def }) : null);
    }
  };

  if (!params) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Electrolize&display=swap');
        .obs-panel * {
          box-sizing: border-box;
          user-select: none;
        }
        .obs-panel select:hover {
          border-color: ${T.borderActive} !important;
        }
        .obs-panel select option {
          background: ${T.bgSurface};
          color: ${T.textPri};
        }
      `}</style>

      <div
        ref={wrapperRef}
        style={{
          width: '100%',
          height: (scale < 1 && innerHeight > 0) ? `${innerHeight * scale}px` : 'auto',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          ref={innerRef}
          className="obs-panel"
          style={{
            width: layoutWidth,
            background: T.bgMid,
            fontFamily: "'Electrolize', monospace",
            color: T.textPri,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            transform: scale < 1 ? `scale(${scale})` : 'none',
            transformOrigin: 'top left',
          }}
        >

        {/* ─── 1. HEADER ─────────────────────────────────────────── */}
        <div style={{
          height: 52,
          background: T.bgDeep,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          borderBottom: `1px solid ${T.borderSubtle}`,
        }}>
          {/* Logo Section */}
          <div style={{
            width: 120,
            borderRight: `1px solid ${T.borderSubtle}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingLeft: 12,
            paddingRight: 8,
          }}>
            <div style={{
              fontFamily: "'Righteous', sans-serif",
              fontSize: 20,
              lineHeight: '22px',
              letterSpacing: '0.08em',
              color: T.textPri,
            }}>
              OBSIDIAN
            </div>
            <div style={{
              fontSize: 7,
              lineHeight: '9px',
              letterSpacing: '0.06em',
              color: T.textDim,
              textTransform: 'uppercase',
              marginTop: 1,
            }}>
              VIRTUAL ANALOG · WAM 2.0
            </div>
          </div>

          {/* Preset Strip */}
          <div style={{
            width: 260,
            borderRight: `1px solid ${T.borderSubtle}`,
            background: T.bgControl,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 8px',
            fontFamily: "'Electrolize', monospace",
            gap: 4,
          }}>
            {isSaving ? (
              <div style={{ display: 'flex', gap: 2 }}>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  placeholder="Preset name..."
                  style={{
                    flex: 1,
                    background: T.bgDeep,
                    border: `1px solid ${T.borderDef}`,
                    color: T.textPri,
                    fontFamily: "'Electrolize', monospace",
                    fontSize: 8.5,
                    padding: '2px 4px',
                    outline: 'none',
                    borderRadius: 0,
                    transition: 'none',
                    height: 20,
                  }}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleConfirmSave();
                    if (e.key === 'Escape') setIsSaving(false);
                  }}
                />
                <button
                  onClick={handleConfirmSave}
                  style={{
                    background: T.redBright,
                    border: 'none',
                    color: T.textPri,
                    fontFamily: "'Electrolize', monospace",
                    fontSize: 8.5,
                    padding: '0 6px',
                    cursor: 'pointer',
                    borderRadius: 0,
                    transition: 'none',
                    height: 20,
                  }}
                >
                  SAVE
                </button>
                <button
                  onClick={() => setIsSaving(false)}
                  style={{
                    background: T.bgElevated,
                    border: `1px solid ${T.borderDef}`,
                    color: T.textSec,
                    fontFamily: "'Electrolize', monospace",
                    fontSize: 8.5,
                    padding: '0 6px',
                    cursor: 'pointer',
                    borderRadius: 0,
                    transition: 'none',
                    height: 20,
                  }}
                >
                  X
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    onClick={handlePrevPreset}
                    style={{
                      background: T.bgElevated,
                      border: `1px solid ${T.borderDef}`,
                      color: T.textPri,
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontFamily: "'Electrolize', monospace",
                      fontSize: 10,
                      borderRadius: 0,
                      transition: 'none',
                    }}
                  >
                    &lt;
                  </button>
                  <button
                    onClick={handleNextPreset}
                    style={{
                      background: T.bgElevated,
                      border: `1px solid ${T.borderDef}`,
                      color: T.textPri,
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontFamily: "'Electrolize', monospace",
                      fontSize: 10,
                      borderRadius: 0,
                      transition: 'none',
                    }}
                  >
                    &gt;
                  </button>
                </div>

                <select
                  value={displayName === 'Unsaved' ? 'unsaved' : currentPresetIndex}
                  onChange={(e) => {
                    if (e.target.value === 'unsaved') return;
                    const idx = parseInt(e.target.value, 10);
                    setCurrentPresetIndex(idx);
                    loadPreset(presets[idx]);
                  }}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: 9.5,
                    color: displayName === 'Unsaved' ? T.textSec : T.textPri,
                    border: `1px solid ${T.borderSubtle}`,
                    background: T.bgDeep,
                    height: 20,
                    outline: 'none',
                    borderRadius: 0,
                    cursor: 'pointer',
                    padding: '0 4px',
                    letterSpacing: '0.04em',
                    fontFamily: "'Electrolize', monospace",
                  }}
                >
                  {(() => {
                    const categories = {};
                    presets.forEach((p, idx) => {
                      const cat = p.category || 'User / Custom';
                      if (!categories[cat]) categories[cat] = [];
                      categories[cat].push({ preset: p, index: idx });
                    });
                    
                    return Object.entries(categories).map(([catName, items]) => (
                      <optgroup key={catName} label={catName} style={{ background: T.bgSurface, color: T.textLabel }}>
                        {items.map(item => (
                          <option key={item.index} value={item.index} style={{ background: T.bgSurface, color: T.textPri }}>
                            {item.preset.name}
                          </option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                  {displayName === 'Unsaved' && (
                    <option value="unsaved" disabled>
                      Unsaved
                    </option>
                  )}
                </select>

                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    onClick={() => {
                      setNewPresetName('');
                      setIsSaving(true);
                    }}
                    style={{
                      background: T.bgElevated,
                      border: `1px solid ${T.borderDef}`,
                      color: T.textPri,
                      fontSize: 8.5,
                      height: 20,
                      padding: '0 6px',
                      cursor: 'pointer',
                      fontFamily: "'Electrolize', monospace",
                      borderRadius: 0,
                      transition: 'none',
                    }}
                  >
                    SAVE
                  </button>
                  <button
                    onClick={handleDeletePreset}
                    disabled={matchingPreset && DEFAULT_PRESETS.some(dp => dp.name === matchingPreset.name)}
                    style={{
                      background: T.bgElevated,
                      border: `1px solid ${T.borderDef}`,
                      color: (matchingPreset && DEFAULT_PRESETS.some(dp => dp.name === matchingPreset.name)) ? T.textDim : T.textRed,
                      fontSize: 8.5,
                      height: 20,
                      padding: '0 6px',
                      cursor: 'pointer',
                      opacity: (matchingPreset && DEFAULT_PRESETS.some(dp => dp.name === matchingPreset.name)) ? 0.5 : 1,
                      fontFamily: "'Electrolize', monospace",
                      borderRadius: 0,
                      transition: 'none',
                    }}
                  >
                    DEL
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 20 }}>
              {syncStatus === 'unsupported' && (
                <span style={{ fontSize: 7.5, color: T.textSec, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                  Folder sync unavailable in this browser
                </span>
              )}

              {syncStatus !== 'unsupported' && !folderName && (
                <button
                  onClick={handleSetFolder}
                  style={{
                    background: T.bgElevated,
                    border: `1px solid ${T.borderDef}`,
                    color: T.textPri,
                    fontFamily: "'Electrolize', monospace",
                    fontSize: 8,
                    height: 18,
                    padding: '0 8px',
                    cursor: 'pointer',
                    borderRadius: 0,
                    transition: 'none',
                    width: '100%',
                  }}
                >
                  SET PRESETS FOLDER
                </button>
              )}

              {syncStatus === 'unauthorized' && folderName && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 4 }}>
                  <span
                    title={folderName}
                    style={{
                      fontSize: 8,
                      color: T.textRed,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      textAlign: 'left',
                    }}
                  >
                    🔑 {folderName}
                  </span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      onClick={handleAuthorize}
                      style={{
                        background: T.redBright,
                        border: 'none',
                        color: T.textPri,
                        fontFamily: "'Electrolize', monospace",
                        fontSize: 8,
                        height: 18,
                        padding: '0 6px',
                        cursor: 'pointer',
                        borderRadius: 0,
                        transition: 'none',
                      }}
                    >
                      AUTH
                    </button>
                    <button
                      onClick={handleSetFolder}
                      style={{
                        background: T.bgElevated,
                        border: `1px solid ${T.borderDef}`,
                        color: T.textSec,
                        fontFamily: "'Electrolize', monospace",
                        fontSize: 8,
                        height: 18,
                        padding: '0 6px',
                        cursor: 'pointer',
                        borderRadius: 0,
                        transition: 'none',
                      }}
                    >
                      CHANGE
                    </button>
                  </div>
                </div>
              )}

              {syncStatus === 'active' && folderName && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 4 }}>
                  <span
                    title={folderName}
                    style={{
                      fontSize: 8,
                      color: T.textLabel,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      textAlign: 'left',
                    }}
                  >
                    📁 {folderName}
                  </span>
                  <button
                    onClick={handleSetFolder}
                    style={{
                      background: T.bgElevated,
                      border: `1px solid ${T.borderDef}`,
                      color: T.textSec,
                      fontFamily: "'Electrolize', monospace",
                      fontSize: 8,
                      height: 18,
                      padding: '0 6px',
                      cursor: 'pointer',
                      borderRadius: 0,
                      transition: 'none',
                    }}
                  >
                    CHANGE
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Spectrogram Canvas */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Spectrogram analyser={analyser} W={layoutWidth - 380} />
          </div>
        </div>

        {/* ─── 2. OSC ROW ────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          flexDirection: widthMode === 'narrow' ? 'column' : 'row',
          background: T.borderSubtle,
          gap: 1,
          borderBottom: `1px solid ${T.borderSubtle}`,
        }}>
          {[1, 2, 3].map(num => {
            const enabledKey = `osc${num}Enabled`;
            const waveKey = `osc${num}Waveform`;
            const mixKey = `osc${num}Mix`;
            const panKey = `osc${num}Pan`;
            const coarseKey = `osc${num}Coarse`;
            const fineKey = `osc${num}Fine`;
            const pwKey = `osc${num}PulseWidth`;
            const pwmKey = `osc${num}PWMDepth`;

            const isEnabled = params[enabledKey];

            return (
              <div key={num} style={{
                flex: 1,
                background: T.bgSurface,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                {/* Section label & Enable Switch */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    color: T.textSec,
                    borderLeft: `2px solid ${T.redPrimary}`,
                    paddingLeft: 8,
                  }}>
                    OSC {num}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      onClick={() => updateParam(enabledKey, !isEnabled)}
                      style={{
                        width: 14,
                        height: 14,
                        cursor: 'pointer',
                        border: `1px solid ${isEnabled ? T.borderActive : T.borderDef}`,
                        background: isEnabled ? T.redBright : T.bgDeep,
                      }}
                    />
                    <span style={{ fontSize: 8, color: isEnabled ? T.textPri : T.textDim, letterSpacing: '0.04em' }}>
                      ON
                    </span>
                  </div>
                </div>

                {/* Waveform Selector Mini Display */}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
                  {['saw', 'square', 'triangle', 'sine'].map(w => (
                    <WaveMini
                      key={w}
                      wave={w}
                      active={params[waveKey] === w}
                      onClick={() => updateParam(waveKey, w)}
                      W={42}
                      H={16}
                    />
                  ))}
                </div>

                {/* Knobs Row 1 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Knob
                    size="md"
                    value={getKnobVal(mixKey)}
                    onChange={v => updateParam(mixKey, v)}
                    onReset={() => resetParam(mixKey)}
                    label="Mix"
                  />
                  <Knob
                    size="sm"
                    value={getKnobVal(panKey)}
                    onChange={v => updateParam(panKey, v)}
                    onReset={() => resetParam(panKey)}
                    label="Pan"
                    fmt={v => `${Math.round((v - 0.5) * 200)}%`}
                  />
                  <Knob
                    size="sm"
                    value={getKnobVal(coarseKey)}
                    onChange={v => updateParam(coarseKey, v)}
                    onReset={() => resetParam(coarseKey)}
                    label="Coarse"
                    fmt={v => `${Math.round((v - 0.5) * 48)} st`}
                  />
                  <Knob
                    size="sm"
                    value={getKnobVal(fineKey)}
                    onChange={v => updateParam(fineKey, v)}
                    onReset={() => resetParam(fineKey)}
                    label="Fine"
                    fmt={v => `${Math.round((v - 0.5) * 200)} c`}
                  />
                </div>

                {/* Knobs Row 2 */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <Knob
                    size="sm"
                    value={getKnobVal(pwKey)}
                    onChange={v => updateParam(pwKey, v)}
                    onReset={() => resetParam(pwKey)}
                    label="PW"
                    fmt={v => `${Math.round(v * 100)}%`}
                  />
                  <Knob
                    size="sm"
                    value={getKnobVal(pwmKey)}
                    onChange={v => updateParam(pwmKey, v)}
                    onReset={() => resetParam(pwmKey)}
                    label="PWM"
                    fmt={v => `${Math.round(v * 100)}%`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── 3. FILTER ─────────────────────────────────────────── */}
        <div style={{
          background: T.bgSurface,
          borderLeft: `3px solid ${T.redPrimary}`,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          borderBottom: `1px solid ${T.borderSubtle}`,
        }}>
          {/* Header */}
          <div style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            color: T.textSec,
            borderLeft: `2px solid ${T.redPrimary}`,
            paddingLeft: 8,
            marginBottom: 4,
          }}>
            FILTER
          </div>

          {/* FilterDisplay */}
          <FilterDisplay
            W={layoutWidth - 28}
            H={80}
            cutoff={getKnobVal('filterCutoff')}
            res={getKnobVal('filterResonance')}
          />

          {/* Frequency Axis Labels */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingLeft: 2,
            paddingRight: 2,
            marginTop: -4,
            marginBottom: 6,
          }}>
            {['20Hz', '100', '500', '2k', '8k', '20kHz'].map(label => (
              <span key={label} style={{ fontSize: 7.5, color: T.textDim, letterSpacing: '0.04em' }}>
                {label}
              </span>
            ))}
          </div>

          {/* Controls Row */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Knob
                size="lg"
                value={getKnobVal('filterCutoff')}
                onChange={v => updateParam('filterCutoff', v)}
                onReset={() => resetParam('filterCutoff')}
                label="Cutoff"
                fmt={v => `${Math.round(35 * Math.pow(600, v))} Hz`}
              />
              <Knob
                size="lg"
                value={getKnobVal('filterResonance')}
                onChange={v => updateParam('filterResonance', v)}
                onReset={() => resetParam('filterResonance')}
                label="Res"
                fmt={v => (v * 3.8).toFixed(2)}
              />
              <Knob
                size="md"
                value={getKnobVal('filterEnvAmount')}
                onChange={v => updateParam('filterEnvAmount', v)}
                onReset={() => resetParam('filterEnvAmount')}
                label="Env Amt"
                fmt={v => `${Math.round((v - 0.5) * 200)}%`}
              />
              
              {/* Type Select */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, userSelect: 'none' }}>
                <select
                  value={params.filterType}
                  onChange={e => updateParam('filterType', e.target.value)}
                  style={{
                    background: T.bgControl,
                    border: `1px solid ${T.borderDef}`,
                    color: T.textPri,
                    fontFamily: "'Electrolize', monospace",
                    fontSize: 8.5,
                    padding: '4px 6px',
                    outline: 'none',
                    height: 22,
                    cursor: 'pointer',
                  }}
                >
                  <option value="lowpass">LP</option>
                  <option value="highpass">HP</option>
                  <option value="bandpass">BP</option>
                  <option value="notch">NT</option>
                </select>
                <div style={{ fontSize: 8.5, color: T.textSec, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  Type
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 40, background: T.borderSubtle }} />

            {/* Envelope knobs */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Knob
                size="sm"
                value={getKnobVal('filterAttack')}
                onChange={v => updateParam('filterAttack', v)}
                onReset={() => resetParam('filterAttack')}
                label="F.Atk"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
              <Knob
                size="sm"
                value={getKnobVal('filterDecay')}
                onChange={v => updateParam('filterDecay', v)}
                onReset={() => resetParam('filterDecay')}
                label="F.Dec"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
              <Knob
                size="sm"
                value={getKnobVal('filterSustain')}
                onChange={v => updateParam('filterSustain', v)}
                onReset={() => resetParam('filterSustain')}
                label="F.Sus"
                fmt={v => `${Math.round(v * 100)}%`}
              />
              <Knob
                size="sm"
                value={getKnobVal('filterRelease')}
                onChange={v => updateParam('filterRelease', v)}
                onReset={() => resetParam('filterRelease')}
                label="F.Rel"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
            </div>
          </div>
        </div>

        {/* ─── 4. BOTTOM ROW ─────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          flexDirection: widthMode === 'wide' ? 'row' : 'column',
          background: T.borderSubtle,
          gap: 1,
          borderBottom: `1px solid ${T.borderSubtle}`,
        }}>
          <div style={{
            display: widthMode === 'wide' ? 'contents' : 'flex',
            flexDirection: widthMode === 'narrow' ? 'column' : 'row',
            gap: 1,
          }}>
            {/* AMP ENV Section */}
          <div style={{
            flex: 1,
            background: T.bgSurface,
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{
              fontSize: 9,
              letterSpacing: '0.18em',
              color: T.textSec,
              borderLeft: `2px solid ${T.redPrimary}`,
              paddingLeft: 6,
            }}>
              AMP ENV
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ADSRDisplay
                W={112}
                H={40}
                attack={getKnobVal('attack')}
                decay={getKnobVal('decay')}
                sustain={getKnobVal('sustain')}
                release={getKnobVal('release')}
              />
            </div>
            {/* 2x2 Knobs grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 2px',
              justifyItems: 'center',
            }}>
              <Knob
                size="md"
                value={getKnobVal('attack')}
                onChange={v => updateParam('attack', v)}
                onReset={() => resetParam('attack')}
                label="A"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
              <Knob
                size="md"
                value={getKnobVal('decay')}
                onChange={v => updateParam('decay', v)}
                onReset={() => resetParam('decay')}
                label="D"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
              <Knob
                size="md"
                value={getKnobVal('sustain')}
                onChange={v => updateParam('sustain', v)}
                onReset={() => resetParam('sustain')}
                label="S"
                fmt={v => `${Math.round(v * 100)}%`}
              />
              <Knob
                size="md"
                value={getKnobVal('release')}
                onChange={v => updateParam('release', v)}
                onReset={() => resetParam('release')}
                label="R"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
            </div>
          </div>

          {/* FILTER ENV Section */}
          <div style={{
            flex: 1,
            background: T.bgSurface,
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{
              fontSize: 9,
              letterSpacing: '0.18em',
              color: T.textSec,
              borderLeft: `2px solid ${T.redPrimary}`,
              paddingLeft: 6,
            }}>
              FLT ENV
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ADSRDisplay
                W={112}
                H={38}
                attack={getKnobVal('filterAttack')}
                decay={getKnobVal('filterDecay')}
                sustain={getKnobVal('filterSustain')}
                release={getKnobVal('filterRelease')}
              />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 2px',
              justifyItems: 'center',
            }}>
              <Knob
                size="sm"
                value={getKnobVal('filterAttack')}
                onChange={v => updateParam('filterAttack', v)}
                onReset={() => resetParam('filterAttack')}
                label="A"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
              <Knob
                size="sm"
                value={getKnobVal('filterDecay')}
                onChange={v => updateParam('filterDecay', v)}
                onReset={() => resetParam('filterDecay')}
                label="D"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
              <Knob
                size="sm"
                value={getKnobVal('filterSustain')}
                onChange={v => updateParam('filterSustain', v)}
                onReset={() => resetParam('filterSustain')}
                label="S"
                fmt={v => `${Math.round(v * 100)}%`}
              />
              <Knob
                size="sm"
                value={getKnobVal('filterRelease')}
                onChange={v => updateParam('filterRelease', v)}
                onReset={() => resetParam('filterRelease')}
                label="R"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Knob
                size="sm"
                value={getKnobVal('filterEnvAmount')}
                onChange={v => updateParam('filterEnvAmount', v)}
                onReset={() => resetParam('filterEnvAmount')}
                label="Amt"
                fmt={v => `${Math.round((v - 0.5) * 200)}%`}
              />
            </div>
          </div>

          {/* PITCH ENV Section */}
          <div style={{
            flex: 1,
            background: T.bgSurface,
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{
              fontSize: 9,
              letterSpacing: '0.18em',
              color: T.textSec,
              borderLeft: `2px solid ${T.redPrimary}`,
              paddingLeft: 6,
            }}>
              PCH ENV
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ADSRDisplay
                W={112}
                H={38}
                attack={getKnobVal('pitchEnvAttack')}
                decay={getKnobVal('pitchEnvDecay')}
                sustain={getKnobVal('pitchEnvSustain')}
                release={getKnobVal('pitchEnvRelease')}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Knob
                size="sm"
                value={getKnobVal('pitchEnvAmount')}
                onChange={v => updateParam('pitchEnvAmount', v)}
                onReset={() => resetParam('pitchEnvAmount')}
                label="Amt"
                fmt={v => `${Math.round((v - 0.5) * 48)} st`}
              />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 2px',
              justifyItems: 'center',
            }}>
              <Knob
                size="sm"
                value={getKnobVal('pitchEnvAttack')}
                onChange={v => updateParam('pitchEnvAttack', v)}
                onReset={() => resetParam('pitchEnvAttack')}
                label="A"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
              <Knob
                size="sm"
                value={getKnobVal('pitchEnvDecay')}
                onChange={v => updateParam('pitchEnvDecay', v)}
                onReset={() => resetParam('pitchEnvDecay')}
                label="D"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
              <Knob
                size="sm"
                value={getKnobVal('pitchEnvSustain')}
                onChange={v => updateParam('pitchEnvSustain', v)}
                onReset={() => resetParam('pitchEnvSustain')}
                label="S"
                fmt={v => `${Math.round(v * 100)}%`}
              />
              <Knob
                size="sm"
                value={getKnobVal('pitchEnvRelease')}
                onChange={v => updateParam('pitchEnvRelease', v)}
                onReset={() => resetParam('pitchEnvRelease')}
                label="R"
                fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`}
              />
            </div>
          </div>
          </div>

          <div style={{
            display: widthMode === 'wide' ? 'contents' : 'flex',
            flexDirection: widthMode === 'narrow' ? 'column' : 'row',
            gap: 1,
          }}>
            {/* LFO Section */}
          <div style={{
            flex: 1,
            background: T.bgSurface,
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{
              fontSize: 9,
              letterSpacing: '0.18em',
              color: T.textSec,
              borderLeft: `2px solid ${T.redPrimary}`,
              paddingLeft: 6,
            }}>
              LFO
            </div>
            
            {/* 4 Wave selectors */}
            <div style={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
              {['saw', 'square', 'triangle', 'sine'].map(w => (
                <WaveMini
                  key={w}
                  wave={w}
                  active={params.lfoWaveform === w}
                  onClick={() => updateParam('lfoWaveform', w)}
                  W={24}
                  H={14}
                />
              ))}
            </div>

            {/* Rate & Depth */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Knob
                size="md"
                value={getKnobVal('lfoRate')}
                onChange={v => updateParam('lfoRate', v)}
                onReset={() => resetParam('lfoRate')}
                label="Rate"
                fmt={v => `${(0.1 + v * 19.9).toFixed(1)} Hz`}
              />
              <Knob
                size="md"
                value={getKnobVal('lfoDepth')}
                onChange={v => updateParam('lfoDepth', v)}
                onReset={() => resetParam('lfoDepth')}
                label="Depth"
                fmt={v => `${Math.round(v * 100)}%`}
              />
            </div>

            {/* Destination Select */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <select
                value={params.lfoDestination}
                onChange={e => updateParam('lfoDestination', e.target.value)}
                style={{
                  background: T.bgControl,
                  border: `1px solid ${T.borderDef}`,
                  color: T.textPri,
                  fontFamily: "'Electrolize', monospace",
                  fontSize: 8.5,
                  padding: '3px 4px',
                  outline: 'none',
                  width: '100%',
                  height: 20,
                  cursor: 'pointer',
                }}
              >
                <option value="pitch">PITCH</option>
                <option value="filter">FILTER</option>
                <option value="volume">VOLUME</option>
                <option value="pan">PAN</option>
              </select>
              <div style={{ fontSize: 8, color: T.textSec, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                DEST
              </div>
            </div>
          </div>

          {/* UNISON Section */}
          <div style={{
            flex: 1,
            background: T.bgSurface,
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{
              fontSize: 9,
              letterSpacing: '0.18em',
              color: T.textSec,
              borderLeft: `2px solid ${T.redPrimary}`,
              paddingLeft: 6,
            }}>
              UNISON
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <Knob
                size="sm"
                value={getKnobVal('unisonVoices')}
                onChange={v => updateParam('unisonVoices', v)}
                onReset={() => resetParam('unisonVoices')}
                label="Voices"
                fmt={v => `${Math.max(1, Math.round(v * 8))}`}
              />
              <Knob
                size="sm"
                value={getKnobVal('unisonDetune')}
                onChange={v => updateParam('unisonDetune', v)}
                onReset={() => resetParam('unisonDetune')}
                label="Detune"
                fmt={v => `${Math.round(v * 100)} c`}
              />
              <Knob
                size="sm"
                value={getKnobVal('unisonSpread')}
                onChange={v => updateParam('unisonSpread', v)}
                onReset={() => resetParam('unisonSpread')}
                label="Spread"
                fmt={v => `${Math.round(v * 100)}%`}
              />
            </div>
          </div>
          </div>
        </div>

        {/* ─── 5. UTILITY STRIP ───────────────────────────────────── */}
        <div style={{
          background: T.bgSurface,
          padding: '10px 14px',
          display: 'flex',
          flexDirection: widthMode === 'narrow' ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: widthMode === 'narrow' ? 12 : 0,
        }}>
          {/* Glide controls */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Knob
              size="sm"
              value={getKnobVal('portamentoTime')}
              onChange={v => updateParam('portamentoTime', v)}
              onReset={() => resetParam('portamentoTime')}
              label="Glide"
              fmt={v => `${(v * 2).toFixed(2)} s`}
            />

            {/* Always/Legato Toggle Pair */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', border: `1px solid ${T.borderDef}`, background: T.bgDeep }}>
                <button
                  onClick={() => updateParam('portamentoMode', 'always')}
                  style={{
                    background: params.portamentoMode === 'always' ? T.redBright : 'transparent',
                    border: 'none',
                    color: params.portamentoMode === 'always' ? T.textPri : T.textSec,
                    fontFamily: "'Electrolize', monospace",
                    fontSize: 8,
                    padding: '4px 6px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  ALWAYS
                </button>
                <button
                  onClick={() => updateParam('portamentoMode', 'legato')}
                  style={{
                    background: params.portamentoMode === 'legato' ? T.redBright : 'transparent',
                    border: 'none',
                    color: params.portamentoMode === 'legato' ? T.textPri : T.textSec,
                    fontFamily: "'Electrolize', monospace",
                    fontSize: 8,
                    padding: '4px 6px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  LEGATO
                </button>
              </div>
              <div style={{ fontSize: 8, color: T.textSec, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                MODE
              </div>
            </div>
          </div>

          {/* Divider */}
          {widthMode !== 'narrow' && <div style={{ width: 1, height: 32, background: T.borderSubtle }} />}

          {/* Velocity controls */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Knob
              size="sm"
              value={getKnobVal('velocityAmpSens')}
              onChange={v => updateParam('velocityAmpSens', v)}
              onReset={() => resetParam('velocityAmpSens')}
              label="Vel→Amp"
              fmt={v => `${Math.round(v * 100)}%`}
            />
            <Knob
              size="sm"
              value={getKnobVal('velocityFilterSens')}
              onChange={v => updateParam('velocityFilterSens', v)}
              onReset={() => resetParam('velocityFilterSens')}
              label="Vel→Flt"
              fmt={v => `${Math.round(v * 100)}%`}
            />
          </div>

          {/* Divider */}
          {widthMode !== 'narrow' && <div style={{ width: 1, height: 32, background: T.borderSubtle }} />}

          {/* Master controls */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Knob
              size="sm"
              value={getKnobVal('masterGain')}
              onChange={v => updateParam('masterGain', v)}
              onReset={() => resetParam('masterGain')}
              label="Gain"
              fmt={v => `${(20 * Math.log10(v * 0.998 + 0.002)).toFixed(1)} dB`}
            />
            <Knob
              size="sm"
              value={getKnobVal('stereoWidth')}
              onChange={v => updateParam('stereoWidth', v)}
              onReset={() => resetParam('stereoWidth')}
              label="Width"
              fmt={v => `${Math.round(v * 200)}%`}
            />
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
