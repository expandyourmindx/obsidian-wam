import { useState, useRef, useEffect, useCallback } from "react";

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
// Angles in degrees: 0 = top (12 o'clock), clockwise positive
function ap(cx, cy, r, a1, a2) {
  const R = a => (a - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(R(a1));
  const y1 = cy + r * Math.sin(R(a1));
  const x2 = cx + r * Math.cos(R(a2));
  const y2 = cy + r * Math.sin(R(a2));
  const lg = ((a2 - a1 + 360) % 360) > 180 ? 1 : 0;
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${lg},1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
}

// ── Knob ──────────────────────────────────────────────────────────────────────
// Props:
//   value      — 0.0 to 1.0
//   onChange   — (v: number) => void
//   size       — 'sm' | 'md' | 'lg'
//   label      — parameter name string
//   fmt        — optional (v: number) => string for value display
function Knob({ value = 0.5, onChange, size = 'md', label, fmt }) {
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

  // Grip ticks — 20 marks distributed around body perimeter
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

  const arcColor = active ? T.redHot : hover ? T.redBright : T.redPrimary;
  const displayVal = fmt ? fmt(value) : Math.round(value * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', userSelect: 'none' }}>
      {/* Value tooltip — shown on hover and drag */}
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
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Body */}
        <circle cx={cx} cy={cy} r={cr} fill={T.bgControl} />
        {/* Bevel — top-left highlight */}
        <path d={ap(cx, cy, cr, -90, 90)} fill="none" stroke="rgba(255,225,190,0.07)" strokeWidth="1.5" />
        {/* Bevel — bottom-right shadow */}
        <path d={ap(cx, cy, cr, 90, 270)} fill="none" stroke="rgba(0,0,0,0.38)" strokeWidth="1.5" />
        {/* Grip ticks */}
        {ticks}
        {/* Travel track */}
        <path d={ap(cx, cy, ar, -135, 135)} fill="none" stroke={T.borderSubtle} strokeWidth="2" />
        {/* Value arc */}
        {value > 0.005 && (
          <path d={ap(cx, cy, ar, -135, -135 + value * 270)} fill="none" stroke={arcColor} strokeWidth="2" />
        )}
        {/* Recessed face */}
        <circle cx={cx} cy={cy} r={fr} fill={T.bgMid} />
        {/* Face inner bevel — inset shadow top */}
        <path d={ap(cx, cy, fr, -90, 90)} fill="none" stroke="rgba(0,0,0,0.32)" strokeWidth="1" />
        {/* Face inner bevel — inset light bottom */}
        <path d={ap(cx, cy, fr, 90, 270)} fill="none" stroke="rgba(255,225,190,0.04)" strokeWidth="1" />
        {/* Indicator line */}
        <g transform={`rotate(${rot},${cx},${cy})`}>
          <rect
            x={cx - 1} y={cy - fr + 2}
            width={2} height={fr - 6}
            fill={active ? T.redHot : T.redBright}
          />
        </g>
        {/* Center cap */}
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

// ── Filter Frequency Response Display ─────────────────────────────────────────
// The character display. The shoebill's eye.
// Animated — cutoff and resonance sweep continuously.
// Glow via ctx shadow, not CSS filter (signal lines only, never controls).
function FilterDisplay({ W = 340, H = 100 }) {
  const cvs = useRef(null);
  const raf = useRef(null);

  useEffect(() => {
    const canvas = cvs.current;
    const ctx = canvas.getContext('2d');

    // 4-pole Moog-style LP with resonant peak
    function lp(f, fc, res) {
      const r = f / fc;
      const base = 1 / Math.sqrt(1 + Math.pow(r, 8));
      if (res < 0.04) return base;
      const peak = res * 2.4 * Math.exp(-Math.pow(Math.log2(r), 2) * res * 9);
      return Math.min(2.1, base + peak);
    }

    // Log scale: 20 Hz to 20 kHz
    const freqX = f => Math.log(f / 20) / Math.log(1000) * W;
    const gainY = g => H - 6 - g * (H - 14);

    let t0 = null;
    function frame(ts) {
      if (!t0) t0 = ts;
      const t = (ts - t0) / 1000;

      // Slow autonomous sweep
      const cutoff = 0.26 + 0.36 * Math.sin(t * 0.22);
      const res    = 0.46 + 0.46 * Math.sin(t * 0.14 + 1.1);
      const fc     = 35 * Math.pow(600, cutoff);   // 35 Hz to ~21 kHz

      // Background
      ctx.fillStyle = T.bgDeep;
      ctx.fillRect(0, 0, W, H);

      // Grid — frequency markers (very dim)
      ctx.save();
      ctx.strokeStyle = T.borderGhost;
      ctx.lineWidth = 0.5;
      [100, 500, 2000, 8000].forEach(f => {
        const x = freqX(f);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      });
      // Gain markers
      [0.5, 0.1, 0.02].forEach(g => {
        const y = gainY(g);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      });
      ctx.restore();

      // Build curve points
      const pts = Array.from({ length: W }, (_, i) => {
        const f = 20 * Math.pow(1000, i / (W - 1));
        return [i, gainY(lp(f, fc, res))];
      });

      // Glow pass
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

      // Main signal line
      ctx.beginPath();
      pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.strokeStyle = T.redBright;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Cutoff frequency marker
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
  }, [W, H]);

  return (
    <div style={{ display: 'inline-block', lineHeight: 0, border: `1px solid ${T.borderSubtle}` }}>
      <canvas ref={cvs} width={W} height={H} style={{ display: 'block' }} />
    </div>
  );
}

// ── Waveform Mini Display ──────────────────────────────────────────────────────
function WaveMini({ wave = 'saw', active = false, onClick }) {
  const W = 100, H = 50;

  const pts = Array.from({ length: 130 }, (_, i) => {
    const t = i / 129;
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
    const py = (H / 2 - y * (H / 2 - 6)).toFixed(1);
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
        {active && <path d={pts} fill="none" stroke="rgba(196,43,43,0.2)" strokeWidth="5" />}
        <path d={pts} fill="none"
          stroke={active ? T.redBright : T.borderDef}
          strokeWidth={active ? 1.5 : 1}
        />
      </svg>
    </div>
  );
}

// ── Color Swatch ───────────────────────────────────────────────────────────────
function Swatch({ name, hex, desc }) {
  return (
    <div style={{ width: 116 }}>
      <div style={{
        height: 38, background: hex,
        border: `1px solid ${T.borderGhost}`,
        marginBottom: 7,
      }} />
      <div style={{ fontFamily: "'Electrolize', monospace", fontSize: 7.5, color: T.textRed, letterSpacing: '0.05em', marginBottom: 3 }}>
        {name}
      </div>
      <div style={{ fontFamily: "'Electrolize', monospace", fontSize: 8, color: T.textSec, letterSpacing: '0.04em', marginBottom: 3 }}>
        {hex}
      </div>
      <div style={{ fontFamily: "'Electrolize', monospace", fontSize: 7.5, color: T.textDim, letterSpacing: '0.03em' }}>
        {desc}
      </div>
    </div>
  );
}

// ── Palette Data ───────────────────────────────────────────────────────────────
const PALETTE = [
  { group: 'BACKGROUNDS', items: [
    ['--obs-bg-deep',     '#0d0a09', 'Page / canvas'],
    ['--obs-bg-mid',      '#131010', 'Panel backgrounds'],
    ['--obs-bg-surface',  '#1c1715', 'Module surfaces'],
    ['--obs-bg-elevated', '#242020', 'Raised elements'],
    ['--obs-bg-control',  '#1a1412', 'Knob bodies'],
  ]},
  { group: 'RED — DRIED EMBERS', items: [
    ['--obs-red-ember',   '#3d0e0e', 'Glow fill, subtle'],
    ['--obs-red-primary', '#8b1a1a', 'Borders, inactive'],
    ['--obs-red-bright',  '#c42b2b', 'Active, indicator'],
    ['--obs-red-hot',     '#e03535', 'Hover, peak, danger'],
  ]},
  { group: 'BORDERS', items: [
    ['--obs-border-ghost',  '#1a1614', 'Barely visible'],
    ['--obs-border-subtle', '#2a2220', 'Panel edges'],
    ['--obs-border-def',    '#3a2e2a', 'Control borders'],
    ['--obs-border-active', '#8b1a1a', 'Focus / selected'],
  ]},
  { group: 'TEXT', items: [
    ['--obs-text-primary', '#ddd0c8', 'Primary text'],
    ['--obs-text-label',   '#9a8878', 'Parameter labels'],
    ['--obs-text-sec',     '#7a6860', 'Secondary / muted'],
    ['--obs-text-dim',     '#3f3430', 'Disabled / ghost'],
    ['--obs-text-red',     '#c42b2b', 'Values, emphasis'],
  ]},
];

// ── Layout helpers ─────────────────────────────────────────────────────────────
const Hr = () => (
  <div style={{ height: 1, background: T.borderGhost, margin: '60px 0' }} />
);
const SecLabel = ({ n, children }) => (
  <div style={{
    fontFamily: "'Electrolize', monospace",
    fontSize: 9, letterSpacing: '0.24em',
    textTransform: 'uppercase', color: T.textDim, marginBottom: 30,
  }}>
    {String(n).padStart(2, '0')} — {children}
  </div>
);
const GroupLabel = ({ children, accent }) => (
  <div style={{
    fontFamily: "'Electrolize', monospace",
    fontSize: 10, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: T.textSec,
    marginBottom: 20,
    ...(accent ? { borderLeft: `2px solid ${T.redPrimary}`, paddingLeft: 10 } : {}),
  }}>
    {children}
  </div>
);
const SubNote = ({ children }) => (
  <div style={{
    fontFamily: "'Electrolize', monospace",
    fontSize: 8.5, color: T.textDim,
    letterSpacing: '0.06em', lineHeight: 1.9, marginBottom: 14,
  }}>
    {children}
  </div>
);

// ── Main Styleguide ────────────────────────────────────────────────────────────
export default function ObsidianStyleguide() {
  const [K, setK] = useState({
    cutoff: 0.62, res: 0.42,
    atk: 0.08, dec: 0.36, sus: 0.68, rel: 0.25,
    gain: 0.78, width: 0.5, rate: 0.28, depth: 0.18,
  });
  const set = key => v => setK(p => ({ ...p, [key]: v }));
  const [wave, setWave] = useState('saw');

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Electrolize&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; background: #0d0a09; }
        ::-webkit-scrollbar-thumb { background: #2a2220; }
      `}</style>

      <div style={{
        background: T.bgDeep, color: T.textPri,
        fontFamily: "'Electrolize', monospace",
        minHeight: '100vh', padding: '64px 48px',
        maxWidth: 760, margin: '0 auto',
      }}>

        {/* ─── HEADER ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 72 }}>
          <div style={{
            fontFamily: "'Righteous', sans-serif",
            fontSize: 84, letterSpacing: '0.1em', lineHeight: 0.88,
            color: T.textPri, marginBottom: 22,
          }}>
            OBSIDIAN
          </div>
          <div style={{
            display: 'inline-block',
            fontFamily: "'Electrolize', monospace",
            fontSize: 10, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: T.textSec,
            borderLeft: `2px solid ${T.redPrimary}`, paddingLeft: 12,
            marginBottom: 22,
          }}>
            Design System — v1.0
          </div>
          <div style={{
            fontFamily: "'Electrolize', monospace",
            fontSize: 9.5, color: T.textDim, letterSpacing: '0.07em',
            lineHeight: 2.1, maxWidth: 400,
          }}>
            Virtual analog synthesizer · Web Audio Module 2.0<br />
            Volcanic. Primordial. Hard edges, no softness.<br />
            Patient at rest. Violent when pushed.
          </div>
        </div>

        <Hr />

        {/* ─── 01 COLOR SYSTEM ────────────────────────────────── */}
        <SecLabel n={1}>Color System</SecLabel>
        {PALETTE.map(({ group, items }) => (
          <div key={group} style={{ marginBottom: 40 }}>
            <div style={{
              fontFamily: "'Electrolize', monospace",
              fontSize: 8.5, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: T.textSec,
              marginBottom: 14,
            }}>
              {group}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {items.map(([name, hex, desc]) => (
                <Swatch key={name} name={name} hex={hex} desc={desc} />
              ))}
            </div>
          </div>
        ))}

        <Hr />

        {/* ─── 02 TYPOGRAPHY ──────────────────────────────────── */}
        <SecLabel n={2}>Typography</SecLabel>

        <div style={{ marginBottom: 40 }}>
          <GroupLabel>Righteous — Badge &amp; Wordmark</GroupLabel>
          <div style={{ fontFamily: "'Righteous', sans-serif", fontSize: 54, letterSpacing: '0.12em', lineHeight: 1, color: T.textPri, marginBottom: 10 }}>
            OBSIDIAN
          </div>
          <div style={{ fontFamily: "'Righteous', sans-serif", fontSize: 30, letterSpacing: '0.14em', lineHeight: 1.2, color: T.textSec, marginBottom: 10 }}>
            OSC 1 · FILTER · AMP ENV
          </div>
          <div style={{ fontFamily: "'Righteous', sans-serif", fontSize: 18, letterSpacing: '0.12em', color: T.textDim }}>
            WAM 2.0 — VIRTUAL ANALOG SYNTHESIZER
          </div>
        </div>

        <div style={{ marginBottom: 40 }}>
          <GroupLabel>Electrolize — UI, Labels, Values</GroupLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { text: 'FILTER CUTOFF',                              sz: 11, ls: '0.20em', color: T.textSec,   note: 'Section header — 11px, 0.20em' },
              { text: 'Cutoff',                                     sz: 10, ls: '0.10em', color: T.textLabel, note: 'Parameter label — 10px, 0.10em' },
              { text: '1250 Hz',                                    sz: 10, ls: '0.06em', color: T.textRed,   note: 'Value readout — obs-text-red' },
              { text: '74 %',                                       sz: 10, ls: '0.06em', color: T.textRed,   note: 'Value readout — percentage' },
              { text: 'Self-oscillation available in the top 1/6th of the resonance range.', sz: 9.5, ls: '0.04em', color: T.textSec, note: 'Description — 9.5px' },
            ].map(({ text, sz, ls, color, note }) => (
              <div key={note} style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
                <span style={{ fontFamily: "'Electrolize', monospace", fontSize: sz, letterSpacing: ls, color, minWidth: 290 }}>
                  {text}
                </span>
                <span style={{ fontSize: 8, color: T.textDim, letterSpacing: '0.06em' }}>{note}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <GroupLabel>Section Label — left-border accent pattern</GroupLabel>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {['Filter', 'OSC 1', 'Amp Env', 'LFO', 'Unison'].map(s => (
              <div key={s} style={{
                fontFamily: "'Electrolize', monospace",
                fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: T.textSec,
                borderLeft: `2px solid ${T.redPrimary}`, paddingLeft: 10,
              }}>
                {s}
              </div>
            ))}
          </div>
        </div>

        <Hr />

        {/* ─── 03 KNOBS ───────────────────────────────────────── */}
        <SecLabel n={3}>Knobs</SecLabel>
        <SubNote>Drag vertical — up increases, down decreases. Double-click resets.</SubNote>

        <div style={{ marginBottom: 52 }}>
          <GroupLabel accent>Size LG — 78px · Filter section</GroupLabel>
          <SubNote>Reserved for primary voice-shaping controls. Filter Cutoff and Resonance.</SubNote>
          <div style={{ display: 'flex', gap: 44, alignItems: 'flex-start' }}>
            <Knob size="lg" value={K.cutoff} onChange={set('cutoff')} label="Cutoff"
              fmt={v => `${Math.round(35 * Math.pow(600, v))} Hz`} />
            <Knob size="lg" value={K.res}    onChange={set('res')}    label="Res"
              fmt={v => (v * 3.8).toFixed(2)} />
          </div>
        </div>

        <div style={{ marginBottom: 52 }}>
          <GroupLabel accent>Size MD — 60px · Envelope and modulation</GroupLabel>
          <SubNote>Standard control. ADSR, LFO parameters, oscillator mix, env amounts.</SubNote>
          <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start' }}>
            <Knob size="md" value={K.atk} onChange={set('atk')} label="Attack"
              fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`} />
            <Knob size="md" value={K.dec} onChange={set('dec')} label="Decay"
              fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`} />
            <Knob size="md" value={K.sus} onChange={set('sus')} label="Sustain"
              fmt={v => `${Math.round(v * 100)} %`} />
            <Knob size="md" value={K.rel} onChange={set('rel')} label="Release"
              fmt={v => v < 0.1 ? `${Math.round(v*1000)} ms` : `${v.toFixed(2)} s`} />
          </div>
        </div>

        <div style={{ marginBottom: 44 }}>
          <GroupLabel accent>Size SM — 44px · Utility strip</GroupLabel>
          <SubNote>Portamento, stereo width, master gain, secondary parameters.</SubNote>
          <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start' }}>
            <Knob size="sm" value={K.gain}  onChange={set('gain')}  label="Gain"
              fmt={v => `${(20 * Math.log10(v * 0.998 + 0.002)).toFixed(1)} dB`} />
            <Knob size="sm" value={K.width} onChange={set('width')} label="Width"
              fmt={v => `${Math.round(v * 200)} %`} />
            <Knob size="sm" value={K.rate}  onChange={set('rate')}  label="Rate"
              fmt={v => `${(0.1 + v * 19.9).toFixed(1)} Hz`} />
            <Knob size="sm" value={K.depth} onChange={set('depth')} label="Depth"
              fmt={v => `${Math.round(v * 100)} %`} />
          </div>
        </div>

        <Hr />

        {/* ─── 04 DISPLAYS ────────────────────────────────────── */}
        <SecLabel n={4}>Displays</SecLabel>

        {/* Filter response */}
        <div style={{ marginBottom: 52 }}>
          <GroupLabel accent>Filter — Frequency Response</GroupLabel>
          <SubNote>
            The character display. The shoebill's eye. Lives at the visual center of the panel.
            Glow via canvas shadow — signal displays only. Never apply glow to controls or text.
          </SubNote>
          <FilterDisplay W={380} H={110} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, width: 380 }}>
            {['20 Hz', '100', '500', '2k', '8k', '20 kHz'].map(f => (
              <span key={f} style={{
                fontFamily: "'Electrolize', monospace", fontSize: 7.5,
                color: T.textDim, letterSpacing: '0.05em',
              }}>{f}</span>
            ))}
          </div>
        </div>

        {/* Waveform selector */}
        <div style={{ marginBottom: 52 }}>
          <GroupLabel accent>Oscillator — Waveform Selector</GroupLabel>
          <SubNote>Click to select. Active: obs-red-bright + canvas glow. Inactive: obs-border-def, no glow.</SubNote>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            {['saw', 'square', 'triangle', 'sine'].map(w => (
              <div key={w} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <WaveMini wave={w} active={wave === w} onClick={() => setWave(w)} />
                <span style={{
                  fontFamily: "'Electrolize', monospace",
                  fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: wave === w ? T.textRed : T.textSec,
                }}>
                  {w}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Value readout */}
        <div style={{ marginBottom: 44 }}>
          <GroupLabel accent>Value Readout — Tooltip on hover / drag</GroupLabel>
          <SubNote>Appears above knob. bg-elevated, border-active, text-red. No border-radius.</SubNote>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[['1250 Hz', 'Cutoff'], ['2.84', 'Resonance'], ['148 ms', 'Attack'], ['-6.0 dB', 'Gain'], ['74 %', 'Sustain'], ['0.1–20 Hz', 'LFO Rate']].map(([val, lbl]) => (
              <div key={lbl} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{
                  background: T.bgElevated, border: `1px solid ${T.borderActive}`,
                  padding: '3px 8px', fontFamily: "'Electrolize', monospace",
                  fontSize: 10, color: T.textRed, letterSpacing: '0.04em',
                }}>
                  {val}
                </div>
                <span style={{
                  fontFamily: "'Electrolize', monospace", fontSize: 8,
                  color: T.textDim, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  {lbl}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Hr />

        {/* ─── 05 RULES FOR AGENTS ────────────────────────────── */}
        <SecLabel n={5}>Rules for Agents</SecLabel>
        <div style={{ fontFamily: "'Electrolize', monospace", fontSize: 9, lineHeight: 2.5, letterSpacing: '0.04em' }}>
          {[
            ['border-radius',    '0 — always, no exceptions, ever.'],
            ['box-shadow',       'None. Depth via bevel arcs and border only.'],
            ['transition',       'None on controls. Allowed on canvas signal displays only.'],
            ['glow',             'Canvas shadow on signal lines only — never on controls, borders, or text.'],
            ['gradients',        'None. Hard fills. Bevel via two overlapping arc strokes (light top, dark bottom).'],
            ['font-badge',       '"Righteous", "Arial Black", sans-serif — wordmark and section markers only.'],
            ['font-ui',          '"Electrolize", monospace — all labels, values, body text.'],
            ['red inactive',     'obs-red-primary #8b1a1a — borders, value arc at rest, inactive indicator.'],
            ['red active',       'obs-red-bright #c42b2b — active state, indicator line, selected waveform.'],
            ['red hover/drag',   'obs-red-hot #e03535 — hover state, active drag, peak activity only.'],
            ['bg warmth',        'All backgrounds are warm near-black. Never blue-black. Never cool grey.'],
            ['bg depth order',   'bgDeep → bgMid → bgSurface → bgElevated. Panel on bgMid, knob body on bgControl.'],
            ['knob drag axis',   'Vertical drag only. Up increases. 120px (sm) / 160px (md) / 200px (lg) = full range.'],
            ['knob bevel',       'Two arc strokes: rgba(255,225,190,0.07) top, rgba(0,0,0,0.38) bottom.'],
            ['display bg',       'Always obs-bg-deep. Grid lines in obs-border-ghost. Signal in obs-red-bright.'],
            ['spacing unit',     '8px base. Control groups: 20–30px gap. Sections: 52px gap. Knob label: 6px below.'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex' }}>
              <span style={{ color: T.textRed, minWidth: 160, flexShrink: 0 }}>{k}</span>
              <span style={{ color: T.textDim, marginRight: 10 }}>—</span>
              <span style={{ color: T.textSec }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 80, paddingTop: 24, borderTop: `1px solid ${T.borderGhost}` }}>
          <div style={{
            fontFamily: "'Righteous', sans-serif",
            fontSize: 13, letterSpacing: '0.24em', color: T.textDim,
          }}>
            OBSIDIAN WAM — DESIGN SYSTEM v1.0
          </div>
          <div style={{
            fontFamily: "'Electrolize', monospace",
            fontSize: 8, color: T.textDim,
            letterSpacing: '0.1em', marginTop: 8, lineHeight: 2.2,
          }}>
            Volcanic glass. Ancient, dark, sharp. Formed under pressure.
          </div>
        </div>

      </div>
    </>
  );
}
