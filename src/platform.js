"use strict";


module.exports = class Platform {

    constructor(log, config, homebridge) {

		const io = require("socket.io-client");
	
        this.config = config;
        this.log = log;
        this.homebridge = homebridge;
        this.debug = config.debug ? log : () => {};
        this.debug = console.debug;

		this.debug(`Connecting to socket ${this.config.socket}...`);
		this.socket = io(this.config.socket);
    
		this.homebridge.on('didFinishLaunching', () => {
            this.debug('Finished launching.');
		});

    }



	createAccessories(devices) {

        let Socket =  require('./accessories/socket.js');
        let Light = require('./accessories/light.js');
        let TV = require('./accessories/tv.js');
        let Sensor = require('./accessories/sensor.js');
        let Switch = require('./accessories/switch.js');
        
        let accessories = [];

		this.debug(`Creating accessories...`);

		for (let key in devices) {
            let device = devices[key];

			if (this.config.exclude && this.config.exclude.indexOf(device.id) >= 0) {
				this.debug(`Excluding device ${device.zoneName}/${device.name}.`);
				continue;
			}

			let Accessory = undefined;

            switch (device.class) {
                case 'tv': {
                    Accessory = TV; 
                    break;
                }
                case 'socket': {
                    Accessory = Socket;
                    break;
                }
                case 'sensor': {
                    Accessory = Sensor;
                    break;
                }
                case 'light': {
                    Accessory = Light;
                    break;
                }
                default: {
                    if (device.capabilitiesObj && device.capabilitiesObj.onoff) {
                        Accessory = Switch;
                    }
                    break;
                }
            }
			
			if (Accessory != undefined) {
				this.debug(`Adding device ${device.zoneName}/${device.name}.`);
				accessories.push(new Accessory({device:device, platform:this}));
			}
	
		}

		// this.debug(JSON.stringify(devices, null, '  '));

		return accessories;

	}


    accessories(callback) {
		
		this.socket.on('connect', () => {
		});

		this.socket.on('connected', (payload) => {

			if (this.devices == undefined) {
				let {devices, zones} = payload;
				this.debug(`Connected to socket. Found ${Object.entries(devices).length} devices.`);
	
                this.debug(JSON.stringify(devices, null, '  '));
				this.devices = devices;
				this.zones = zones;
	
				callback(this.createAccessories(devices));	
			}
		});

    }

	generateUUID(id) {
        return this.homebridge.hap.uuid.generate(id.toString());
    }

}
