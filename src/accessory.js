var {API, Service, Characteristic} = require('./homebridge.js');
var Events = require('events');
var Timer = require('yow/timer');

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
		this.updateCharacteristicValue(Service.AccessoryInformation, Characteristic.Model, this.device.driverId);
		this.updateCharacteristicValue(Service.AccessoryInformation, Characteristic.Manufacturer, this.device.driverUri);
		this.updateCharacteristicValue(Service.AccessoryInformation, Characteristic.SerialNumber, this.device.id);


		try {
			this.updateCharacteristicValue(Service.AccessoryInformation, Characteristic.Manufacturer, this.device.settings['zb_manufacturer_name']);
			this.updateCharacteristicValue(Service.AccessoryInformation, Characteristic.Model, this.device.settings['zb_product_id']);
		}
		catch(error) {
		}


		
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
                this.debug(`Setting device ${this.name}/${capabilityID} to ${value} (${deviceCapabilityID}).`);
				this.socket.emit(deviceCapabilityID, value, () => {
					onoff = value;
					callback();	
				});
			});	
		}


		this.socket.on(deviceCapabilityID, (value) => {
			onoff = value;
			this.debug(`Updating ${this.name}/${capabilityID} to ${value}.`);
			characteristic.updateValue(onoff);
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
				this.socket.emit(deviceCapabilityID, value, () => {
					deviceCapabilityID = value;
					callback();
				});
			});	
		}
		
		this.socket.on(deviceCapabilityID, (value) => {
			this.debug(`Updating ${this.name} light level to ${value}.`);
			characteristic.updateValue(currentAmbientLightLevel = value);		
		});	
	}


	enableBrightness(service) {
		let capabilityID = 'dim';
		let capability = this.device.capabilitiesObj[capabilityID];

		if (capability == undefined)
			return;

		let characteristic = this.getService(service).getCharacteristic(Characteristic.Brightness);
		let deviceCapabilityID = `${this.device.id}/${capability.id}`;

		let value = capability.value;
		value = (value - capability.min) / (capability.max - capability.min);
		value = value * (characteristic.props.maxValue - characteristic.props.minValue) + characteristic.props.minValue;
		characteristic.updateValue(value);

		let brightness = value;

		if (capability.getable) {
			characteristic.on('get', (callback) => {
				callback(null, brightness);
			});	
		}

		if (capability.setable) {
			characteristic.on('set', (value, callback) => {

				let convertedValue = value;
				convertedValue = (convertedValue - characteristic.props.minValue) / (characteristic.props.maxValue - characteristic.props.minValue);
				convertedValue = convertedValue * (capability.max - capability.min) + capability.min;
	
				this.socket.emit(deviceCapabilityID, convertedValue, () => {
					brightness = value;
					callback();
				});
			});	
		}
		
		this.socket.on(deviceCapabilityID, (value) => {

			// Hmm. Values min/max special case due to on/off
			if (value == capability.min || value == capability.max)
				return;

			value = (value - capability.min) / (capability.max - capability.min);
			value = value * (characteristic.props.maxValue - characteristic.props.minValue) + characteristic.props.minValue;

			brightness = value;

			this.debug(`Updating ${this.name} brightness to ${brightness}.`);
			characteristic.updateValue(brightness);		

		});	
	}



	enableColorTemperature(service) {
		let capabilityID = 'light_temperature';
		let capability = this.device.capabilitiesObj[capabilityID];

		if (capability == undefined)
			return;

		let characteristic = this.getService(service).getCharacteristic(Characteristic.ColorTemperature);
		let deviceCapabilityID = `${this.device.id}/${capability.id}`;
		let colorTemperature = capability.value;

		let value = capability.value;
		value = (value - capability.min) / (capability.max - capability.min);
		value = value * (characteristic.props.maxValue - characteristic.props.minValue) + characteristic.props.minValue;
		characteristic.updateValue(value);

		if (capability.getable) {
			characteristic.on('get', (callback) => {
				let value = colorTemperature;
	
				value = (value - capability.min) / (capability.max - capability.min);
				value = value * (characteristic.props.maxValue - characteristic.props.minValue) + characteristic.props.minValue;
	
				callback(null, value);
			});	
		}

		if (capability.setable) {
			characteristic.on('set', (value, callback) => {

				value = (value - characteristic.props.minValue) / (characteristic.props.maxValue - characteristic.props.minValue);
				value = value * (capability.max - capability.min) + capability.min;
	
				this.socket.emit(deviceCapabilityID, value, () => {
					colorTemperature = value;
					callback();
				});
			});	
		}
		
		this.socket.on(deviceCapabilityID, (value) => {

			colorTemperature = value;

			value = (value - capability.min) / (capability.max - capability.min);
			value = value * (characteristic.props.maxValue - characteristic.props.minValue) + characteristic.props.minValue;

			this.debug(`Updating ${this.name} color temperature to ${value}.`);
			characteristic.updateValue(value);		

		});	
	}



	enableCurrentTemperature(service) {
		let capabilityID = 'measure_temperature';
		let capability = this.device.capabilitiesObj[capabilityID];

		if (capability == undefined)
			return;
		
		let characteristic = this.getService(service).getCharacteristic(Characteristic.CurrentTemperature);
		let deviceCapabilityID = `${this.device.id}/${capability.id}`;
		let currentTemperature = capability.value;

		characteristic.updateValue(currentTemperature);		

		if (characteristic.getable) {
			characteristic.on('get', (callback) => {
				callback(null, currentTemperature);
            });
		}

		this.socket.on(deviceCapabilityID, (value) => {
			currentTemperature = value;

			this.debug(`Updating ${this.name} temperature to ${currentTemperature}.`);
			characteristic.updateValue(currentTemperature);
		});			

	}



	enableMotionDetected(service) {
		let capabilityID = 'alarm_motion';
		let capability = this.device.capabilitiesObj[capabilityID];

		if (capability == undefined)
			return;

		let characteristic = this.getService(service).getCharacteristic(Characteristic.MotionDetected);
		let deviceCapabilityID = `${this.device.id}/${capability.id}`;
		let motionDetected = capability.value;

		characteristic.updateValue(motionDetected);		

		if (capability.getable) {
			characteristic.on('get', (callback) => {
				callback(null, motionDetected);
			});
		}

		if (capability.setable) {
			characteristic.on('set', (value, callback) => {
				this.socket.emit(deviceCapabilityID, value, () => {
					motionDetected = value;
					callback();
				});
			});	
		}


		this.socket.on(deviceCapabilityID, (value) => {
			motionDetected = value;
			this.debug(`Updating ${this.name} motion to ${motionDetected}.`);
			characteristic.updateValue(motionDetected);	
		});
	}



	enableProgrammableSwitchEvent(service) {

		this.log('-------------------------------');

		let capabilityID = 'alarm_generic';
		let capability = this.device.capabilitiesObj[capabilityID];

		if (capability == undefined)
			return;



		let characteristic = this.getService(service).getCharacteristic(Characteristic.ProgrammableSwitchEvent);
		let deviceCapabilityID = `${this.device.id}/${capability.id}`;
		let capabilityValue = capability.value;

		characteristic.setProps({ maxValue: 0 });
		this.log(`${capabilityValue}!!!!!!!!`);
//		characteristic.updateValue(capabilityValue ? 1 : 0);		


		this.socket.on(deviceCapabilityID, (value) => {
			capabilityValue = value
			this.debug(`Updating ${this.name} ProgrammableSwitchEvent to ${capabilityValue}.`);
//			characteristic.updateValue(capabilityValue ? 1 : 0);		
		});
	}
};

