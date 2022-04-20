var {Service, Characteristic} = require('../homebridge.js')
var Accessory = require('../accessory.js');

module.exports = class extends Accessory {

    constructor(options) {
		super(options);
		
		this.addService(new Service.Lightbulb(this.name, this.UUID));
		this.enableOnOff(Service.Lightbulb);
		this.enableBrightness(Service.Lightbulb);
		this.enableColorTemperature(Service.Lightbulb);
    }





}

