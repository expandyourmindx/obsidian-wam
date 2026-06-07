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
        await this.audioContext.audioWorklet.addModule(
            new URL('./processor.js', import.meta.url)
        );

        const node = new AudioWorkletNode(
            this.audioContext,
            'obsidian-processor',
            {
                numberOfInputs: 0,
                numberOfOutputs: 1,
                outputChannelCount: [2]
            }
        );

        // Bridge WAM2 standard scheduleEvents API to Obsidian's processor postMessage protocol.
        // This makes Obsidian compatible with any WAM2 host without touching the processor.
        node.scheduleEvents = (...events) => {
            for (const event of events) {
                if (event.type === 'wam-midi') {
                    const bytes = event.data.bytes;
                    const status = bytes[0] & 0xF0;
                    const note = bytes[1];
                    const velocity = bytes[2];
                    const time = event.time;
                    const isScheduled = time !== undefined && time > this.audioContext.currentTime + 0.01;

                    if (status === 0x90 && velocity > 0) {
                        if (isScheduled) {
                            node.port.postMessage({ type: 'scheduleNote', data: { time, noteType: 'noteOn', note, velocity } });
                        } else {
                            node.port.postMessage({ type: 'noteOn', data: { note, velocity } });
                        }
                    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
                        if (isScheduled) {
                            node.port.postMessage({ type: 'scheduleNote', data: { time, noteType: 'noteOff', note, velocity: 0 } });
                        } else {
                            node.port.postMessage({ type: 'noteOff', data: { note } });
                        }
                    }
                }
            }
        };

        this._audioNode = node;
        return node;
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

    // Schedule a note-on at a precise AudioContext time (sample-accurate)
    scheduleNote(time, note, velocity) {
        this.audioNode.port.postMessage({
            type: 'scheduleNote',
            data: { time, noteType: 'noteOn', note, velocity }
        });
    }

    // Schedule a note-off at a precise AudioContext time (sample-accurate)
    scheduleNoteOff(time, note) {
        this.audioNode.port.postMessage({
            type: 'scheduleNote',
            data: { time, noteType: 'noteOff', note, velocity: 0 }
        });
    }

    // Clear all pending scheduled events
    clearSchedule() {
        this.audioNode.port.postMessage({ type: 'clearSchedule' });
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

    async createGui() {
        const { mountGUI } = await import('./ObsidianGUI.js');
        const container = document.createElement('div');
        container.style.width = '660px';
        container.style.background = '#131010';

        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        this._audioNode.connect(analyser);

        mountGUI(container, this, analyser);
        return container;
    }
}