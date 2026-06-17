// src/defaultPresets.js
// Default parameters and factory presets for Obsidian

import pwmArp from '../presets/Arps & Sequences/PWM Arp.json';
import tranceGate from '../presets/Arps & Sequences/Trance Gate.json';
import fingeredBass from '../presets/Bass/Fingered Bass.json';
import growlBass from '../presets/Bass/Growl Bass.json';
import subBass from '../presets/Bass/Sub Bass.json';
import laserZap from '../presets/FX/Laser Zap.json';
import riser from '../presets/FX/Riser.json';
import clav from '../presets/Keys/Clav.json';
import electricPiano from '../presets/Keys/Electric Piano.json';
import acidScream from '../presets/Leads/Acid Scream.json';
import flute from '../presets/Leads/Flute.json';
import screamingSaw from '../presets/Leads/Screaming Saw.json';
import supersawLead from '../presets/Leads/Supersaw Lead.json';
import obsidianPad from '../presets/Pads/Obsidian Pad.json';
import shimmer from '../presets/Pads/Shimmer.json';
import velvetDream from '../presets/Pads/Velvet Dream.json';
import glassMarimba from '../presets/Plucks/Glass Marimba.json';
import pluckedString from '../presets/Plucks/Plucked String.json';
import analogStrings from '../presets/Strings/Analog Strings.json';
import celloSection from '../presets/Strings/Cello Section.json';

export const DEFAULT_PARAMS = {
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

export const DEFAULT_PRESETS = [
  { name: 'Init', category: 'Default', state: DEFAULT_PARAMS },
  { name: 'PWM Arp', category: 'Arps & Sequences', state: pwmArp.state || pwmArp },
  { name: 'Trance Gate', category: 'Arps & Sequences', state: tranceGate.state || tranceGate },
  { name: 'Fingered Bass', category: 'Bass', state: fingeredBass.state || fingeredBass },
  { name: 'Growl Bass', category: 'Bass', state: growlBass.state || growlBass },
  { name: 'Sub Bass', category: 'Bass', state: subBass.state || subBass },
  { name: 'Laser Zap', category: 'FX', state: laserZap.state || laserZap },
  { name: 'Riser', category: 'FX', state: riser.state || riser },
  { name: 'Clav', category: 'Keys', state: clav.state || clav },
  { name: 'Electric Piano', category: 'Keys', state: electricPiano.state || electricPiano },
  { name: 'Acid Scream', category: 'Leads', state: acidScream.state || acidScream },
  { name: 'Flute', category: 'Leads', state: flute.state || flute },
  { name: 'Screaming Saw', category: 'Leads', state: screamingSaw.state || screamingSaw },
  { name: 'Supersaw Lead', category: 'Leads', state: supersawLead.state || supersawLead },
  { name: 'Obsidian Pad', category: 'Pads', state: obsidianPad.state || obsidianPad },
  { name: 'Shimmer', category: 'Pads', state: shimmer.state || shimmer },
  { name: 'Velvet Dream', category: 'Pads', state: velvetDream.state || velvetDream },
  { name: 'Glass Marimba', category: 'Plucks', state: glassMarimba.state || glassMarimba },
  { name: 'Plucked String', category: 'Plucks', state: pluckedString.state || pluckedString },
  { name: 'Analog Strings', category: 'Strings', state: analogStrings.state || analogStrings },
  { name: 'Cello Section', category: 'Strings', state: celloSection.state || celloSection }
];
