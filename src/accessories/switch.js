var {Service, Characteristic} = require('../homebridge.js')
var Accessory = require('../accessory.js');

module.exports = class Switch extends Accessory {

    constructor(options) {

		super(options);
		
		this.addService(new Service.Switch(this.name, this.UUID));
		this.enableOnOff(Service.Switch);
    }


}

