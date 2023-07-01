# <div align="center">**iCloud API**</div>

<div align="center">Yet another iCloud API Wrapper.</div>

## **Features**
- 2FA Authorization
- Devices localization (does not include FMF)
- Family devices support
- Device localization address, distance & driving time

## **Resources**
- [@matt-kruse](https://github.com/matt-kruse) | [find-my-iphone](https://github.com/matt-kruse/find-my-iphone) | For FindMy service
- [@zzxx3081](https://github.com/zzxx3081) | [iCloud_Internal_API](https://github.com/zzxx3081/iCloud_Internal_API) | For 2FA authorization

## **Development environment**
### System Requirements
- [Node.js v16 or above](https://nodejs.org/en/download/)
- [Git](https://git-scm.com/downloads)

## **Installation**
```shell
npm install apple-icloudapi
```
### And You're ready to go! :tada:

## **Example**
```
var icloud = require("icloudapi");

icloud.settingsFile = "./settings.json";

icloud.getDevices((err, devices) => {
	if (err) return err;
	return console.log(devices);
	/* ^^ Returns array of devices */
})
```
For more information see [Wiki Page](https://github.com/arin2115/icloudapi/wiki)

## **Support**
If You encounter any issues, create [issue](https://github.com/arin2115/icloudapi/issues/new) and describe Your issue.
You can support me on paypal, [link](https://www.paypal.com/paypalme/arin2115)

## **Create a bug report**
If You see an error message, please create [bug report](https://github.com/arin2115/icloudapi/issues/new?labels=bug&template=bug_report.md). This would help us fixing errors in the future version of **ATime**.

## **Create a feature request**
If You have an idea that we can add to our project, please create [feature request](https://github.com/arin2115/icloudapi/issues/new?labels=enhancement&template=feature_request.md) and describe Your idea. That way we can upgrade out project over time with new ideas. Thanks!
<b>Pull requests are welcome too!</b>
