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
		let Accessories = {
			'socket': require('./accessories/socket.js'),
			'light': require('./accessories/light.js'),
			'tv': require('./accessories/tv.js'),
			'sensor': require('./accessories/sensor.js')
		}

        let accessories = [];

		this.debug(`Creating accessories...`);

		for (let key in devices) {
			let device = devices[key];
			let Accessory = Accessories[device.class];

			if (this.config.exclude && this.config.exclude.indexOf(device.id) >= 0) {
				this.debug(`Excluding device ${device.zoneName}/${device.name}.`);
				continue;
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
