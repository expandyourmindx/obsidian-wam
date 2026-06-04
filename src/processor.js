// src/processor.js
// Obsidian WAM — AudioWorklet Processor
// Runs on the audio thread. No allocations, no main thread access.

const SAMPLE_RATE = 44100;
const MAX_VOICES = 8;

// ── PolyBLEP helper ──────────────────────────────────────────────
// This is the secret sauce. A naive sawtooth or square wave aliases
// badly at high frequencies. PolyBLEP smooths the discontinuities
// at the waveform edges so harmonics don't fold back as noise.
function polyBlep(phase, phaseIncrement) {
    if (phase < phaseIncrement) {
        const t = phase / phaseIncrement;
        return t + t - t * t - 1.0;
    } else if (phase > 1.0 - phaseIncrement) {
        const t = (phase - 1.0) / phaseIncrement;
        return t * t + t + t + 1.0;
    }
    return 0.0;
}

function squareWave(phase, phaseIncrement) {
    let square = phase < 0.5 ? 1.0 : -1.0;
    square += polyBlep(phase, phaseIncrement);
    square -= polyBlep((phase + 0.5) % 1.0, phaseIncrement);
    return square;
}

function triangleWave(phase, phaseIncrement) {
    // Integrate a square wave to get a band-limited triangle
    let tri = phase < 0.5
        ? 4.0 * phase - 1.0
        : 3.0 - 4.0 * phase;
    return tri;
}

function sawWave(phase, phaseIncrement) {
    let saw = 2.0 * phase - 1.0;
    saw -= polyBlep(phase, phaseIncrement);
    return saw;
}

// waveform: 'saw' | 'square' | 'triangle' | 'sine'
function getOscSample(phase, phaseIncrement, waveform) {
    switch (waveform) {
        case 'sine': return Math.sin(phase * 2 * Math.PI);
        case 'square': return squareWave(phase, phaseIncrement);
        case 'triangle': return triangleWave(phase, phaseIncrement);
        default: return sawWave(phase, phaseIncrement);
    }
}

function getLFOSample(phase, waveform) {
    switch (waveform) {
        case 'triangle':
            return phase < 0.5 ? 4.0 * phase - 1.0 : 3.0 - 4.0 * phase;
        case 'square':
            return phase < 0.5 ? 1.0 : -1.0;
        case 'saw':
            return 2.0 * phase - 1.0;
        default:
            return Math.sin(phase * 2 * Math.PI);
    }
}

function calcPhaseIncrement(note, coarse, fine) {
    const totalSemitones = coarse + fine / 100;
    const freq = 440 * Math.pow(2, (note - 69 + totalSemitones) / 12);
    return freq / sampleRate;
}

// Equal power panning
// Returns [leftGain, rightGain] for a pan value of -1.0 to 1.0
function panGains(pan) {
    const angle = (pan + 1.0) / 2.0 * Math.PI / 2.0;
    return [Math.cos(angle), Math.sin(angle)];
}

// ── Moog Ladder Filter ───────────────────────────────────────────
// Four cascaded one-pole filters with resonance feedback.
// This is the circuit that made the Minimoog famous.
// cutoff: 0.0 - 1.0 (normalized, we'll convert to Hz)
// resonance: 0.0 - 4.0 (above 1.0 it self-oscillates)
function moogFilter(voice, input, ch) {
    const cutoff = voice.filterCutoff;
    const res = voice.filterResonance;
    const f = cutoff * cutoff * 0.9;

    const scaledRes = res * 0.4; // spread range across full slider travel
    const feedback = scaledRes * 3.6 * voice[`filterStage4${ch}`];

    voice[`filterStage1${ch}`] += f * (Math.tanh(input - feedback) - Math.tanh(voice[`filterStage1${ch}`]));
    voice[`filterStage2${ch}`] += f * (Math.tanh(voice[`filterStage1${ch}`]) - Math.tanh(voice[`filterStage2${ch}`]));
    voice[`filterStage3${ch}`] += f * (Math.tanh(voice[`filterStage2${ch}`]) - Math.tanh(voice[`filterStage3${ch}`]));
    voice[`filterStage4${ch}`] += f * (Math.tanh(voice[`filterStage3${ch}`]) - Math.tanh(voice[`filterStage4${ch}`]));

    switch (voice.filterType) {
      case 'highpass':
        return input - voice[`filterStage4${ch}`];
      case 'bandpass':
        return voice[`filterStage2${ch}`];
      case 'notch':
        return (input - voice[`filterStage4${ch}`]) + voice[`filterStage2${ch}`] * 0.5;
      default: // lowpass
        return voice[`filterStage4${ch}`];
    }
}

