"use strict";


module.exports = class Platform {

    constructor(log, config, homebridge) {

		const io = require("socket.io-client");
	
        this.config = config;
        this.log = log;
        this.homebridge = homebridge;
        this.debug = config.debug ? log : () => {};
		this.socket = io("http://192.168.86.37:3987");
    
		this.homebridge.on('didFinishLaunching', () => {
            this.debug('Finished launching.');
		});

    }



	createAccessories(devices) {
		let Accessories = {
			'socket': require('./accessories/switch.js'),
			'light': require('./accessories/lightbulb.js'),
			'sensor': require('./accessories/sensor.js'),
			'Xoutlet': require('./accessories/outlet.js'),
			'Xtemperature-sensor': require('./accessories/temperature-sensor.js')
		}

        let accessories = [];

		this.debug(`Creating accessories...`);

		for (let key in devices) {
			let device = devices[key];
			let Accessory = Accessories[device.class];
			
			if (Accessory != undefined) {
				accessories.push(new Accessory({device:device, platform:this}));

			}
	
		}

		return accessories;

	}


    accessories(callback) {
		
		this.socket.on('connect', () => {
		});

		this.socket.on('connected', (payload) => {

			if (this.devices == undefined) {
				let {devices, zones} = payload;
				this.debug(`Connected to socket. Found ${Object.entries(devices).length} devices.`);
	
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
