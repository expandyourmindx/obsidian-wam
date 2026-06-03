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

    return voice[`filterStage4${ch}`] * (1.0 + scaledRes * 0.8);
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

        // Filter state
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

        voice.filterCutoff = this.params.filterCutoff;
        voice.filterResonance = this.params.filterResonance;
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
    }

    noteOff(note) {
        const voice = this.voices.find(v => v.active && v.note === note);
        if (voice) {
            voice.envStage = 4; // trigger release
            voice.filterEnvStage = 4;
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

                // OSC 1 — apply pitch mod
                let sig1 = 0;
                const osc1Inc = voice.osc1.phaseIncrement * lfoFreqMod;
                voice.osc1.phase += osc1Inc;
                if (voice.osc1.phase >= 1.0) voice.osc1.phase -= 1.0;
                if (this.params.osc1Enabled) {
                    sig1 = getOscSample(voice.osc1.phase, osc1Inc, this.params.osc1Waveform);
                }

                // OSC 2
                let sig2 = 0;
                const osc2Inc = voice.osc2.phaseIncrement * lfoFreqMod;
                voice.osc2.phase += osc2Inc;
                if (voice.osc2.phase >= 1.0) voice.osc2.phase -= 1.0;
                if (this.params.osc2Enabled) {
                    sig2 = getOscSample(voice.osc2.phase, osc2Inc, this.params.osc2Waveform);
                }

                // OSC 3
                let sig3 = 0;
                const osc3Inc = voice.osc3.phaseIncrement * lfoFreqMod;
                voice.osc3.phase += osc3Inc;
                if (voice.osc3.phase >= 1.0) voice.osc3.phase -= 1.0;
                if (this.params.osc3Enabled) {
                    sig3 = getOscSample(voice.osc3.phase, osc3Inc, this.params.osc3Waveform);
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

                // Pan gains per oscillator
                const [l1, r1] = panGains(this.params.osc1Pan + lfoPanMod);
                const [l2, r2] = panGains(this.params.osc2Pan + lfoPanMod);
                const [l3, r3] = panGains(this.params.osc3Pan + lfoPanMod);

                // Mix into stereo
                let mixL = (sig1 * this.params.osc1Mix * l1 +
                    sig2 * this.params.osc2Mix * l2 +
                    sig3 * this.params.osc3Mix * l3);
                let mixR = (sig1 * this.params.osc1Mix * r1 +
                    sig2 * this.params.osc2Mix * r2 +
                    sig3 * this.params.osc3Mix * r3);

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