var {API, Service, Characteristic} = require('./homebridge.js');
var Events = require('events');


module.exports = class extends Events  {

    constructor(options) {
		super();

        let {device, platform} = options;
		let uuid = device.id;

		this.name = device.name;

		// Apparently we need a display name...
		this.displayName = device.name;

		// Seems like we have to set the uuid_base member to a unique ID to have several platforms with accessories with the same name
		this.uuid_base = uuid;

		// What do I know, but this is set also...
		this.UUID = uuid;
		this.uuid = uuid;
		
		this.platform = platform;
		this.socket = platform.socket;
		this.device = device;
		this.log = platform.log;
		this.debug = platform.debug;
		this.services = [];

        this.addService(new Service.AccessoryInformation()); 
		this.updateCharacteristicValue(Service.AccessoryInformation, Characteristic.FirmwareRevision, "1.0");

	}

	addService(service) {
        this.services.push(service);
    }

	getServices() {
		return this.services;
	}
	
    getService(name) {
        if (name instanceof Service)
            return name;

        for (var index in this.services) {
            var service = this.services[index];
            
            if (typeof name === 'string' && (service.displayName === name || service.name === name))
                return service;
            else if (typeof name === 'function' && ((service instanceof name) || (name.UUID === service.UUID)))
                return service;
          }
        
    }	
    
    updateCharacteristicValue(service, characteristic, value) {
        this.getService(service).getCharacteristic(characteristic).updateValue(value);
    }


    enableCharacteristic(service, characteristic, getter, setter) {

        service = this.getService(service);
        
        if (typeof getter === 'function') {
            service.getCharacteristic(characteristic).on('get', async (callback) => {
				try {
					var value = await getter();
					callback(null, value);
				}
				catch(error) {
					this.log(error);
					callback();
				};
            });
        }

        if (typeof setter === 'function') {
            service.getCharacteristic(characteristic).on('set', async (value, callback) => {
				try {
					await setter(value);
				}
				catch(error) {
					this.log(error);
				}
				finally {
					callback();
				}
            });
    
        }

    }	
	
	evaluate(code, args = {}) {       
		// Call is used to define where "this" within the evaluated code should reference.
		// eval does not accept the likes of eval.call(...) or eval.apply(...) and cannot
		// be an arrow function
		return function () {
			// Create an args definition list e.g. "arg1 = this.arg1, arg2 = this.arg2"
			const argsStr = Object.keys(args).map(key => `${key} = this.${key}`).join(',');
			const argsDef = argsStr ? `let ${argsStr};` : '';
	
			return eval(`${argsDef}${code}`);
		}.call(args);
	}


	enableOnOff(service) {
		let capabilityID = 'onoff';
		let capability = this.device.capabilitiesObj[capabilityID];

		if (capability == undefined)
			return;

		let characteristic = this.getService(service).getCharacteristic(Characteristic.On);
		let deviceCapabilityID = `${this.device.id}/${capability.id}`;
		let onoff = capability.value;

		characteristic.updateValue(onoff);		

		if (capability.getable) {
			characteristic.on('get', (callback) => {
				callback(null, onoff);
			});
		}

		if (capability.setable) {
			characteristic.on('set', (value, callback) => {
				onoff = value;
				this.debug(`Emitting ${deviceCapabilityID} ${value}.`);
				this.socket.emit(deviceCapabilityID, value);
				callback();
			});	
		}


		this.socket.on(deviceCapabilityID, (value) => {
			if (value != undefined) {
				value = value == true;
				onoff = value;
				this.debug(`Updating ${this.name} ON/OFF to ${value}.`);
				characteristic.updateValue(value);		
			}

		});
	}

	enableLightSensor(service) {
		let capabilityID = 'measure_luminance';
		let capability = this.device.capabilitiesObj[capabilityID];

		if (capability == undefined)
			return;

		let characteristic = this.getService(service).getCharacteristic(Characteristic.CurrentAmbientLightLevel);
		let deviceCapabilityID = `${this.device.id}/${capability.id}`;
		let currentAmbientLightLevel = capability.value;

		characteristic.updateValue(currentAmbientLightLevel);

		if (capability.getable) {
			characteristic.on('get', (callback) => {
				callback(null, currentAmbientLightLevel);
			});	
		}

		if (capability.setable) {
			characteristic.on('set', (value, callback) => {

				currentAmbientLightLevel = value;
				
				this.debug(`Emitting ${deviceCapabilityID} ${value}.`);
				this.socket.emit(deviceCapabilityID, value);
	
				callback();
			});	
		}
		
		this.socket.on(deviceCapabilityID, (value) => {
			if (value != undefined) {
				this.debug(`Updating ${this.name} light level to ${value}.`);
				characteristic.updateValue(currentAmbientLightLevel = value);		
			}

		});	
	}


	enableBrightness(service) {
		let capabilityID = 'dim';
		let capability = this.device.capabilitiesObj[capabilityID];

		if (capability == undefined)
			return;

		let characteristic = this.getService(service).getCharacteristic(Characteristic.Brightness);
		let deviceCapabilityID = `${this.device.id}/${capability.id}`;

		this.brightness = capability.value;

		let value = capability.value;
		value = (value - capability.min) / (capability.max - capability.min);
		value = value * (characteristic.props.maxValue - characteristic.props.minValue) + characteristic.props.minValue;
		characteristic.updateValue(value);

		if (capability.getable) {
			characteristic.on('get', (callback) => {
				let value = this.brightness;
	
				value = (value - capability.min) / (capability.max - capability.min);
				value = value * (characteristic.props.maxValue - characteristic.props.minValue) + characteristic.props.minValue;
	
				callback(null, value);
			});	
		}

		if (capability.setable) {
			characteristic.on('set', (value, callback) => {

				value = (value - characteristic.props.minValue) / (characteristic.props.maxValue - characteristic.props.minValue);
				value = value * (capability.max - capability.min) + capability.min;
	
				this.brightness = value;
				
				this.debug(`Emitting ${deviceCapabilityID} ${value}.`);
				this.socket.emit(deviceCapabilityID, value);
	
				callback();
			});	
		}
		
		this.socket.on(deviceCapabilityID, (value) => {
			if (value != undefined) {
				this.brightness = value;

				value = (value - capability.min) / (capability.max - capability.min);
				value = value * (characteristic.props.maxValue - characteristic.props.minValue) + characteristic.props.minValue;
	
				this.debug(`Updating ${this.name} brightness to ${value}.`);
				characteristic.updateValue(value);		
			}

		});	
	}

/*
	enableColorTemperature(service) {

		var {get:getTopic, set:setTopic, minValue = 0, maxValue = 100} = this.config['color-temperature'] || {};

		if (getTopic) {
			var characteristic = this.getService(service).getCharacteristic(Characteristic.ColorTemperature);

			this.colorTemperature = characteristic.value;
	
			var getter = async () => {
				return this.colorTemperature;
			}
	
			var setter = async (value) => {
				try {
					this.log(`Setting color temperature to ${value}`);
					this.colorTemperature = value;

					// Convert to factor (0-1)
					value = (value - characteristic.props.minValue) / (characteristic.props.maxValue - characteristic.props.minValue);

					// Convert to mqtt value
					value = value * (maxValue - minValue) + minValue;

					this.platform.publish(setTopic, JSON.stringify(value));
		
				}
				catch (error) {
					this.log(error);
				}
		
			};
	
			this.enableCharacteristic(service, Characteristic.ColorTemperature, getter, setter);		
	
			this.on(getTopic, (value) => {
				value = (value - minValue) / (maxValue - minValue);
				value = value * (characteristic.props.maxValue - characteristic.props.minValue) + characteristic.props.minValue;
	
				this.colorTemperature = value;

				this.debug(`ColorTemperature:${getTopic}:${this.colorTemperature}`);
				this.updateCharacteristicValue(service, Characteristic.ColorTemperature, this.colorTemperature);	
			});				

			this.platform.subscribe(getTopic);
		}	
	}
*/


	enableCurrentTemperature(service) {
		let capabilityID = 'measure_temperature';
		let capability = this.device.capabilitiesObj[capabilityID];

		if (capability == undefined)
			return;
		
		let characteristic = this.getService(service).getCharacteristic(Characteristic.CurrentTemperature);
		let deviceCapabilityID = `${this.device.id}/${capability.id}`;

		this.currentTemperature = capability.value;
		characteristic.updateValue(this.currentTemperature);		

		if (characteristic.getable) {
			characteristic.on('get', (callback) => {
				this.debug(`TEMP is ${this.currentTemperature}`);
				callback(null, this.currentTemperature);
            });
		}

		this.socket.on(deviceCapabilityID, (value) => {
			if (value != undefined) {
				this.currentTemperature = value;

				this.debug(`Updating ${this.name} temperature to ${value}.`);
				characteristic.updateValue(value);		
			}

		});			

	}



	enableMotionDetected(service) {
		let capabilityID = 'alarm_motion';
		let capability = this.device.capabilitiesObj[capabilityID];

		if (capability == undefined)
			return;

		let characteristic = this.getService(service).getCharacteristic(Characteristic.MotionDetected);
		let deviceCapabilityID = `${this.device.id}/${capability.id}`;

		this.motionDetected = capability.value;

		if (capability.getable) {
			characteristic.on('get', (callback) => {
				callback(null, this.motionDetected);
			});
		}

		if (capability.setable) {
			characteristic.on('set', (value, callback) => {
				this.motionDetected = value;
				this.debug(`Emitting ${deviceCapabilityID} ${value}.`);
				this.socket.emit(deviceCapabilityID, value);
				callback();
			});	
		}


		this.socket.on(deviceCapabilityID, (value) => {
			if (value != undefined) {
				value = value == true;
				this.motionDetected = value;
				this.debug(`Updating ${this.name} motion to ${value}.`);
				characteristic.updateValue(value);		
			}

		});
	}



};