// ── Single voice ─────────────────────────────────────────────────
// Pre-allocated. We never create a new voice object during playback.
function createVoice() {
    return {
        active: false,
        note: 0,
        frequency: 0,
        velocity: 1.0,

        // Oscillator state — one per osc
        osc1: { phase: 0, phaseIncrement: 0 },
        osc2: { phase: 0, phaseIncrement: 0 },
        osc3: { phase: 0, phaseIncrement: 0 },

        // Unison oscillator state — pre-allocated for max 8 unison voices
        unisonOsc1: Array.from({ length: 8 }, () => ({ phase: Math.random() })),
        unisonOsc2: Array.from({ length: 8 }, () => ({ phase: Math.random() })),
        unisonOsc3: Array.from({ length: 8 }, () => ({ phase: Math.random() })),

        // ADSR state
        // Stages: 0=idle, 1=attack, 2=decay, 3=sustain, 4=release
        envStage: 0,
        envValue: 0,
        envAttackRate: 0,
        envDecayRate: 0,
        envSustainLevel: 0,
        envReleaseRate: 0,

        // Filter envelope state — mirrors amplitude envelope stages
        filterEnvStage: 0,
        filterEnvValue: 0,
        filterEnvAttackRate: 0,
        filterEnvDecayRate: 0,
        filterEnvSustainLevel: 0,
        filterEnvReleaseRate: 0,

        // Pitch envelope state
        pitchEnvStage: 0,
        pitchEnvValue: 0,
        pitchEnvAttackRate: 0,
        pitchEnvDecayRate: 0,
        pitchEnvSustainLevel: 0,
        pitchEnvReleaseRate: 0,

        // Filter state
        filterType: 'lowpass',
        filterCutoff: 0.8,
        filterResonance: 0.1,
        filterStage1L: 0, filterStage2L: 0, filterStage3L: 0, filterStage4L: 0,
        filterStage1R: 0, filterStage2R: 0, filterStage3R: 0, filterStage4R: 0,
    };
}

