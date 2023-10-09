var request = require("request");
var util = require("util");
const prompt = require("prompt-sync")({ sigint: true });
var fs = require('fs');

const CookieFileStore = require('tough-cookie-file-store').FileCookieStore

var icloud = {
	AccountHeaders: [],
	base_path: "",

	init: function(callback) {
		if (!icloud.hasOwnProperty("icloudSettingsFile")) {
			return callback("iCloud Settings File is missing | icloudSettingsFile");
		}

		var settings = JSON.parse(fs.readFileSync(icloud.icloudSettingsFile, "utf8"));

		if (settings.apple_id == null || settings.password == null) {
			return callback("apple_id / password is not set in settings file");
		}

		icloud.apple_id = settings.apple_id;
		icloud.password = settings.password;
		icloud.googleApiKey = settings.googleApiKey;
		icloud.trustToken = settings.trustToken;
		icloud.unattended = settings.unattended;

		var newLogin = !icloud.hasOwnProperty("jar");
		if (newLogin) {
			icloud.jar = new request.jar(new CookieFileStore('cookies.json'))
		}

		icloud.iRequest = request.defaults({
			jar: icloud.jar,
			headers: {
				"Origin": "https://www.icloud.com",
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
			}
		});

		if (newLogin) {
			icloud.login(function(err, res, body) {
				return callback(err, res, body);
			}, true);
		} else {
			icloud.checkSession(function(err, res, body) {
				if (err) {
					console.log("Session dead");
					
					icloud.jar = null;
					try {
						fs.unlinkSync("cookies.json");
					} catch (err) {
						console.log("No cookies.json file to delete");
					}
					icloud.jar = request.jar(new CookieFileStore("cookies.json"));

					icloud.login(function(err, res, body) {
						return callback(err, res, body);
					}, false);
				} else {
					return callback(err, res, body);
				}
			});
		}
	},

	login: function(callback, checkSession = true) {
		if (checkSession) {
			icloud.checkSession(function(err, res, body) {
				if (err) {
					//session is dead, start new
					icloud.jar = null;
					icloud.jar = request.jar(new CookieFileStore("cookies.json"));
	
					icloud.login(function(err, res, body) {
						return callback(err, res, body);
					}, false);
				} else {
					return callback(err, res, body);
				}
			});
		} else {
			icloud.signInRequest(function(info) {
				if (info.toString().startsWith("Login Error")) {
					console.error(info);
					return callback(info);
				}
	
				if (info == false) {
					icloud.AccountLoginRequest(function(info) {
						if (info.toString().startsWith("Login Error")) {
							console.error(info);
							return callback(info);
						}

						icloud.onLogin(info, function(err, resp, body) {
							return callback(err, resp, body);
						});
					});
				} else {
					icloud.TwoFACodeRequest(function(info) {
						if (info.toString().startsWith("Login Error")) {
							console.error(info);
							return callback(info);
						}
	
						icloud.TrustTokenRequest(function(info) {
							if (info.toString().startsWith("Login Error")) {
								console.error(info);
								return callback(info);
							}
	
							icloud.AccountLoginRequest(function(info) {
								if (info.toString().startsWith("Login Error")) {
									console.error(info);
									return callback(info);
								}
	
								icloud.onLogin(info, function(err, resp, body) {
									return callback(err, resp, body);
								});
							});
						});
					});
				}
			});
		}
	},

	signInRequest: async function(callback) {
		var trustToken = icloud.trustToken;
		if (!trustToken) trustToken = "";

		var options = {
			url: "https://idmsa.apple.com/appleauth/auth/signin",
			headers: {
                'Content-Type': 'application/json',
                'Referer': 'https://idmsa.apple.com/',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                'Origin': 'https://idmsa.apple.com',
                'X-Requested-With': 'XMLHttpRequest',
                'X-Apple-Widget-Key': 'd39ba9916b7251055b22c7f910e2ea796ee65e98b2ddecea8f5dde8d9d1a815d'
            },
			json: {
                'accountName': icloud.apple_id,
                'password': icloud.password,
                'rememberMe': true,
				'trustTokens': [trustToken]
			}
		};

		icloud.iRequest.post(options, function(error, response, body) {
			if (!response || !(response.statusCode == 409 || response.statusCode == 200)) {
				return callback("Login Error | Invalid apple_id or password?");
			}
			
			icloud.AccountHeaders["scnt"] = response.headers["scnt"];
			icloud.AccountHeaders['X-Apple-Auth-Attributes'] = response.headers['x-apple-auth-attributes']
			icloud.AccountHeaders['X-Apple-Widget-Key'] = 'd39ba9916b7251055b22c7f910e2ea796ee65e98b2ddecea8f5dde8d9d1a815d'
			icloud.AccountHeaders['X-Apple-Session-Token'] = response.headers['x-apple-session-token']
			icloud.AccountHeaders['X-Apple-ID-Account-Country'] = response.headers['x-apple-id-account-country']
			icloud.AccountHeaders['X-Apple-ID-Session-Id'] = response.headers['x-apple-id-session-id']

			return callback(response.headers["x-apple-twosv-trust-eligible"] != null);
		});
	},

	TwoFACodeRequest: function(callback) {
		if (icloud.unattended === true) {
			return callback("Login Error | Unattended Mode is active, unable to get 2FA code");
		}

		const code = prompt("2FA Code: ");

		var options = {
			url: "https://idmsa.apple.com/appleauth/auth/verify/trusteddevice/securitycode",
			headers: {
				'Content-Type': 'application/json',
				'Referer': 'https://idmsa.apple.com/',
				'scnt': icloud.AccountHeaders['scnt'],
				'X-Apple-ID-Session-Id': icloud.AccountHeaders['X-Apple-ID-Session-Id'],
				'X-Apple-Widget-Key': icloud.AccountHeaders['X-Apple-Widget-Key'],
			},
			json: {
				'securityCode': {
					'code': code
				}
			}
		};

		icloud.iRequest.post(options, function(error, response, body) {
			icloud.AccountHeaders['X-Apple-Session-Token'] = response.headers['x-apple-session-token'];
			
			if (response.statusCode == 400) {
				return callback("Login Error | Invalid 2FA Code");
			}

			if (!response || response.statusCode != 204) {
				return callback("Login Error | Unable to verify 2FA code");
			}

			if (response.headers["x-apple-session-token"] == null) {
				return callback("Login Error | Something went wrong with 2FA verification");
			}

			return callback(true);
		});
	},

	TrustTokenRequest: function(callback) {
		var options = {
			url: "https://idmsa.apple.com/appleauth/auth/2sv/trust",
			headers: {
				'Content-Type': 'application/json',
				'Referer': 'https://idmsa.apple.com/',
				'scnt': icloud.AccountHeaders['scnt'],
				'X-Apple-ID-Session-Id': icloud.AccountHeaders['X-Apple-ID-Session-Id'],
				'X-Apple-Widget-Key': icloud.AccountHeaders['X-Apple-Widget-Key'],
			}
		};

		icloud.iRequest.get(options, function(error, response, body) {
			icloud.AccountHeaders['X-Apple-Session-Token'] = response.headers['x-apple-session-token'];
			icloud.AccountHeaders['X-Apple-TwoSV-Trust-Token'] = response.headers['x-apple-twosv-trust-token'];

			icloud.trustToken = response.headers['x-apple-twosv-trust-token'];
			fs.writeFileSync(icloud.icloudSettingsFile, JSON.stringify({
				apple_id: icloud.apple_id,
				password: icloud.password,
				googleApiKey: icloud.googleApiKey,
				trustToken: icloud.trustToken,
				unattended: icloud.unattended
			}, null, 4));

			if (!response || response.statusCode != 204) {
				return callback("Login Error | Unable to get trust token");
			}

			if (response.headers["x-apple-session-token"] == null || response.headers["x-apple-twosv-trust-token"] == null) {
				return callback("Login Error | Invalid trust token response");
			}

			return callback(true);
		});
	},

	AccountLoginRequest: function(callback) {
		var options = {
			url: "https://setup.iCloud.com/setup/ws/1/accountLogin",
			headers: {
				'Accept': 'application/json, text/javascript, */*; q=0.01',
				'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
				'Referer': 'https://www.icloud.com/',
				'Origin': 'https://www.icloud.com',
				'Connection': 'keep-alive',
			},
			json: {
				'dsWebAuthToken': icloud.AccountHeaders['X-Apple-Session-Token'],
				'accountCountryCode': icloud.AccountHeaders['X-Apple-ID-Account-Country'],
				'extended_login': "true"
			}
		};

		icloud.iRequest.post(options, function(error, response, body) {
			var cookies = response.headers['set-cookie'];
			if (cookies && cookies.length > 0) {
				cookies.forEach(cookie => {
					icloud.jar.setCookie(cookie, 'https://setup.iCloud.com/');
				})
			}

			if (!response || response.statusCode != 200) {
				return callback("Login Error | Unable to login");
			}

			if (body.dsInfo.dsid == null) {
				return callback("Login Error | Missing account dsid");
			}

			return callback(body);
		});
	},

	checkSession: function(callback) {

		var options = {
			url: "https://setup.icloud.com/setup/ws/1/validate"
		};

		icloud.iRequest.post(options, function(error, response, body) {
			if (!response || response.statusCode != 200) {
				return callback("Login Error | Could not refresh session");
			}

			icloud.onLogin(JSON.parse(body), function(err, resp, body) {
				if (resp.statusCode == 450) {
					icloud.signInRequest(function(info) {
						if (info.toString().startsWith("Login Error")) {
							return callback(info);
						}
			
						if (info == false) {
							icloud.AccountLoginRequest(function(info) {
								if (info.toString().startsWith("Login Error")) {
									return callback(info);
								}
		
								icloud.onLogin(info, function(err, resp, body) {
									return callback(err, resp, body);
								});
							});
						} else {
							try {
								fs.unlinkSync("cookies.json");
								icloud.login(() => {

								});
							} catch (err) {}
						}
					});
				} 

				return callback(err, resp, body);
			});

		});
	},

	onLogin: function(body, callback) {
		if (body.hasOwnProperty("webservices") && body.webservices.hasOwnProperty("findme")) {
			icloud.base_path = body.webservices.findme.url;

			options = {
				url: icloud.base_path + "/fmipservice/client/web/initClient",
				json: {
					"clientContext": {
						"appName": "iCloud Find (Web)",
						"appVersion": "2.0",
						"timezone": "US/Eastern",
						"inactiveTime": 3571,
						"apiVersion": "3.0",
						"fmly": true 
					}
				}
			};
		
			icloud.iRequest.post(options, callback);
		} else {
			return callback("Cannot parse webservice FindMe url");
		}
	},

	getDevices: function(callback) {
		icloud.init(function(error, response, body) {
			if (response.statusCode == 450) {
				try {
					fs.unlinkSync("cookies.json");
					icloud.login(() => {

					});
				} catch (err) {}
				icloud.signInRequest(function(info) {
					if (info.toString().startsWith("Login Error")) {
						return callback(info);
					}
		
					if (info == false) {
						icloud.AccountLoginRequest(function(info) {
							if (info.toString().startsWith("Login Error")) {
								return callback(info);
							}
	
							icloud.onLogin(info, function(err, resp, body) {
								return callback(err, resp, body);
							});
						});
					} else {
						try {
							fs.unlinkSync("cookies.json");
							icloud.login(() => {
						
							});
						} catch (err) {}
					}
				});
			} else {
				if (!response || response.statusCode != 200) {
					return callback(error);
				}
	
				var devices = [];
	
				// Retrieve each device on the account
				body.content.forEach(function(device) {
					devices.push({
						id: device.id,
						name: device.name,
						deviceModel: device.deviceModel,
						activationLocked: device.activationLocked,
						deviceStatus: device.deviceStatus,
						passcodeLength: device.passcodeLength,
						modelDisplayName: device.modelDisplayName,
						deviceDisplayName: device.deviceDisplayName,
						batteryLevel: device.batteryLevel,
						batteryStatus: device.batteryStatus,
						audioChannels: device.audioChannels,
						isLocating: device.isLocating,
						lostModeCapable: device.lostModeCapable,
						location: device.location
					});
				});
	
				return callback(error, devices);
			}

			callback(error, []);
		});
	},

	alertDevice: function(deviceId, callback, subject = "Find My Alert") {
		var options = {
			url: icloud.base_path + "/fmipservice/client/web/playSound",
			json: {
				"subject": subject,
				"device": deviceId
			}
		};
		icloud.iRequest.post(options, callback);
	},

	getLocationOfDevice: function(device, callback) {
		if (!device.location) {
			return callback("Device has no location");
		}

		var googleUrl = "https://maps.googleapis.com/maps/api/geocode/json?latlng=%d,%d&sensor=true&key=%s";

		googleUrl = util.format(googleUrl, device.location.latitude, device.location.longitude, icloud.googleApiKey);

		var req = {
			url: googleUrl,
			json: true
		};

		request(req, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				if (Array.isArray(json.results) &&
					json.results.length > 0 &&
					json.results[0].hasOwnProperty("formatted_address")) {

					return callback(err, json.results[0].formatted_address);
				}
			}
			return callback(err);
		});
	},

	getDistanceOfDevice: function(device, myLatitude, myLongitude, callback) {
		if (device.location) {
			var googleUrl = "https://maps.googleapis.com/maps/api/distancematrix/json?origins=%d,%d&destinations=%d,%d&mode=driving&sensor=false&key=%s";

			googleUrl = util.format(googleUrl, myLatitude, myLongitude, device.location.latitude, device.location.longitude, icloud.googleApiKey);

			var req = {
				url: googleUrl,
				json: true
			};

			request(req, function(err, response, json) {
				if (!err && response.statusCode == 200) {
					if (json && json.rows && json.rows.length > 0) {
						return callback(err, json.rows[0].elements[0]);
					}
					return callback(err);
				}
			});
		} else {
			callback("Device has no location");
		}
	}

	// TOOD: Add more services (iCloud Drive, Mail, Calendar, Reminders, etc.)
};

module.exports = icloud;
