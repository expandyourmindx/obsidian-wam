//#region node_modules/@webaudiomodules/sdk/dist/index.js
var WebAudioModule = class {
	static get isWebAudioModuleConstructor() {
		return true;
	}
	static createInstance(groupId, audioContext, initialState) {
		return new this(groupId, audioContext).initialize(initialState);
	}
	constructor(groupId, audioContext) {
		this._groupId = groupId;
		this._audioContext = audioContext;
		this._initialized = false;
		this._audioNode = void 0;
		this._timestamp = performance.now();
		this._guiModuleUrl = void 0;
		this._descriptorUrl = "./descriptor.json";
		this._descriptor = {
			identifier: `com.webaudiomodule.default`,
			name: `WebAudioModule_${this.constructor.name}`,
			vendor: "WebAudioModuleVendor",
			description: "",
			version: "0.0.0",
			apiVersion: "2.0.0",
			thumbnail: "",
			keywords: [],
			isInstrument: false,
			website: "",
			hasAudioInput: true,
			hasAudioOutput: true,
			hasAutomationInput: true,
			hasAutomationOutput: true,
			hasMidiInput: true,
			hasMidiOutput: true,
			hasMpeInput: true,
			hasMpeOutput: true,
			hasOscInput: true,
			hasOscOutput: true,
			hasSysexInput: true,
			hasSysexOutput: true
		};
	}
	get isWebAudioModule() {
		return true;
	}
	get groupId() {
		return this._groupId;
	}
	get moduleId() {
		return this.descriptor.identifier;
	}
	get instanceId() {
		return this.moduleId + this._timestamp;
	}
	get descriptor() {
		return this._descriptor;
	}
	get identifier() {
		return this.descriptor.identifier;
	}
	get name() {
		return this.descriptor.name;
	}
	get vendor() {
		return this.descriptor.vendor;
	}
	get audioContext() {
		return this._audioContext;
	}
	get audioNode() {
		if (!this.initialized) console.warn("WAM should be initialized before getting the audioNode");
		return this._audioNode;
	}
	set audioNode(node) {
		this._audioNode = node;
	}
	get initialized() {
		return this._initialized;
	}
	set initialized(value) {
		this._initialized = value;
	}
	async createAudioNode(initialState) {
		throw new TypeError("createAudioNode() not provided");
	}
	async initialize(state) {
		if (!this._audioNode) this.audioNode = await this.createAudioNode();
		this.initialized = true;
		return this;
	}
	async _loadGui() {
		const url = this._guiModuleUrl;
		if (!url) throw new TypeError("Gui module not found");
		return import(
			/* webpackIgnore: true */
			url
);
	}
	async _loadDescriptor() {
		const url = this._descriptorUrl;
		if (!url) throw new TypeError("Descriptor not found");
		const descriptor = await (await fetch(url)).json();
		Object.assign(this._descriptor, descriptor);
		return this._descriptor;
	}
	async createGui() {
		if (!this.initialized) console.warn("Plugin should be initialized before getting the gui");
		if (!this._guiModuleUrl) return void 0;
		const { createElement } = await this._loadGui();
		return createElement(this);
	}
	destroyGui() {}
};
var WebAudioModule_default = WebAudioModule;
var getRingBuffer = (moduleId) => {
	const audioWorkletGlobalScope = globalThis;
	class RingBuffer2 {
		static getStorageForCapacity(capacity, Type) {
			if (!Type.BYTES_PER_ELEMENT) throw new Error("Pass in a ArrayBuffer subclass");
			const bytes = 8 + (capacity + 1) * Type.BYTES_PER_ELEMENT;
			return new SharedArrayBuffer(bytes);
		}
		constructor(sab, Type) {
			if (!Type.BYTES_PER_ELEMENT) throw new Error("Pass a concrete typed array class as second argument");
			this._Type = Type;
			this._capacity = (sab.byteLength - 8) / Type.BYTES_PER_ELEMENT;
			this.buf = sab;
			this.write_ptr = new Uint32Array(this.buf, 0, 1);
			this.read_ptr = new Uint32Array(this.buf, 4, 1);
			this.storage = new Type(this.buf, 8, this._capacity);
		}
		get type() {
			return this._Type.name;
		}
		push(elements) {
			const rd = Atomics.load(this.read_ptr, 0);
			const wr = Atomics.load(this.write_ptr, 0);
			if ((wr + 1) % this._storageCapacity() === rd) return 0;
			const toWrite = Math.min(this._availableWrite(rd, wr), elements.length);
			const firstPart = Math.min(this._storageCapacity() - wr, toWrite);
			const secondPart = toWrite - firstPart;
			this._copy(elements, 0, this.storage, wr, firstPart);
			this._copy(elements, firstPart, this.storage, 0, secondPart);
			Atomics.store(this.write_ptr, 0, (wr + toWrite) % this._storageCapacity());
			return toWrite;
		}
		pop(elements) {
			const rd = Atomics.load(this.read_ptr, 0);
			const wr = Atomics.load(this.write_ptr, 0);
			if (wr === rd) return 0;
			const isArray = !Number.isInteger(elements);
			const toRead = Math.min(this._availableRead(rd, wr), isArray ? elements.length : elements);
			if (isArray) {
				const firstPart = Math.min(this._storageCapacity() - rd, toRead);
				const secondPart = toRead - firstPart;
				this._copy(this.storage, rd, elements, 0, firstPart);
				this._copy(this.storage, 0, elements, firstPart, secondPart);
			}
			Atomics.store(this.read_ptr, 0, (rd + toRead) % this._storageCapacity());
			return toRead;
		}
		get empty() {
			const rd = Atomics.load(this.read_ptr, 0);
			return Atomics.load(this.write_ptr, 0) === rd;
		}
		get full() {
			const rd = Atomics.load(this.read_ptr, 0);
			return (Atomics.load(this.write_ptr, 0) + 1) % this._capacity !== rd;
		}
		get capacity() {
			return this._capacity - 1;
		}
		get availableRead() {
			const rd = Atomics.load(this.read_ptr, 0);
			const wr = Atomics.load(this.write_ptr, 0);
			return this._availableRead(rd, wr);
		}
		get availableWrite() {
			const rd = Atomics.load(this.read_ptr, 0);
			const wr = Atomics.load(this.write_ptr, 0);
			return this._availableWrite(rd, wr);
		}
		_availableRead(rd, wr) {
			if (wr > rd) return wr - rd;
			return wr + this._storageCapacity() - rd;
		}
		_availableWrite(rd, wr) {
			let rv = rd - wr - 1;
			if (wr >= rd) rv += this._storageCapacity();
			return rv;
		}
		_storageCapacity() {
			return this._capacity;
		}
		_copy(input, offsetInput, output, offsetOutput, size) {
			for (let i = 0; i < size; i++) output[offsetOutput + i] = input[offsetInput + i];
		}
	}
	if (audioWorkletGlobalScope.AudioWorkletProcessor) {
		const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
		if (!ModuleScope.RingBuffer) ModuleScope.RingBuffer = RingBuffer2;
	}
	return RingBuffer2;
};
var RingBuffer_default = getRingBuffer;
var getWamEventRingBuffer = (moduleId) => {
	const audioWorkletGlobalScope = globalThis;
	class WamEventRingBuffer2 {
		static DefaultExtraBytesPerEvent = 64;
		static WamEventBaseBytes = 13;
		static WamAutomationEventBytes = WamEventRingBuffer2.WamEventBaseBytes + 2 + 8 + 1;
		static WamTransportEventBytes = WamEventRingBuffer2.WamEventBaseBytes + 4 + 8 + 8 + 1 + 1 + 1;
		static WamMidiEventBytes = WamEventRingBuffer2.WamEventBaseBytes + 1 + 1 + 1;
		static WamBinaryEventBytes = WamEventRingBuffer2.WamEventBaseBytes + 4;
		static getStorageForEventCapacity(RingBuffer2, eventCapacity, maxBytesPerEvent = void 0) {
			if (maxBytesPerEvent === void 0) maxBytesPerEvent = WamEventRingBuffer2.DefaultExtraBytesPerEvent;
			else maxBytesPerEvent = Math.max(maxBytesPerEvent, WamEventRingBuffer2.DefaultExtraBytesPerEvent);
			const capacity = (Math.max(WamEventRingBuffer2.WamAutomationEventBytes, WamEventRingBuffer2.WamTransportEventBytes, WamEventRingBuffer2.WamMidiEventBytes, WamEventRingBuffer2.WamBinaryEventBytes) + maxBytesPerEvent) * eventCapacity;
			return RingBuffer2.getStorageForCapacity(capacity, Uint8Array);
		}
		constructor(RingBuffer2, sab, parameterIds, maxBytesPerEvent = void 0) {
			this._eventSizeBytes = {};
			this._encodeEventType = {};
			this._decodeEventType = {};
			[
				"wam-automation",
				"wam-transport",
				"wam-midi",
				"wam-sysex",
				"wam-mpe",
				"wam-osc",
				"wam-info"
			].forEach((type, encodedType) => {
				let byteSize = 0;
				switch (type) {
					case "wam-automation":
						byteSize = WamEventRingBuffer2.WamAutomationEventBytes;
						break;
					case "wam-transport":
						byteSize = WamEventRingBuffer2.WamTransportEventBytes;
						break;
					case "wam-mpe":
					case "wam-midi":
						byteSize = WamEventRingBuffer2.WamMidiEventBytes;
						break;
					case "wam-osc":
					case "wam-sysex":
					case "wam-info":
						byteSize = WamEventRingBuffer2.WamBinaryEventBytes;
						break;
					default: break;
				}
				this._eventSizeBytes[type] = byteSize;
				this._encodeEventType[type] = encodedType;
				this._decodeEventType[encodedType] = type;
			});
			this._parameterCode = 0;
			this._parameterCodes = {};
			this._encodeParameterId = {};
			this._decodeParameterId = {};
			this.setParameterIds(parameterIds);
			this._sab = sab;
			if (maxBytesPerEvent === void 0) maxBytesPerEvent = WamEventRingBuffer2.DefaultExtraBytesPerEvent;
			else maxBytesPerEvent = Math.max(maxBytesPerEvent, WamEventRingBuffer2.DefaultExtraBytesPerEvent);
			this._eventBytesAvailable = Math.max(WamEventRingBuffer2.WamAutomationEventBytes, WamEventRingBuffer2.WamTransportEventBytes, WamEventRingBuffer2.WamMidiEventBytes, WamEventRingBuffer2.WamBinaryEventBytes) + maxBytesPerEvent;
			this._eventBytes = new ArrayBuffer(this._eventBytesAvailable);
			this._eventBytesView = new DataView(this._eventBytes);
			this._rb = new RingBuffer2(this._sab, Uint8Array);
			this._eventSizeArray = new Uint8Array(this._eventBytes, 0, 4);
			this._eventSizeView = new DataView(this._eventBytes, 0, 4);
		}
		_writeHeader(byteSize, type, time) {
			let byteOffset = 0;
			this._eventBytesView.setUint32(byteOffset, byteSize);
			byteOffset += 4;
			this._eventBytesView.setUint8(byteOffset, this._encodeEventType[type]);
			byteOffset += 1;
			this._eventBytesView.setFloat64(byteOffset, Number.isFinite(time) ? time : -1);
			byteOffset += 8;
			return byteOffset;
		}
		_encode(event) {
			let byteOffset = 0;
			const { type, time } = event;
			switch (event.type) {
				case "wam-automation":
					{
						if (!(event.data.id in this._encodeParameterId)) break;
						const byteSize = this._eventSizeBytes[type];
						byteOffset = this._writeHeader(byteSize, type, time);
						const { data } = event;
						const encodedParameterId = this._encodeParameterId[data.id];
						const { value, normalized } = data;
						this._eventBytesView.setUint16(byteOffset, encodedParameterId);
						byteOffset += 2;
						this._eventBytesView.setFloat64(byteOffset, value);
						byteOffset += 8;
						this._eventBytesView.setUint8(byteOffset, normalized ? 1 : 0);
						byteOffset += 1;
					}
					break;
				case "wam-transport":
					{
						const byteSize = this._eventSizeBytes[type];
						byteOffset = this._writeHeader(byteSize, type, time);
						const { data } = event;
						const { currentBar, currentBarStarted, tempo, timeSigNumerator, timeSigDenominator, playing } = data;
						this._eventBytesView.setUint32(byteOffset, currentBar);
						byteOffset += 4;
						this._eventBytesView.setFloat64(byteOffset, currentBarStarted);
						byteOffset += 8;
						this._eventBytesView.setFloat64(byteOffset, tempo);
						byteOffset += 8;
						this._eventBytesView.setUint8(byteOffset, timeSigNumerator);
						byteOffset += 1;
						this._eventBytesView.setUint8(byteOffset, timeSigDenominator);
						byteOffset += 1;
						this._eventBytesView.setUint8(byteOffset, playing ? 1 : 0);
						byteOffset += 1;
					}
					break;
				case "wam-mpe":
				case "wam-midi":
					{
						const byteSize = this._eventSizeBytes[type];
						byteOffset = this._writeHeader(byteSize, type, time);
						const { data } = event;
						const { bytes } = data;
						let b = 0;
						while (b < 3) {
							this._eventBytesView.setUint8(byteOffset, bytes[b]);
							byteOffset += 1;
							b++;
						}
					}
					break;
				case "wam-osc":
				case "wam-sysex":
				case "wam-info":
					{
						let bytes = null;
						if (event.type === "wam-info") {
							const { data } = event;
							bytes = new TextEncoder().encode(data.instanceId);
						} else {
							const { data } = event;
							bytes = data.bytes;
						}
						const numBytes = bytes.length;
						const byteSize = this._eventSizeBytes[type];
						byteOffset = this._writeHeader(byteSize + numBytes, type, time);
						this._eventBytesView.setUint32(byteOffset, numBytes);
						byteOffset += 4;
						const bytesRequired = byteOffset + numBytes;
						if (bytesRequired > this._eventBytesAvailable) console.error(`Event requires ${bytesRequired} bytes but only ${this._eventBytesAvailable} have been allocated!`);
						new Uint8Array(this._eventBytes, byteOffset, numBytes).set(bytes);
						byteOffset += numBytes;
					}
					break;
				default: break;
			}
			return new Uint8Array(this._eventBytes, 0, byteOffset);
		}
		_decode() {
			let byteOffset = 0;
			const type = this._decodeEventType[this._eventBytesView.getUint8(byteOffset)];
			byteOffset += 1;
			let time = this._eventBytesView.getFloat64(byteOffset);
			if (time === -1) time = void 0;
			byteOffset += 8;
			switch (type) {
				case "wam-automation": {
					const encodedParameterId = this._eventBytesView.getUint16(byteOffset);
					byteOffset += 2;
					const value = this._eventBytesView.getFloat64(byteOffset);
					byteOffset += 8;
					const normalized = !!this._eventBytesView.getUint8(byteOffset);
					byteOffset += 1;
					if (!(encodedParameterId in this._decodeParameterId)) break;
					const id = this._decodeParameterId[encodedParameterId];
					return {
						type,
						time,
						data: {
							id,
							value,
							normalized
						}
					};
				}
				case "wam-transport": {
					const currentBar = this._eventBytesView.getUint32(byteOffset);
					byteOffset += 4;
					const currentBarStarted = this._eventBytesView.getFloat64(byteOffset);
					byteOffset += 8;
					const tempo = this._eventBytesView.getFloat64(byteOffset);
					byteOffset += 8;
					const timeSigNumerator = this._eventBytesView.getUint8(byteOffset);
					byteOffset += 1;
					const timeSigDenominator = this._eventBytesView.getUint8(byteOffset);
					byteOffset += 1;
					const playing = this._eventBytesView.getUint8(byteOffset) == 1;
					byteOffset += 1;
					return {
						type,
						time,
						data: {
							currentBar,
							currentBarStarted,
							tempo,
							timeSigNumerator,
							timeSigDenominator,
							playing
						}
					};
				}
				case "wam-mpe":
				case "wam-midi": {
					const bytes = [
						0,
						0,
						0
					];
					let b = 0;
					while (b < 3) {
						bytes[b] = this._eventBytesView.getUint8(byteOffset);
						byteOffset += 1;
						b++;
					}
					return {
						type,
						time,
						data: { bytes }
					};
				}
				case "wam-osc":
				case "wam-sysex":
				case "wam-info": {
					const numBytes = this._eventBytesView.getUint32(byteOffset);
					byteOffset += 4;
					const bytes = new Uint8Array(numBytes);
					bytes.set(new Uint8Array(this._eventBytes, byteOffset, numBytes));
					byteOffset += numBytes;
					if (type === "wam-info") {
						const data = { instanceId: new TextDecoder().decode(bytes) };
						return {
							type,
							time,
							data
						};
					} else return {
						type,
						time,
						data: { bytes }
					};
				}
				default: break;
			}
			return false;
		}
		write(...events) {
			const numEvents = events.length;
			let bytesAvailable = this._rb.availableWrite;
			let numSkipped = 0;
			let i = 0;
			while (i < numEvents) {
				const event = events[i];
				const bytes = this._encode(event);
				const eventSizeBytes = bytes.byteLength;
				let bytesWritten = 0;
				if (bytesAvailable >= eventSizeBytes) if (eventSizeBytes === 0) numSkipped++;
				else bytesWritten = this._rb.push(bytes);
				else break;
				bytesAvailable -= bytesWritten;
				i++;
			}
			return i - numSkipped;
		}
		read() {
			if (this._rb.empty) return [];
			const events = [];
			let bytesAvailable = this._rb.availableRead;
			let bytesRead = 0;
			while (bytesAvailable > 0) {
				bytesRead = this._rb.pop(this._eventSizeArray);
				bytesAvailable -= bytesRead;
				const eventSizeBytes = this._eventSizeView.getUint32(0);
				const eventBytes = new Uint8Array(this._eventBytes, 0, eventSizeBytes - 4);
				bytesRead = this._rb.pop(eventBytes);
				bytesAvailable -= bytesRead;
				const decodedEvent = this._decode();
				if (decodedEvent) events.push(decodedEvent);
			}
			return events;
		}
		setParameterIds(parameterIds) {
			this._encodeParameterId = {};
			this._decodeParameterId = {};
			parameterIds.forEach((parameterId) => {
				let parameterCode = -1;
				if (parameterId in this._parameterCodes) parameterCode = this._parameterCodes[parameterId];
				else {
					parameterCode = this._generateParameterCode();
					this._parameterCodes[parameterId] = parameterCode;
				}
				this._encodeParameterId[parameterId] = parameterCode;
				this._decodeParameterId[parameterCode] = parameterId;
			});
		}
		_generateParameterCode() {
			if (this._parameterCode > 65535) throw Error("Too many parameters have been registered!");
			return this._parameterCode++;
		}
	}
	if (audioWorkletGlobalScope.AudioWorkletProcessor) {
		const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
		if (!ModuleScope.WamEventRingBuffer) ModuleScope.WamEventRingBuffer = WamEventRingBuffer2;
	}
	return WamEventRingBuffer2;
};
var WamEventRingBuffer_default = getWamEventRingBuffer;
RingBuffer_default();
WamEventRingBuffer_default();
AudioWorkletNode;
//#endregion
//#region src/index.js
var DEFAULT_PARAMS = {
	pitchBend: 0,
	filterType: "lowpass",
	portamentoTime: 0,
	portamentoMode: "always",
	osc1PulseWidth: .5,
	osc2PulseWidth: .5,
	osc3PulseWidth: .5,
	osc1PWMDepth: 0,
	osc2PWMDepth: 0,
	osc3PWMDepth: 0,
	unisonVoices: 1,
	unisonDetune: 10,
	unisonSpread: .8,
	pitchEnvAmount: 0,
	pitchEnvAttack: .001,
	pitchEnvDecay: .2,
	pitchEnvSustain: 0,
	pitchEnvRelease: .1,
	attack: .01,
	decay: .1,
	sustain: .7,
	release: .3,
	masterGain: .5,
	stereoWidth: 1,
	filterCutoff: .8,
	filterResonance: .1,
	filterAttack: .01,
	filterDecay: .3,
	filterSustain: .3,
	filterRelease: .5,
	filterEnvAmount: 0,
	lfoRate: 1,
	lfoDepth: 0,
	lfoWaveform: "sine",
	lfoDestination: "pitch",
	velocityAmpSens: 1,
	velocityFilterSens: .5,
	osc1Waveform: "saw",
	osc1Coarse: 0,
	osc1Fine: 0,
	osc1Mix: 1,
	osc1Pan: 0,
	osc1Enabled: true,
	osc2Waveform: "saw",
	osc2Coarse: 0,
	osc2Fine: 7,
	osc2Mix: .7,
	osc2Pan: -.3,
	osc2Enabled: true,
	osc3Waveform: "square",
	osc3Coarse: -12,
	osc3Fine: 0,
	osc3Mix: .5,
	osc3Pan: .3,
	osc3Enabled: true
};
var ObsidianWAM = class extends WebAudioModule_default {
	static descriptor = {
		name: "Obsidian",
		vendor: "Canvas",
		version: "2.0.0",
		category: "Instrument",
		description: "Virtual analog synthesizer"
	};
	async initialize(state) {
		this._paramState = { ...DEFAULT_PARAMS };
		await super.initialize(state);
		if (state) await this.setState(state);
		return this;
	}
	async createAudioNode(options) {
		await this.audioContext.audioWorklet.addModule(new URL("data:text/javascript;base64,Ly8gc3JjL3Byb2Nlc3Nvci5qcw0KLy8gT2JzaWRpYW4gV0FNIOKAlCBBdWRpb1dvcmtsZXQgUHJvY2Vzc29yDQovLyBSdW5zIG9uIHRoZSBhdWRpbyB0aHJlYWQuIE5vIGFsbG9jYXRpb25zLCBubyBtYWluIHRocmVhZCBhY2Nlc3MuDQoNCmNvbnN0IFNBTVBMRV9SQVRFID0gNDQxMDA7DQpjb25zdCBNQVhfVk9JQ0VTID0gODsNCg0KLy8g4pSA4pSAIFBvbHlCTEVQIGhlbHBlciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIANCi8vIFRoaXMgaXMgdGhlIHNlY3JldCBzYXVjZS4gQSBuYWl2ZSBzYXd0b290aCBvciBzcXVhcmUgd2F2ZSBhbGlhc2VzDQovLyBiYWRseSBhdCBoaWdoIGZyZXF1ZW5jaWVzLiBQb2x5QkxFUCBzbW9vdGhzIHRoZSBkaXNjb250aW51aXRpZXMNCi8vIGF0IHRoZSB3YXZlZm9ybSBlZGdlcyBzbyBoYXJtb25pY3MgZG9uJ3QgZm9sZCBiYWNrIGFzIG5vaXNlLg0KZnVuY3Rpb24gcG9seUJsZXAocGhhc2UsIHBoYXNlSW5jcmVtZW50KSB7DQogICAgaWYgKHBoYXNlIDwgcGhhc2VJbmNyZW1lbnQpIHsNCiAgICAgICAgY29uc3QgdCA9IHBoYXNlIC8gcGhhc2VJbmNyZW1lbnQ7DQogICAgICAgIHJldHVybiB0ICsgdCAtIHQgKiB0IC0gMS4wOw0KICAgIH0gZWxzZSBpZiAocGhhc2UgPiAxLjAgLSBwaGFzZUluY3JlbWVudCkgew0KICAgICAgICBjb25zdCB0ID0gKHBoYXNlIC0gMS4wKSAvIHBoYXNlSW5jcmVtZW50Ow0KICAgICAgICByZXR1cm4gdCAqIHQgKyB0ICsgdCArIDEuMDsNCiAgICB9DQogICAgcmV0dXJuIDAuMDsNCn0NCg0KZnVuY3Rpb24gc3F1YXJlV2F2ZShwaGFzZSwgcGhhc2VJbmNyZW1lbnQsIHB1bHNlV2lkdGgpIHsNCiAgLy8gVmFyaWFibGUgcHVsc2Ugd2lkdGgg4oCUIDAuNSBpcyBhIHBlcmZlY3Qgc3F1YXJlIHdhdmUNCiAgLy8gVmFsdWVzIGF3YXkgZnJvbSAwLjUgY3JlYXRlIGEgcmVjdGFuZ3VsYXIgd2F2ZSB3aXRoIGRpZmZlcmVudCBoYXJtb25pYyBjb250ZW50DQogIGxldCBzcXVhcmUgPSBwaGFzZSA8IHB1bHNlV2lkdGggPyAxLjAgOiAtMS4wOw0KICAvLyBQb2x5QkxFUCBjb3JyZWN0aW9ucyBhdCBib3RoIGRpc2NvbnRpbnVpdGllcw0KICBzcXVhcmUgKz0gcG9seUJsZXAocGhhc2UsIHBoYXNlSW5jcmVtZW50KTsNCiAgc3F1YXJlIC09IHBvbHlCbGVwKChwaGFzZSAtIHB1bHNlV2lkdGggKyAxLjApICUgMS4wLCBwaGFzZUluY3JlbWVudCk7DQogIC8vIERDIG9mZnNldCBjb21wZW5zYXRpb24g4oCUIHJlY3Rhbmd1bGFyIHdhdmVzIGhhdmUgREMgb2Zmc2V0IHdoZW4gd2lkdGggIT0gMC41DQogIHNxdWFyZSAtPSAoMi4wICogcHVsc2VXaWR0aCAtIDEuMCk7DQogIHJldHVybiBzcXVhcmU7DQp9DQoNCmZ1bmN0aW9uIHRyaWFuZ2xlV2F2ZShwaGFzZSwgcGhhc2VJbmNyZW1lbnQpIHsNCiAgICAvLyBJbnRlZ3JhdGUgYSBzcXVhcmUgd2F2ZSB0byBnZXQgYSBiYW5kLWxpbWl0ZWQgdHJpYW5nbGUNCiAgICBsZXQgdHJpID0gcGhhc2UgPCAwLjUNCiAgICAgICAgPyA0LjAgKiBwaGFzZSAtIDEuMA0KICAgICAgICA6IDMuMCAtIDQuMCAqIHBoYXNlOw0KICAgIHJldHVybiB0cmk7DQp9DQoNCmZ1bmN0aW9uIHNhd1dhdmUocGhhc2UsIHBoYXNlSW5jcmVtZW50KSB7DQogICAgbGV0IHNhdyA9IDIuMCAqIHBoYXNlIC0gMS4wOw0KICAgIHNhdyAtPSBwb2x5QmxlcChwaGFzZSwgcGhhc2VJbmNyZW1lbnQpOw0KICAgIHJldHVybiBzYXc7DQp9DQoNCi8vIHdhdmVmb3JtOiAnc2F3JyB8ICdzcXVhcmUnIHwgJ3RyaWFuZ2xlJyB8ICdzaW5lJw0KZnVuY3Rpb24gZ2V0T3NjU2FtcGxlKHBoYXNlLCBwaGFzZUluY3JlbWVudCwgd2F2ZWZvcm0sIHB1bHNlV2lkdGggPSAwLjUpIHsNCiAgICBzd2l0Y2ggKHdhdmVmb3JtKSB7DQogICAgICAgIGNhc2UgJ3NpbmUnOiByZXR1cm4gTWF0aC5zaW4ocGhhc2UgKiAyICogTWF0aC5QSSk7DQogICAgICAgIGNhc2UgJ3NxdWFyZSc6IHJldHVybiBzcXVhcmVXYXZlKHBoYXNlLCBwaGFzZUluY3JlbWVudCwgcHVsc2VXaWR0aCk7DQogICAgICAgIGNhc2UgJ3RyaWFuZ2xlJzogcmV0dXJuIHRyaWFuZ2xlV2F2ZShwaGFzZSwgcGhhc2VJbmNyZW1lbnQpOw0KICAgICAgICBkZWZhdWx0OiByZXR1cm4gc2F3V2F2ZShwaGFzZSwgcGhhc2VJbmNyZW1lbnQpOw0KICAgIH0NCn0NCg0KZnVuY3Rpb24gZ2V0TEZPU2FtcGxlKHBoYXNlLCB3YXZlZm9ybSkgew0KICAgIHN3aXRjaCAod2F2ZWZvcm0pIHsNCiAgICAgICAgY2FzZSAndHJpYW5nbGUnOg0KICAgICAgICAgICAgcmV0dXJuIHBoYXNlIDwgMC41ID8gNC4wICogcGhhc2UgLSAxLjAgOiAzLjAgLSA0LjAgKiBwaGFzZTsNCiAgICAgICAgY2FzZSAnc3F1YXJlJzoNCiAgICAgICAgICAgIHJldHVybiBwaGFzZSA8IDAuNSA/IDEuMCA6IC0xLjA7DQogICAgICAgIGNhc2UgJ3Nhdyc6DQogICAgICAgICAgICByZXR1cm4gMi4wICogcGhhc2UgLSAxLjA7DQogICAgICAgIGRlZmF1bHQ6DQogICAgICAgICAgICByZXR1cm4gTWF0aC5zaW4ocGhhc2UgKiAyICogTWF0aC5QSSk7DQogICAgfQ0KfQ0KDQpmdW5jdGlvbiBjYWxjUGhhc2VJbmNyZW1lbnQobm90ZSwgY29hcnNlLCBmaW5lKSB7DQogICAgY29uc3QgdG90YWxTZW1pdG9uZXMgPSBjb2Fyc2UgKyBmaW5lIC8gMTAwOw0KICAgIGNvbnN0IGZyZXEgPSA0NDAgKiBNYXRoLnBvdygyLCAobm90ZSAtIDY5ICsgdG90YWxTZW1pdG9uZXMpIC8gMTIpOw0KICAgIHJldHVybiBmcmVxIC8gc2FtcGxlUmF0ZTsNCn0NCg0KLy8gRXF1YWwgcG93ZXIgcGFubmluZw0KLy8gUmV0dXJucyBbbGVmdEdhaW4sIHJpZ2h0R2Fpbl0gZm9yIGEgcGFuIHZhbHVlIG9mIC0xLjAgdG8gMS4wDQpmdW5jdGlvbiBwYW5HYWlucyhwYW4pIHsNCiAgICBjb25zdCBhbmdsZSA9IChwYW4gKyAxLjApIC8gMi4wICogTWF0aC5QSSAvIDIuMDsNCiAgICByZXR1cm4gW01hdGguY29zKGFuZ2xlKSwgTWF0aC5zaW4oYW5nbGUpXTsNCn0NCg0KLy8g4pSA4pSAIE1vb2cgTGFkZGVyIEZpbHRlciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIANCi8vIEZvdXIgY2FzY2FkZWQgb25lLXBvbGUgZmlsdGVycyB3aXRoIHJlc29uYW5jZSBmZWVkYmFjay4NCi8vIFRoaXMgaXMgdGhlIGNpcmN1aXQgdGhhdCBtYWRlIHRoZSBNaW5pbW9vZyBmYW1vdXMuDQovLyBjdXRvZmY6IDAuMCAtIDEuMCAobm9ybWFsaXplZCwgd2UnbGwgY29udmVydCB0byBIeikNCi8vIHJlc29uYW5jZTogMC4wIC0gNC4wIChhYm92ZSAxLjAgaXQgc2VsZi1vc2NpbGxhdGVzKQ0KZnVuY3Rpb24gbW9vZ0ZpbHRlcih2b2ljZSwgaW5wdXQsIGNoKSB7DQogICAgY29uc3QgY3V0b2ZmID0gdm9pY2UuZmlsdGVyQ3V0b2ZmOw0KICAgIGNvbnN0IHJlcyA9IHZvaWNlLmZpbHRlclJlc29uYW5jZTsNCiAgICBjb25zdCBmID0gY3V0b2ZmICogY3V0b2ZmICogMC45Ow0KDQogICAgY29uc3Qgc2NhbGVkUmVzID0gcmVzICogMC40OyAvLyBzcHJlYWQgcmFuZ2UgYWNyb3NzIGZ1bGwgc2xpZGVyIHRyYXZlbA0KICAgIGNvbnN0IGZlZWRiYWNrID0gc2NhbGVkUmVzICogMy42ICogdm9pY2VbYGZpbHRlclN0YWdlNCR7Y2h9YF07DQoNCiAgICB2b2ljZVtgZmlsdGVyU3RhZ2UxJHtjaH1gXSArPSBmICogKE1hdGgudGFuaChpbnB1dCAtIGZlZWRiYWNrKSAtIE1hdGgudGFuaCh2b2ljZVtgZmlsdGVyU3RhZ2UxJHtjaH1gXSkpOw0KICAgIHZvaWNlW2BmaWx0ZXJTdGFnZTIke2NofWBdICs9IGYgKiAoTWF0aC50YW5oKHZvaWNlW2BmaWx0ZXJTdGFnZTEke2NofWBdKSAtIE1hdGgudGFuaCh2b2ljZVtgZmlsdGVyU3RhZ2UyJHtjaH1gXSkpOw0KICAgIHZvaWNlW2BmaWx0ZXJTdGFnZTMke2NofWBdICs9IGYgKiAoTWF0aC50YW5oKHZvaWNlW2BmaWx0ZXJTdGFnZTIke2NofWBdKSAtIE1hdGgudGFuaCh2b2ljZVtgZmlsdGVyU3RhZ2UzJHtjaH1gXSkpOw0KICAgIHZvaWNlW2BmaWx0ZXJTdGFnZTQke2NofWBdICs9IGYgKiAoTWF0aC50YW5oKHZvaWNlW2BmaWx0ZXJTdGFnZTMke2NofWBdKSAtIE1hdGgudGFuaCh2b2ljZVtgZmlsdGVyU3RhZ2U0JHtjaH1gXSkpOw0KDQogICAgc3dpdGNoICh2b2ljZS5maWx0ZXJUeXBlKSB7DQogICAgICBjYXNlICdoaWdocGFzcyc6DQogICAgICAgIHJldHVybiBpbnB1dCAtIHZvaWNlW2BmaWx0ZXJTdGFnZTQke2NofWBdOw0KICAgICAgY2FzZSAnYmFuZHBhc3MnOg0KICAgICAgICByZXR1cm4gdm9pY2VbYGZpbHRlclN0YWdlMiR7Y2h9YF07DQogICAgICBjYXNlICdub3RjaCc6DQogICAgICAgIHJldHVybiAoaW5wdXQgLSB2b2ljZVtgZmlsdGVyU3RhZ2U0JHtjaH1gXSkgKyB2b2ljZVtgZmlsdGVyU3RhZ2UyJHtjaH1gXSAqIDAuNTsNCiAgICAgIGRlZmF1bHQ6IC8vIGxvd3Bhc3MNCiAgICAgICAgcmV0dXJuIHZvaWNlW2BmaWx0ZXJTdGFnZTQke2NofWBdOw0KICAgIH0NCn0NCg0KLy8g4pSA4pSAIFNpbmdsZSB2b2ljZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIANCi8vIFByZS1hbGxvY2F0ZWQuIFdlIG5ldmVyIGNyZWF0ZSBhIG5ldyB2b2ljZSBvYmplY3QgZHVyaW5nIHBsYXliYWNrLg0KZnVuY3Rpb24gY3JlYXRlVm9pY2UoKSB7DQogICAgcmV0dXJuIHsNCiAgICAgICAgYWN0aXZlOiBmYWxzZSwNCiAgICAgICAgbm90ZTogMCwNCiAgICAgICAgZnJlcXVlbmN5OiAwLA0KICAgICAgICB2ZWxvY2l0eTogMS4wLA0KDQogICAgICAgIC8vIE9zY2lsbGF0b3Igc3RhdGUg4oCUIG9uZSBwZXIgb3NjDQogICAgICAgIG9zYzE6IHsgcGhhc2U6IDAsIHBoYXNlSW5jcmVtZW50OiAwIH0sDQogICAgICAgIG9zYzI6IHsgcGhhc2U6IDAsIHBoYXNlSW5jcmVtZW50OiAwIH0sDQogICAgICAgIG9zYzM6IHsgcGhhc2U6IDAsIHBoYXNlSW5jcmVtZW50OiAwIH0sDQoNCiAgICAgICAgLy8gVW5pc29uIG9zY2lsbGF0b3Igc3RhdGUg4oCUIHByZS1hbGxvY2F0ZWQgZm9yIG1heCA4IHVuaXNvbiB2b2ljZXMNCiAgICAgICAgdW5pc29uT3NjMTogQXJyYXkuZnJvbSh7IGxlbmd0aDogOCB9LCAoKSA9PiAoeyBwaGFzZTogTWF0aC5yYW5kb20oKSB9KSksDQogICAgICAgIHVuaXNvbk9zYzI6IEFycmF5LmZyb20oeyBsZW5ndGg6IDggfSwgKCkgPT4gKHsgcGhhc2U6IE1hdGgucmFuZG9tKCkgfSkpLA0KICAgICAgICB1bmlzb25Pc2MzOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiA4IH0sICgpID0+ICh7IHBoYXNlOiBNYXRoLnJhbmRvbSgpIH0pKSwNCg0KICAgICAgICAvLyBBRFNSIHN0YXRlDQogICAgICAgIC8vIFN0YWdlczogMD1pZGxlLCAxPWF0dGFjaywgMj1kZWNheSwgMz1zdXN0YWluLCA0PXJlbGVhc2UNCiAgICAgICAgZW52U3RhZ2U6IDAsDQogICAgICAgIGVudlZhbHVlOiAwLA0KICAgICAgICBlbnZBdHRhY2tSYXRlOiAwLA0KICAgICAgICBlbnZEZWNheVJhdGU6IDAsDQogICAgICAgIGVudlN1c3RhaW5MZXZlbDogMCwNCiAgICAgICAgZW52UmVsZWFzZVJhdGU6IDAsDQoNCiAgICAgICAgLy8gRmlsdGVyIGVudmVsb3BlIHN0YXRlIOKAlCBtaXJyb3JzIGFtcGxpdHVkZSBlbnZlbG9wZSBzdGFnZXMNCiAgICAgICAgZmlsdGVyRW52U3RhZ2U6IDAsDQogICAgICAgIGZpbHRlckVudlZhbHVlOiAwLA0KICAgICAgICBmaWx0ZXJFbnZBdHRhY2tSYXRlOiAwLA0KICAgICAgICBmaWx0ZXJFbnZEZWNheVJhdGU6IDAsDQogICAgICAgIGZpbHRlckVudlN1c3RhaW5MZXZlbDogMCwNCiAgICAgICAgZmlsdGVyRW52UmVsZWFzZVJhdGU6IDAsDQoNCiAgICAgICAgLy8gUGl0Y2ggZW52ZWxvcGUgc3RhdGUNCiAgICAgICAgcGl0Y2hFbnZTdGFnZTogMCwNCiAgICAgICAgcGl0Y2hFbnZWYWx1ZTogMCwNCiAgICAgICAgcGl0Y2hFbnZBdHRhY2tSYXRlOiAwLA0KICAgICAgICBwaXRjaEVudkRlY2F5UmF0ZTogMCwNCiAgICAgICAgcGl0Y2hFbnZTdXN0YWluTGV2ZWw6IDAsDQogICAgICAgIHBpdGNoRW52UmVsZWFzZVJhdGU6IDAsDQoNCiAgICAgICAgLy8gUG9ydGFtZW50byBzdGF0ZQ0KICAgICAgICBjdXJyZW50RnJlcTogMCwgICAgLy8gY3VycmVudCBmcmVxdWVuY3ksIGdsaWRlcyB0b3dhcmQgdGFyZ2V0RnJlcQ0KICAgICAgICB0YXJnZXRGcmVxOiAwLCAgICAgLy8gZGVzdGluYXRpb24gZnJlcXVlbmN5DQogICAgICAgIGdsaWRlUmF0ZTogMCwgICAgICAvLyBzZW1pdG9uZXMgcGVyIHNhbXBsZSB0b3dhcmQgdGFyZ2V0DQoNCiAgICAgICAgLy8gRmlsdGVyIHN0YXRlDQogICAgICAgIGZpbHRlclR5cGU6ICdsb3dwYXNzJywNCiAgICAgICAgZmlsdGVyQ3V0b2ZmOiAwLjgsDQogICAgICAgIGZpbHRlclJlc29uYW5jZTogMC4xLA0KICAgICAgICBmaWx0ZXJTdGFnZTFMOiAwLCBmaWx0ZXJTdGFnZTJMOiAwLCBmaWx0ZXJTdGFnZTNMOiAwLCBmaWx0ZXJTdGFnZTRMOiAwLA0KICAgICAgICBmaWx0ZXJTdGFnZTFSOiAwLCBmaWx0ZXJTdGFnZTJSOiAwLCBmaWx0ZXJTdGFnZTNSOiAwLCBmaWx0ZXJTdGFnZTRSOiAwLA0KICAgIH07DQp9DQoNCi8vIOKUgOKUgCBQcm9jZXNzb3Ig4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSADQpjbGFzcyBPYnNpZGlhblByb2Nlc3NvciBleHRlbmRzIEF1ZGlvV29ya2xldFByb2Nlc3NvciB7DQogICAgY29uc3RydWN0b3IoKSB7DQogICAgICAgIHN1cGVyKCk7DQoNCiAgICAgICAgLy8gUHJlLWFsbG9jYXRlIHZvaWNlIHBvb2wg4oCUIG5vIG5ldyBvYmplY3RzIGR1cmluZyBwbGF5YmFjaw0KICAgICAgICB0aGlzLnZvaWNlcyA9IFtdOw0KICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IE1BWF9WT0lDRVM7IGkrKykgew0KICAgICAgICAgICAgdGhpcy52b2ljZXMucHVzaChjcmVhdGVWb2ljZSgpKTsNCiAgICAgICAgfQ0KICAgICAgICB0aGlzLmFjdGl2ZVZvaWNlQ291bnQgPSAwOw0KDQogICAgICAgIC8vIExGTyDigJQgZ2xvYmFsLCBub3QgcGVyIHZvaWNlDQogICAgICAgIHRoaXMubGZvUGhhc2UgPSAwOw0KICAgICAgICB0aGlzLmxmb1BoYXNlSW5jcmVtZW50ID0gMiAvIHNhbXBsZVJhdGU7IC8vIGRlZmF1bHQgMWh6LCBmdWxsIGN5Y2xlID0gMiB1bml0cw0KDQogICAgICAgIC8vIFBhcmFtZXRlcnMgd2l0aCBkZWZhdWx0cw0KICAgICAgICB0aGlzLnBhcmFtcyA9IHsNCiAgICAgICAgICAgIHBpdGNoQmVuZDogMCwgLy8gc2VtaXRvbmVzLCDCsTINCiAgICAgICAgICAgIGZpbHRlclR5cGU6ICdsb3dwYXNzJywgLy8gbG93cGFzcyB8IGhpZ2hwYXNzIHwgYmFuZHBhc3MgfCBub3RjaA0KICAgICAgICAgICAgcG9ydGFtZW50b1RpbWU6IDAuMCwgICAgICAvLyBzZWNvbmRzLCAwID0gaW5zdGFudCwgMC4wMDEgdG8gMi4wDQogICAgICAgICAgICBwb3J0YW1lbnRvTW9kZTogJ2Fsd2F5cycsIC8vICdhbHdheXMnIHwgJ2xlZ2F0bycNCiAgICAgICAgICAgIG9zYzFQdWxzZVdpZHRoOiAwLjUsICAgLy8gMC4xIHRvIDAuOSwgMC41ID0gcGVyZmVjdCBzcXVhcmUNCiAgICAgICAgICAgIG9zYzJQdWxzZVdpZHRoOiAwLjUsDQogICAgICAgICAgICBvc2MzUHVsc2VXaWR0aDogMC41LA0KICAgICAgICAgICAgb3NjMVBXTURlcHRoOiAwLjAsICAgICAvLyAwLjAgdG8gMS4wLCBob3cgbXVjaCBMRk8gbW9kdWxhdGVzIHB1bHNlIHdpZHRoDQogICAgICAgICAgICBvc2MyUFdNRGVwdGg6IDAuMCwNCiAgICAgICAgICAgIG9zYzNQV01EZXB0aDogMC4wLA0KICAgICAgICAgICAgdW5pc29uVm9pY2VzOiAxLCAgICAgIC8vIDEgdG8gOC4gMSA9IHVuaXNvbiBvZmYsIG5vcm1hbCBiZWhhdmlvcg0KICAgICAgICAgICAgdW5pc29uRGV0dW5lOiAxMCwgICAgIC8vIGNlbnRzLCAwIHRvIDEwMA0KICAgICAgICAgICAgdW5pc29uU3ByZWFkOiAwLjgsICAgIC8vIHN0ZXJlbyBzcHJlYWQsIDAuMCB0byAxLjANCiAgICAgICAgICAgIHBpdGNoRW52QW1vdW50OiAwLCAgICAgIC8vIHNlbWl0b25lcywgLTI0IHRvICsyNC4gMCA9IG9mZg0KICAgICAgICAgICAgcGl0Y2hFbnZBdHRhY2s6IDAuMDAxLCAgLy8gdmVyeSBmYXN0IGRlZmF1bHQNCiAgICAgICAgICAgIHBpdGNoRW52RGVjYXk6IDAuMiwgICAgIC8vIHNob3J0IGRlY2F5IOKAlCBjbGFzc2ljIDgwOCBzbmFwDQogICAgICAgICAgICBwaXRjaEVudlN1c3RhaW46IDAuMCwgICAvLyB6ZXJvIHN1c3RhaW4gYnkgZGVmYXVsdCDigJQgdHJhbnNpZW50IHNoYXBlDQogICAgICAgICAgICBwaXRjaEVudlJlbGVhc2U6IDAuMSwNCiAgICAgICAgICAgIGF0dGFjazogMC4wMSwNCiAgICAgICAgICAgIGRlY2F5OiAwLjEsDQogICAgICAgICAgICBzdXN0YWluOiAwLjcsDQogICAgICAgICAgICByZWxlYXNlOiAwLjMsDQogICAgICAgICAgICBtYXN0ZXJHYWluOiAwLjUsDQogICAgICAgICAgICBzdGVyZW9XaWR0aDogMS4wLCAvLyAwLjAgPSBtb25vLCAxLjAgPSBmdWxsIHN0ZXJlbywgPjEuMCA9IGh5cGVyLXdpZGUNCiAgICAgICAgICAgIGZpbHRlckN1dG9mZjogMC44LA0KICAgICAgICAgICAgZmlsdGVyUmVzb25hbmNlOiAwLjEsDQogICAgICAgICAgICBmaWx0ZXJBdHRhY2s6IDAuMDEsDQogICAgICAgICAgICBmaWx0ZXJEZWNheTogMC4zLA0KICAgICAgICAgICAgZmlsdGVyU3VzdGFpbjogMC4zLA0KICAgICAgICAgICAgZmlsdGVyUmVsZWFzZTogMC41LA0KICAgICAgICAgICAgZmlsdGVyRW52QW1vdW50OiAwLjAsICAgLy8gLTEuMCB0byAxLjAuIDAgPSBubyBtb2R1bGF0aW9uDQogICAgICAgICAgICBsZm9SYXRlOiAxLjAsICAgICAgICAvLyBIeiwgMC4xIHRvIDIwDQogICAgICAgICAgICBsZm9EZXB0aDogMC4wLCAgICAgICAvLyAwLjAgdG8gMS4wLCBkZWZhdWx0IDAgc28gTEZPIGlzIG9wdC1pbg0KICAgICAgICAgICAgbGZvV2F2ZWZvcm06ICdzaW5lJywgLy8gc2luZSB8IHRyaWFuZ2xlIHwgc3F1YXJlIHwgc2F3DQogICAgICAgICAgICBsZm9EZXN0aW5hdGlvbjogJ3BpdGNoJywgLy8gcGl0Y2ggfCBmaWx0ZXIgfCB2b2x1bWUgfCBwYW4NCiAgICAgICAgICAgIHZlbG9jaXR5QW1wU2VuczogMS4wLCAgICAgLy8gMC4wIHRvIDEuMCDigJQgaG93IG11Y2ggdmVsb2NpdHkgYWZmZWN0cyB2b2x1bWUNCiAgICAgICAgICAgIHZlbG9jaXR5RmlsdGVyU2VuczogMC41LCAgLy8gMC4wIHRvIDEuMCDigJQgaG93IG11Y2ggdmVsb2NpdHkgb3BlbnMgdGhlIGZpbHRlcg0KDQogICAgICAgICAgICAvLyBPU0MgMQ0KICAgICAgICAgICAgb3NjMVdhdmVmb3JtOiAnc2F3JywNCiAgICAgICAgICAgIG9zYzFDb2Fyc2U6IDAsICAgICAgLy8gc2VtaXRvbmVzLCAtMjQgdG8gKzI0DQogICAgICAgICAgICBvc2MxRmluZTogMCwgICAgICAgIC8vIGNlbnRzLCAtMTAwIHRvICsxMDANCiAgICAgICAgICAgIG9zYzFNaXg6IDEuMCwgICAgICAgLy8gMC4wIHRvIDEuMA0KICAgICAgICAgICAgb3NjMVBhbjogMC4wLA0KICAgICAgICAgICAgb3NjMUVuYWJsZWQ6IHRydWUsDQoNCiAgICAgICAgICAgIC8vIE9TQyAyDQogICAgICAgICAgICBvc2MyV2F2ZWZvcm06ICdzYXcnLA0KICAgICAgICAgICAgb3NjMkNvYXJzZTogMCwNCiAgICAgICAgICAgIG9zYzJGaW5lOiA3LCAgICAgICAgLy8gZGVmYXVsdCArNyBjZW50cyBkZXR1bmUgZm9yIHRoaWNrbmVzcw0KICAgICAgICAgICAgb3NjMk1peDogMC43LA0KICAgICAgICAgICAgb3NjMlBhbjogLTAuMywNCiAgICAgICAgICAgIG9zYzJFbmFibGVkOiB0cnVlLA0KDQogICAgICAgICAgICAvLyBPU0MgMw0KICAgICAgICAgICAgb3NjM1dhdmVmb3JtOiAnc3F1YXJlJywNCiAgICAgICAgICAgIG9zYzNDb2Fyc2U6IC0xMiwgICAgLy8gZGVmYXVsdCBzdWIgb2N0YXZlDQogICAgICAgICAgICBvc2MzRmluZTogMCwNCiAgICAgICAgICAgIG9zYzNNaXg6IDAuNSwNCiAgICAgICAgICAgIG9zYzNQYW46IDAuMywNCiAgICAgICAgICAgIG9zYzNFbmFibGVkOiB0cnVlLA0KICAgICAgICB9Ow0KDQogICAgICAgIC8vIExpc3RlbiBmb3IgbWVzc2FnZXMgZnJvbSB0aGUgbWFpbiB0aHJlYWQNCiAgICAgICAgLy8gKHBhcmFtZXRlciBjaGFuZ2VzLCBub3RlIGV2ZW50cyBpZiBub3QgdXNpbmcgV0FNIGV2ZW50IHF1ZXVlIHlldCkNCiAgICAgICAgdGhpcy5wb3J0Lm9ubWVzc2FnZSA9IChlKSA9PiB7DQogICAgICAgICAgICBjb25zdCB7IHR5cGUsIGRhdGEgfSA9IGUuZGF0YTsNCiAgICAgICAgICAgIGlmICh0eXBlID09PSAnbm90ZU9uJykgdGhpcy5ub3RlT24oZGF0YS5ub3RlLCBkYXRhLnZlbG9jaXR5KTsNCiAgICAgICAgICAgIGlmICh0eXBlID09PSAnbm90ZU9mZicpIHRoaXMubm90ZU9mZihkYXRhLm5vdGUpOw0KICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdzZXRQYXJhbScpIHsNCiAgICAgICAgICAgICAgICB0aGlzLnBhcmFtc1tkYXRhLmtleV0gPSBkYXRhLnZhbHVlOw0KICAgICAgICAgICAgICAgIGlmIChkYXRhLmtleSA9PT0gJ2xmb1JhdGUnKSB7DQogICAgICAgICAgICAgICAgICAgIHRoaXMubGZvUGhhc2VJbmNyZW1lbnQgPSBkYXRhLnZhbHVlIC8gc2FtcGxlUmF0ZTsNCiAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgdGhpcy52b2ljZXMuZm9yRWFjaCh2ID0+IHsNCiAgICAgICAgICAgICAgICAgICAgaWYgKHYuYWN0aXZlKSB7DQogICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5rZXkgPT09ICdmaWx0ZXJDdXRvZmYnKSB2LmZpbHRlckN1dG9mZiA9IGRhdGEudmFsdWU7DQogICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5rZXkgPT09ICdmaWx0ZXJSZXNvbmFuY2UnKSB2LmZpbHRlclJlc29uYW5jZSA9IGRhdGEudmFsdWU7DQogICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5rZXkgPT09ICdmaWx0ZXJUeXBlJykgdi5maWx0ZXJUeXBlID0gZGF0YS52YWx1ZTsNCiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXRhLmtleSA9PT0gJ29zYzFGaW5lJyB8fCBkYXRhLmtleSA9PT0gJ29zYzFDb2Fyc2UnKSB7DQogICAgICAgICAgICAgICAgICAgICAgICAgICAgdi5vc2MxLnBoYXNlSW5jcmVtZW50ID0gY2FsY1BoYXNlSW5jcmVtZW50KHYubm90ZSwgdGhpcy5wYXJhbXMub3NjMUNvYXJzZSwgdGhpcy5wYXJhbXMub3NjMUZpbmUpOw0KICAgICAgICAgICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEua2V5ID09PSAnb3NjMkZpbmUnIHx8IGRhdGEua2V5ID09PSAnb3NjMkNvYXJzZScpIHsNCiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2Lm9zYzIucGhhc2VJbmNyZW1lbnQgPSBjYWxjUGhhc2VJbmNyZW1lbnQodi5ub3RlLCB0aGlzLnBhcmFtcy5vc2MyQ29hcnNlLCB0aGlzLnBhcmFtcy5vc2MyRmluZSk7DQogICAgICAgICAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5rZXkgPT09ICdvc2MzRmluZScgfHwgZGF0YS5rZXkgPT09ICdvc2MzQ29hcnNlJykgew0KICAgICAgICAgICAgICAgICAgICAgICAgICAgIHYub3NjMy5waGFzZUluY3JlbWVudCA9IGNhbGNQaGFzZUluY3JlbWVudCh2Lm5vdGUsIHRoaXMucGFyYW1zLm9zYzNDb2Fyc2UsIHRoaXMucGFyYW1zLm9zYzNGaW5lKTsNCiAgICAgICAgICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgIH0pOw0KDQogICAgICAgICAgICAgICAgaWYgKGRhdGEua2V5ID09PSAndW5pc29uVm9pY2VzJyB8fCBkYXRhLmtleSA9PT0gJ3VuaXNvbkRldHVuZScpIHsNCiAgICAgICAgICAgICAgICAgIHRoaXMudm9pY2VzLmZvckVhY2godiA9PiB7DQogICAgICAgICAgICAgICAgICAgIGlmICghdi5hY3RpdmUpIHJldHVybjsNCiAgICAgICAgICAgICAgICAgICAgY29uc3QgdW5pc29uQ291bnQgPSBNYXRoLm1heCgxLCBNYXRoLmZsb29yKHRoaXMucGFyYW1zLnVuaXNvblZvaWNlcykpOw0KICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB1ID0gMDsgdSA8IDg7IHUrKykgew0KICAgICAgICAgICAgICAgICAgICAgIGlmICh1bmlzb25Db3VudCA9PT0gMSkgew0KICAgICAgICAgICAgICAgICAgICAgICAgdi51bmlzb25Pc2MxW3VdLnBoYXNlSW5jcmVtZW50ID0gdi5vc2MxLnBoYXNlSW5jcmVtZW50Ow0KICAgICAgICAgICAgICAgICAgICAgICAgdi51bmlzb25Pc2MyW3VdLnBoYXNlSW5jcmVtZW50ID0gdi5vc2MyLnBoYXNlSW5jcmVtZW50Ow0KICAgICAgICAgICAgICAgICAgICAgICAgdi51bmlzb25Pc2MzW3VdLnBoYXNlSW5jcmVtZW50ID0gdi5vc2MzLnBoYXNlSW5jcmVtZW50Ow0KICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7DQogICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzcHJlYWQgPSB1IC8gKHVuaXNvbkNvdW50IC0gMSk7DQogICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXR1bmVDZW50cyA9IChzcHJlYWQgLSAwLjUpICogMiAqIHRoaXMucGFyYW1zLnVuaXNvbkRldHVuZTsNCiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRldHVuZVJhdGlvID0gTWF0aC5wb3coMiwgZGV0dW5lQ2VudHMgLyAxMjAwKTsNCiAgICAgICAgICAgICAgICAgICAgICAgIHYudW5pc29uT3NjMVt1XS5waGFzZUluY3JlbWVudCA9IHYub3NjMS5waGFzZUluY3JlbWVudCAqIGRldHVuZVJhdGlvOw0KICAgICAgICAgICAgICAgICAgICAgICAgdi51bmlzb25Pc2MyW3VdLnBoYXNlSW5jcmVtZW50ID0gdi5vc2MyLnBoYXNlSW5jcmVtZW50ICogZGV0dW5lUmF0aW87DQogICAgICAgICAgICAgICAgICAgICAgICB2LnVuaXNvbk9zYzNbdV0ucGhhc2VJbmNyZW1lbnQgPSB2Lm9zYzMucGhhc2VJbmNyZW1lbnQgKiBkZXR1bmVSYXRpbzsNCiAgICAgICAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICAgIH0pOw0KICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgIH0NCiAgICAgICAgfTsNCiAgICB9DQoNCiAgICAvLyDilIDilIAgTm90ZSBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgA0KICAgIG5vdGVPbihub3RlLCB2ZWxvY2l0eSkgew0KICAgICAgICB0aGlzLmFjdGl2ZVZvaWNlQ291bnQrKzsNCiAgICAgICAgLy8gRmlyc3QgcHJpb3JpdHk6IHJldHJpZ2dlciB0aGUgc2FtZSBub3RlIGlmIGl0J3MgYWxyZWFkeSBwbGF5aW5nDQogICAgICAgIGxldCB2b2ljZSA9IHRoaXMudm9pY2VzLmZpbmQodiA9PiB2LmFjdGl2ZSAmJiB2Lm5vdGUgPT09IG5vdGUpOw0KICAgICAgICAvLyBTZWNvbmQgcHJpb3JpdHk6IGZpbmQgYSBmcmVlIHZvaWNlDQogICAgICAgIGlmICghdm9pY2UpIHZvaWNlID0gdGhpcy52b2ljZXMuZmluZCh2ID0+ICF2LmFjdGl2ZSk7DQogICAgICAgIC8vIExhc3QgcmVzb3J0OiBzdGVhbCB0aGUgdm9pY2UgZnVydGhlc3QgaW50byBpdHMgcmVsZWFzZQ0KICAgICAgICBpZiAoIXZvaWNlKSB7DQogICAgICAgICAgICB2b2ljZSA9IHRoaXMudm9pY2VzLnJlZHVjZSgob2xkZXN0LCB2KSA9Pg0KICAgICAgICAgICAgICAgIHYuZW52VmFsdWUgPCBvbGRlc3QuZW52VmFsdWUgPyB2IDogb2xkZXN0DQogICAgICAgICAgICAgICAgLCB0aGlzLnZvaWNlc1swXSk7DQogICAgICAgIH0NCg0KICAgICAgICBjb25zdCBmcmVxID0gNDQwICogTWF0aC5wb3coMiwgKG5vdGUgLSA2OSkgLyAxMik7DQoNCiAgICAgICAgdm9pY2UuYWN0aXZlID0gdHJ1ZTsNCiAgICAgICAgdm9pY2Uubm90ZSA9IG5vdGU7DQogICAgICAgIHZvaWNlLmZyZXF1ZW5jeSA9IGZyZXE7DQogICAgICAgIHZvaWNlLnZlbG9jaXR5ID0gdmVsb2NpdHkgLyAxMjc7DQogICAgICAgIHZvaWNlLm9zYzEucGhhc2UgPSAwOw0KICAgICAgICB2b2ljZS5vc2MyLnBoYXNlID0gMDsNCiAgICAgICAgdm9pY2Uub3NjMy5waGFzZSA9IDA7DQoNCiAgICAgICAgLy8gUG9ydGFtZW50byDigJQgZGV0ZXJtaW5lIHdoZXRoZXIgdG8gZ2xpZGUNCiAgICAgICAgY29uc3Qgc2hvdWxkR2xpZGUgPSB0aGlzLnBhcmFtcy5wb3J0YW1lbnRvVGltZSA+IDAgJiYgKA0KICAgICAgICAgIHRoaXMucGFyYW1zLnBvcnRhbWVudG9Nb2RlID09PSAnYWx3YXlzJyB8fA0KICAgICAgICAgICh0aGlzLnBhcmFtcy5wb3J0YW1lbnRvTW9kZSA9PT0gJ2xlZ2F0bycgJiYgdGhpcy5hY3RpdmVWb2ljZUNvdW50ID4gMSkNCiAgICAgICAgKTsNCg0KICAgICAgICB2b2ljZS50YXJnZXRGcmVxID0gZnJlcTsNCg0KICAgICAgICBpZiAoc2hvdWxkR2xpZGUgJiYgdm9pY2UuY3VycmVudEZyZXEgPiAwKSB7DQogICAgICAgICAgLy8gS2VlcCBjdXJyZW50IGZyZXF1ZW5jeSBhbmQgZ2xpZGUgdG8gdGFyZ2V0DQogICAgICAgICAgLy8gZ2xpZGVSYXRlIGlzIGluIGZyZXF1ZW5jeSByYXRpbyBwZXIgc2FtcGxlDQogICAgICAgICAgY29uc3QgZ2xpZGVUaW1lID0gdGhpcy5wYXJhbXMucG9ydGFtZW50b1RpbWUgKiBzYW1wbGVSYXRlOw0KICAgICAgICAgIGNvbnN0IHNlbWl0b25lRGlzdGFuY2UgPSBNYXRoLmFicygNCiAgICAgICAgICAgIDEyICogTWF0aC5sb2cyKGZyZXEgLyB2b2ljZS5jdXJyZW50RnJlcSkNCiAgICAgICAgICApOw0KICAgICAgICAgIHZvaWNlLmdsaWRlUmF0ZSA9IHNlbWl0b25lRGlzdGFuY2UgLyBnbGlkZVRpbWU7DQogICAgICAgIH0gZWxzZSB7DQogICAgICAgICAgLy8gSnVtcCBpbnN0YW50bHkgdG8gdGFyZ2V0DQogICAgICAgICAgdm9pY2UuY3VycmVudEZyZXEgPSBmcmVxOw0KICAgICAgICAgIHZvaWNlLmdsaWRlUmF0ZSA9IDA7DQogICAgICAgIH0NCg0KICAgICAgICAvLyBCYXNlIHBoYXNlIGluY3JlbWVudHMgZnJvbSBjdXJyZW50IGZyZXF1ZW5jeQ0KICAgICAgICAvLyBVbmlzb24gZGV0dW5lIGlzIGFwcGxpZWQgYXMgYSByYXRpbyBvbiB0b3Agb2YgdGhpcyBpbiBwcm9jZXNzKCkNCiAgICAgICAgdm9pY2Uub3NjMS5waGFzZUluY3JlbWVudCA9ICh2b2ljZS5jdXJyZW50RnJlcSAqIE1hdGgucG93KDIsICh0aGlzLnBhcmFtcy5vc2MxQ29hcnNlICsgdGhpcy5wYXJhbXMub3NjMUZpbmUgLyAxMDApIC8gMTIpKSAvIHNhbXBsZVJhdGU7DQogICAgICAgIHZvaWNlLm9zYzIucGhhc2VJbmNyZW1lbnQgPSAodm9pY2UuY3VycmVudEZyZXEgKiBNYXRoLnBvdygyLCAodGhpcy5wYXJhbXMub3NjMkNvYXJzZSArIHRoaXMucGFyYW1zLm9zYzJGaW5lIC8gMTAwKSAvIDEyKSkgLyBzYW1wbGVSYXRlOw0KICAgICAgICB2b2ljZS5vc2MzLnBoYXNlSW5jcmVtZW50ID0gKHZvaWNlLmN1cnJlbnRGcmVxICogTWF0aC5wb3coMiwgKHRoaXMucGFyYW1zLm9zYzNDb2Fyc2UgKyB0aGlzLnBhcmFtcy5vc2MzRmluZSAvIDEwMCkgLyAxMikpIC8gc2FtcGxlUmF0ZTsNCg0KICAgICAgICAvLyBTZXQgdXAgdW5pc29uIG9zY2lsbGF0b3IgcGhhc2UgaW5jcmVtZW50cw0KICAgICAgICAvLyBFYWNoIGNvcHkgZ2V0cyBhIGRldHVuZSBvZmZzZXQgc3ByZWFkIGV2ZW5seSBhY3Jvc3MgdGhlIGRldHVuZSByYW5nZQ0KICAgICAgICBjb25zdCB1bmlzb25Db3VudCA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3IodGhpcy5wYXJhbXMudW5pc29uVm9pY2VzKSk7DQogICAgICAgIGZvciAobGV0IHUgPSAwOyB1IDwgODsgdSsrKSB7DQogICAgICAgICAgaWYgKHVuaXNvbkNvdW50ID09PSAxKSB7DQogICAgICAgICAgICAvLyBObyBkZXR1bmUg4oCUIHNpbmdsZSBjb3B5IGF0IGJhc2UgcGl0Y2gNCiAgICAgICAgICAgIHZvaWNlLnVuaXNvbk9zYzFbdV0ucGhhc2VJbmNyZW1lbnQgPSB2b2ljZS5vc2MxLnBoYXNlSW5jcmVtZW50Ow0KICAgICAgICAgICAgdm9pY2UudW5pc29uT3NjMlt1XS5waGFzZUluY3JlbWVudCA9IHZvaWNlLm9zYzIucGhhc2VJbmNyZW1lbnQ7DQogICAgICAgICAgICB2b2ljZS51bmlzb25Pc2MzW3VdLnBoYXNlSW5jcmVtZW50ID0gdm9pY2Uub3NjMy5waGFzZUluY3JlbWVudDsNCiAgICAgICAgICB9IGVsc2Ugew0KICAgICAgICAgICAgLy8gU3ByZWFkIGRldHVuZSBldmVubHkgYWNyb3NzIGNvcGllcw0KICAgICAgICAgICAgLy8gQ2VudGVyIGNvcHkgKGlmIG9kZCBjb3VudCkgaXMgYXQgMCBjZW50cyBkZXR1bmUNCiAgICAgICAgICAgIGNvbnN0IHNwcmVhZCA9IHUgLyAodW5pc29uQ291bnQgLSAxKTsgLy8gMC4wIHRvIDEuMA0KICAgICAgICAgICAgY29uc3QgZGV0dW5lQ2VudHMgPSAoc3ByZWFkIC0gMC41KSAqIDIgKiB0aGlzLnBhcmFtcy51bmlzb25EZXR1bmU7DQogICAgICAgICAgICBjb25zdCBkZXR1bmVSYXRpbyA9IE1hdGgucG93KDIsIGRldHVuZUNlbnRzIC8gMTIwMCk7DQogICAgICAgICAgICB2b2ljZS51bmlzb25Pc2MxW3VdLnBoYXNlSW5jcmVtZW50ID0gdm9pY2Uub3NjMS5waGFzZUluY3JlbWVudCAqIGRldHVuZVJhdGlvOw0KICAgICAgICAgICAgdm9pY2UudW5pc29uT3NjMlt1XS5waGFzZUluY3JlbWVudCA9IHZvaWNlLm9zYzIucGhhc2VJbmNyZW1lbnQgKiBkZXR1bmVSYXRpbzsNCiAgICAgICAgICAgIHZvaWNlLnVuaXNvbk9zYzNbdV0ucGhhc2VJbmNyZW1lbnQgPSB2b2ljZS5vc2MzLnBoYXNlSW5jcmVtZW50ICogZGV0dW5lUmF0aW87DQogICAgICAgICAgfQ0KICAgICAgICB9DQoNCiAgICAgICAgLy8gUmFuZG9taXplIHBoYXNlcyBvbiByZXRyaWdnZXIgdG8gcHJldmVudCBwaGFzZSBjYW5jZWxsYXRpb24NCiAgICAgICAgZm9yIChsZXQgdSA9IDA7IHUgPCA4OyB1KyspIHsNCiAgICAgICAgICB2b2ljZS51bmlzb25Pc2MxW3VdLnBoYXNlID0gTWF0aC5yYW5kb20oKTsNCiAgICAgICAgICB2b2ljZS51bmlzb25Pc2MyW3VdLnBoYXNlID0gTWF0aC5yYW5kb20oKTsNCiAgICAgICAgICB2b2ljZS51bmlzb25Pc2MzW3VdLnBoYXNlID0gTWF0aC5yYW5kb20oKTsNCiAgICAgICAgfQ0KDQogICAgICAgIHZvaWNlLmZpbHRlckN1dG9mZiA9IHRoaXMucGFyYW1zLmZpbHRlckN1dG9mZjsNCiAgICAgICAgdm9pY2UuZmlsdGVyUmVzb25hbmNlID0gdGhpcy5wYXJhbXMuZmlsdGVyUmVzb25hbmNlOw0KICAgICAgICB2b2ljZS5maWx0ZXJUeXBlID0gdGhpcy5wYXJhbXMuZmlsdGVyVHlwZTsNCiAgICAgICAgLy8gUmVzZXQgZmlsdGVyIHN0YWdlcyBvbiBuZXcgbm90ZSB0byBwcmV2ZW50IGNsaWNrcw0KICAgICAgICB2b2ljZS5maWx0ZXJTdGFnZTFMID0gMDsNCiAgICAgICAgdm9pY2UuZmlsdGVyU3RhZ2UyTCA9IDA7DQogICAgICAgIHZvaWNlLmZpbHRlclN0YWdlM0wgPSAwOw0KICAgICAgICB2b2ljZS5maWx0ZXJTdGFnZTRMID0gMDsNCiAgICAgICAgdm9pY2UuZmlsdGVyU3RhZ2UxUiA9IDA7DQogICAgICAgIHZvaWNlLmZpbHRlclN0YWdlMlIgPSAwOw0KICAgICAgICB2b2ljZS5maWx0ZXJTdGFnZTNSID0gMDsNCiAgICAgICAgdm9pY2UuZmlsdGVyU3RhZ2U0UiA9IDA7DQoNCiAgICAgICAgLy8gU3RhcnQgYXR0YWNrDQogICAgICAgIHZvaWNlLmVudlN0YWdlID0gMTsNCiAgICAgICAgdm9pY2UuZW52QXR0YWNrUmF0ZSA9IDEuMCAvICh0aGlzLnBhcmFtcy5hdHRhY2sgKiBzYW1wbGVSYXRlKTsNCiAgICAgICAgdm9pY2UuZW52RGVjYXlSYXRlID0gMS4wIC8gKHRoaXMucGFyYW1zLmRlY2F5ICogc2FtcGxlUmF0ZSk7DQogICAgICAgIHZvaWNlLmVudlN1c3RhaW5MZXZlbCA9IHRoaXMucGFyYW1zLnN1c3RhaW47DQogICAgICAgIHZvaWNlLmVudlJlbGVhc2VSYXRlID0gMS4wIC8gKHRoaXMucGFyYW1zLnJlbGVhc2UgKiBzYW1wbGVSYXRlKTsNCg0KICAgICAgICAvLyBTdGFydCBmaWx0ZXIgZW52ZWxvcGUNCiAgICAgICAgdm9pY2UuZmlsdGVyRW52U3RhZ2UgPSAxOw0KICAgICAgICB2b2ljZS5maWx0ZXJFbnZBdHRhY2tSYXRlID0gMS4wIC8gKHRoaXMucGFyYW1zLmZpbHRlckF0dGFjayAqIHNhbXBsZVJhdGUpOw0KICAgICAgICB2b2ljZS5maWx0ZXJFbnZEZWNheVJhdGUgPSAxLjAgLyAodGhpcy5wYXJhbXMuZmlsdGVyRGVjYXkgKiBzYW1wbGVSYXRlKTsNCiAgICAgICAgdm9pY2UuZmlsdGVyRW52U3VzdGFpbkxldmVsID0gdGhpcy5wYXJhbXMuZmlsdGVyU3VzdGFpbjsNCiAgICAgICAgdm9pY2UuZmlsdGVyRW52UmVsZWFzZVJhdGUgPSAxLjAgLyAodGhpcy5wYXJhbXMuZmlsdGVyUmVsZWFzZSAqIHNhbXBsZVJhdGUpOw0KDQogICAgICAgIC8vIFN0YXJ0IHBpdGNoIGVudmVsb3BlDQogICAgICAgIHZvaWNlLnBpdGNoRW52U3RhZ2UgPSAxOw0KICAgICAgICB2b2ljZS5waXRjaEVudkF0dGFja1JhdGUgPSAxLjAgLyAodGhpcy5wYXJhbXMucGl0Y2hFbnZBdHRhY2sgKiBzYW1wbGVSYXRlKTsNCiAgICAgICAgdm9pY2UucGl0Y2hFbnZEZWNheVJhdGUgPSAxLjAgLyAodGhpcy5wYXJhbXMucGl0Y2hFbnZEZWNheSAqIHNhbXBsZVJhdGUpOw0KICAgICAgICB2b2ljZS5waXRjaEVudlN1c3RhaW5MZXZlbCA9IHRoaXMucGFyYW1zLnBpdGNoRW52U3VzdGFpbjsNCiAgICAgICAgdm9pY2UucGl0Y2hFbnZSZWxlYXNlUmF0ZSA9IDEuMCAvICh0aGlzLnBhcmFtcy5waXRjaEVudlJlbGVhc2UgKiBzYW1wbGVSYXRlKTsNCiAgICB9DQoNCiAgICBub3RlT2ZmKG5vdGUpIHsNCiAgICAgICAgY29uc3Qgdm9pY2UgPSB0aGlzLnZvaWNlcy5maW5kKHYgPT4gdi5hY3RpdmUgJiYgdi5ub3RlID09PSBub3RlKTsNCiAgICAgICAgaWYgKHZvaWNlKSB7DQogICAgICAgICAgICB0aGlzLmFjdGl2ZVZvaWNlQ291bnQgPSBNYXRoLm1heCgwLCB0aGlzLmFjdGl2ZVZvaWNlQ291bnQgLSAxKTsNCiAgICAgICAgICAgIHZvaWNlLmVudlN0YWdlID0gNDsgLy8gdHJpZ2dlciByZWxlYXNlDQogICAgICAgICAgICB2b2ljZS5maWx0ZXJFbnZTdGFnZSA9IDQ7DQogICAgICAgICAgICB2b2ljZS5waXRjaEVudlN0YWdlID0gNDsNCiAgICAgICAgfQ0KICAgIH0NCg0KICAgIC8vIOKUgOKUgCBBRFNSIHBlciBzYW1wbGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSADQogICAgcHJvY2Vzc0VudmVsb3BlKHZvaWNlKSB7DQogICAgICAgIHN3aXRjaCAodm9pY2UuZW52U3RhZ2UpIHsNCiAgICAgICAgICAgIGNhc2UgMTogLy8gQXR0YWNrDQogICAgICAgICAgICAgICAgdm9pY2UuZW52VmFsdWUgKz0gdm9pY2UuZW52QXR0YWNrUmF0ZTsNCiAgICAgICAgICAgICAgICBpZiAodm9pY2UuZW52VmFsdWUgPj0gMS4wKSB7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmVudlZhbHVlID0gMS4wOw0KICAgICAgICAgICAgICAgICAgICB2b2ljZS5lbnZTdGFnZSA9IDI7IC8vIG1vdmUgdG8gZGVjYXkNCiAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgYnJlYWs7DQogICAgICAgICAgICBjYXNlIDI6IC8vIERlY2F5DQogICAgICAgICAgICAgICAgdm9pY2UuZW52VmFsdWUgLT0gdm9pY2UuZW52RGVjYXlSYXRlOw0KICAgICAgICAgICAgICAgIGlmICh2b2ljZS5lbnZWYWx1ZSA8PSB2b2ljZS5lbnZTdXN0YWluTGV2ZWwpIHsNCiAgICAgICAgICAgICAgICAgICAgdm9pY2UuZW52VmFsdWUgPSB2b2ljZS5lbnZTdXN0YWluTGV2ZWw7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmVudlN0YWdlID0gMzsgLy8gaG9sZCBhdCBzdXN0YWluDQogICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgIGJyZWFrOw0KICAgICAgICAgICAgY2FzZSAzOiAvLyBTdXN0YWluDQogICAgICAgICAgICAgICAgLy8gTm90aGluZyDigJQgaG9sZCBhdCBzdXN0YWluIGxldmVsIHVudGlsIG5vdGVPZmYNCiAgICAgICAgICAgICAgICBicmVhazsNCiAgICAgICAgICAgIGNhc2UgNDogLy8gUmVsZWFzZQ0KICAgICAgICAgICAgICAgIHZvaWNlLmVudlZhbHVlIC09IHZvaWNlLmVudlJlbGVhc2VSYXRlOw0KICAgICAgICAgICAgICAgIGlmICh2b2ljZS5lbnZWYWx1ZSA8PSAwKSB7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmVudlZhbHVlID0gMDsNCiAgICAgICAgICAgICAgICAgICAgdm9pY2UuZW52U3RhZ2UgPSAwOw0KICAgICAgICAgICAgICAgICAgICB2b2ljZS5hY3RpdmUgPSBmYWxzZTsgLy8gdm9pY2UgaXMgZnJlZSBhZ2Fpbg0KICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICBicmVhazsNCiAgICAgICAgICAgIGRlZmF1bHQ6DQogICAgICAgICAgICAgICAgdm9pY2UuZW52VmFsdWUgPSAwOw0KICAgICAgICB9DQogICAgICAgIHJldHVybiB2b2ljZS5lbnZWYWx1ZTsNCiAgICB9DQoNCiAgICBwcm9jZXNzRmlsdGVyRW52ZWxvcGUodm9pY2UpIHsNCiAgICAgICAgc3dpdGNoICh2b2ljZS5maWx0ZXJFbnZTdGFnZSkgew0KICAgICAgICAgICAgY2FzZSAxOiAvLyBBdHRhY2sNCiAgICAgICAgICAgICAgICB2b2ljZS5maWx0ZXJFbnZWYWx1ZSArPSB2b2ljZS5maWx0ZXJFbnZBdHRhY2tSYXRlOw0KICAgICAgICAgICAgICAgIGlmICh2b2ljZS5maWx0ZXJFbnZWYWx1ZSA+PSAxLjApIHsNCiAgICAgICAgICAgICAgICAgICAgdm9pY2UuZmlsdGVyRW52VmFsdWUgPSAxLjA7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmZpbHRlckVudlN0YWdlID0gMjsNCiAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgYnJlYWs7DQogICAgICAgICAgICBjYXNlIDI6IC8vIERlY2F5DQogICAgICAgICAgICAgICAgdm9pY2UuZmlsdGVyRW52VmFsdWUgLT0gdm9pY2UuZmlsdGVyRW52RGVjYXlSYXRlOw0KICAgICAgICAgICAgICAgIGlmICh2b2ljZS5maWx0ZXJFbnZWYWx1ZSA8PSB2b2ljZS5maWx0ZXJFbnZTdXN0YWluTGV2ZWwpIHsNCiAgICAgICAgICAgICAgICAgICAgdm9pY2UuZmlsdGVyRW52VmFsdWUgPSB2b2ljZS5maWx0ZXJFbnZTdXN0YWluTGV2ZWw7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmZpbHRlckVudlN0YWdlID0gMzsNCiAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgYnJlYWs7DQogICAgICAgICAgICBjYXNlIDM6IC8vIFN1c3RhaW4NCiAgICAgICAgICAgICAgICBicmVhazsNCiAgICAgICAgICAgIGNhc2UgNDogLy8gUmVsZWFzZQ0KICAgICAgICAgICAgICAgIHZvaWNlLmZpbHRlckVudlZhbHVlIC09IHZvaWNlLmZpbHRlckVudlJlbGVhc2VSYXRlOw0KICAgICAgICAgICAgICAgIGlmICh2b2ljZS5maWx0ZXJFbnZWYWx1ZSA8PSAwKSB7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmZpbHRlckVudlZhbHVlID0gMDsNCiAgICAgICAgICAgICAgICAgICAgdm9pY2UuZmlsdGVyRW52U3RhZ2UgPSAwOw0KICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICBicmVhazsNCiAgICAgICAgICAgIGRlZmF1bHQ6DQogICAgICAgICAgICAgICAgdm9pY2UuZmlsdGVyRW52VmFsdWUgPSAwOw0KICAgICAgICB9DQogICAgICAgIHJldHVybiB2b2ljZS5maWx0ZXJFbnZWYWx1ZTsNCiAgICB9DQoNCiAgICBwcm9jZXNzUGl0Y2hFbnZlbG9wZSh2b2ljZSkgew0KICAgICAgc3dpdGNoICh2b2ljZS5waXRjaEVudlN0YWdlKSB7DQogICAgICAgIGNhc2UgMTogLy8gQXR0YWNrDQogICAgICAgICAgdm9pY2UucGl0Y2hFbnZWYWx1ZSArPSB2b2ljZS5waXRjaEVudkF0dGFja1JhdGU7DQogICAgICAgICAgaWYgKHZvaWNlLnBpdGNoRW52VmFsdWUgPj0gMS4wKSB7DQogICAgICAgICAgICB2b2ljZS5waXRjaEVudlZhbHVlID0gMS4wOw0KICAgICAgICAgICAgdm9pY2UucGl0Y2hFbnZTdGFnZSA9IDI7DQogICAgICAgICAgfQ0KICAgICAgICAgIGJyZWFrOw0KICAgICAgICBjYXNlIDI6IC8vIERlY2F5DQogICAgICAgICAgdm9pY2UucGl0Y2hFbnZWYWx1ZSAtPSB2b2ljZS5waXRjaEVudkRlY2F5UmF0ZTsNCiAgICAgICAgICBpZiAodm9pY2UucGl0Y2hFbnZWYWx1ZSA8PSB2b2ljZS5waXRjaEVudlN1c3RhaW5MZXZlbCkgew0KICAgICAgICAgICAgdm9pY2UucGl0Y2hFbnZWYWx1ZSA9IHZvaWNlLnBpdGNoRW52U3VzdGFpbkxldmVsOw0KICAgICAgICAgICAgdm9pY2UucGl0Y2hFbnZTdGFnZSA9IDM7DQogICAgICAgICAgfQ0KICAgICAgICAgIGJyZWFrOw0KICAgICAgICBjYXNlIDM6IC8vIFN1c3RhaW4NCiAgICAgICAgICBicmVhazsNCiAgICAgICAgY2FzZSA0OiAvLyBSZWxlYXNlDQogICAgICAgICAgdm9pY2UucGl0Y2hFbnZWYWx1ZSAtPSB2b2ljZS5waXRjaEVudlJlbGVhc2VSYXRlOw0KICAgICAgICAgIGlmICh2b2ljZS5waXRjaEVudlZhbHVlIDw9IDApIHsNCiAgICAgICAgICAgIHZvaWNlLnBpdGNoRW52VmFsdWUgPSAwOw0KICAgICAgICAgICAgdm9pY2UucGl0Y2hFbnZTdGFnZSA9IDA7DQogICAgICAgICAgfQ0KICAgICAgICAgIGJyZWFrOw0KICAgICAgICBkZWZhdWx0Og0KICAgICAgICAgIHZvaWNlLnBpdGNoRW52VmFsdWUgPSAwOw0KICAgICAgfQ0KICAgICAgcmV0dXJuIHZvaWNlLnBpdGNoRW52VmFsdWU7DQogICAgfQ0KDQogICAgLy8g4pSA4pSAIE1haW4gRFNQIGxvb3Ag4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSADQogICAgLy8gQ2FsbGVkIGV2ZXJ5IDEyOCBzYW1wbGVzICh+M21zIGF0IDQ0MTAwaHopLiBNdXN0IGNvbXBsZXRlIGZhc3QuDQogICAgcHJvY2VzcyhpbnB1dHMsIG91dHB1dHMpIHsNCiAgICAgICAgY29uc3Qgb3V0cHV0ID0gb3V0cHV0c1swXTsNCiAgICAgICAgY29uc3QgbGVmdCA9IG91dHB1dFswXTsNCiAgICAgICAgY29uc3QgcmlnaHQgPSBvdXRwdXRbMV07DQoNCiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZWZ0Lmxlbmd0aDsgaSsrKSB7DQogICAgICAgICAgICBsZXQgc2FtcGxlTCA9IDA7DQogICAgICAgICAgICBsZXQgc2FtcGxlUiA9IDA7DQoNCiAgICAgICAgICAgIC8vIEFkdmFuY2UgTEZPDQogICAgICAgICAgICB0aGlzLmxmb1BoYXNlICs9IHRoaXMubGZvUGhhc2VJbmNyZW1lbnQ7DQogICAgICAgICAgICBpZiAodGhpcy5sZm9QaGFzZSA+PSAxLjApIHRoaXMubGZvUGhhc2UgLT0gMS4wOw0KICAgICAgICAgICAgY29uc3QgbGZvVmFsdWUgPSBnZXRMRk9TYW1wbGUodGhpcy5sZm9QaGFzZSwgdGhpcy5wYXJhbXMubGZvV2F2ZWZvcm0pICogdGhpcy5wYXJhbXMubGZvRGVwdGg7DQoNCiAgICAgICAgICAgIGZvciAobGV0IHYgPSAwOyB2IDwgTUFYX1ZPSUNFUzsgdisrKSB7DQogICAgICAgICAgICAgICAgY29uc3Qgdm9pY2UgPSB0aGlzLnZvaWNlc1t2XTsNCiAgICAgICAgICAgICAgICBpZiAoIXZvaWNlLmFjdGl2ZSkgY29udGludWU7DQoNCiAgICAgICAgICAgICAgICAvLyBBcHBseSBMRk8gbW9kdWxhdGlvbiB0byBkZXN0aW5hdGlvbg0KICAgICAgICAgICAgICAgIGxldCBsZm9GcmVxTW9kID0gMS4wOw0KICAgICAgICAgICAgICAgIGxldCBsZm9GaWx0ZXJNb2QgPSAwLjA7DQogICAgICAgICAgICAgICAgbGV0IGxmb1ZvbHVtZU1vZCA9IDEuMDsNCiAgICAgICAgICAgICAgICBsZXQgbGZvUGFuTW9kID0gMC4wOw0KDQogICAgICAgICAgICAgICAgc3dpdGNoICh0aGlzLnBhcmFtcy5sZm9EZXN0aW5hdGlvbikgew0KICAgICAgICAgICAgICAgICAgICBjYXNlICdwaXRjaCc6DQogICAgICAgICAgICAgICAgICAgICAgICAvLyBMRk8gbW9kdWxhdGVzIHBpdGNoIOKAlCDCsTEgc2VtaXRvbmUgYXQgZnVsbCBkZXB0aA0KICAgICAgICAgICAgICAgICAgICAgICAgbGZvRnJlcU1vZCA9IE1hdGgucG93KDIsIGxmb1ZhbHVlIC8gMTIpOw0KICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7DQogICAgICAgICAgICAgICAgICAgIGNhc2UgJ2ZpbHRlcic6DQogICAgICAgICAgICAgICAgICAgICAgICAvLyBMRk8gbW9kdWxhdGVzIGZpbHRlciBjdXRvZmYg4oCUIGFkZHMgZGlyZWN0bHkgdG8gY3V0b2ZmDQogICAgICAgICAgICAgICAgICAgICAgICBsZm9GaWx0ZXJNb2QgPSBsZm9WYWx1ZSAqIDAuMzsNCiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrOw0KICAgICAgICAgICAgICAgICAgICBjYXNlICd2b2x1bWUnOg0KICAgICAgICAgICAgICAgICAgICAgICAgLy8gTEZPIG1vZHVsYXRlcyBhbXBsaXR1ZGUNCiAgICAgICAgICAgICAgICAgICAgICAgIGxmb1ZvbHVtZU1vZCA9IDEuMCArIGxmb1ZhbHVlICogMC41Ow0KICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7DQogICAgICAgICAgICAgICAgICAgIGNhc2UgJ3Bhbic6DQogICAgICAgICAgICAgICAgICAgICAgICAvLyBMRk8gbW9kdWxhdGVzIHN0ZXJlbyBwYW4gcG9zaXRpb24NCiAgICAgICAgICAgICAgICAgICAgICAgIGxmb1Bhbk1vZCA9IGxmb1ZhbHVlOw0KICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7DQogICAgICAgICAgICAgICAgfQ0KDQogICAgICAgICAgICAgICAgY29uc3QgdW5pc29uQ291bnQgPSBNYXRoLm1heCgxLCBNYXRoLmZsb29yKHRoaXMucGFyYW1zLnVuaXNvblZvaWNlcykpOw0KICAgICAgICAgICAgICAgIGNvbnN0IGJlbmRNb2QgPSBNYXRoLnBvdygyLCB0aGlzLnBhcmFtcy5waXRjaEJlbmQgLyAxMik7DQoNCiAgICAgICAgICAgICAgICAvLyBQaXRjaCBlbnZlbG9wZSBtb2R1bGF0aW9uDQogICAgICAgICAgICAgICAgY29uc3QgcGl0Y2hFbnYgPSB0aGlzLnByb2Nlc3NQaXRjaEVudmVsb3BlKHZvaWNlKTsNCiAgICAgICAgICAgICAgICBjb25zdCBwaXRjaEVudk1vZCA9IE1hdGgucG93KDIsIChwaXRjaEVudiAqIHRoaXMucGFyYW1zLnBpdGNoRW52QW1vdW50KSAvIDEyKTsNCg0KICAgICAgICAgICAgICAgIC8vIFBXTSDigJQgTEZPIG1vZHVsYXRlcyBwdWxzZSB3aWR0aCB3aGVuIGRlcHRoID4gMA0KICAgICAgICAgICAgICAgIC8vIGxmb1ZhbHVlIGlzIGFscmVhZHkgY2FsY3VsYXRlZCBhYm92ZSBhcyAtMSB0byArMQ0KICAgICAgICAgICAgICAgIGNvbnN0IHB3MSA9IE1hdGgubWF4KDAuMSwgTWF0aC5taW4oMC45LA0KICAgICAgICAgICAgICAgICAgdGhpcy5wYXJhbXMub3NjMVB1bHNlV2lkdGggKyBsZm9WYWx1ZSAqIHRoaXMucGFyYW1zLm9zYzFQV01EZXB0aCAqIDAuNA0KICAgICAgICAgICAgICAgICkpOw0KICAgICAgICAgICAgICAgIGNvbnN0IHB3MiA9IE1hdGgubWF4KDAuMSwgTWF0aC5taW4oMC45LA0KICAgICAgICAgICAgICAgICAgdGhpcy5wYXJhbXMub3NjMlB1bHNlV2lkdGggKyBsZm9WYWx1ZSAqIHRoaXMucGFyYW1zLm9zYzJQV01EZXB0aCAqIDAuNA0KICAgICAgICAgICAgICAgICkpOw0KICAgICAgICAgICAgICAgIGNvbnN0IHB3MyA9IE1hdGgubWF4KDAuMSwgTWF0aC5taW4oMC45LA0KICAgICAgICAgICAgICAgICAgdGhpcy5wYXJhbXMub3NjM1B1bHNlV2lkdGggKyBsZm9WYWx1ZSAqIHRoaXMucGFyYW1zLm9zYzNQV01EZXB0aCAqIDAuNA0KICAgICAgICAgICAgICAgICkpOw0KDQogICAgICAgICAgICAgICAgLy8gQWR2YW5jZSBwb3J0YW1lbnRvIGdsaWRlDQogICAgICAgICAgICAgICAgaWYgKHZvaWNlLmdsaWRlUmF0ZSA+IDAgJiYgdm9pY2UuY3VycmVudEZyZXEgIT09IHZvaWNlLnRhcmdldEZyZXEpIHsNCiAgICAgICAgICAgICAgICAgIC8vIE1vdmUgY3VycmVudCBmcmVxdWVuY3kgdG93YXJkIHRhcmdldCBpbiBzZW1pdG9uZSBzcGFjZQ0KICAgICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFNlbWl0b25lcyA9IDEyICogTWF0aC5sb2cyKHZvaWNlLmN1cnJlbnRGcmVxKTsNCiAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldFNlbWl0b25lcyA9IDEyICogTWF0aC5sb2cyKHZvaWNlLnRhcmdldEZyZXEpOw0KICAgICAgICAgICAgICAgICAgY29uc3QgZGlmZiA9IHRhcmdldFNlbWl0b25lcyAtIGN1cnJlbnRTZW1pdG9uZXM7DQogICAgICAgICAgICAgICAgICBjb25zdCBzdGVwID0gdm9pY2UuZ2xpZGVSYXRlICogTWF0aC5zaWduKGRpZmYpOw0KDQogICAgICAgICAgICAgICAgICBpZiAoTWF0aC5hYnMoZGlmZikgPD0gTWF0aC5hYnMoc3RlcCkpIHsNCiAgICAgICAgICAgICAgICAgICAgLy8gQ2xvc2UgZW5vdWdoIOKAlCBzbmFwIHRvIHRhcmdldA0KICAgICAgICAgICAgICAgICAgICB2b2ljZS5jdXJyZW50RnJlcSA9IHZvaWNlLnRhcmdldEZyZXE7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmdsaWRlUmF0ZSA9IDA7DQogICAgICAgICAgICAgICAgICB9IGVsc2Ugew0KICAgICAgICAgICAgICAgICAgICB2b2ljZS5jdXJyZW50RnJlcSA9IE1hdGgucG93KDIsIChjdXJyZW50U2VtaXRvbmVzICsgc3RlcCkgLyAxMik7DQogICAgICAgICAgICAgICAgICB9DQoNCiAgICAgICAgICAgICAgICAgIC8vIFJlY2FsY3VsYXRlIGJhc2UgcGhhc2UgaW5jcmVtZW50cyBmcm9tIGN1cnJlbnQgZ2xpZGluZyBmcmVxdWVuY3kNCiAgICAgICAgICAgICAgICAgIHZvaWNlLm9zYzEucGhhc2VJbmNyZW1lbnQgPSAodm9pY2UuY3VycmVudEZyZXEgKiBNYXRoLnBvdygyLCAodGhpcy5wYXJhbXMub3NjMUNvYXJzZSArIHRoaXMucGFyYW1zLm9zYzFGaW5lIC8gMTAwKSAvIDEyKSkgLyBzYW1wbGVSYXRlOw0KICAgICAgICAgICAgICAgICAgdm9pY2Uub3NjMi5waGFzZUluY3JlbWVudCA9ICh2b2ljZS5jdXJyZW50RnJlcSAqIE1hdGgucG93KDIsICh0aGlzLnBhcmFtcy5vc2MyQ29hcnNlICsgdGhpcy5wYXJhbXMub3NjMkZpbmUgLyAxMDApIC8gMTIpKSAvIHNhbXBsZVJhdGU7DQogICAgICAgICAgICAgICAgICB2b2ljZS5vc2MzLnBoYXNlSW5jcmVtZW50ID0gKHZvaWNlLmN1cnJlbnRGcmVxICogTWF0aC5wb3coMiwgKHRoaXMucGFyYW1zLm9zYzNDb2Fyc2UgKyB0aGlzLnBhcmFtcy5vc2MzRmluZSAvIDEwMCkgLyAxMikpIC8gc2FtcGxlUmF0ZTsNCg0KICAgICAgICAgICAgICAgICAgLy8gUmVjYWxjdWxhdGUgdW5pc29uIHBoYXNlIGluY3JlbWVudHMgZnJvbSB1cGRhdGVkIGJhc2UgaW5jcmVtZW50cw0KICAgICAgICAgICAgICAgICAgY29uc3QgdW5pc29uQ291bnQgPSBNYXRoLm1heCgxLCBNYXRoLmZsb29yKHRoaXMucGFyYW1zLnVuaXNvblZvaWNlcykpOw0KICAgICAgICAgICAgICAgICAgZm9yIChsZXQgdSA9IDA7IHUgPCA4OyB1KyspIHsNCiAgICAgICAgICAgICAgICAgICAgaWYgKHVuaXNvbkNvdW50ID09PSAxKSB7DQogICAgICAgICAgICAgICAgICAgICAgdm9pY2UudW5pc29uT3NjMVt1XS5waGFzZUluY3JlbWVudCA9IHZvaWNlLm9zYzEucGhhc2VJbmNyZW1lbnQ7DQogICAgICAgICAgICAgICAgICAgICAgdm9pY2UudW5pc29uT3NjMlt1XS5waGFzZUluY3JlbWVudCA9IHZvaWNlLm9zYzIucGhhc2VJbmNyZW1lbnQ7DQogICAgICAgICAgICAgICAgICAgICAgdm9pY2UudW5pc29uT3NjM1t1XS5waGFzZUluY3JlbWVudCA9IHZvaWNlLm9zYzMucGhhc2VJbmNyZW1lbnQ7DQogICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7DQogICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ByZWFkID0gdSAvICh1bmlzb25Db3VudCAtIDEpOw0KICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRldHVuZUNlbnRzID0gKHNwcmVhZCAtIDAuNSkgKiAyICogdGhpcy5wYXJhbXMudW5pc29uRGV0dW5lOw0KICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRldHVuZVJhdGlvID0gTWF0aC5wb3coMiwgZGV0dW5lQ2VudHMgLyAxMjAwKTsNCiAgICAgICAgICAgICAgICAgICAgICB2b2ljZS51bmlzb25Pc2MxW3VdLnBoYXNlSW5jcmVtZW50ID0gdm9pY2Uub3NjMS5waGFzZUluY3JlbWVudCAqIGRldHVuZVJhdGlvOw0KICAgICAgICAgICAgICAgICAgICAgIHZvaWNlLnVuaXNvbk9zYzJbdV0ucGhhc2VJbmNyZW1lbnQgPSB2b2ljZS5vc2MyLnBoYXNlSW5jcmVtZW50ICogZGV0dW5lUmF0aW87DQogICAgICAgICAgICAgICAgICAgICAgdm9pY2UudW5pc29uT3NjM1t1XS5waGFzZUluY3JlbWVudCA9IHZvaWNlLm9zYzMucGhhc2VJbmNyZW1lbnQgKiBkZXR1bmVSYXRpbzsNCiAgICAgICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgIH0NCg0KICAgICAgICAgICAgICAgIGxldCBzaWcxTCA9IDAsIHNpZzFSID0gMDsNCiAgICAgICAgICAgICAgICBsZXQgc2lnMkwgPSAwLCBzaWcyUiA9IDA7DQogICAgICAgICAgICAgICAgbGV0IHNpZzNMID0gMCwgc2lnM1IgPSAwOw0KDQogICAgICAgICAgICAgICAgZm9yIChsZXQgdSA9IDA7IHUgPCB1bmlzb25Db3VudDsgdSsrKSB7DQogICAgICAgICAgICAgICAgICAvLyBDYWxjdWxhdGUgc3RlcmVvIHBvc2l0aW9uIGZvciB0aGlzIHVuaXNvbiBjb3B5DQogICAgICAgICAgICAgICAgICAvLyBGaXJzdCBjb3B5IHBhbnMgbGVmdCwgbGFzdCBjb3B5IHBhbnMgcmlnaHQsIG1pZGRsZSBjb3BpZXMgc3ByZWFkIGJldHdlZW4NCiAgICAgICAgICAgICAgICAgIGNvbnN0IHVuaXNvblBhbiA9IHVuaXNvbkNvdW50ID09PSAxDQogICAgICAgICAgICAgICAgICAgID8gMA0KICAgICAgICAgICAgICAgICAgICA6ICh1IC8gKHVuaXNvbkNvdW50IC0gMSkgLSAwLjUpICogMiAqIHRoaXMucGFyYW1zLnVuaXNvblNwcmVhZDsNCg0KICAgICAgICAgICAgICAgICAgLy8gT1NDIDENCiAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBhcmFtcy5vc2MxRW5hYmxlZCkgew0KICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmMxID0gdm9pY2UudW5pc29uT3NjMVt1XS5waGFzZUluY3JlbWVudCAqIGxmb0ZyZXFNb2QgKiBiZW5kTW9kICogcGl0Y2hFbnZNb2Q7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLnVuaXNvbk9zYzFbdV0ucGhhc2UgKz0gaW5jMTsNCiAgICAgICAgICAgICAgICAgICAgaWYgKHZvaWNlLnVuaXNvbk9zYzFbdV0ucGhhc2UgPj0gMS4wKSB2b2ljZS51bmlzb25Pc2MxW3VdLnBoYXNlIC09IDEuMDsNCiAgICAgICAgICAgICAgICAgICAgY29uc3QgczEgPSBnZXRPc2NTYW1wbGUodm9pY2UudW5pc29uT3NjMVt1XS5waGFzZSwgaW5jMSwgdGhpcy5wYXJhbXMub3NjMVdhdmVmb3JtLCBwdzEpOw0KICAgICAgICAgICAgICAgICAgICBjb25zdCBbbDEsIHIxXSA9IHBhbkdhaW5zKHRoaXMucGFyYW1zLm9zYzFQYW4gKyB1bmlzb25QYW4gKyBsZm9QYW5Nb2QpOw0KICAgICAgICAgICAgICAgICAgICBzaWcxTCArPSBzMSAqIGwxOw0KICAgICAgICAgICAgICAgICAgICBzaWcxUiArPSBzMSAqIHIxOw0KICAgICAgICAgICAgICAgICAgfQ0KDQogICAgICAgICAgICAgICAgICAvLyBPU0MgMg0KICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGFyYW1zLm9zYzJFbmFibGVkKSB7DQogICAgICAgICAgICAgICAgICAgIGNvbnN0IGluYzIgPSB2b2ljZS51bmlzb25Pc2MyW3VdLnBoYXNlSW5jcmVtZW50ICogbGZvRnJlcU1vZCAqIGJlbmRNb2QgKiBwaXRjaEVudk1vZDsNCiAgICAgICAgICAgICAgICAgICAgdm9pY2UudW5pc29uT3NjMlt1XS5waGFzZSArPSBpbmMyOw0KICAgICAgICAgICAgICAgICAgICBpZiAodm9pY2UudW5pc29uT3NjMlt1XS5waGFzZSA+PSAxLjApIHZvaWNlLnVuaXNvbk9zYzJbdV0ucGhhc2UgLT0gMS4wOw0KICAgICAgICAgICAgICAgICAgICBjb25zdCBzMiA9IGdldE9zY1NhbXBsZSh2b2ljZS51bmlzb25Pc2MyW3VdLnBoYXNlLCBpbmMyLCB0aGlzLnBhcmFtcy5vc2MyV2F2ZWZvcm0sIHB3Mik7DQogICAgICAgICAgICAgICAgICAgIGNvbnN0IFtsMiwgcjJdID0gcGFuR2FpbnModGhpcy5wYXJhbXMub3NjMlBhbiArIHVuaXNvblBhbiArIGxmb1Bhbk1vZCk7DQogICAgICAgICAgICAgICAgICAgIHNpZzJMICs9IHMyICogbDI7DQogICAgICAgICAgICAgICAgICAgIHNpZzJSICs9IHMyICogcjI7DQogICAgICAgICAgICAgICAgICB9DQoNCiAgICAgICAgICAgICAgICAgIC8vIE9TQyAzDQogICAgICAgICAgICAgICAgICBpZiAodGhpcy5wYXJhbXMub3NjM0VuYWJsZWQpIHsNCiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5jMyA9IHZvaWNlLnVuaXNvbk9zYzNbdV0ucGhhc2VJbmNyZW1lbnQgKiBsZm9GcmVxTW9kICogYmVuZE1vZCAqIHBpdGNoRW52TW9kOw0KICAgICAgICAgICAgICAgICAgICB2b2ljZS51bmlzb25Pc2MzW3VdLnBoYXNlICs9IGluYzM7DQogICAgICAgICAgICAgICAgICAgIGlmICh2b2ljZS51bmlzb25Pc2MzW3VdLnBoYXNlID49IDEuMCkgdm9pY2UudW5pc29uT3NjM1t1XS5waGFzZSAtPSAxLjA7DQogICAgICAgICAgICAgICAgICAgIGNvbnN0IHMzID0gZ2V0T3NjU2FtcGxlKHZvaWNlLnVuaXNvbk9zYzNbdV0ucGhhc2UsIGluYzMsIHRoaXMucGFyYW1zLm9zYzNXYXZlZm9ybSwgcHczKTsNCiAgICAgICAgICAgICAgICAgICAgY29uc3QgW2wzLCByM10gPSBwYW5HYWlucyh0aGlzLnBhcmFtcy5vc2MzUGFuICsgdW5pc29uUGFuICsgbGZvUGFuTW9kKTsNCiAgICAgICAgICAgICAgICAgICAgc2lnM0wgKz0gczMgKiBsMzsNCiAgICAgICAgICAgICAgICAgICAgc2lnM1IgKz0gczMgKiByMzsNCiAgICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICB9DQoNCiAgICAgICAgICAgICAgICAvLyBFbnZlbG9wZQ0KICAgICAgICAgICAgICAgIGNvbnN0IHZlbEFtcCA9IDEuMCAtIHRoaXMucGFyYW1zLnZlbG9jaXR5QW1wU2VucyAqICgxLjAgLSB2b2ljZS52ZWxvY2l0eSk7DQogICAgICAgICAgICAgICAgY29uc3QgZW52ID0gdGhpcy5wcm9jZXNzRW52ZWxvcGUodm9pY2UpICogbGZvVm9sdW1lTW9kICogdmVsQW1wOw0KDQogICAgICAgICAgICAgICAgLy8gUHJvY2VzcyBmaWx0ZXIgZW52ZWxvcGUNCiAgICAgICAgICAgICAgICBjb25zdCBmaWx0ZXJFbnYgPSB0aGlzLnByb2Nlc3NGaWx0ZXJFbnZlbG9wZSh2b2ljZSk7DQoNCiAgICAgICAgICAgICAgICAvLyBNb2R1bGF0ZSBjdXRvZmYg4oCUIGJhc2UgY3V0b2ZmICsgZW52ZWxvcGUgYW1vdW50ICogZW52ZWxvcGUgdmFsdWUNCiAgICAgICAgICAgICAgICAvLyBDbGFtcGVkIHRvIDAtMSB0byBzdGF5IGluIHZhbGlkIGZpbHRlciByYW5nZQ0KICAgICAgICAgICAgICAgIGNvbnN0IHZlbEZpbHRlckJvb3N0ID0gdm9pY2UudmVsb2NpdHkgKiB0aGlzLnBhcmFtcy52ZWxvY2l0eUZpbHRlclNlbnMgKiAwLjM7DQogICAgICAgICAgICAgICAgY29uc3QgbW9kdWxhdGVkQ3V0b2ZmID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwNCiAgICAgICAgICAgICAgICAgICAgdm9pY2UuZmlsdGVyQ3V0b2ZmICsgKGZpbHRlckVudiAqIHRoaXMucGFyYW1zLmZpbHRlckVudkFtb3VudCkgKyBsZm9GaWx0ZXJNb2QgKyB2ZWxGaWx0ZXJCb29zdA0KICAgICAgICAgICAgICAgICkpOw0KDQogICAgICAgICAgICAgICAgLy8gVGVtcG9yYXJpbHkgb3ZlcnJpZGUgdm9pY2UgY3V0b2ZmIGZvciB0aGlzIHNhbXBsZQ0KICAgICAgICAgICAgICAgIGNvbnN0IHNhdmVkQ3V0b2ZmID0gdm9pY2UuZmlsdGVyQ3V0b2ZmOw0KICAgICAgICAgICAgICAgIHZvaWNlLmZpbHRlckN1dG9mZiA9IG1vZHVsYXRlZEN1dG9mZjsNCg0KICAgICAgICAgICAgICAgIC8vIE5vcm1hbGl6ZSBieSB1bmlzb24gY291bnQgdG8gcHJldmVudCB2b2x1bWUgaW5jcmVhc2Ugd2l0aCBtb3JlIHZvaWNlcw0KICAgICAgICAgICAgICAgIGNvbnN0IHVuaXNvbk5vcm0gPSAxLjAgLyBNYXRoLnNxcnQodW5pc29uQ291bnQpOw0KDQogICAgICAgICAgICAgICAgLy8gTWl4IGFsbCBvc2NpbGxhdG9ycw0KICAgICAgICAgICAgICAgIGxldCBtaXhMID0gKHNpZzFMICogdGhpcy5wYXJhbXMub3NjMU1peCArDQogICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnMkwgKiB0aGlzLnBhcmFtcy5vc2MyTWl4ICsNCiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWczTCAqIHRoaXMucGFyYW1zLm9zYzNNaXgpICogdW5pc29uTm9ybTsNCiAgICAgICAgICAgICAgICBsZXQgbWl4UiA9IChzaWcxUiAqIHRoaXMucGFyYW1zLm9zYzFNaXggKw0KICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZzJSICogdGhpcy5wYXJhbXMub3NjMk1peCArDQogICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnM1IgKiB0aGlzLnBhcmFtcy5vc2MzTWl4KSAqIHVuaXNvbk5vcm07DQoNCiAgICAgICAgICAgICAgICAvLyBBcHBseSBlbnZlbG9wZSBhbmQgZmlsdGVyIHBlciBjaGFubmVsDQogICAgICAgICAgICAgICAgbWl4TCA9IG1vb2dGaWx0ZXIodm9pY2UsIG1peEwgKiBlbnYsICdMJyk7DQogICAgICAgICAgICAgICAgbWl4UiA9IG1vb2dGaWx0ZXIodm9pY2UsIG1peFIgKiBlbnYsICdSJyk7DQoNCiAgICAgICAgICAgICAgICAvLyBSZXN0b3JlIGJhc2UgY3V0b2ZmDQogICAgICAgICAgICAgICAgdm9pY2UuZmlsdGVyQ3V0b2ZmID0gc2F2ZWRDdXRvZmY7DQoNCiAgICAgICAgICAgICAgICBzYW1wbGVMICs9IG1peEw7DQogICAgICAgICAgICAgICAgc2FtcGxlUiArPSBtaXhSOw0KICAgICAgICAgICAgfQ0KDQogICAgICAgICAgICBjb25zdCBvdXRMID0gKHNhbXBsZUwgLyBNQVhfVk9JQ0VTKSAqIHRoaXMucGFyYW1zLm1hc3RlckdhaW47DQogICAgICAgICAgICBjb25zdCBvdXRSID0gKHNhbXBsZVIgLyBNQVhfVk9JQ0VTKSAqIHRoaXMucGFyYW1zLm1hc3RlckdhaW47DQoNCiAgICAgICAgICAgIC8vIE1pZC1zaWRlIHN0ZXJlbyB3aWR0aA0KICAgICAgICAgICAgY29uc3QgbWlkICA9IChvdXRMICsgb3V0UikgKiAwLjU7DQogICAgICAgICAgICBjb25zdCBzaWRlID0gKG91dEwgLSBvdXRSKSAqIDAuNSAqIHRoaXMucGFyYW1zLnN0ZXJlb1dpZHRoOw0KDQogICAgICAgICAgICBsZWZ0W2ldICA9IE1hdGgudGFuaChtaWQgKyBzaWRlKTsNCiAgICAgICAgICAgIHJpZ2h0W2ldID0gTWF0aC50YW5oKG1pZCAtIHNpZGUpOw0KICAgICAgICB9DQoNCiAgICAgICAgcmV0dXJuIHRydWU7DQogICAgfQ0KfQ0KDQpyZWdpc3RlclByb2Nlc3Nvcignb2JzaWRpYW4tcHJvY2Vzc29yJywgT2JzaWRpYW5Qcm9jZXNzb3IpOw==", "" + import.meta.url));
		this.audioNode = new AudioWorkletNode(this.audioContext, "obsidian-processor", {
			numberOfInputs: 0,
			numberOfOutputs: 1,
			outputChannelCount: [2]
		});
		return this.audioNode;
	}
	noteOn(note, velocity = 100) {
		this.audioNode.port.postMessage({
			type: "noteOn",
			data: {
				note,
				velocity
			}
		});
	}
	noteOff(note) {
		this.audioNode.port.postMessage({
			type: "noteOff",
			data: { note }
		});
	}
	setParam(key, value) {
		if (this._paramState) this._paramState[key] = value;
		this.audioNode.port.postMessage({
			type: "setParam",
			data: {
				key,
				value
			}
		});
	}
	getState() {
		return { ...this._paramState };
	}
	async setState(state) {
		Object.entries(state).forEach(([key, value]) => this.setParam(key, value));
	}
	async createGUI() {
		const { mountGUI } = await import("./ObsidianGUI.js");
		const container = document.createElement("div");
		container.style.width = "660px";
		container.style.background = "#131010";
		mountGUI(container, this);
		return container;
	}
};
//#endregion
export { ObsidianWAM as default };
