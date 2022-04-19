var {Service, Characteristic} = require('../homebridge.js')
var Accessory = require('../accessory.js');

module.exports = class Outlet extends Accessory {

    constructor(options) {

		super(options);
		
		this.addService(new Service.Outlet(this.name, this.UUID));
		this.enableOnOff(Service.Outlet);
    }



}

