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

// waveform: 'saw' | 'square' | 'triangle'
function getOscSample(phase, phaseIncrement, waveform) {
  switch (waveform) {
    case 'square':   return squareWave(phase, phaseIncrement);
    case 'triangle': return triangleWave(phase, phaseIncrement);
    default:         return sawWave(phase, phaseIncrement);
  }
}

// ── Moog Ladder Filter ───────────────────────────────────────────
// Four cascaded one-pole filters with resonance feedback.
// This is the circuit that made the Minimoog famous.
// cutoff: 0.0 - 1.0 (normalized, we'll convert to Hz)
// resonance: 0.0 - 4.0 (above 1.0 it self-oscillates)
function moogFilter(voice, input) {
    const cutoff = voice.filterCutoff;
    const res = voice.filterResonance;

    // Frequency warping — maps 0-1 to a useful Hz range (20-18000)
    const f = cutoff * cutoff * 0.9;

    // Feedback with resonance
    const feedback = res * (voice.filterStage4 - input * 0.05);

    // Four cascaded one-pole lowpass stages
    voice.filterStage1 += f * (Math.tanh(input - feedback) - Math.tanh(voice.filterStage1));
    voice.filterStage2 += f * (Math.tanh(voice.filterStage1) - Math.tanh(voice.filterStage2));
    voice.filterStage3 += f * (Math.tanh(voice.filterStage2) - Math.tanh(voice.filterStage3));
    voice.filterStage4 += f * (Math.tanh(voice.filterStage3) - Math.tanh(voice.filterStage4));

    return voice.filterStage4;
}

// ── Single voice ─────────────────────────────────────────────────
// Pre-allocated. We never create a new voice object during playback.
function createVoice() {
    return {
        active: false,
        note: 0,
        frequency: 0,
        phase: 0,
        phaseIncrement: 0,
        waveform: 'saw',

        // ADSR state
        // Stages: 0=idle, 1=attack, 2=decay, 3=sustain, 4=release
        envStage: 0,
        envValue: 0,
        envAttackRate: 0,
        envDecayRate: 0,
        envSustainLevel: 0,
        envReleaseRate: 0,

        // Filter state
        filterCutoff: 0.8,
        filterResonance: 0.1,
        filterStage1: 0,
        filterStage2: 0,
        filterStage3: 0,
        filterStage4: 0,
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

        // Parameters with defaults
        this.params = {
            attack: 0.01,
            decay: 0.1,
            sustain: 0.7,
            release: 0.3,
            masterGain: 0.5,
            filterCutoff: 0.8,
            filterResonance: 0.1,
            osc1Waveform: 'saw',
        };

        // Listen for messages from the main thread
        // (parameter changes, note events if not using WAM event queue yet)
        this.port.onmessage = (e) => {
            const { type, data } = e.data;
            if (type === 'noteOn') this.noteOn(data.note, data.velocity);
            if (type === 'noteOff') this.noteOff(data.note);
            if (type === 'setParam') {
                this.params[data.key] = data.value;
                this.voices.forEach(v => {
                    if (v.active) {
                        if (data.key === 'filterCutoff') v.filterCutoff = data.value;
                        if (data.key === 'filterResonance') v.filterResonance = data.value;
                        if (data.key === 'osc1Waveform') v.waveform = data.value;
                    }
                });
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
        voice.phase = 0;
        voice.phaseIncrement = freq / sampleRate; // sampleRate is a global in AudioWorklet
        voice.waveform = this.params.osc1Waveform;

        voice.filterCutoff = this.params.filterCutoff;
        voice.filterResonance = this.params.filterResonance;
        // Reset filter stages on new note to prevent clicks
        voice.filterStage1 = 0;
        voice.filterStage2 = 0;
        voice.filterStage3 = 0;
        voice.filterStage4 = 0;

        // Start attack
        voice.envStage = 1;
        voice.envAttackRate = 1.0 / (this.params.attack * sampleRate);
        voice.envDecayRate = 1.0 / (this.params.decay * sampleRate);
        voice.envSustainLevel = this.params.sustain;
        voice.envReleaseRate = 1.0 / (this.params.release * sampleRate);
    }

    noteOff(note) {
        const voice = this.voices.find(v => v.active && v.note === note);
        if (voice) voice.envStage = 4; // trigger release
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

    // ── Main DSP loop ──────────────────────────────────────────────
    // Called every 128 samples (~3ms at 44100hz). Must complete fast.
    process(inputs, outputs) {
        const output = outputs[0];
        const left = output[0];
        const right = output[1];

        for (let i = 0; i < left.length; i++) {
            let sample = 0;

            for (let v = 0; v < MAX_VOICES; v++) {
                const voice = this.voices[v];
                if (!voice.active) continue;

                let signal = getOscSample(voice.phase, voice.phaseIncrement, voice.waveform);
                voice.phase += voice.phaseIncrement;
                if (voice.phase >= 1.0) voice.phase -= 1.0;
                const env = this.processEnvelope(voice);
                signal = signal * env;
                signal = moogFilter(voice, signal);
                sample += signal;
            }

            const out = (sample / MAX_VOICES) * this.params.masterGain;
            left[i] = out;
            right[i] = out;
        }

        return true;
    }
}

registerProcessor('obsidian-processor', ObsidianProcessor);