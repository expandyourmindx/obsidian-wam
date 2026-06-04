// src/index.js
// Obsidian WAM — Entry Point
// This is what the host sees. It loads the processor into the
// AudioWorklet and exposes the standard WAM interface.

import { WebAudioModule } from '@webaudiomodules/sdk';

const DEFAULT_PARAMS = {
    pitchBend: 0,
    filterType: 'lowpass',
    portamentoTime: 0.0,
    portamentoMode: 'always',
    osc1PulseWidth: 0.5,
    osc2PulseWidth: 0.5,
    osc3PulseWidth: 0.5,
    osc1PWMDepth: 0.0,
    osc2PWMDepth: 0.0,
    osc3PWMDepth: 0.0,
    unisonVoices: 1,
    unisonDetune: 10,
    unisonSpread: 0.8,
    pitchEnvAmount: 0,
    pitchEnvAttack: 0.001,
    pitchEnvDecay: 0.2,
    pitchEnvSustain: 0.0,
    pitchEnvRelease: 0.1,
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
    masterGain: 0.5,
    stereoWidth: 1.0,
    filterCutoff: 0.8,
    filterResonance: 0.1,
    filterAttack: 0.01,
    filterDecay: 0.3,
    filterSustain: 0.3,
    filterRelease: 0.5,
    filterEnvAmount: 0.0,
    lfoRate: 1.0,
    lfoDepth: 0.0,
    lfoWaveform: 'sine',
    lfoDestination: 'pitch',
    velocityAmpSens: 1.0,
    velocityFilterSens: 0.5,
    osc1Waveform: 'saw',
    osc1Coarse: 0,
    osc1Fine: 0,
    osc1Mix: 1.0,
    osc1Pan: 0.0,
    osc1Enabled: true,
    osc2Waveform: 'saw',
    osc2Coarse: 0,
    osc2Fine: 7,
    osc2Mix: 0.7,
    osc2Pan: -0.3,
    osc2Enabled: true,
    osc3Waveform: 'square',
    osc3Coarse: -12,
    osc3Fine: 0,
    osc3Mix: 0.5,
    osc3Pan: 0.3,
    osc3Enabled: true,
};

export default class ObsidianWAM extends WebAudioModule {
    // Metadata — shows up in plugin browsers
    static descriptor = {
        name: 'Obsidian',
        vendor: 'Canvas',
        version: '2.0.0',
        category: 'Instrument',
        description: 'Virtual analog synthesizer',
    };

    async initialize(state) {
        this._paramState = { ...DEFAULT_PARAMS };
        await super.initialize(state);
        if (state) await this.setState(state);
        return this;
    }

    async createAudioNode(options) {
        // Register the processor with the AudioContext's worklet
        // The processor file gets loaded as a separate module on the audio thread
        await this.audioContext.audioWorklet.addModule(
            new URL('./processor.js', import.meta.url)
        );

        // Create the AudioWorkletNode — this is the node that
        // connects into the host's audio graph
        this.audioNode = new AudioWorkletNode(
            this.audioContext,
            'obsidian-processor',
            {
                numberOfInputs: 0,   // instrument — no audio input
                numberOfOutputs: 1,
                outputChannelCount: [2] // stereo output
            }
        );

        return this.audioNode;
    }

    // Send a note on to the processor thread
    noteOn(note, velocity = 100) {
        this.audioNode.port.postMessage({
            type: 'noteOn',
            data: { note, velocity }
        });
    }

    // Send a note off to the processor thread
    noteOff(note) {
        this.audioNode.port.postMessage({
            type: 'noteOff',
            data: { note }
        });
    }

    setParam(key, value) {
        if (this._paramState) this._paramState[key] = value;
        this.audioNode.port.postMessage({ type: 'setParam', data: { key, value } });
    }

    getState() {
        return { ...this._paramState };
    }

    async setState(state) {
        Object.entries(state).forEach(([key, value]) => this.setParam(key, value));
    }
}