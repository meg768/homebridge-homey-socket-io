var {Service, Characteristic} = require('../homebridge.js')
var Accessory = require('../accessory.js');


module.exports = class extends Accessory {

    constructor(options) {

		super(options);
		
		if (this.device.capabilitiesObj['alarm_motion']) {
			this.addService(new Service.MotionSensor(this.name, this.UUID));
			this.enableMotionDetected(Service.MotionSensor);	
		}
		if (this.device.capabilitiesObj['measure_temperature']) {
			this.addService(new Service.TemperatureSensor(this.name, this.UUID));
			this.enableCurrentTemperature(Service.TemperatureSensor);		
		}
		if (this.device.capabilitiesObj['measure_luminance']) {
			this.addService(new Service.LightSensor(this.name, this.UUID));
			this.enableLightSensor(Service.LightSensor);		
		}


		/*
		if (this.device.capabilitiesObj['alarm_generic']) {
			this.addService(new Service.Doorbell(this.name, this.UUID));
			this.enableProgrammableSwitchEvent(Service.Doorbell);		

		}
		*/
    }



}

