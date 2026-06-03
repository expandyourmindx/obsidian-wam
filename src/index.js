// src/index.js
// Obsidian WAM — Entry Point
// This is what the host sees. It loads the processor into the
// AudioWorklet and exposes the standard WAM interface.

import { WebAudioModule } from '@webaudiomodules/sdk';

export default class ObsidianWAM extends WebAudioModule {
    // Metadata — shows up in plugin browsers
    static descriptor = {
        name: 'Obsidian',
        vendor: 'Canvas',
        version: '2.0.0',
        category: 'Instrument',
        description: 'Virtual analog synthesizer',
    };

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

    // Set a parameter — attack, decay, sustain, release, masterGain
    setParam(key, value) {
        this.audioNode.port.postMessage({
            type: 'setParam',
            data: { key, value }
        });
    }
}