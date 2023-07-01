var icloud = require("./index");
var assert = require("assert");

icloudSettingsFile = "settings.json";

(() => {
	var device;

	icloud.icloudSettingsFile = icloudSettingsFile;
	assert(icloud.icloudSettingsFile);

	icloud.getDevices(function(error, devices) {
		assert(!error);
		assert(devices);
		assert(devices.length > 0);
		devices.forEach(function(d) {
			if (device == undefined && d.location && d.lostModeCapable) {
				console.log(d);
				device = d;
			}
		});
		assert(device);
	});

	setTimeout(() => {
		icloud.getDistanceOfDevice(device, 51.9189046, 19.1343786, function(error, result) {
			assert(!error);
			assert(result.distance.value > 0);
			assert(result.duration.value > 0);
			console.log(result.distance.text);
			console.log(result.duration.text);
		});
	
		icloud.getLocationOfDevice(device, function(error, location) {
			assert(!error);
			assert(location);
			console.log(location);
		});

		icloud.alertDevice(device.id, function(error) {
			assert(!error);
		});
	}, 15000);
})();