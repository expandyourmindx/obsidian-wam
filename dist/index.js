import { t as DEFAULT_PARAMS } from "./defaultPresets.js";
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
		await this.audioContext.audioWorklet.addModule(new URL("data:text/javascript;base64,Ly8gc3JjL3Byb2Nlc3Nvci5qcw0KLy8gT2JzaWRpYW4gV0FNIOKAlCBBdWRpb1dvcmtsZXQgUHJvY2Vzc29yDQovLyBSdW5zIG9uIHRoZSBhdWRpbyB0aHJlYWQuIE5vIGFsbG9jYXRpb25zLCBubyBtYWluIHRocmVhZCBhY2Nlc3MuDQoNCmNvbnN0IFNBTVBMRV9SQVRFID0gNDQxMDA7DQpjb25zdCBNQVhfVk9JQ0VTID0gODsNCg0KLy8g4pSA4pSAIFBvbHlCTEVQIGhlbHBlciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIANCi8vIFRoaXMgaXMgdGhlIHNlY3JldCBzYXVjZS4gQSBuYWl2ZSBzYXd0b290aCBvciBzcXVhcmUgd2F2ZSBhbGlhc2VzDQovLyBiYWRseSBhdCBoaWdoIGZyZXF1ZW5jaWVzLiBQb2x5QkxFUCBzbW9vdGhzIHRoZSBkaXNjb250aW51aXRpZXMNCi8vIGF0IHRoZSB3YXZlZm9ybSBlZGdlcyBzbyBoYXJtb25pY3MgZG9uJ3QgZm9sZCBiYWNrIGFzIG5vaXNlLg0KZnVuY3Rpb24gcG9seUJsZXAocGhhc2UsIHBoYXNlSW5jcmVtZW50KSB7DQogICAgaWYgKHBoYXNlIDwgcGhhc2VJbmNyZW1lbnQpIHsNCiAgICAgICAgY29uc3QgdCA9IHBoYXNlIC8gcGhhc2VJbmNyZW1lbnQ7DQogICAgICAgIHJldHVybiB0ICsgdCAtIHQgKiB0IC0gMS4wOw0KICAgIH0gZWxzZSBpZiAocGhhc2UgPiAxLjAgLSBwaGFzZUluY3JlbWVudCkgew0KICAgICAgICBjb25zdCB0ID0gKHBoYXNlIC0gMS4wKSAvIHBoYXNlSW5jcmVtZW50Ow0KICAgICAgICByZXR1cm4gdCAqIHQgKyB0ICsgdCArIDEuMDsNCiAgICB9DQogICAgcmV0dXJuIDAuMDsNCn0NCg0KZnVuY3Rpb24gc3F1YXJlV2F2ZShwaGFzZSwgcGhhc2VJbmNyZW1lbnQsIHB1bHNlV2lkdGgpIHsNCiAgLy8gVmFyaWFibGUgcHVsc2Ugd2lkdGgg4oCUIDAuNSBpcyBhIHBlcmZlY3Qgc3F1YXJlIHdhdmUNCiAgLy8gVmFsdWVzIGF3YXkgZnJvbSAwLjUgY3JlYXRlIGEgcmVjdGFuZ3VsYXIgd2F2ZSB3aXRoIGRpZmZlcmVudCBoYXJtb25pYyBjb250ZW50DQogIGxldCBzcXVhcmUgPSBwaGFzZSA8IHB1bHNlV2lkdGggPyAxLjAgOiAtMS4wOw0KICAvLyBQb2x5QkxFUCBjb3JyZWN0aW9ucyBhdCBib3RoIGRpc2NvbnRpbnVpdGllcw0KICBzcXVhcmUgKz0gcG9seUJsZXAocGhhc2UsIHBoYXNlSW5jcmVtZW50KTsNCiAgc3F1YXJlIC09IHBvbHlCbGVwKChwaGFzZSAtIHB1bHNlV2lkdGggKyAxLjApICUgMS4wLCBwaGFzZUluY3JlbWVudCk7DQogIC8vIERDIG9mZnNldCBjb21wZW5zYXRpb24g4oCUIHJlY3Rhbmd1bGFyIHdhdmVzIGhhdmUgREMgb2Zmc2V0IHdoZW4gd2lkdGggIT0gMC41DQogIHNxdWFyZSAtPSAoMi4wICogcHVsc2VXaWR0aCAtIDEuMCk7DQogIHJldHVybiBzcXVhcmU7DQp9DQoNCmZ1bmN0aW9uIHRyaWFuZ2xlV2F2ZShwaGFzZSwgcGhhc2VJbmNyZW1lbnQpIHsNCiAgICAvLyBJbnRlZ3JhdGUgYSBzcXVhcmUgd2F2ZSB0byBnZXQgYSBiYW5kLWxpbWl0ZWQgdHJpYW5nbGUNCiAgICBsZXQgdHJpID0gcGhhc2UgPCAwLjUNCiAgICAgICAgPyA0LjAgKiBwaGFzZSAtIDEuMA0KICAgICAgICA6IDMuMCAtIDQuMCAqIHBoYXNlOw0KICAgIHJldHVybiB0cmk7DQp9DQoNCmZ1bmN0aW9uIHNhd1dhdmUocGhhc2UsIHBoYXNlSW5jcmVtZW50KSB7DQogICAgbGV0IHNhdyA9IDIuMCAqIHBoYXNlIC0gMS4wOw0KICAgIHNhdyAtPSBwb2x5QmxlcChwaGFzZSwgcGhhc2VJbmNyZW1lbnQpOw0KICAgIHJldHVybiBzYXc7DQp9DQoNCi8vIHdhdmVmb3JtOiAnc2F3JyB8ICdzcXVhcmUnIHwgJ3RyaWFuZ2xlJyB8ICdzaW5lJw0KZnVuY3Rpb24gZ2V0T3NjU2FtcGxlKHBoYXNlLCBwaGFzZUluY3JlbWVudCwgd2F2ZWZvcm0sIHB1bHNlV2lkdGggPSAwLjUpIHsNCiAgICBzd2l0Y2ggKHdhdmVmb3JtKSB7DQogICAgICAgIGNhc2UgJ3NpbmUnOiByZXR1cm4gTWF0aC5zaW4ocGhhc2UgKiAyICogTWF0aC5QSSk7DQogICAgICAgIGNhc2UgJ3NxdWFyZSc6IHJldHVybiBzcXVhcmVXYXZlKHBoYXNlLCBwaGFzZUluY3JlbWVudCwgcHVsc2VXaWR0aCk7DQogICAgICAgIGNhc2UgJ3RyaWFuZ2xlJzogcmV0dXJuIHRyaWFuZ2xlV2F2ZShwaGFzZSwgcGhhc2VJbmNyZW1lbnQpOw0KICAgICAgICBkZWZhdWx0OiByZXR1cm4gc2F3V2F2ZShwaGFzZSwgcGhhc2VJbmNyZW1lbnQpOw0KICAgIH0NCn0NCg0KZnVuY3Rpb24gZ2V0TEZPU2FtcGxlKHBoYXNlLCB3YXZlZm9ybSkgew0KICAgIHN3aXRjaCAod2F2ZWZvcm0pIHsNCiAgICAgICAgY2FzZSAndHJpYW5nbGUnOg0KICAgICAgICAgICAgcmV0dXJuIHBoYXNlIDwgMC41ID8gNC4wICogcGhhc2UgLSAxLjAgOiAzLjAgLSA0LjAgKiBwaGFzZTsNCiAgICAgICAgY2FzZSAnc3F1YXJlJzoNCiAgICAgICAgICAgIHJldHVybiBwaGFzZSA8IDAuNSA/IDEuMCA6IC0xLjA7DQogICAgICAgIGNhc2UgJ3Nhdyc6DQogICAgICAgICAgICByZXR1cm4gMi4wICogcGhhc2UgLSAxLjA7DQogICAgICAgIGRlZmF1bHQ6DQogICAgICAgICAgICByZXR1cm4gTWF0aC5zaW4ocGhhc2UgKiAyICogTWF0aC5QSSk7DQogICAgfQ0KfQ0KDQpmdW5jdGlvbiBjYWxjUGhhc2VJbmNyZW1lbnQobm90ZSwgY29hcnNlLCBmaW5lKSB7DQogICAgY29uc3QgdG90YWxTZW1pdG9uZXMgPSBjb2Fyc2UgKyBmaW5lIC8gMTAwOw0KICAgIGNvbnN0IGZyZXEgPSA0NDAgKiBNYXRoLnBvdygyLCAobm90ZSAtIDY5ICsgdG90YWxTZW1pdG9uZXMpIC8gMTIpOw0KICAgIHJldHVybiBmcmVxIC8gc2FtcGxlUmF0ZTsNCn0NCg0KLy8gRXF1YWwgcG93ZXIgcGFubmluZw0KLy8gUmV0dXJucyBbbGVmdEdhaW4sIHJpZ2h0R2Fpbl0gZm9yIGEgcGFuIHZhbHVlIG9mIC0xLjAgdG8gMS4wDQpmdW5jdGlvbiBwYW5HYWlucyhwYW4pIHsNCiAgICBjb25zdCBhbmdsZSA9IChwYW4gKyAxLjApIC8gMi4wICogTWF0aC5QSSAvIDIuMDsNCiAgICByZXR1cm4gW01hdGguY29zKGFuZ2xlKSwgTWF0aC5zaW4oYW5nbGUpXTsNCn0NCg0KLy8g4pSA4pSAIE1vb2cgTGFkZGVyIEZpbHRlciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIANCi8vIEZvdXIgY2FzY2FkZWQgb25lLXBvbGUgZmlsdGVycyB3aXRoIHJlc29uYW5jZSBmZWVkYmFjay4NCi8vIFRoaXMgaXMgdGhlIGNpcmN1aXQgdGhhdCBtYWRlIHRoZSBNaW5pbW9vZyBmYW1vdXMuDQovLyBjdXRvZmY6IDAuMCAtIDEuMCAobm9ybWFsaXplZCwgd2UnbGwgY29udmVydCB0byBIeikNCi8vIHJlc29uYW5jZTogMC4wIC0gNC4wIChhYm92ZSAxLjAgaXQgc2VsZi1vc2NpbGxhdGVzKQ0KZnVuY3Rpb24gbW9vZ0ZpbHRlcih2b2ljZSwgaW5wdXQsIGNoKSB7DQogICAgY29uc3QgY3V0b2ZmID0gdm9pY2UuZmlsdGVyQ3V0b2ZmOw0KICAgIGNvbnN0IHJlcyA9IHZvaWNlLmZpbHRlclJlc29uYW5jZTsNCiAgICBjb25zdCBmID0gY3V0b2ZmICogY3V0b2ZmICogMC45Ow0KDQogICAgY29uc3Qgc2NhbGVkUmVzID0gcmVzICogMC40OyAvLyBzcHJlYWQgcmFuZ2UgYWNyb3NzIGZ1bGwgc2xpZGVyIHRyYXZlbA0KICAgIGNvbnN0IGZlZWRiYWNrID0gc2NhbGVkUmVzICogMy42ICogdm9pY2VbYGZpbHRlclN0YWdlNCR7Y2h9YF07DQoNCiAgICB2b2ljZVtgZmlsdGVyU3RhZ2UxJHtjaH1gXSArPSBmICogKE1hdGgudGFuaChpbnB1dCAtIGZlZWRiYWNrKSAtIE1hdGgudGFuaCh2b2ljZVtgZmlsdGVyU3RhZ2UxJHtjaH1gXSkpOw0KICAgIHZvaWNlW2BmaWx0ZXJTdGFnZTIke2NofWBdICs9IGYgKiAoTWF0aC50YW5oKHZvaWNlW2BmaWx0ZXJTdGFnZTEke2NofWBdKSAtIE1hdGgudGFuaCh2b2ljZVtgZmlsdGVyU3RhZ2UyJHtjaH1gXSkpOw0KICAgIHZvaWNlW2BmaWx0ZXJTdGFnZTMke2NofWBdICs9IGYgKiAoTWF0aC50YW5oKHZvaWNlW2BmaWx0ZXJTdGFnZTIke2NofWBdKSAtIE1hdGgudGFuaCh2b2ljZVtgZmlsdGVyU3RhZ2UzJHtjaH1gXSkpOw0KICAgIHZvaWNlW2BmaWx0ZXJTdGFnZTQke2NofWBdICs9IGYgKiAoTWF0aC50YW5oKHZvaWNlW2BmaWx0ZXJTdGFnZTMke2NofWBdKSAtIE1hdGgudGFuaCh2b2ljZVtgZmlsdGVyU3RhZ2U0JHtjaH1gXSkpOw0KDQogICAgc3dpdGNoICh2b2ljZS5maWx0ZXJUeXBlKSB7DQogICAgICBjYXNlICdoaWdocGFzcyc6DQogICAgICAgIHJldHVybiBpbnB1dCAtIHZvaWNlW2BmaWx0ZXJTdGFnZTQke2NofWBdOw0KICAgICAgY2FzZSAnYmFuZHBhc3MnOg0KICAgICAgICByZXR1cm4gdm9pY2VbYGZpbHRlclN0YWdlMiR7Y2h9YF07DQogICAgICBjYXNlICdub3RjaCc6DQogICAgICAgIHJldHVybiAoaW5wdXQgLSB2b2ljZVtgZmlsdGVyU3RhZ2U0JHtjaH1gXSkgKyB2b2ljZVtgZmlsdGVyU3RhZ2UyJHtjaH1gXSAqIDAuNTsNCiAgICAgIGRlZmF1bHQ6IC8vIGxvd3Bhc3MNCiAgICAgICAgcmV0dXJuIHZvaWNlW2BmaWx0ZXJTdGFnZTQke2NofWBdOw0KICAgIH0NCn0NCg0KLy8g4pSA4pSAIFNpbmdsZSB2b2ljZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIANCi8vIFByZS1hbGxvY2F0ZWQuIFdlIG5ldmVyIGNyZWF0ZSBhIG5ldyB2b2ljZSBvYmplY3QgZHVyaW5nIHBsYXliYWNrLg0KZnVuY3Rpb24gY3JlYXRlVm9pY2UoKSB7DQogICAgcmV0dXJuIHsNCiAgICAgICAgYWN0aXZlOiBmYWxzZSwNCiAgICAgICAgbm90ZTogMCwNCiAgICAgICAgZnJlcXVlbmN5OiAwLA0KICAgICAgICB2ZWxvY2l0eTogMS4wLA0KDQogICAgICAgIC8vIE9zY2lsbGF0b3Igc3RhdGUg4oCUIG9uZSBwZXIgb3NjDQogICAgICAgIG9zYzE6IHsgcGhhc2U6IDAsIHBoYXNlSW5jcmVtZW50OiAwIH0sDQogICAgICAgIG9zYzI6IHsgcGhhc2U6IDAsIHBoYXNlSW5jcmVtZW50OiAwIH0sDQogICAgICAgIG9zYzM6IHsgcGhhc2U6IDAsIHBoYXNlSW5jcmVtZW50OiAwIH0sDQoNCiAgICAgICAgLy8gVW5pc29uIG9zY2lsbGF0b3Igc3RhdGUg4oCUIHByZS1hbGxvY2F0ZWQgZm9yIG1heCA4IHVuaXNvbiB2b2ljZXMNCiAgICAgICAgdW5pc29uT3NjMTogQXJyYXkuZnJvbSh7IGxlbmd0aDogOCB9LCAoKSA9PiAoeyBwaGFzZTogTWF0aC5yYW5kb20oKSB9KSksDQogICAgICAgIHVuaXNvbk9zYzI6IEFycmF5LmZyb20oeyBsZW5ndGg6IDggfSwgKCkgPT4gKHsgcGhhc2U6IE1hdGgucmFuZG9tKCkgfSkpLA0KICAgICAgICB1bmlzb25Pc2MzOiBBcnJheS5mcm9tKHsgbGVuZ3RoOiA4IH0sICgpID0+ICh7IHBoYXNlOiBNYXRoLnJhbmRvbSgpIH0pKSwNCg0KICAgICAgICAvLyBBRFNSIHN0YXRlDQogICAgICAgIC8vIFN0YWdlczogMD1pZGxlLCAxPWF0dGFjaywgMj1kZWNheSwgMz1zdXN0YWluLCA0PXJlbGVhc2UNCiAgICAgICAgZW52U3RhZ2U6IDAsDQogICAgICAgIGVudlZhbHVlOiAwLA0KICAgICAgICBlbnZBdHRhY2tSYXRlOiAwLA0KICAgICAgICBlbnZEZWNheVJhdGU6IDAsDQogICAgICAgIGVudlN1c3RhaW5MZXZlbDogMCwNCiAgICAgICAgZW52UmVsZWFzZVJhdGU6IDAsDQoNCiAgICAgICAgLy8gRmlsdGVyIGVudmVsb3BlIHN0YXRlIOKAlCBtaXJyb3JzIGFtcGxpdHVkZSBlbnZlbG9wZSBzdGFnZXMNCiAgICAgICAgZmlsdGVyRW52U3RhZ2U6IDAsDQogICAgICAgIGZpbHRlckVudlZhbHVlOiAwLA0KICAgICAgICBmaWx0ZXJFbnZBdHRhY2tSYXRlOiAwLA0KICAgICAgICBmaWx0ZXJFbnZEZWNheVJhdGU6IDAsDQogICAgICAgIGZpbHRlckVudlN1c3RhaW5MZXZlbDogMCwNCiAgICAgICAgZmlsdGVyRW52UmVsZWFzZVJhdGU6IDAsDQoNCiAgICAgICAgLy8gUGl0Y2ggZW52ZWxvcGUgc3RhdGUNCiAgICAgICAgcGl0Y2hFbnZTdGFnZTogMCwNCiAgICAgICAgcGl0Y2hFbnZWYWx1ZTogMCwNCiAgICAgICAgcGl0Y2hFbnZBdHRhY2tSYXRlOiAwLA0KICAgICAgICBwaXRjaEVudkRlY2F5UmF0ZTogMCwNCiAgICAgICAgcGl0Y2hFbnZTdXN0YWluTGV2ZWw6IDAsDQogICAgICAgIHBpdGNoRW52UmVsZWFzZVJhdGU6IDAsDQoNCiAgICAgICAgLy8gUG9ydGFtZW50byBzdGF0ZQ0KICAgICAgICBjdXJyZW50RnJlcTogMCwgICAgLy8gY3VycmVudCBmcmVxdWVuY3ksIGdsaWRlcyB0b3dhcmQgdGFyZ2V0RnJlcQ0KICAgICAgICB0YXJnZXRGcmVxOiAwLCAgICAgLy8gZGVzdGluYXRpb24gZnJlcXVlbmN5DQogICAgICAgIGdsaWRlUmF0ZTogMCwgICAgICAvLyBzZW1pdG9uZXMgcGVyIHNhbXBsZSB0b3dhcmQgdGFyZ2V0DQoNCiAgICAgICAgLy8gRmlsdGVyIHN0YXRlDQogICAgICAgIGZpbHRlclR5cGU6ICdsb3dwYXNzJywNCiAgICAgICAgZmlsdGVyQ3V0b2ZmOiAwLjgsDQogICAgICAgIGZpbHRlclJlc29uYW5jZTogMC4xLA0KICAgICAgICBmaWx0ZXJTdGFnZTFMOiAwLCBmaWx0ZXJTdGFnZTJMOiAwLCBmaWx0ZXJTdGFnZTNMOiAwLCBmaWx0ZXJTdGFnZTRMOiAwLA0KICAgICAgICBmaWx0ZXJTdGFnZTFSOiAwLCBmaWx0ZXJTdGFnZTJSOiAwLCBmaWx0ZXJTdGFnZTNSOiAwLCBmaWx0ZXJTdGFnZTRSOiAwLA0KICAgIH07DQp9DQoNCi8vIOKUgOKUgCBQcm9jZXNzb3Ig4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSADQpjbGFzcyBPYnNpZGlhblByb2Nlc3NvciBleHRlbmRzIEF1ZGlvV29ya2xldFByb2Nlc3NvciB7DQogICAgY29uc3RydWN0b3IoKSB7DQogICAgICAgIHN1cGVyKCk7DQoNCiAgICAgICAgLy8gUHJlLWFsbG9jYXRlIHZvaWNlIHBvb2wg4oCUIG5vIG5ldyBvYmplY3RzIGR1cmluZyBwbGF5YmFjaw0KICAgICAgICB0aGlzLnZvaWNlcyA9IFtdOw0KICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IE1BWF9WT0lDRVM7IGkrKykgew0KICAgICAgICAgICAgdGhpcy52b2ljZXMucHVzaChjcmVhdGVWb2ljZSgpKTsNCiAgICAgICAgfQ0KICAgICAgICB0aGlzLmFjdGl2ZVZvaWNlQ291bnQgPSAwOw0KDQogICAgICAgIC8vIFNjaGVkdWxlZCBldmVudCBxdWV1ZSDigJQgc29ydGVkIGJ5IHRpbWUgYXNjZW5kaW5nDQogICAgICAgIHRoaXMuc2NoZWR1bGVkRXZlbnRzID0gW107DQoNCiAgICAgICAgLy8gTEZPIOKAlCBnbG9iYWwsIG5vdCBwZXIgdm9pY2UNCiAgICAgICAgdGhpcy5sZm9QaGFzZSA9IDA7DQogICAgICAgIHRoaXMubGZvUGhhc2VJbmNyZW1lbnQgPSAyIC8gc2FtcGxlUmF0ZTsgLy8gZGVmYXVsdCAxaHosIGZ1bGwgY3ljbGUgPSAyIHVuaXRzDQoNCiAgICAgICAgLy8gUGFyYW1ldGVycyB3aXRoIGRlZmF1bHRzDQogICAgICAgIHRoaXMucGFyYW1zID0gew0KICAgICAgICAgICAgcGl0Y2hCZW5kOiAwLCAvLyBzZW1pdG9uZXMsIMKxMg0KICAgICAgICAgICAgZmlsdGVyVHlwZTogJ2xvd3Bhc3MnLCAvLyBsb3dwYXNzIHwgaGlnaHBhc3MgfCBiYW5kcGFzcyB8IG5vdGNoDQogICAgICAgICAgICBwb3J0YW1lbnRvVGltZTogMC4wLCAgICAgIC8vIHNlY29uZHMsIDAgPSBpbnN0YW50LCAwLjAwMSB0byAyLjANCiAgICAgICAgICAgIHBvcnRhbWVudG9Nb2RlOiAnYWx3YXlzJywgLy8gJ2Fsd2F5cycgfCAnbGVnYXRvJw0KICAgICAgICAgICAgb3NjMVB1bHNlV2lkdGg6IDAuNSwgICAvLyAwLjEgdG8gMC45LCAwLjUgPSBwZXJmZWN0IHNxdWFyZQ0KICAgICAgICAgICAgb3NjMlB1bHNlV2lkdGg6IDAuNSwNCiAgICAgICAgICAgIG9zYzNQdWxzZVdpZHRoOiAwLjUsDQogICAgICAgICAgICBvc2MxUFdNRGVwdGg6IDAuMCwgICAgIC8vIDAuMCB0byAxLjAsIGhvdyBtdWNoIExGTyBtb2R1bGF0ZXMgcHVsc2Ugd2lkdGgNCiAgICAgICAgICAgIG9zYzJQV01EZXB0aDogMC4wLA0KICAgICAgICAgICAgb3NjM1BXTURlcHRoOiAwLjAsDQogICAgICAgICAgICB1bmlzb25Wb2ljZXM6IDEsICAgICAgLy8gMSB0byA4LiAxID0gdW5pc29uIG9mZiwgbm9ybWFsIGJlaGF2aW9yDQogICAgICAgICAgICB1bmlzb25EZXR1bmU6IDEwLCAgICAgLy8gY2VudHMsIDAgdG8gMTAwDQogICAgICAgICAgICB1bmlzb25TcHJlYWQ6IDAuOCwgICAgLy8gc3RlcmVvIHNwcmVhZCwgMC4wIHRvIDEuMA0KICAgICAgICAgICAgcGl0Y2hFbnZBbW91bnQ6IDAsICAgICAgLy8gc2VtaXRvbmVzLCAtMjQgdG8gKzI0LiAwID0gb2ZmDQogICAgICAgICAgICBwaXRjaEVudkF0dGFjazogMC4wMDEsICAvLyB2ZXJ5IGZhc3QgZGVmYXVsdA0KICAgICAgICAgICAgcGl0Y2hFbnZEZWNheTogMC4yLCAgICAgLy8gc2hvcnQgZGVjYXkg4oCUIGNsYXNzaWMgODA4IHNuYXANCiAgICAgICAgICAgIHBpdGNoRW52U3VzdGFpbjogMC4wLCAgIC8vIHplcm8gc3VzdGFpbiBieSBkZWZhdWx0IOKAlCB0cmFuc2llbnQgc2hhcGUNCiAgICAgICAgICAgIHBpdGNoRW52UmVsZWFzZTogMC4xLA0KICAgICAgICAgICAgYXR0YWNrOiAwLjAxLA0KICAgICAgICAgICAgZGVjYXk6IDAuMSwNCiAgICAgICAgICAgIHN1c3RhaW46IDAuNywNCiAgICAgICAgICAgIHJlbGVhc2U6IDAuMywNCiAgICAgICAgICAgIG1hc3RlckdhaW46IDAuNSwNCiAgICAgICAgICAgIHN0ZXJlb1dpZHRoOiAxLjAsIC8vIDAuMCA9IG1vbm8sIDEuMCA9IGZ1bGwgc3RlcmVvLCA+MS4wID0gaHlwZXItd2lkZQ0KICAgICAgICAgICAgZmlsdGVyQ3V0b2ZmOiAwLjgsDQogICAgICAgICAgICBmaWx0ZXJSZXNvbmFuY2U6IDAuMSwNCiAgICAgICAgICAgIGZpbHRlckF0dGFjazogMC4wMSwNCiAgICAgICAgICAgIGZpbHRlckRlY2F5OiAwLjMsDQogICAgICAgICAgICBmaWx0ZXJTdXN0YWluOiAwLjMsDQogICAgICAgICAgICBmaWx0ZXJSZWxlYXNlOiAwLjUsDQogICAgICAgICAgICBmaWx0ZXJFbnZBbW91bnQ6IDAuMCwgICAvLyAtMS4wIHRvIDEuMC4gMCA9IG5vIG1vZHVsYXRpb24NCiAgICAgICAgICAgIGxmb1JhdGU6IDEuMCwgICAgICAgIC8vIEh6LCAwLjEgdG8gMjANCiAgICAgICAgICAgIGxmb0RlcHRoOiAwLjAsICAgICAgIC8vIDAuMCB0byAxLjAsIGRlZmF1bHQgMCBzbyBMRk8gaXMgb3B0LWluDQogICAgICAgICAgICBsZm9XYXZlZm9ybTogJ3NpbmUnLCAvLyBzaW5lIHwgdHJpYW5nbGUgfCBzcXVhcmUgfCBzYXcNCiAgICAgICAgICAgIGxmb0Rlc3RpbmF0aW9uOiAncGl0Y2gnLCAvLyBwaXRjaCB8IGZpbHRlciB8IHZvbHVtZSB8IHBhbg0KICAgICAgICAgICAgdmVsb2NpdHlBbXBTZW5zOiAxLjAsICAgICAvLyAwLjAgdG8gMS4wIOKAlCBob3cgbXVjaCB2ZWxvY2l0eSBhZmZlY3RzIHZvbHVtZQ0KICAgICAgICAgICAgdmVsb2NpdHlGaWx0ZXJTZW5zOiAwLjUsICAvLyAwLjAgdG8gMS4wIOKAlCBob3cgbXVjaCB2ZWxvY2l0eSBvcGVucyB0aGUgZmlsdGVyDQoNCiAgICAgICAgICAgIC8vIE9TQyAxDQogICAgICAgICAgICBvc2MxV2F2ZWZvcm06ICdzYXcnLA0KICAgICAgICAgICAgb3NjMUNvYXJzZTogMCwgICAgICAvLyBzZW1pdG9uZXMsIC0yNCB0byArMjQNCiAgICAgICAgICAgIG9zYzFGaW5lOiAwLCAgICAgICAgLy8gY2VudHMsIC0xMDAgdG8gKzEwMA0KICAgICAgICAgICAgb3NjMU1peDogMS4wLCAgICAgICAvLyAwLjAgdG8gMS4wDQogICAgICAgICAgICBvc2MxUGFuOiAwLjAsDQogICAgICAgICAgICBvc2MxRW5hYmxlZDogdHJ1ZSwNCg0KICAgICAgICAgICAgLy8gT1NDIDINCiAgICAgICAgICAgIG9zYzJXYXZlZm9ybTogJ3NhdycsDQogICAgICAgICAgICBvc2MyQ29hcnNlOiAwLA0KICAgICAgICAgICAgb3NjMkZpbmU6IDcsICAgICAgICAvLyBkZWZhdWx0ICs3IGNlbnRzIGRldHVuZSBmb3IgdGhpY2tuZXNzDQogICAgICAgICAgICBvc2MyTWl4OiAwLjcsDQogICAgICAgICAgICBvc2MyUGFuOiAtMC4zLA0KICAgICAgICAgICAgb3NjMkVuYWJsZWQ6IHRydWUsDQoNCiAgICAgICAgICAgIC8vIE9TQyAzDQogICAgICAgICAgICBvc2MzV2F2ZWZvcm06ICdzcXVhcmUnLA0KICAgICAgICAgICAgb3NjM0NvYXJzZTogLTEyLCAgICAvLyBkZWZhdWx0IHN1YiBvY3RhdmUNCiAgICAgICAgICAgIG9zYzNGaW5lOiAwLA0KICAgICAgICAgICAgb3NjM01peDogMC41LA0KICAgICAgICAgICAgb3NjM1BhbjogMC4zLA0KICAgICAgICAgICAgb3NjM0VuYWJsZWQ6IHRydWUsDQogICAgICAgIH07DQoNCiAgICAgICAgLy8gTGlzdGVuIGZvciBtZXNzYWdlcyBmcm9tIHRoZSBtYWluIHRocmVhZA0KICAgICAgICAvLyAocGFyYW1ldGVyIGNoYW5nZXMsIG5vdGUgZXZlbnRzIGlmIG5vdCB1c2luZyBXQU0gZXZlbnQgcXVldWUgeWV0KQ0KICAgICAgICB0aGlzLnBvcnQub25tZXNzYWdlID0gKGUpID0+IHsNCiAgICAgICAgICAgIGNvbnN0IHsgdHlwZSwgZGF0YSB9ID0gZS5kYXRhOw0KICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdub3RlT24nKSB0aGlzLm5vdGVPbihkYXRhLm5vdGUsIGRhdGEudmVsb2NpdHkpOw0KICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdub3RlT2ZmJykgdGhpcy5ub3RlT2ZmKGRhdGEubm90ZSk7DQogICAgICAgICAgICBpZiAodHlwZSA9PT0gJ3NjaGVkdWxlTm90ZScpIHsNCiAgICAgICAgICAgICAgICB0aGlzLnNjaGVkdWxlZEV2ZW50cy5wdXNoKGRhdGEpOw0KICAgICAgICAgICAgICAgIHRoaXMuc2NoZWR1bGVkRXZlbnRzLnNvcnQoKGEsIGIpID0+IGEudGltZSAtIGIudGltZSk7DQogICAgICAgICAgICB9DQogICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NsZWFyU2NoZWR1bGUnKSB7DQogICAgICAgICAgICAgICAgdGhpcy5zY2hlZHVsZWRFdmVudHMubGVuZ3RoID0gMDsNCiAgICAgICAgICAgIH0NCiAgICAgICAgICAgIGlmICh0eXBlID09PSAnc2V0UGFyYW0nKSB7DQogICAgICAgICAgICAgICAgdGhpcy5wYXJhbXNbZGF0YS5rZXldID0gZGF0YS52YWx1ZTsNCiAgICAgICAgICAgICAgICBpZiAoZGF0YS5rZXkgPT09ICdsZm9SYXRlJykgew0KICAgICAgICAgICAgICAgICAgICB0aGlzLmxmb1BoYXNlSW5jcmVtZW50ID0gZGF0YS52YWx1ZSAvIHNhbXBsZVJhdGU7DQogICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgIHRoaXMudm9pY2VzLmZvckVhY2godiA9PiB7DQogICAgICAgICAgICAgICAgICAgIGlmICh2LmFjdGl2ZSkgew0KICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEua2V5ID09PSAnZmlsdGVyQ3V0b2ZmJykgdi5maWx0ZXJDdXRvZmYgPSBkYXRhLnZhbHVlOw0KICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEua2V5ID09PSAnZmlsdGVyUmVzb25hbmNlJykgdi5maWx0ZXJSZXNvbmFuY2UgPSBkYXRhLnZhbHVlOw0KICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEua2V5ID09PSAnZmlsdGVyVHlwZScpIHYuZmlsdGVyVHlwZSA9IGRhdGEudmFsdWU7DQogICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5rZXkgPT09ICdvc2MxRmluZScgfHwgZGF0YS5rZXkgPT09ICdvc2MxQ29hcnNlJykgew0KICAgICAgICAgICAgICAgICAgICAgICAgICAgIHYub3NjMS5waGFzZUluY3JlbWVudCA9IGNhbGNQaGFzZUluY3JlbWVudCh2Lm5vdGUsIHRoaXMucGFyYW1zLm9zYzFDb2Fyc2UsIHRoaXMucGFyYW1zLm9zYzFGaW5lKTsNCiAgICAgICAgICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXRhLmtleSA9PT0gJ29zYzJGaW5lJyB8fCBkYXRhLmtleSA9PT0gJ29zYzJDb2Fyc2UnKSB7DQogICAgICAgICAgICAgICAgICAgICAgICAgICAgdi5vc2MyLnBoYXNlSW5jcmVtZW50ID0gY2FsY1BoYXNlSW5jcmVtZW50KHYubm90ZSwgdGhpcy5wYXJhbXMub3NjMkNvYXJzZSwgdGhpcy5wYXJhbXMub3NjMkZpbmUpOw0KICAgICAgICAgICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEua2V5ID09PSAnb3NjM0ZpbmUnIHx8IGRhdGEua2V5ID09PSAnb3NjM0NvYXJzZScpIHsNCiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2Lm9zYzMucGhhc2VJbmNyZW1lbnQgPSBjYWxjUGhhc2VJbmNyZW1lbnQodi5ub3RlLCB0aGlzLnBhcmFtcy5vc2MzQ29hcnNlLCB0aGlzLnBhcmFtcy5vc2MzRmluZSk7DQogICAgICAgICAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICB9KTsNCg0KICAgICAgICAgICAgICAgIGlmIChkYXRhLmtleSA9PT0gJ3VuaXNvblZvaWNlcycgfHwgZGF0YS5rZXkgPT09ICd1bmlzb25EZXR1bmUnKSB7DQogICAgICAgICAgICAgICAgICB0aGlzLnZvaWNlcy5mb3JFYWNoKHYgPT4gew0KICAgICAgICAgICAgICAgICAgICBpZiAoIXYuYWN0aXZlKSByZXR1cm47DQogICAgICAgICAgICAgICAgICAgIGNvbnN0IHVuaXNvbkNvdW50ID0gTWF0aC5tYXgoMSwgTWF0aC5mbG9vcih0aGlzLnBhcmFtcy51bmlzb25Wb2ljZXMpKTsNCiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgdSA9IDA7IHUgPCA4OyB1KyspIHsNCiAgICAgICAgICAgICAgICAgICAgICBpZiAodW5pc29uQ291bnQgPT09IDEpIHsNCiAgICAgICAgICAgICAgICAgICAgICAgIHYudW5pc29uT3NjMVt1XS5waGFzZUluY3JlbWVudCA9IHYub3NjMS5waGFzZUluY3JlbWVudDsNCiAgICAgICAgICAgICAgICAgICAgICAgIHYudW5pc29uT3NjMlt1XS5waGFzZUluY3JlbWVudCA9IHYub3NjMi5waGFzZUluY3JlbWVudDsNCiAgICAgICAgICAgICAgICAgICAgICAgIHYudW5pc29uT3NjM1t1XS5waGFzZUluY3JlbWVudCA9IHYub3NjMy5waGFzZUluY3JlbWVudDsNCiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Ugew0KICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ByZWFkID0gdSAvICh1bmlzb25Db3VudCAtIDEpOw0KICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGV0dW5lQ2VudHMgPSAoc3ByZWFkIC0gMC41KSAqIDIgKiB0aGlzLnBhcmFtcy51bmlzb25EZXR1bmU7DQogICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXR1bmVSYXRpbyA9IE1hdGgucG93KDIsIGRldHVuZUNlbnRzIC8gMTIwMCk7DQogICAgICAgICAgICAgICAgICAgICAgICB2LnVuaXNvbk9zYzFbdV0ucGhhc2VJbmNyZW1lbnQgPSB2Lm9zYzEucGhhc2VJbmNyZW1lbnQgKiBkZXR1bmVSYXRpbzsNCiAgICAgICAgICAgICAgICAgICAgICAgIHYudW5pc29uT3NjMlt1XS5waGFzZUluY3JlbWVudCA9IHYub3NjMi5waGFzZUluY3JlbWVudCAqIGRldHVuZVJhdGlvOw0KICAgICAgICAgICAgICAgICAgICAgICAgdi51bmlzb25Pc2MzW3VdLnBoYXNlSW5jcmVtZW50ID0gdi5vc2MzLnBoYXNlSW5jcmVtZW50ICogZGV0dW5lUmF0aW87DQogICAgICAgICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgICB9KTsNCiAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICB9DQogICAgICAgIH07DQogICAgfQ0KDQogICAgLy8g4pSA4pSAIE5vdGUgaGVscGVycyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIANCiAgICBub3RlT24obm90ZSwgdmVsb2NpdHkpIHsNCiAgICAgICAgdGhpcy5hY3RpdmVWb2ljZUNvdW50Kys7DQogICAgICAgIC8vIEZpcnN0IHByaW9yaXR5OiByZXRyaWdnZXIgdGhlIHNhbWUgbm90ZSBpZiBpdCdzIGFscmVhZHkgcGxheWluZw0KICAgICAgICBsZXQgdm9pY2UgPSB0aGlzLnZvaWNlcy5maW5kKHYgPT4gdi5hY3RpdmUgJiYgdi5ub3RlID09PSBub3RlKTsNCiAgICAgICAgLy8gU2Vjb25kIHByaW9yaXR5OiBmaW5kIGEgZnJlZSB2b2ljZQ0KICAgICAgICBpZiAoIXZvaWNlKSB2b2ljZSA9IHRoaXMudm9pY2VzLmZpbmQodiA9PiAhdi5hY3RpdmUpOw0KICAgICAgICAvLyBMYXN0IHJlc29ydDogc3RlYWwgdGhlIHZvaWNlIGZ1cnRoZXN0IGludG8gaXRzIHJlbGVhc2UNCiAgICAgICAgaWYgKCF2b2ljZSkgew0KICAgICAgICAgICAgdm9pY2UgPSB0aGlzLnZvaWNlcy5yZWR1Y2UoKG9sZGVzdCwgdikgPT4NCiAgICAgICAgICAgICAgICB2LmVudlZhbHVlIDwgb2xkZXN0LmVudlZhbHVlID8gdiA6IG9sZGVzdA0KICAgICAgICAgICAgICAgICwgdGhpcy52b2ljZXNbMF0pOw0KICAgICAgICB9DQoNCiAgICAgICAgY29uc3QgZnJlcSA9IDQ0MCAqIE1hdGgucG93KDIsIChub3RlIC0gNjkpIC8gMTIpOw0KDQogICAgICAgIHZvaWNlLmFjdGl2ZSA9IHRydWU7DQogICAgICAgIHZvaWNlLm5vdGUgPSBub3RlOw0KICAgICAgICB2b2ljZS5mcmVxdWVuY3kgPSBmcmVxOw0KICAgICAgICB2b2ljZS52ZWxvY2l0eSA9IHZlbG9jaXR5IC8gMTI3Ow0KICAgICAgICB2b2ljZS5vc2MxLnBoYXNlID0gMDsNCiAgICAgICAgdm9pY2Uub3NjMi5waGFzZSA9IDA7DQogICAgICAgIHZvaWNlLm9zYzMucGhhc2UgPSAwOw0KDQogICAgICAgIC8vIFBvcnRhbWVudG8g4oCUIGRldGVybWluZSB3aGV0aGVyIHRvIGdsaWRlDQogICAgICAgIGNvbnN0IHNob3VsZEdsaWRlID0gdGhpcy5wYXJhbXMucG9ydGFtZW50b1RpbWUgPiAwICYmICgNCiAgICAgICAgICB0aGlzLnBhcmFtcy5wb3J0YW1lbnRvTW9kZSA9PT0gJ2Fsd2F5cycgfHwNCiAgICAgICAgICAodGhpcy5wYXJhbXMucG9ydGFtZW50b01vZGUgPT09ICdsZWdhdG8nICYmIHRoaXMuYWN0aXZlVm9pY2VDb3VudCA+IDEpDQogICAgICAgICk7DQoNCiAgICAgICAgdm9pY2UudGFyZ2V0RnJlcSA9IGZyZXE7DQoNCiAgICAgICAgaWYgKHNob3VsZEdsaWRlICYmIHZvaWNlLmN1cnJlbnRGcmVxID4gMCkgew0KICAgICAgICAgIC8vIEtlZXAgY3VycmVudCBmcmVxdWVuY3kgYW5kIGdsaWRlIHRvIHRhcmdldA0KICAgICAgICAgIC8vIGdsaWRlUmF0ZSBpcyBpbiBmcmVxdWVuY3kgcmF0aW8gcGVyIHNhbXBsZQ0KICAgICAgICAgIGNvbnN0IGdsaWRlVGltZSA9IHRoaXMucGFyYW1zLnBvcnRhbWVudG9UaW1lICogc2FtcGxlUmF0ZTsNCiAgICAgICAgICBjb25zdCBzZW1pdG9uZURpc3RhbmNlID0gTWF0aC5hYnMoDQogICAgICAgICAgICAxMiAqIE1hdGgubG9nMihmcmVxIC8gdm9pY2UuY3VycmVudEZyZXEpDQogICAgICAgICAgKTsNCiAgICAgICAgICB2b2ljZS5nbGlkZVJhdGUgPSBzZW1pdG9uZURpc3RhbmNlIC8gZ2xpZGVUaW1lOw0KICAgICAgICB9IGVsc2Ugew0KICAgICAgICAgIC8vIEp1bXAgaW5zdGFudGx5IHRvIHRhcmdldA0KICAgICAgICAgIHZvaWNlLmN1cnJlbnRGcmVxID0gZnJlcTsNCiAgICAgICAgICB2b2ljZS5nbGlkZVJhdGUgPSAwOw0KICAgICAgICB9DQoNCiAgICAgICAgLy8gQmFzZSBwaGFzZSBpbmNyZW1lbnRzIGZyb20gY3VycmVudCBmcmVxdWVuY3kNCiAgICAgICAgLy8gVW5pc29uIGRldHVuZSBpcyBhcHBsaWVkIGFzIGEgcmF0aW8gb24gdG9wIG9mIHRoaXMgaW4gcHJvY2VzcygpDQogICAgICAgIHZvaWNlLm9zYzEucGhhc2VJbmNyZW1lbnQgPSAodm9pY2UuY3VycmVudEZyZXEgKiBNYXRoLnBvdygyLCAodGhpcy5wYXJhbXMub3NjMUNvYXJzZSArIHRoaXMucGFyYW1zLm9zYzFGaW5lIC8gMTAwKSAvIDEyKSkgLyBzYW1wbGVSYXRlOw0KICAgICAgICB2b2ljZS5vc2MyLnBoYXNlSW5jcmVtZW50ID0gKHZvaWNlLmN1cnJlbnRGcmVxICogTWF0aC5wb3coMiwgKHRoaXMucGFyYW1zLm9zYzJDb2Fyc2UgKyB0aGlzLnBhcmFtcy5vc2MyRmluZSAvIDEwMCkgLyAxMikpIC8gc2FtcGxlUmF0ZTsNCiAgICAgICAgdm9pY2Uub3NjMy5waGFzZUluY3JlbWVudCA9ICh2b2ljZS5jdXJyZW50RnJlcSAqIE1hdGgucG93KDIsICh0aGlzLnBhcmFtcy5vc2MzQ29hcnNlICsgdGhpcy5wYXJhbXMub3NjM0ZpbmUgLyAxMDApIC8gMTIpKSAvIHNhbXBsZVJhdGU7DQoNCiAgICAgICAgLy8gU2V0IHVwIHVuaXNvbiBvc2NpbGxhdG9yIHBoYXNlIGluY3JlbWVudHMNCiAgICAgICAgLy8gRWFjaCBjb3B5IGdldHMgYSBkZXR1bmUgb2Zmc2V0IHNwcmVhZCBldmVubHkgYWNyb3NzIHRoZSBkZXR1bmUgcmFuZ2UNCiAgICAgICAgY29uc3QgdW5pc29uQ291bnQgPSBNYXRoLm1heCgxLCBNYXRoLmZsb29yKHRoaXMucGFyYW1zLnVuaXNvblZvaWNlcykpOw0KICAgICAgICBmb3IgKGxldCB1ID0gMDsgdSA8IDg7IHUrKykgew0KICAgICAgICAgIGlmICh1bmlzb25Db3VudCA9PT0gMSkgew0KICAgICAgICAgICAgLy8gTm8gZGV0dW5lIOKAlCBzaW5nbGUgY29weSBhdCBiYXNlIHBpdGNoDQogICAgICAgICAgICB2b2ljZS51bmlzb25Pc2MxW3VdLnBoYXNlSW5jcmVtZW50ID0gdm9pY2Uub3NjMS5waGFzZUluY3JlbWVudDsNCiAgICAgICAgICAgIHZvaWNlLnVuaXNvbk9zYzJbdV0ucGhhc2VJbmNyZW1lbnQgPSB2b2ljZS5vc2MyLnBoYXNlSW5jcmVtZW50Ow0KICAgICAgICAgICAgdm9pY2UudW5pc29uT3NjM1t1XS5waGFzZUluY3JlbWVudCA9IHZvaWNlLm9zYzMucGhhc2VJbmNyZW1lbnQ7DQogICAgICAgICAgfSBlbHNlIHsNCiAgICAgICAgICAgIC8vIFNwcmVhZCBkZXR1bmUgZXZlbmx5IGFjcm9zcyBjb3BpZXMNCiAgICAgICAgICAgIC8vIENlbnRlciBjb3B5IChpZiBvZGQgY291bnQpIGlzIGF0IDAgY2VudHMgZGV0dW5lDQogICAgICAgICAgICBjb25zdCBzcHJlYWQgPSB1IC8gKHVuaXNvbkNvdW50IC0gMSk7IC8vIDAuMCB0byAxLjANCiAgICAgICAgICAgIGNvbnN0IGRldHVuZUNlbnRzID0gKHNwcmVhZCAtIDAuNSkgKiAyICogdGhpcy5wYXJhbXMudW5pc29uRGV0dW5lOw0KICAgICAgICAgICAgY29uc3QgZGV0dW5lUmF0aW8gPSBNYXRoLnBvdygyLCBkZXR1bmVDZW50cyAvIDEyMDApOw0KICAgICAgICAgICAgdm9pY2UudW5pc29uT3NjMVt1XS5waGFzZUluY3JlbWVudCA9IHZvaWNlLm9zYzEucGhhc2VJbmNyZW1lbnQgKiBkZXR1bmVSYXRpbzsNCiAgICAgICAgICAgIHZvaWNlLnVuaXNvbk9zYzJbdV0ucGhhc2VJbmNyZW1lbnQgPSB2b2ljZS5vc2MyLnBoYXNlSW5jcmVtZW50ICogZGV0dW5lUmF0aW87DQogICAgICAgICAgICB2b2ljZS51bmlzb25Pc2MzW3VdLnBoYXNlSW5jcmVtZW50ID0gdm9pY2Uub3NjMy5waGFzZUluY3JlbWVudCAqIGRldHVuZVJhdGlvOw0KICAgICAgICAgIH0NCiAgICAgICAgfQ0KDQogICAgICAgIC8vIFJhbmRvbWl6ZSBwaGFzZXMgb24gcmV0cmlnZ2VyIHRvIHByZXZlbnQgcGhhc2UgY2FuY2VsbGF0aW9uDQogICAgICAgIGZvciAobGV0IHUgPSAwOyB1IDwgODsgdSsrKSB7DQogICAgICAgICAgdm9pY2UudW5pc29uT3NjMVt1XS5waGFzZSA9IE1hdGgucmFuZG9tKCk7DQogICAgICAgICAgdm9pY2UudW5pc29uT3NjMlt1XS5waGFzZSA9IE1hdGgucmFuZG9tKCk7DQogICAgICAgICAgdm9pY2UudW5pc29uT3NjM1t1XS5waGFzZSA9IE1hdGgucmFuZG9tKCk7DQogICAgICAgIH0NCg0KICAgICAgICB2b2ljZS5maWx0ZXJDdXRvZmYgPSB0aGlzLnBhcmFtcy5maWx0ZXJDdXRvZmY7DQogICAgICAgIHZvaWNlLmZpbHRlclJlc29uYW5jZSA9IHRoaXMucGFyYW1zLmZpbHRlclJlc29uYW5jZTsNCiAgICAgICAgdm9pY2UuZmlsdGVyVHlwZSA9IHRoaXMucGFyYW1zLmZpbHRlclR5cGU7DQogICAgICAgIC8vIFJlc2V0IGZpbHRlciBzdGFnZXMgb24gbmV3IG5vdGUgdG8gcHJldmVudCBjbGlja3MNCiAgICAgICAgdm9pY2UuZmlsdGVyU3RhZ2UxTCA9IDA7DQogICAgICAgIHZvaWNlLmZpbHRlclN0YWdlMkwgPSAwOw0KICAgICAgICB2b2ljZS5maWx0ZXJTdGFnZTNMID0gMDsNCiAgICAgICAgdm9pY2UuZmlsdGVyU3RhZ2U0TCA9IDA7DQogICAgICAgIHZvaWNlLmZpbHRlclN0YWdlMVIgPSAwOw0KICAgICAgICB2b2ljZS5maWx0ZXJTdGFnZTJSID0gMDsNCiAgICAgICAgdm9pY2UuZmlsdGVyU3RhZ2UzUiA9IDA7DQogICAgICAgIHZvaWNlLmZpbHRlclN0YWdlNFIgPSAwOw0KDQogICAgICAgIC8vIFN0YXJ0IGF0dGFjaw0KICAgICAgICB2b2ljZS5lbnZTdGFnZSA9IDE7DQogICAgICAgIHZvaWNlLmVudkF0dGFja1JhdGUgPSAxLjAgLyAodGhpcy5wYXJhbXMuYXR0YWNrICogc2FtcGxlUmF0ZSk7DQogICAgICAgIHZvaWNlLmVudkRlY2F5UmF0ZSA9IDEuMCAvICh0aGlzLnBhcmFtcy5kZWNheSAqIHNhbXBsZVJhdGUpOw0KICAgICAgICB2b2ljZS5lbnZTdXN0YWluTGV2ZWwgPSB0aGlzLnBhcmFtcy5zdXN0YWluOw0KICAgICAgICB2b2ljZS5lbnZSZWxlYXNlUmF0ZSA9IDEuMCAvICh0aGlzLnBhcmFtcy5yZWxlYXNlICogc2FtcGxlUmF0ZSk7DQoNCiAgICAgICAgLy8gU3RhcnQgZmlsdGVyIGVudmVsb3BlDQogICAgICAgIHZvaWNlLmZpbHRlckVudlN0YWdlID0gMTsNCiAgICAgICAgdm9pY2UuZmlsdGVyRW52QXR0YWNrUmF0ZSA9IDEuMCAvICh0aGlzLnBhcmFtcy5maWx0ZXJBdHRhY2sgKiBzYW1wbGVSYXRlKTsNCiAgICAgICAgdm9pY2UuZmlsdGVyRW52RGVjYXlSYXRlID0gMS4wIC8gKHRoaXMucGFyYW1zLmZpbHRlckRlY2F5ICogc2FtcGxlUmF0ZSk7DQogICAgICAgIHZvaWNlLmZpbHRlckVudlN1c3RhaW5MZXZlbCA9IHRoaXMucGFyYW1zLmZpbHRlclN1c3RhaW47DQogICAgICAgIHZvaWNlLmZpbHRlckVudlJlbGVhc2VSYXRlID0gMS4wIC8gKHRoaXMucGFyYW1zLmZpbHRlclJlbGVhc2UgKiBzYW1wbGVSYXRlKTsNCg0KICAgICAgICAvLyBTdGFydCBwaXRjaCBlbnZlbG9wZQ0KICAgICAgICB2b2ljZS5waXRjaEVudlN0YWdlID0gMTsNCiAgICAgICAgdm9pY2UucGl0Y2hFbnZBdHRhY2tSYXRlID0gMS4wIC8gKHRoaXMucGFyYW1zLnBpdGNoRW52QXR0YWNrICogc2FtcGxlUmF0ZSk7DQogICAgICAgIHZvaWNlLnBpdGNoRW52RGVjYXlSYXRlID0gMS4wIC8gKHRoaXMucGFyYW1zLnBpdGNoRW52RGVjYXkgKiBzYW1wbGVSYXRlKTsNCiAgICAgICAgdm9pY2UucGl0Y2hFbnZTdXN0YWluTGV2ZWwgPSB0aGlzLnBhcmFtcy5waXRjaEVudlN1c3RhaW47DQogICAgICAgIHZvaWNlLnBpdGNoRW52UmVsZWFzZVJhdGUgPSAxLjAgLyAodGhpcy5wYXJhbXMucGl0Y2hFbnZSZWxlYXNlICogc2FtcGxlUmF0ZSk7DQogICAgfQ0KDQogICAgbm90ZU9mZihub3RlKSB7DQogICAgICAgIGNvbnN0IHZvaWNlID0gdGhpcy52b2ljZXMuZmluZCh2ID0+IHYuYWN0aXZlICYmIHYubm90ZSA9PT0gbm90ZSk7DQogICAgICAgIGlmICh2b2ljZSkgew0KICAgICAgICAgICAgdGhpcy5hY3RpdmVWb2ljZUNvdW50ID0gTWF0aC5tYXgoMCwgdGhpcy5hY3RpdmVWb2ljZUNvdW50IC0gMSk7DQogICAgICAgICAgICB2b2ljZS5lbnZTdGFnZSA9IDQ7IC8vIHRyaWdnZXIgcmVsZWFzZQ0KICAgICAgICAgICAgdm9pY2UuZmlsdGVyRW52U3RhZ2UgPSA0Ow0KICAgICAgICAgICAgdm9pY2UucGl0Y2hFbnZTdGFnZSA9IDQ7DQogICAgICAgIH0NCiAgICB9DQoNCiAgICAvLyDilIDilIAgQURTUiBwZXIgc2FtcGxlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgA0KICAgIHByb2Nlc3NFbnZlbG9wZSh2b2ljZSkgew0KICAgICAgICBzd2l0Y2ggKHZvaWNlLmVudlN0YWdlKSB7DQogICAgICAgICAgICBjYXNlIDE6IC8vIEF0dGFjaw0KICAgICAgICAgICAgICAgIHZvaWNlLmVudlZhbHVlICs9IHZvaWNlLmVudkF0dGFja1JhdGU7DQogICAgICAgICAgICAgICAgaWYgKHZvaWNlLmVudlZhbHVlID49IDEuMCkgew0KICAgICAgICAgICAgICAgICAgICB2b2ljZS5lbnZWYWx1ZSA9IDEuMDsNCiAgICAgICAgICAgICAgICAgICAgdm9pY2UuZW52U3RhZ2UgPSAyOyAvLyBtb3ZlIHRvIGRlY2F5DQogICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgIGJyZWFrOw0KICAgICAgICAgICAgY2FzZSAyOiAvLyBEZWNheQ0KICAgICAgICAgICAgICAgIHZvaWNlLmVudlZhbHVlIC09IHZvaWNlLmVudkRlY2F5UmF0ZTsNCiAgICAgICAgICAgICAgICBpZiAodm9pY2UuZW52VmFsdWUgPD0gdm9pY2UuZW52U3VzdGFpbkxldmVsKSB7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmVudlZhbHVlID0gdm9pY2UuZW52U3VzdGFpbkxldmVsOw0KICAgICAgICAgICAgICAgICAgICB2b2ljZS5lbnZTdGFnZSA9IDM7IC8vIGhvbGQgYXQgc3VzdGFpbg0KICAgICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgICBicmVhazsNCiAgICAgICAgICAgIGNhc2UgMzogLy8gU3VzdGFpbg0KICAgICAgICAgICAgICAgIC8vIE5vdGhpbmcg4oCUIGhvbGQgYXQgc3VzdGFpbiBsZXZlbCB1bnRpbCBub3RlT2ZmDQogICAgICAgICAgICAgICAgYnJlYWs7DQogICAgICAgICAgICBjYXNlIDQ6IC8vIFJlbGVhc2UNCiAgICAgICAgICAgICAgICB2b2ljZS5lbnZWYWx1ZSAtPSB2b2ljZS5lbnZSZWxlYXNlUmF0ZTsNCiAgICAgICAgICAgICAgICBpZiAodm9pY2UuZW52VmFsdWUgPD0gMCkgew0KICAgICAgICAgICAgICAgICAgICB2b2ljZS5lbnZWYWx1ZSA9IDA7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmVudlN0YWdlID0gMDsNCiAgICAgICAgICAgICAgICAgICAgdm9pY2UuYWN0aXZlID0gZmFsc2U7IC8vIHZvaWNlIGlzIGZyZWUgYWdhaW4NCiAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgYnJlYWs7DQogICAgICAgICAgICBkZWZhdWx0Og0KICAgICAgICAgICAgICAgIHZvaWNlLmVudlZhbHVlID0gMDsNCiAgICAgICAgfQ0KICAgICAgICByZXR1cm4gdm9pY2UuZW52VmFsdWU7DQogICAgfQ0KDQogICAgcHJvY2Vzc0ZpbHRlckVudmVsb3BlKHZvaWNlKSB7DQogICAgICAgIHN3aXRjaCAodm9pY2UuZmlsdGVyRW52U3RhZ2UpIHsNCiAgICAgICAgICAgIGNhc2UgMTogLy8gQXR0YWNrDQogICAgICAgICAgICAgICAgdm9pY2UuZmlsdGVyRW52VmFsdWUgKz0gdm9pY2UuZmlsdGVyRW52QXR0YWNrUmF0ZTsNCiAgICAgICAgICAgICAgICBpZiAodm9pY2UuZmlsdGVyRW52VmFsdWUgPj0gMS4wKSB7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmZpbHRlckVudlZhbHVlID0gMS4wOw0KICAgICAgICAgICAgICAgICAgICB2b2ljZS5maWx0ZXJFbnZTdGFnZSA9IDI7DQogICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgIGJyZWFrOw0KICAgICAgICAgICAgY2FzZSAyOiAvLyBEZWNheQ0KICAgICAgICAgICAgICAgIHZvaWNlLmZpbHRlckVudlZhbHVlIC09IHZvaWNlLmZpbHRlckVudkRlY2F5UmF0ZTsNCiAgICAgICAgICAgICAgICBpZiAodm9pY2UuZmlsdGVyRW52VmFsdWUgPD0gdm9pY2UuZmlsdGVyRW52U3VzdGFpbkxldmVsKSB7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmZpbHRlckVudlZhbHVlID0gdm9pY2UuZmlsdGVyRW52U3VzdGFpbkxldmVsOw0KICAgICAgICAgICAgICAgICAgICB2b2ljZS5maWx0ZXJFbnZTdGFnZSA9IDM7DQogICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgIGJyZWFrOw0KICAgICAgICAgICAgY2FzZSAzOiAvLyBTdXN0YWluDQogICAgICAgICAgICAgICAgYnJlYWs7DQogICAgICAgICAgICBjYXNlIDQ6IC8vIFJlbGVhc2UNCiAgICAgICAgICAgICAgICB2b2ljZS5maWx0ZXJFbnZWYWx1ZSAtPSB2b2ljZS5maWx0ZXJFbnZSZWxlYXNlUmF0ZTsNCiAgICAgICAgICAgICAgICBpZiAodm9pY2UuZmlsdGVyRW52VmFsdWUgPD0gMCkgew0KICAgICAgICAgICAgICAgICAgICB2b2ljZS5maWx0ZXJFbnZWYWx1ZSA9IDA7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmZpbHRlckVudlN0YWdlID0gMDsNCiAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgYnJlYWs7DQogICAgICAgICAgICBkZWZhdWx0Og0KICAgICAgICAgICAgICAgIHZvaWNlLmZpbHRlckVudlZhbHVlID0gMDsNCiAgICAgICAgfQ0KICAgICAgICByZXR1cm4gdm9pY2UuZmlsdGVyRW52VmFsdWU7DQogICAgfQ0KDQogICAgcHJvY2Vzc1BpdGNoRW52ZWxvcGUodm9pY2UpIHsNCiAgICAgIHN3aXRjaCAodm9pY2UucGl0Y2hFbnZTdGFnZSkgew0KICAgICAgICBjYXNlIDE6IC8vIEF0dGFjaw0KICAgICAgICAgIHZvaWNlLnBpdGNoRW52VmFsdWUgKz0gdm9pY2UucGl0Y2hFbnZBdHRhY2tSYXRlOw0KICAgICAgICAgIGlmICh2b2ljZS5waXRjaEVudlZhbHVlID49IDEuMCkgew0KICAgICAgICAgICAgdm9pY2UucGl0Y2hFbnZWYWx1ZSA9IDEuMDsNCiAgICAgICAgICAgIHZvaWNlLnBpdGNoRW52U3RhZ2UgPSAyOw0KICAgICAgICAgIH0NCiAgICAgICAgICBicmVhazsNCiAgICAgICAgY2FzZSAyOiAvLyBEZWNheQ0KICAgICAgICAgIHZvaWNlLnBpdGNoRW52VmFsdWUgLT0gdm9pY2UucGl0Y2hFbnZEZWNheVJhdGU7DQogICAgICAgICAgaWYgKHZvaWNlLnBpdGNoRW52VmFsdWUgPD0gdm9pY2UucGl0Y2hFbnZTdXN0YWluTGV2ZWwpIHsNCiAgICAgICAgICAgIHZvaWNlLnBpdGNoRW52VmFsdWUgPSB2b2ljZS5waXRjaEVudlN1c3RhaW5MZXZlbDsNCiAgICAgICAgICAgIHZvaWNlLnBpdGNoRW52U3RhZ2UgPSAzOw0KICAgICAgICAgIH0NCiAgICAgICAgICBicmVhazsNCiAgICAgICAgY2FzZSAzOiAvLyBTdXN0YWluDQogICAgICAgICAgYnJlYWs7DQogICAgICAgIGNhc2UgNDogLy8gUmVsZWFzZQ0KICAgICAgICAgIHZvaWNlLnBpdGNoRW52VmFsdWUgLT0gdm9pY2UucGl0Y2hFbnZSZWxlYXNlUmF0ZTsNCiAgICAgICAgICBpZiAodm9pY2UucGl0Y2hFbnZWYWx1ZSA8PSAwKSB7DQogICAgICAgICAgICB2b2ljZS5waXRjaEVudlZhbHVlID0gMDsNCiAgICAgICAgICAgIHZvaWNlLnBpdGNoRW52U3RhZ2UgPSAwOw0KICAgICAgICAgIH0NCiAgICAgICAgICBicmVhazsNCiAgICAgICAgZGVmYXVsdDoNCiAgICAgICAgICB2b2ljZS5waXRjaEVudlZhbHVlID0gMDsNCiAgICAgIH0NCiAgICAgIHJldHVybiB2b2ljZS5waXRjaEVudlZhbHVlOw0KICAgIH0NCg0KICAgIC8vIOKUgOKUgCBNYWluIERTUCBsb29wIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgA0KICAgIC8vIENhbGxlZCBldmVyeSAxMjggc2FtcGxlcyAofjNtcyBhdCA0NDEwMGh6KS4gTXVzdCBjb21wbGV0ZSBmYXN0Lg0KICAgIHByb2Nlc3MoaW5wdXRzLCBvdXRwdXRzKSB7DQogICAgICAgIGNvbnN0IG91dHB1dCA9IG91dHB1dHNbMF07DQogICAgICAgIGNvbnN0IGxlZnQgPSBvdXRwdXRbMF07DQogICAgICAgIGNvbnN0IHJpZ2h0ID0gb3V0cHV0WzFdOw0KDQogICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVmdC5sZW5ndGg7IGkrKykgew0KICAgICAgICAgICAgbGV0IHNhbXBsZUwgPSAwOw0KICAgICAgICAgICAgbGV0IHNhbXBsZVIgPSAwOw0KDQogICAgICAgICAgICAvLyBGaXJlIGFueSBzY2hlZHVsZWQgZXZlbnRzIHRoYXQgZmFsbCBvbiBvciBiZWZvcmUgdGhpcyBleGFjdCBzYW1wbGUNCiAgICAgICAgICAgIGNvbnN0IHNhbXBsZVRpbWUgPSBjdXJyZW50VGltZSArIGkgLyBzYW1wbGVSYXRlOw0KICAgICAgICAgICAgd2hpbGUgKHRoaXMuc2NoZWR1bGVkRXZlbnRzLmxlbmd0aCA+IDAgJiYNCiAgICAgICAgICAgICAgICAgICB0aGlzLnNjaGVkdWxlZEV2ZW50c1swXS50aW1lIDw9IHNhbXBsZVRpbWUpIHsNCiAgICAgICAgICAgICAgICBjb25zdCBldiA9IHRoaXMuc2NoZWR1bGVkRXZlbnRzLnNoaWZ0KCk7DQogICAgICAgICAgICAgICAgaWYgKGV2Lm5vdGVUeXBlID09PSAnbm90ZU9uJykgdGhpcy5ub3RlT24oZXYubm90ZSwgZXYudmVsb2NpdHkpOw0KICAgICAgICAgICAgICAgIGVsc2UgaWYgKGV2Lm5vdGVUeXBlID09PSAnbm90ZU9mZicpIHRoaXMubm90ZU9mZihldi5ub3RlKTsNCiAgICAgICAgICAgIH0NCg0KICAgICAgICAgICAgLy8gQWR2YW5jZSBMRk8NCiAgICAgICAgICAgIHRoaXMubGZvUGhhc2UgKz0gdGhpcy5sZm9QaGFzZUluY3JlbWVudDsNCiAgICAgICAgICAgIGlmICh0aGlzLmxmb1BoYXNlID49IDEuMCkgdGhpcy5sZm9QaGFzZSAtPSAxLjA7DQogICAgICAgICAgICBjb25zdCBsZm9WYWx1ZSA9IGdldExGT1NhbXBsZSh0aGlzLmxmb1BoYXNlLCB0aGlzLnBhcmFtcy5sZm9XYXZlZm9ybSkgKiB0aGlzLnBhcmFtcy5sZm9EZXB0aDsNCg0KICAgICAgICAgICAgZm9yIChsZXQgdiA9IDA7IHYgPCBNQVhfVk9JQ0VTOyB2KyspIHsNCiAgICAgICAgICAgICAgICBjb25zdCB2b2ljZSA9IHRoaXMudm9pY2VzW3ZdOw0KICAgICAgICAgICAgICAgIGlmICghdm9pY2UuYWN0aXZlKSBjb250aW51ZTsNCg0KICAgICAgICAgICAgICAgIC8vIEFwcGx5IExGTyBtb2R1bGF0aW9uIHRvIGRlc3RpbmF0aW9uDQogICAgICAgICAgICAgICAgbGV0IGxmb0ZyZXFNb2QgPSAxLjA7DQogICAgICAgICAgICAgICAgbGV0IGxmb0ZpbHRlck1vZCA9IDAuMDsNCiAgICAgICAgICAgICAgICBsZXQgbGZvVm9sdW1lTW9kID0gMS4wOw0KICAgICAgICAgICAgICAgIGxldCBsZm9QYW5Nb2QgPSAwLjA7DQoNCiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRoaXMucGFyYW1zLmxmb0Rlc3RpbmF0aW9uKSB7DQogICAgICAgICAgICAgICAgICAgIGNhc2UgJ3BpdGNoJzoNCiAgICAgICAgICAgICAgICAgICAgICAgIC8vIExGTyBtb2R1bGF0ZXMgcGl0Y2gg4oCUIMKxMSBzZW1pdG9uZSBhdCBmdWxsIGRlcHRoDQogICAgICAgICAgICAgICAgICAgICAgICBsZm9GcmVxTW9kID0gTWF0aC5wb3coMiwgbGZvVmFsdWUgLyAxMik7DQogICAgICAgICAgICAgICAgICAgICAgICBicmVhazsNCiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZmlsdGVyJzoNCiAgICAgICAgICAgICAgICAgICAgICAgIC8vIExGTyBtb2R1bGF0ZXMgZmlsdGVyIGN1dG9mZiDigJQgYWRkcyBkaXJlY3RseSB0byBjdXRvZmYNCiAgICAgICAgICAgICAgICAgICAgICAgIGxmb0ZpbHRlck1vZCA9IGxmb1ZhbHVlICogMC4zOw0KICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7DQogICAgICAgICAgICAgICAgICAgIGNhc2UgJ3ZvbHVtZSc6DQogICAgICAgICAgICAgICAgICAgICAgICAvLyBMRk8gbW9kdWxhdGVzIGFtcGxpdHVkZQ0KICAgICAgICAgICAgICAgICAgICAgICAgbGZvVm9sdW1lTW9kID0gMS4wICsgbGZvVmFsdWUgKiAwLjU7DQogICAgICAgICAgICAgICAgICAgICAgICBicmVhazsNCiAgICAgICAgICAgICAgICAgICAgY2FzZSAncGFuJzoNCiAgICAgICAgICAgICAgICAgICAgICAgIC8vIExGTyBtb2R1bGF0ZXMgc3RlcmVvIHBhbiBwb3NpdGlvbg0KICAgICAgICAgICAgICAgICAgICAgICAgbGZvUGFuTW9kID0gbGZvVmFsdWU7DQogICAgICAgICAgICAgICAgICAgICAgICBicmVhazsNCiAgICAgICAgICAgICAgICB9DQoNCiAgICAgICAgICAgICAgICBjb25zdCB1bmlzb25Db3VudCA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3IodGhpcy5wYXJhbXMudW5pc29uVm9pY2VzKSk7DQogICAgICAgICAgICAgICAgY29uc3QgYmVuZE1vZCA9IE1hdGgucG93KDIsIHRoaXMucGFyYW1zLnBpdGNoQmVuZCAvIDEyKTsNCg0KICAgICAgICAgICAgICAgIC8vIFBpdGNoIGVudmVsb3BlIG1vZHVsYXRpb24NCiAgICAgICAgICAgICAgICBjb25zdCBwaXRjaEVudiA9IHRoaXMucHJvY2Vzc1BpdGNoRW52ZWxvcGUodm9pY2UpOw0KICAgICAgICAgICAgICAgIGNvbnN0IHBpdGNoRW52TW9kID0gTWF0aC5wb3coMiwgKHBpdGNoRW52ICogdGhpcy5wYXJhbXMucGl0Y2hFbnZBbW91bnQpIC8gMTIpOw0KDQogICAgICAgICAgICAgICAgLy8gUFdNIOKAlCBMRk8gbW9kdWxhdGVzIHB1bHNlIHdpZHRoIHdoZW4gZGVwdGggPiAwDQogICAgICAgICAgICAgICAgLy8gbGZvVmFsdWUgaXMgYWxyZWFkeSBjYWxjdWxhdGVkIGFib3ZlIGFzIC0xIHRvICsxDQogICAgICAgICAgICAgICAgY29uc3QgcHcxID0gTWF0aC5tYXgoMC4xLCBNYXRoLm1pbigwLjksDQogICAgICAgICAgICAgICAgICB0aGlzLnBhcmFtcy5vc2MxUHVsc2VXaWR0aCArIGxmb1ZhbHVlICogdGhpcy5wYXJhbXMub3NjMVBXTURlcHRoICogMC40DQogICAgICAgICAgICAgICAgKSk7DQogICAgICAgICAgICAgICAgY29uc3QgcHcyID0gTWF0aC5tYXgoMC4xLCBNYXRoLm1pbigwLjksDQogICAgICAgICAgICAgICAgICB0aGlzLnBhcmFtcy5vc2MyUHVsc2VXaWR0aCArIGxmb1ZhbHVlICogdGhpcy5wYXJhbXMub3NjMlBXTURlcHRoICogMC40DQogICAgICAgICAgICAgICAgKSk7DQogICAgICAgICAgICAgICAgY29uc3QgcHczID0gTWF0aC5tYXgoMC4xLCBNYXRoLm1pbigwLjksDQogICAgICAgICAgICAgICAgICB0aGlzLnBhcmFtcy5vc2MzUHVsc2VXaWR0aCArIGxmb1ZhbHVlICogdGhpcy5wYXJhbXMub3NjM1BXTURlcHRoICogMC40DQogICAgICAgICAgICAgICAgKSk7DQoNCiAgICAgICAgICAgICAgICAvLyBBZHZhbmNlIHBvcnRhbWVudG8gZ2xpZGUNCiAgICAgICAgICAgICAgICBpZiAodm9pY2UuZ2xpZGVSYXRlID4gMCAmJiB2b2ljZS5jdXJyZW50RnJlcSAhPT0gdm9pY2UudGFyZ2V0RnJlcSkgew0KICAgICAgICAgICAgICAgICAgLy8gTW92ZSBjdXJyZW50IGZyZXF1ZW5jeSB0b3dhcmQgdGFyZ2V0IGluIHNlbWl0b25lIHNwYWNlDQogICAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50U2VtaXRvbmVzID0gMTIgKiBNYXRoLmxvZzIodm9pY2UuY3VycmVudEZyZXEpOw0KICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0U2VtaXRvbmVzID0gMTIgKiBNYXRoLmxvZzIodm9pY2UudGFyZ2V0RnJlcSk7DQogICAgICAgICAgICAgICAgICBjb25zdCBkaWZmID0gdGFyZ2V0U2VtaXRvbmVzIC0gY3VycmVudFNlbWl0b25lczsNCiAgICAgICAgICAgICAgICAgIGNvbnN0IHN0ZXAgPSB2b2ljZS5nbGlkZVJhdGUgKiBNYXRoLnNpZ24oZGlmZik7DQoNCiAgICAgICAgICAgICAgICAgIGlmIChNYXRoLmFicyhkaWZmKSA8PSBNYXRoLmFicyhzdGVwKSkgew0KICAgICAgICAgICAgICAgICAgICAvLyBDbG9zZSBlbm91Z2gg4oCUIHNuYXAgdG8gdGFyZ2V0DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmN1cnJlbnRGcmVxID0gdm9pY2UudGFyZ2V0RnJlcTsNCiAgICAgICAgICAgICAgICAgICAgdm9pY2UuZ2xpZGVSYXRlID0gMDsNCiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLmN1cnJlbnRGcmVxID0gTWF0aC5wb3coMiwgKGN1cnJlbnRTZW1pdG9uZXMgKyBzdGVwKSAvIDEyKTsNCiAgICAgICAgICAgICAgICAgIH0NCg0KICAgICAgICAgICAgICAgICAgLy8gUmVjYWxjdWxhdGUgYmFzZSBwaGFzZSBpbmNyZW1lbnRzIGZyb20gY3VycmVudCBnbGlkaW5nIGZyZXF1ZW5jeQ0KICAgICAgICAgICAgICAgICAgdm9pY2Uub3NjMS5waGFzZUluY3JlbWVudCA9ICh2b2ljZS5jdXJyZW50RnJlcSAqIE1hdGgucG93KDIsICh0aGlzLnBhcmFtcy5vc2MxQ29hcnNlICsgdGhpcy5wYXJhbXMub3NjMUZpbmUgLyAxMDApIC8gMTIpKSAvIHNhbXBsZVJhdGU7DQogICAgICAgICAgICAgICAgICB2b2ljZS5vc2MyLnBoYXNlSW5jcmVtZW50ID0gKHZvaWNlLmN1cnJlbnRGcmVxICogTWF0aC5wb3coMiwgKHRoaXMucGFyYW1zLm9zYzJDb2Fyc2UgKyB0aGlzLnBhcmFtcy5vc2MyRmluZSAvIDEwMCkgLyAxMikpIC8gc2FtcGxlUmF0ZTsNCiAgICAgICAgICAgICAgICAgIHZvaWNlLm9zYzMucGhhc2VJbmNyZW1lbnQgPSAodm9pY2UuY3VycmVudEZyZXEgKiBNYXRoLnBvdygyLCAodGhpcy5wYXJhbXMub3NjM0NvYXJzZSArIHRoaXMucGFyYW1zLm9zYzNGaW5lIC8gMTAwKSAvIDEyKSkgLyBzYW1wbGVSYXRlOw0KDQogICAgICAgICAgICAgICAgICAvLyBSZWNhbGN1bGF0ZSB1bmlzb24gcGhhc2UgaW5jcmVtZW50cyBmcm9tIHVwZGF0ZWQgYmFzZSBpbmNyZW1lbnRzDQogICAgICAgICAgICAgICAgICBjb25zdCB1bmlzb25Db3VudCA9IE1hdGgubWF4KDEsIE1hdGguZmxvb3IodGhpcy5wYXJhbXMudW5pc29uVm9pY2VzKSk7DQogICAgICAgICAgICAgICAgICBmb3IgKGxldCB1ID0gMDsgdSA8IDg7IHUrKykgew0KICAgICAgICAgICAgICAgICAgICBpZiAodW5pc29uQ291bnQgPT09IDEpIHsNCiAgICAgICAgICAgICAgICAgICAgICB2b2ljZS51bmlzb25Pc2MxW3VdLnBoYXNlSW5jcmVtZW50ID0gdm9pY2Uub3NjMS5waGFzZUluY3JlbWVudDsNCiAgICAgICAgICAgICAgICAgICAgICB2b2ljZS51bmlzb25Pc2MyW3VdLnBoYXNlSW5jcmVtZW50ID0gdm9pY2Uub3NjMi5waGFzZUluY3JlbWVudDsNCiAgICAgICAgICAgICAgICAgICAgICB2b2ljZS51bmlzb25Pc2MzW3VdLnBoYXNlSW5jcmVtZW50ID0gdm9pY2Uub3NjMy5waGFzZUluY3JlbWVudDsNCiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHsNCiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzcHJlYWQgPSB1IC8gKHVuaXNvbkNvdW50IC0gMSk7DQogICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGV0dW5lQ2VudHMgPSAoc3ByZWFkIC0gMC41KSAqIDIgKiB0aGlzLnBhcmFtcy51bmlzb25EZXR1bmU7DQogICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGV0dW5lUmF0aW8gPSBNYXRoLnBvdygyLCBkZXR1bmVDZW50cyAvIDEyMDApOw0KICAgICAgICAgICAgICAgICAgICAgIHZvaWNlLnVuaXNvbk9zYzFbdV0ucGhhc2VJbmNyZW1lbnQgPSB2b2ljZS5vc2MxLnBoYXNlSW5jcmVtZW50ICogZGV0dW5lUmF0aW87DQogICAgICAgICAgICAgICAgICAgICAgdm9pY2UudW5pc29uT3NjMlt1XS5waGFzZUluY3JlbWVudCA9IHZvaWNlLm9zYzIucGhhc2VJbmNyZW1lbnQgKiBkZXR1bmVSYXRpbzsNCiAgICAgICAgICAgICAgICAgICAgICB2b2ljZS51bmlzb25Pc2MzW3VdLnBoYXNlSW5jcmVtZW50ID0gdm9pY2Uub3NjMy5waGFzZUluY3JlbWVudCAqIGRldHVuZVJhdGlvOw0KICAgICAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgICB9DQogICAgICAgICAgICAgICAgfQ0KDQogICAgICAgICAgICAgICAgbGV0IHNpZzFMID0gMCwgc2lnMVIgPSAwOw0KICAgICAgICAgICAgICAgIGxldCBzaWcyTCA9IDAsIHNpZzJSID0gMDsNCiAgICAgICAgICAgICAgICBsZXQgc2lnM0wgPSAwLCBzaWczUiA9IDA7DQoNCiAgICAgICAgICAgICAgICBmb3IgKGxldCB1ID0gMDsgdSA8IHVuaXNvbkNvdW50OyB1KyspIHsNCiAgICAgICAgICAgICAgICAgIC8vIENhbGN1bGF0ZSBzdGVyZW8gcG9zaXRpb24gZm9yIHRoaXMgdW5pc29uIGNvcHkNCiAgICAgICAgICAgICAgICAgIC8vIEZpcnN0IGNvcHkgcGFucyBsZWZ0LCBsYXN0IGNvcHkgcGFucyByaWdodCwgbWlkZGxlIGNvcGllcyBzcHJlYWQgYmV0d2Vlbg0KICAgICAgICAgICAgICAgICAgY29uc3QgdW5pc29uUGFuID0gdW5pc29uQ291bnQgPT09IDENCiAgICAgICAgICAgICAgICAgICAgPyAwDQogICAgICAgICAgICAgICAgICAgIDogKHUgLyAodW5pc29uQ291bnQgLSAxKSAtIDAuNSkgKiAyICogdGhpcy5wYXJhbXMudW5pc29uU3ByZWFkOw0KDQogICAgICAgICAgICAgICAgICAvLyBPU0MgMQ0KICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGFyYW1zLm9zYzFFbmFibGVkKSB7DQogICAgICAgICAgICAgICAgICAgIGNvbnN0IGluYzEgPSB2b2ljZS51bmlzb25Pc2MxW3VdLnBoYXNlSW5jcmVtZW50ICogbGZvRnJlcU1vZCAqIGJlbmRNb2QgKiBwaXRjaEVudk1vZDsNCiAgICAgICAgICAgICAgICAgICAgdm9pY2UudW5pc29uT3NjMVt1XS5waGFzZSArPSBpbmMxOw0KICAgICAgICAgICAgICAgICAgICBpZiAodm9pY2UudW5pc29uT3NjMVt1XS5waGFzZSA+PSAxLjApIHZvaWNlLnVuaXNvbk9zYzFbdV0ucGhhc2UgLT0gMS4wOw0KICAgICAgICAgICAgICAgICAgICBjb25zdCBzMSA9IGdldE9zY1NhbXBsZSh2b2ljZS51bmlzb25Pc2MxW3VdLnBoYXNlLCBpbmMxLCB0aGlzLnBhcmFtcy5vc2MxV2F2ZWZvcm0sIHB3MSk7DQogICAgICAgICAgICAgICAgICAgIGNvbnN0IFtsMSwgcjFdID0gcGFuR2FpbnModGhpcy5wYXJhbXMub3NjMVBhbiArIHVuaXNvblBhbiArIGxmb1Bhbk1vZCk7DQogICAgICAgICAgICAgICAgICAgIHNpZzFMICs9IHMxICogbDE7DQogICAgICAgICAgICAgICAgICAgIHNpZzFSICs9IHMxICogcjE7DQogICAgICAgICAgICAgICAgICB9DQoNCiAgICAgICAgICAgICAgICAgIC8vIE9TQyAyDQogICAgICAgICAgICAgICAgICBpZiAodGhpcy5wYXJhbXMub3NjMkVuYWJsZWQpIHsNCiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5jMiA9IHZvaWNlLnVuaXNvbk9zYzJbdV0ucGhhc2VJbmNyZW1lbnQgKiBsZm9GcmVxTW9kICogYmVuZE1vZCAqIHBpdGNoRW52TW9kOw0KICAgICAgICAgICAgICAgICAgICB2b2ljZS51bmlzb25Pc2MyW3VdLnBoYXNlICs9IGluYzI7DQogICAgICAgICAgICAgICAgICAgIGlmICh2b2ljZS51bmlzb25Pc2MyW3VdLnBoYXNlID49IDEuMCkgdm9pY2UudW5pc29uT3NjMlt1XS5waGFzZSAtPSAxLjA7DQogICAgICAgICAgICAgICAgICAgIGNvbnN0IHMyID0gZ2V0T3NjU2FtcGxlKHZvaWNlLnVuaXNvbk9zYzJbdV0ucGhhc2UsIGluYzIsIHRoaXMucGFyYW1zLm9zYzJXYXZlZm9ybSwgcHcyKTsNCiAgICAgICAgICAgICAgICAgICAgY29uc3QgW2wyLCByMl0gPSBwYW5HYWlucyh0aGlzLnBhcmFtcy5vc2MyUGFuICsgdW5pc29uUGFuICsgbGZvUGFuTW9kKTsNCiAgICAgICAgICAgICAgICAgICAgc2lnMkwgKz0gczIgKiBsMjsNCiAgICAgICAgICAgICAgICAgICAgc2lnMlIgKz0gczIgKiByMjsNCiAgICAgICAgICAgICAgICAgIH0NCg0KICAgICAgICAgICAgICAgICAgLy8gT1NDIDMNCiAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBhcmFtcy5vc2MzRW5hYmxlZCkgew0KICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmMzID0gdm9pY2UudW5pc29uT3NjM1t1XS5waGFzZUluY3JlbWVudCAqIGxmb0ZyZXFNb2QgKiBiZW5kTW9kICogcGl0Y2hFbnZNb2Q7DQogICAgICAgICAgICAgICAgICAgIHZvaWNlLnVuaXNvbk9zYzNbdV0ucGhhc2UgKz0gaW5jMzsNCiAgICAgICAgICAgICAgICAgICAgaWYgKHZvaWNlLnVuaXNvbk9zYzNbdV0ucGhhc2UgPj0gMS4wKSB2b2ljZS51bmlzb25Pc2MzW3VdLnBoYXNlIC09IDEuMDsNCiAgICAgICAgICAgICAgICAgICAgY29uc3QgczMgPSBnZXRPc2NTYW1wbGUodm9pY2UudW5pc29uT3NjM1t1XS5waGFzZSwgaW5jMywgdGhpcy5wYXJhbXMub3NjM1dhdmVmb3JtLCBwdzMpOw0KICAgICAgICAgICAgICAgICAgICBjb25zdCBbbDMsIHIzXSA9IHBhbkdhaW5zKHRoaXMucGFyYW1zLm9zYzNQYW4gKyB1bmlzb25QYW4gKyBsZm9QYW5Nb2QpOw0KICAgICAgICAgICAgICAgICAgICBzaWczTCArPSBzMyAqIGwzOw0KICAgICAgICAgICAgICAgICAgICBzaWczUiArPSBzMyAqIHIzOw0KICAgICAgICAgICAgICAgICAgfQ0KICAgICAgICAgICAgICAgIH0NCg0KICAgICAgICAgICAgICAgIC8vIEVudmVsb3BlDQogICAgICAgICAgICAgICAgY29uc3QgdmVsQW1wID0gMS4wIC0gdGhpcy5wYXJhbXMudmVsb2NpdHlBbXBTZW5zICogKDEuMCAtIHZvaWNlLnZlbG9jaXR5KTsNCiAgICAgICAgICAgICAgICBjb25zdCBlbnYgPSB0aGlzLnByb2Nlc3NFbnZlbG9wZSh2b2ljZSkgKiBsZm9Wb2x1bWVNb2QgKiB2ZWxBbXA7DQoNCiAgICAgICAgICAgICAgICAvLyBQcm9jZXNzIGZpbHRlciBlbnZlbG9wZQ0KICAgICAgICAgICAgICAgIGNvbnN0IGZpbHRlckVudiA9IHRoaXMucHJvY2Vzc0ZpbHRlckVudmVsb3BlKHZvaWNlKTsNCg0KICAgICAgICAgICAgICAgIC8vIE1vZHVsYXRlIGN1dG9mZiDigJQgYmFzZSBjdXRvZmYgKyBlbnZlbG9wZSBhbW91bnQgKiBlbnZlbG9wZSB2YWx1ZQ0KICAgICAgICAgICAgICAgIC8vIENsYW1wZWQgdG8gMC0xIHRvIHN0YXkgaW4gdmFsaWQgZmlsdGVyIHJhbmdlDQogICAgICAgICAgICAgICAgY29uc3QgdmVsRmlsdGVyQm9vc3QgPSB2b2ljZS52ZWxvY2l0eSAqIHRoaXMucGFyYW1zLnZlbG9jaXR5RmlsdGVyU2VucyAqIDAuMzsNCiAgICAgICAgICAgICAgICBjb25zdCBtb2R1bGF0ZWRDdXRvZmYgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxLA0KICAgICAgICAgICAgICAgICAgICB2b2ljZS5maWx0ZXJDdXRvZmYgKyAoZmlsdGVyRW52ICogdGhpcy5wYXJhbXMuZmlsdGVyRW52QW1vdW50KSArIGxmb0ZpbHRlck1vZCArIHZlbEZpbHRlckJvb3N0DQogICAgICAgICAgICAgICAgKSk7DQoNCiAgICAgICAgICAgICAgICAvLyBUZW1wb3JhcmlseSBvdmVycmlkZSB2b2ljZSBjdXRvZmYgZm9yIHRoaXMgc2FtcGxlDQogICAgICAgICAgICAgICAgY29uc3Qgc2F2ZWRDdXRvZmYgPSB2b2ljZS5maWx0ZXJDdXRvZmY7DQogICAgICAgICAgICAgICAgdm9pY2UuZmlsdGVyQ3V0b2ZmID0gbW9kdWxhdGVkQ3V0b2ZmOw0KDQogICAgICAgICAgICAgICAgLy8gTm9ybWFsaXplIGJ5IHVuaXNvbiBjb3VudCB0byBwcmV2ZW50IHZvbHVtZSBpbmNyZWFzZSB3aXRoIG1vcmUgdm9pY2VzDQogICAgICAgICAgICAgICAgY29uc3QgdW5pc29uTm9ybSA9IDEuMCAvIE1hdGguc3FydCh1bmlzb25Db3VudCk7DQoNCiAgICAgICAgICAgICAgICAvLyBNaXggYWxsIG9zY2lsbGF0b3JzDQogICAgICAgICAgICAgICAgbGV0IG1peEwgPSAoc2lnMUwgKiB0aGlzLnBhcmFtcy5vc2MxTWl4ICsNCiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWcyTCAqIHRoaXMucGFyYW1zLm9zYzJNaXggKw0KICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZzNMICogdGhpcy5wYXJhbXMub3NjM01peCkgKiB1bmlzb25Ob3JtOw0KICAgICAgICAgICAgICAgIGxldCBtaXhSID0gKHNpZzFSICogdGhpcy5wYXJhbXMub3NjMU1peCArDQogICAgICAgICAgICAgICAgICAgICAgICAgICAgc2lnMlIgKiB0aGlzLnBhcmFtcy5vc2MyTWl4ICsNCiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaWczUiAqIHRoaXMucGFyYW1zLm9zYzNNaXgpICogdW5pc29uTm9ybTsNCg0KICAgICAgICAgICAgICAgIC8vIEFwcGx5IGVudmVsb3BlIGFuZCBmaWx0ZXIgcGVyIGNoYW5uZWwNCiAgICAgICAgICAgICAgICBtaXhMID0gbW9vZ0ZpbHRlcih2b2ljZSwgbWl4TCAqIGVudiwgJ0wnKTsNCiAgICAgICAgICAgICAgICBtaXhSID0gbW9vZ0ZpbHRlcih2b2ljZSwgbWl4UiAqIGVudiwgJ1InKTsNCg0KICAgICAgICAgICAgICAgIC8vIFJlc3RvcmUgYmFzZSBjdXRvZmYNCiAgICAgICAgICAgICAgICB2b2ljZS5maWx0ZXJDdXRvZmYgPSBzYXZlZEN1dG9mZjsNCg0KICAgICAgICAgICAgICAgIHNhbXBsZUwgKz0gbWl4TDsNCiAgICAgICAgICAgICAgICBzYW1wbGVSICs9IG1peFI7DQogICAgICAgICAgICB9DQoNCiAgICAgICAgICAgIGNvbnN0IG91dEwgPSAoc2FtcGxlTCAvIE1BWF9WT0lDRVMpICogdGhpcy5wYXJhbXMubWFzdGVyR2FpbjsNCiAgICAgICAgICAgIGNvbnN0IG91dFIgPSAoc2FtcGxlUiAvIE1BWF9WT0lDRVMpICogdGhpcy5wYXJhbXMubWFzdGVyR2FpbjsNCg0KICAgICAgICAgICAgLy8gTWlkLXNpZGUgc3RlcmVvIHdpZHRoDQogICAgICAgICAgICBjb25zdCBtaWQgID0gKG91dEwgKyBvdXRSKSAqIDAuNTsNCiAgICAgICAgICAgIGNvbnN0IHNpZGUgPSAob3V0TCAtIG91dFIpICogMC41ICogdGhpcy5wYXJhbXMuc3RlcmVvV2lkdGg7DQoNCiAgICAgICAgICAgIGxlZnRbaV0gID0gTWF0aC50YW5oKG1pZCArIHNpZGUpOw0KICAgICAgICAgICAgcmlnaHRbaV0gPSBNYXRoLnRhbmgobWlkIC0gc2lkZSk7DQogICAgICAgIH0NCg0KICAgICAgICByZXR1cm4gdHJ1ZTsNCiAgICB9DQp9DQoNCnJlZ2lzdGVyUHJvY2Vzc29yKCdvYnNpZGlhbi1wcm9jZXNzb3InLCBPYnNpZGlhblByb2Nlc3Nvcik7", "" + import.meta.url));
		const node = new AudioWorkletNode(this.audioContext, "obsidian-processor", {
			numberOfInputs: 0,
			numberOfOutputs: 1,
			outputChannelCount: [2]
		});
		node.scheduleEvents = (...events) => {
			for (const event of events) if (event.type === "wam-midi") {
				const bytes = event.data.bytes;
				const status = bytes[0] & 240;
				const note = bytes[1];
				const velocity = bytes[2];
				const time = event.time;
				const isScheduled = time !== void 0 && time > this.audioContext.currentTime + .01;
				if (status === 144 && velocity > 0) if (isScheduled) node.port.postMessage({
					type: "scheduleNote",
					data: {
						time,
						noteType: "noteOn",
						note,
						velocity
					}
				});
				else node.port.postMessage({
					type: "noteOn",
					data: {
						note,
						velocity
					}
				});
				else if (status === 128 || status === 144 && velocity === 0) if (isScheduled) node.port.postMessage({
					type: "scheduleNote",
					data: {
						time,
						noteType: "noteOff",
						note,
						velocity: 0
					}
				});
				else node.port.postMessage({
					type: "noteOff",
					data: { note }
				});
			}
		};
		this._audioNode = node;
		return node;
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
	scheduleNote(time, note, velocity) {
		this.audioNode.port.postMessage({
			type: "scheduleNote",
			data: {
				time,
				noteType: "noteOn",
				note,
				velocity
			}
		});
	}
	scheduleNoteOff(time, note) {
		this.audioNode.port.postMessage({
			type: "scheduleNote",
			data: {
				time,
				noteType: "noteOff",
				note,
				velocity: 0
			}
		});
	}
	clearSchedule() {
		this.audioNode.port.postMessage({ type: "clearSchedule" });
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
	async createGui() {
		const { mountGUI } = await import("./ObsidianGUI.js");
		const container = document.createElement("div");
		container.style.width = "660px";
		container.style.background = "#131010";
		const analyser = this.audioContext.createAnalyser();
		analyser.fftSize = 2048;
		analyser.smoothingTimeConstant = .8;
		this._audioNode.connect(analyser);
		mountGUI(container, this, analyser);
		return container;
	}
};
//#endregion
export { ObsidianWAM as default };