// ── Processor ────────────────────────────────────────────────────
class ObsidianProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        // Pre-allocate voice pool — no new objects during playback
        this.voices = [];
        for (let i = 0; i < MAX_VOICES; i++) {
            this.voices.push(createVoice());
        }

        // LFO — global, not per voice
        this.lfoPhase = 0;
        this.lfoPhaseIncrement = 2 / sampleRate; // default 1hz, full cycle = 2 units

        // Parameters with defaults
        this.params = {
            pitchBend: 0, // semitones, ±2
            filterType: 'lowpass', // lowpass | highpass | bandpass | notch
            unisonVoices: 1,      // 1 to 8. 1 = unison off, normal behavior
            unisonDetune: 10,     // cents, 0 to 100
            unisonSpread: 0.8,    // stereo spread, 0.0 to 1.0
            pitchEnvAmount: 0,      // semitones, -24 to +24. 0 = off
            pitchEnvAttack: 0.001,  // very fast default
            pitchEnvDecay: 0.2,     // short decay — classic 808 snap
            pitchEnvSustain: 0.0,   // zero sustain by default — transient shape
            pitchEnvRelease: 0.1,
            attack: 0.01,
            decay: 0.1,
            sustain: 0.7,
            release: 0.3,
            masterGain: 0.5,
            filterCutoff: 0.8,
            filterResonance: 0.1,
            filterAttack: 0.01,
            filterDecay: 0.3,
            filterSustain: 0.3,
            filterRelease: 0.5,
            filterEnvAmount: 0.0,   // -1.0 to 1.0. 0 = no modulation
            lfoRate: 1.0,        // Hz, 0.1 to 20
            lfoDepth: 0.0,       // 0.0 to 1.0, default 0 so LFO is opt-in
            lfoWaveform: 'sine', // sine | triangle | square | saw
            lfoDestination: 'pitch', // pitch | filter | volume | pan
            velocityAmpSens: 1.0,     // 0.0 to 1.0 — how much velocity affects volume
            velocityFilterSens: 0.5,  // 0.0 to 1.0 — how much velocity opens the filter

            // OSC 1
            osc1Waveform: 'saw',
            osc1Coarse: 0,      // semitones, -24 to +24
            osc1Fine: 0,        // cents, -100 to +100
            osc1Mix: 1.0,       // 0.0 to 1.0
            osc1Pan: 0.0,
            osc1Enabled: true,

            // OSC 2
            osc2Waveform: 'saw',
            osc2Coarse: 0,
            osc2Fine: 7,        // default +7 cents detune for thickness
            osc2Mix: 0.7,
            osc2Pan: -0.3,
            osc2Enabled: true,

            // OSC 3
            osc3Waveform: 'square',
            osc3Coarse: -12,    // default sub octave
            osc3Fine: 0,
            osc3Mix: 0.5,
            osc3Pan: 0.3,
            osc3Enabled: true,
        };

        // Listen for messages from the main thread
        // (parameter changes, note events if not using WAM event queue yet)
        this.port.onmessage = (e) => {
            const { type, data } = e.data;
            if (type === 'noteOn') this.noteOn(data.note, data.velocity);
            if (type === 'noteOff') this.noteOff(data.note);
            if (type === 'setParam') {
                this.params[data.key] = data.value;
                if (data.key === 'lfoRate') {
                    this.lfoPhaseIncrement = data.value / sampleRate;
                }
                this.voices.forEach(v => {
                    if (v.active) {
                        if (data.key === 'filterCutoff') v.filterCutoff = data.value;
                        if (data.key === 'filterResonance') v.filterResonance = data.value;
                        if (data.key === 'filterType') v.filterType = data.value;
                        if (data.key === 'osc1Fine' || data.key === 'osc1Coarse') {
                            v.osc1.phaseIncrement = calcPhaseIncrement(v.note, this.params.osc1Coarse, this.params.osc1Fine);
                        }
                        if (data.key === 'osc2Fine' || data.key === 'osc2Coarse') {
                            v.osc2.phaseIncrement = calcPhaseIncrement(v.note, this.params.osc2Coarse, this.params.osc2Fine);
                        }
                        if (data.key === 'osc3Fine' || data.key === 'osc3Coarse') {
                            v.osc3.phaseIncrement = calcPhaseIncrement(v.note, this.params.osc3Coarse, this.params.osc3Fine);
                        }
                    }
                });

                if (data.key === 'unisonVoices' || data.key === 'unisonDetune') {
                  this.voices.forEach(v => {
                    if (!v.active) return;
                    const unisonCount = Math.max(1, Math.floor(this.params.unisonVoices));
                    for (let u = 0; u < 8; u++) {
                      if (unisonCount === 1) {
                        v.unisonOsc1[u].phaseIncrement = v.osc1.phaseIncrement;
                        v.unisonOsc2[u].phaseIncrement = v.osc2.phaseIncrement;
                        v.unisonOsc3[u].phaseIncrement = v.osc3.phaseIncrement;
                      } else {
                        const spread = u / (unisonCount - 1);
                        const detuneCents = (spread - 0.5) * 2 * this.params.unisonDetune;
                        const detuneRatio = Math.pow(2, detuneCents / 1200);
                        v.unisonOsc1[u].phaseIncrement = v.osc1.phaseIncrement * detuneRatio;
                        v.unisonOsc2[u].phaseIncrement = v.osc2.phaseIncrement * detuneRatio;
                        v.unisonOsc3[u].phaseIncrement = v.osc3.phaseIncrement * detuneRatio;
                      }
                    }
                  });
                }
            }
        };
    }

    // ── Note helpers ───────────────────────────────────────────────
    noteOn(note, velocity) {
        // First priority: retrigger the same note if it's already playing
        let voice = this.voices.find(v => v.active && v.note === note);
        // Second priority: find a free voice
        if (!voice) voice = this.voices.find(v => !v.active);
        // Last resort: steal the voice furthest into its release
        if (!voice) {
            voice = this.voices.reduce((oldest, v) =>
                v.envValue < oldest.envValue ? v : oldest
                , this.voices[0]);
        }

        const freq = 440 * Math.pow(2, (note - 69) / 12);

        voice.active = true;
        voice.note = note;
        voice.frequency = freq;
        voice.velocity = velocity / 127;
        voice.osc1.phase = 0;
        voice.osc1.phaseIncrement = calcPhaseIncrement(note, this.params.osc1Coarse, this.params.osc1Fine);

        voice.osc2.phase = 0;
        voice.osc2.phaseIncrement = calcPhaseIncrement(note, this.params.osc2Coarse, this.params.osc2Fine);

        voice.osc3.phase = 0;
        voice.osc3.phaseIncrement = calcPhaseIncrement(note, this.params.osc3Coarse, this.params.osc3Fine);

        // Set up unison oscillator phase increments
        // Each copy gets a detune offset spread evenly across the detune range
        const unisonCount = Math.max(1, Math.floor(this.params.unisonVoices));
        for (let u = 0; u < 8; u++) {
          if (unisonCount === 1) {
            // No detune — single copy at base pitch
            voice.unisonOsc1[u].phaseIncrement = voice.osc1.phaseIncrement;
            voice.unisonOsc2[u].phaseIncrement = voice.osc2.phaseIncrement;
            voice.unisonOsc3[u].phaseIncrement = voice.osc3.phaseIncrement;
          } else {
            // Spread detune evenly across copies
            // Center copy (if odd count) is at 0 cents detune
            const spread = u / (unisonCount - 1); // 0.0 to 1.0
            const detuneCents = (spread - 0.5) * 2 * this.params.unisonDetune;
            const detuneRatio = Math.pow(2, detuneCents / 1200);
            voice.unisonOsc1[u].phaseIncrement = voice.osc1.phaseIncrement * detuneRatio;
            voice.unisonOsc2[u].phaseIncrement = voice.osc2.phaseIncrement * detuneRatio;
            voice.unisonOsc3[u].phaseIncrement = voice.osc3.phaseIncrement * detuneRatio;
          }
        }

        // Randomize phases on retrigger to prevent phase cancellation
        for (let u = 0; u < 8; u++) {
          voice.unisonOsc1[u].phase = Math.random();
          voice.unisonOsc2[u].phase = Math.random();
          voice.unisonOsc3[u].phase = Math.random();
        }

        voice.filterCutoff = this.params.filterCutoff;
        voice.filterResonance = this.params.filterResonance;
        voice.filterType = this.params.filterType;
        // Reset filter stages on new note to prevent clicks
        voice.filterStage1L = 0;
        voice.filterStage2L = 0;
        voice.filterStage3L = 0;
        voice.filterStage4L = 0;
        voice.filterStage1R = 0;
        voice.filterStage2R = 0;
        voice.filterStage3R = 0;
        voice.filterStage4R = 0;

        // Start attack
        voice.envStage = 1;
        voice.envAttackRate = 1.0 / (this.params.attack * sampleRate);
        voice.envDecayRate = 1.0 / (this.params.decay * sampleRate);
        voice.envSustainLevel = this.params.sustain;
        voice.envReleaseRate = 1.0 / (this.params.release * sampleRate);

        // Start filter envelope
        voice.filterEnvStage = 1;
        voice.filterEnvAttackRate = 1.0 / (this.params.filterAttack * sampleRate);
        voice.filterEnvDecayRate = 1.0 / (this.params.filterDecay * sampleRate);
        voice.filterEnvSustainLevel = this.params.filterSustain;
        voice.filterEnvReleaseRate = 1.0 / (this.params.filterRelease * sampleRate);

        // Start pitch envelope
        voice.pitchEnvStage = 1;
        voice.pitchEnvAttackRate = 1.0 / (this.params.pitchEnvAttack * sampleRate);
        voice.pitchEnvDecayRate = 1.0 / (this.params.pitchEnvDecay * sampleRate);
        voice.pitchEnvSustainLevel = this.params.pitchEnvSustain;
        voice.pitchEnvReleaseRate = 1.0 / (this.params.pitchEnvRelease * sampleRate);
    }

    noteOff(note) {
        const voice = this.voices.find(v => v.active && v.note === note);
        if (voice) {
            voice.envStage = 4; // trigger release
            voice.filterEnvStage = 4;
            voice.pitchEnvStage = 4;
        }
    }

    // ── ADSR per sample ────────────────────────────────────────────
    processEnvelope(voice) {
        switch (voice.envStage) {
            case 1: // Attack
                voice.envValue += voice.envAttackRate;
                if (voice.envValue >= 1.0) {
                    voice.envValue = 1.0;
                    voice.envStage = 2; // move to decay
                }
                break;
            case 2: // Decay
                voice.envValue -= voice.envDecayRate;
                if (voice.envValue <= voice.envSustainLevel) {
                    voice.envValue = voice.envSustainLevel;
                    voice.envStage = 3; // hold at sustain
                }
                break;
            case 3: // Sustain
                // Nothing — hold at sustain level until noteOff
                break;
            case 4: // Release
                voice.envValue -= voice.envReleaseRate;
                if (voice.envValue <= 0) {
                    voice.envValue = 0;
                    voice.envStage = 0;
                    voice.active = false; // voice is free again
                }
                break;
            default:
                voice.envValue = 0;
        }
        return voice.envValue;
    }

    processFilterEnvelope(voice) {
        switch (voice.filterEnvStage) {
            case 1: // Attack
                voice.filterEnvValue += voice.filterEnvAttackRate;
                if (voice.filterEnvValue >= 1.0) {
                    voice.filterEnvValue = 1.0;
                    voice.filterEnvStage = 2;
                }
                break;
            case 2: // Decay
                voice.filterEnvValue -= voice.filterEnvDecayRate;
                if (voice.filterEnvValue <= voice.filterEnvSustainLevel) {
                    voice.filterEnvValue = voice.filterEnvSustainLevel;
                    voice.filterEnvStage = 3;
                }
                break;
            case 3: // Sustain
                break;
            case 4: // Release
                voice.filterEnvValue -= voice.filterEnvReleaseRate;
                if (voice.filterEnvValue <= 0) {
                    voice.filterEnvValue = 0;
                    voice.filterEnvStage = 0;
                }
                break;
            default:
                voice.filterEnvValue = 0;
        }
        return voice.filterEnvValue;
    }

    processPitchEnvelope(voice) {
      switch (voice.pitchEnvStage) {
        case 1: // Attack
          voice.pitchEnvValue += voice.pitchEnvAttackRate;
          if (voice.pitchEnvValue >= 1.0) {
            voice.pitchEnvValue = 1.0;
            voice.pitchEnvStage = 2;
          }
          break;
        case 2: // Decay
          voice.pitchEnvValue -= voice.pitchEnvDecayRate;
          if (voice.pitchEnvValue <= voice.pitchEnvSustainLevel) {
            voice.pitchEnvValue = voice.pitchEnvSustainLevel;
            voice.pitchEnvStage = 3;
          }
          break;
        case 3: // Sustain
          break;
        case 4: // Release
          voice.pitchEnvValue -= voice.pitchEnvReleaseRate;
          if (voice.pitchEnvValue <= 0) {
            voice.pitchEnvValue = 0;
            voice.pitchEnvStage = 0;
          }
          break;
        default:
          voice.pitchEnvValue = 0;
      }
      return voice.pitchEnvValue;
    }

    // ── Main DSP loop ──────────────────────────────────────────────
    // Called every 128 samples (~3ms at 44100hz). Must complete fast.
    process(inputs, outputs) {
        const output = outputs[0];
        const left = output[0];
        const right = output[1];

        for (let i = 0; i < left.length; i++) {
            let sampleL = 0;
            let sampleR = 0;

            // Advance LFO
            this.lfoPhase += this.lfoPhaseIncrement;
            if (this.lfoPhase >= 1.0) this.lfoPhase -= 1.0;
            const lfoValue = getLFOSample(this.lfoPhase, this.params.lfoWaveform) * this.params.lfoDepth;

            for (let v = 0; v < MAX_VOICES; v++) {
                const voice = this.voices[v];
                if (!voice.active) continue;

                // Apply LFO modulation to destination
                let lfoFreqMod = 1.0;
                let lfoFilterMod = 0.0;
                let lfoVolumeMod = 1.0;
                let lfoPanMod = 0.0;

                switch (this.params.lfoDestination) {
                    case 'pitch':
                        // LFO modulates pitch — ±1 semitone at full depth
                        lfoFreqMod = Math.pow(2, lfoValue / 12);
                        break;
                    case 'filter':
                        // LFO modulates filter cutoff — adds directly to cutoff
                        lfoFilterMod = lfoValue * 0.3;
                        break;
                    case 'volume':
                        // LFO modulates amplitude
                        lfoVolumeMod = 1.0 + lfoValue * 0.5;
                        break;
                    case 'pan':
                        // LFO modulates stereo pan position
                        lfoPanMod = lfoValue;
                        break;
                }

                const unisonCount = Math.max(1, Math.floor(this.params.unisonVoices));
                const bendMod = Math.pow(2, this.params.pitchBend / 12);

                // Pitch envelope modulation
                const pitchEnv = this.processPitchEnvelope(voice);
                const pitchEnvMod = Math.pow(2, (pitchEnv * this.params.pitchEnvAmount) / 12);

                let sig1L = 0, sig1R = 0;
                let sig2L = 0, sig2R = 0;
                let sig3L = 0, sig3R = 0;

                for (let u = 0; u < unisonCount; u++) {
                  // Calculate stereo position for this unison copy
                  // First copy pans left, last copy pans right, middle copies spread between
                  const unisonPan = unisonCount === 1
                    ? 0
                    : (u / (unisonCount - 1) - 0.5) * 2 * this.params.unisonSpread;

                  // OSC 1
                  if (this.params.osc1Enabled) {
                    const inc1 = voice.unisonOsc1[u].phaseIncrement * lfoFreqMod * bendMod * pitchEnvMod;
                    voice.unisonOsc1[u].phase += inc1;
                    if (voice.unisonOsc1[u].phase >= 1.0) voice.unisonOsc1[u].phase -= 1.0;
                    const s1 = getOscSample(voice.unisonOsc1[u].phase, inc1, this.params.osc1Waveform);
                    const [l1, r1] = panGains(this.params.osc1Pan + unisonPan + lfoPanMod);
                    sig1L += s1 * l1;
                    sig1R += s1 * r1;
                  }

                  // OSC 2
                  if (this.params.osc2Enabled) {
                    const inc2 = voice.unisonOsc2[u].phaseIncrement * lfoFreqMod * bendMod * pitchEnvMod;
                    voice.unisonOsc2[u].phase += inc2;
                    if (voice.unisonOsc2[u].phase >= 1.0) voice.unisonOsc2[u].phase -= 1.0;
                    const s2 = getOscSample(voice.unisonOsc2[u].phase, inc2, this.params.osc2Waveform);
                    const [l2, r2] = panGains(this.params.osc2Pan + unisonPan + lfoPanMod);
                    sig2L += s2 * l2;
                    sig2R += s2 * r2;
                  }

                  // OSC 3
                  if (this.params.osc3Enabled) {
                    const inc3 = voice.unisonOsc3[u].phaseIncrement * lfoFreqMod * bendMod * pitchEnvMod;
                    voice.unisonOsc3[u].phase += inc3;
                    if (voice.unisonOsc3[u].phase >= 1.0) voice.unisonOsc3[u].phase -= 1.0;
                    const s3 = getOscSample(voice.unisonOsc3[u].phase, inc3, this.params.osc3Waveform);
                    const [l3, r3] = panGains(this.params.osc3Pan + unisonPan + lfoPanMod);
                    sig3L += s3 * l3;
                    sig3R += s3 * r3;
                  }
                }

                // Envelope
                const velAmp = 1.0 - this.params.velocityAmpSens * (1.0 - voice.velocity);
                const env = this.processEnvelope(voice) * lfoVolumeMod * velAmp;

                // Process filter envelope
                const filterEnv = this.processFilterEnvelope(voice);

                // Modulate cutoff — base cutoff + envelope amount * envelope value
                // Clamped to 0-1 to stay in valid filter range
                const velFilterBoost = voice.velocity * this.params.velocityFilterSens * 0.3;
                const modulatedCutoff = Math.max(0, Math.min(1,
                    voice.filterCutoff + (filterEnv * this.params.filterEnvAmount) + lfoFilterMod + velFilterBoost
                ));

                // Temporarily override voice cutoff for this sample
                const savedCutoff = voice.filterCutoff;
                voice.filterCutoff = modulatedCutoff;

                // Normalize by unison count to prevent volume increase with more voices
                const unisonNorm = 1.0 / Math.sqrt(unisonCount);

                // Mix all oscillators
                let mixL = (sig1L * this.params.osc1Mix +
                            sig2L * this.params.osc2Mix +
                            sig3L * this.params.osc3Mix) * unisonNorm;
                let mixR = (sig1R * this.params.osc1Mix +
                            sig2R * this.params.osc2Mix +
                            sig3R * this.params.osc3Mix) * unisonNorm;

                // Apply envelope and filter per channel
                mixL = moogFilter(voice, mixL * env, 'L');
                mixR = moogFilter(voice, mixR * env, 'R');

                // Restore base cutoff
                voice.filterCutoff = savedCutoff;

                sampleL += mixL;
                sampleR += mixR;
            }

            left[i] = Math.tanh((sampleL / MAX_VOICES) * this.params.masterGain);
            right[i] = Math.tanh((sampleR / MAX_VOICES) * this.params.masterGain);
        }

        return true;
    }
}

registerProcessor('obsidian-processor', ObsidianProcessor);