import * as Bluebird from 'bluebird';
import { fs } from 'mz';
import * as Stream from 'stream';
import * as zlib from 'zlib';
import { TestBot } from './base';
import * as sdk from 'etcher-sdk';
import * as path from 'path';
import { exec } from 'mz/child_process';
// import * as retry from 'bluebird-retry';

/**
 * `DeviceInteractor` class can be used as a base class for interaction with a
 * particular DUT type through the testbot. Extend this class and use its methods
 * to form implementation of other new `deviceType`.
 *
 * @example
 * Use this example snippet below to get started on creating a new deviceType
 * implmentation. Our new device is called SomeNewDevice.
 * ```ts
 * export class SomeNewDevice extends DeviceInteractor {
 * 		// 7 volts is our sample target voltage needed to power ON the SomeNewDevice.
 * 		constructor(testBot: TestBot) {
 * 			super(testBot, 7);
 * 	 	}
 *
 *   	async powerOn() {
 * 			// Instructions to power on DUT go here, steps broadly are:
 * 			// 1. Set the target voltage with setVout(this.powerVoltage)
 * 			// 2. Switch SD card to the DUT with switchSdToDUT()
 * 			// 3. Power on the DUT with powerOnDUT()
 * 			// 4. Any custom steps
 *   	}
 *
 * 	 	private customDeviceSpecificMethod() {
 * 	 		// Code goes here!
 * 	 	}
 * }
 * ```
 *
 * @remark
 * You can check {@link https://github.com/balena-io/testbotsdk/blob/master/lib/devices.ts}
 * for device implementation of RaspberryPi and Intel-nuc `deviceType` as examples.
 */
export abstract class DeviceInteractor {
	/**
	 * @param powerVoltage The value of target voltage in volts needed by the DUT. This
	 * value is used to set the output voltage that is supplied to the DUT.
	 */
	protected constructor(
		protected readonly testBot: TestBot,
		public readonly powerVoltage: number,
	) {}

	/**
	 * Flash the SD card inside the SD Mux.
	 *
	 * @param stream Pass stream of the image file to be flashed
	 */
	async flash(stream: Stream.Readable) {
		await this.testBot.flash(stream);
	}

	/**
	 * Specify filepath of image to flash and creates a stream of the image. Image
	 * file should be compressed with gzip compressions (having file extension `.gz`).
	 *
	 * @param filePath file path of the image.
	 * @throws Will result in error if the filepath end with `.zip`. Zip files are not supported.
	 */
	async flashFromFile(filePath: string) {
		if (filePath.endsWith('.zip')) {
			throw new Error('zip files are not supported');
		}

		let src: Stream.Readable = await fs.createReadStream(filePath);
		if (filePath.endsWith('.gz')) {
			src = src.pipe(zlib.createGunzip());
		}
		await this.flash(src);
	}

	/** Signals the DUT to be powered off and close the DUT serial output stream. */
	async powerOff() {
		await this.testBot.closeDutSerial();
		await this.testBot.powerOffDUT();
	}

	/**
	 * Abstract method to power ON the DUT as per specifications.
	 *
	 * @remark
	 * Use this method to define a set of instructions for powering on the DUT, since
	 * each device has a widely different power on procedure and different voltage
	 * needed hence the method is kept abstract.
	 */
	abstract async powerOn(): Promise<void>;
}

/** Implementation for Raspberry Pi like devices. */
export class RaspberryPi extends DeviceInteractor {
	constructor(testBot: TestBot) {
		super(testBot, 5);
	}

	async powerOn() {
		await this.testBot.setVout(this.powerVoltage);
		await this.testBot.switchSdToDUT(1000);
		await this.testBot.powerOnDUT();
	}
}

/** Implementation for Beaglebone like devices. */
export class BeagleBone extends DeviceInteractor {
	constructor(testBot: TestBot) {
		super(testBot, 5);
	}

	async checkDutPower() {
		const [stdout, stderr] = await exec(`cat /sys/class/net/eth1/carrier`);
		console.log(stderr);
		const file = stdout.toString();
		if (file.includes('1')) {
			console.log(`DUT is currently On`);
			return true;
		} else {
			console.log(`DUT is currently Off`);
			return false;
		}
	}

	async waitInternalFlash() {
		await this.testBot.powerOffDUT();
		await this.testBot.setVout(this.powerVoltage);
		await this.testBot.switchSdToDUT(5000); // Wait for 5s after toggling mux, to ensure that the mux is toggled to DUT before powering it on
		await this.testBot.powerOnDUT();

		await Bluebird.delay(5000); // Wait 5s before measuring current for the first time, or we may power off again during flashing!
		let current = await this.testBot.readVoutAmperage();
		let timedOut = 0;
		console.log('Initial current measurement:' + current + ' Amps');

		const timeoutHandle = setTimeout(() => {
			timedOut = 1;
		}, 360000); // 6 minute timeout

		while (current > 0.1 && timedOut === 0) {
			await Bluebird.delay(5000); // Wait 5s before measuring current again.
			current = await this.testBot.readVoutAmperage();
			console.log(
				'Awaiting DUT to flash internally and power down, current: ' +
					current +
					' Amps',
			);
		}

		clearTimeout(timeoutHandle);
		if (timedOut === 1) {
			throw new Error('Timed out while waiting for DUT to flash');
		} else {
			console.log('Internally flashed - powering off DUT');
			// Once current has dropped below the threshold, power off and toggle mux.
			await this.testBot.powerOffDUT();
			await this.testBot.switchSdToHost(1000);
		}
	}

	async powerOn() {
		await this.testBot.setVout(this.powerVoltage);
		await this.testBot.powerOnDUT();
	}

	async flash(stream: Stream.Readable) {
		console.log('Entering flash method for Beaglebone');

		// power off first
		await this.powerOff();

		// Flash the SD card
		await this.testBot.flash(stream);

		// wait for device to internally flash
		await this.waitInternalFlash();

		console.log(`Device flashed`);

		await this.powerOff();
		await this.testBot.switchSdToHost(1000);
	}
}

/** Implementation for balenaFin v1.1.x (V10+)
 * @remark
 * For the balenaFin `v1.0.0`, see the [[BalenaFinV09]] child class.
 */
export class BalenaFin extends DeviceInteractor {
	constructor(testBot: TestBot) {
		super(testBot, 12);
	}

	readonly OUTPUT_DIR = path.join(__dirname, '..', 'bin', '/');

	// usb-toggle
	async toggleUsb(state: boolean, port: number) {
		console.log(`Toggling USB ${state ? 'on' : 'off'}`);
		await exec(
			`${this.OUTPUT_DIR}uhubctl -a ${state ? 'on' : 'off'} -p ${port} -l 1-1`,
		);
	}

	protected async powerOnFlash() {
		await this.toggleUsb(false, 4);
		await Bluebird.delay(1000 * 8); // Wait 8s before trying to turning USB back on
		await this.toggleUsb(true, 4);
	}

	async flash(stream: Stream.Readable) {
		let tries = 0;
		while (tries < 3) {
			console.log(`Entering flash method for Fin, attempt ${tries + 1}`);

			await this.toggleUsb(false, 4);
			await this.testBot.powerOffDUT();
			await Bluebird.delay(1000); // Wait 8s before trying to turning USB back on

			await this.powerOnFlash();
			// etcher-sdk (power on) usboot
			const adapters: sdk.scanner.adapters.Adapter[] = [
				new sdk.scanner.adapters.BlockDeviceAdapter(() => false),
				new sdk.scanner.adapters.UsbbootDeviceAdapter(),
			];
			const deviceScanner = new sdk.scanner.Scanner(adapters);
			console.log('Waiting for compute module');
			// Wait for compute module to appear over usb
			const computeModule: sdk.sourceDestination.UsbbootDrive = await new Promise(
				(resolve, reject) => {
					function onAttach(
						drive: sdk.scanner.adapters.AdapterSourceDestination,
					) {
						if (drive instanceof sdk.sourceDestination.UsbbootDrive) {
							deviceScanner.removeListener('attach', onAttach);
							resolve(drive);
						}
					}
					deviceScanner.on('attach', onAttach);
					deviceScanner.on('error', reject);
					deviceScanner.start();
				},
			);
			console.log('Compute module attached');
			// wait to convert to block device.
			await new Promise<void>((resolve, reject) => {
				function onDetach(
					drive: sdk.scanner.adapters.AdapterSourceDestination,
				) {
					if (drive === computeModule) {
						deviceScanner.removeListener('detach', onDetach);
						resolve();
					}
				}
				deviceScanner.on('detach', onDetach);
				deviceScanner.on('error', reject);
			});

			// start a timeout - if the fin takes too long to appear as a block device, we must retry from the beginning

			console.log('Waiting for compute module to reattach as a block device');

			// let reAttachFail = false;
			const dest = await new Promise(
				(
					resolve: (drive: sdk.sourceDestination.BlockDevice) => void,
					reject,
				) => {
					const timeout = setTimeout(() => {
						clearTimeout(timeout);
						console.log(`DEBUG: Timed out!`);
						reject();
					}, 1000 * 60 * 5);

					function onAttach(
						drive: sdk.scanner.adapters.AdapterSourceDestination,
					) {
						if (
							drive instanceof sdk.sourceDestination.BlockDevice &&
							drive.description === 'Compute Module'
						) {
							console.log('Attached compute module.');
							clearTimeout(timeout);
							resolve(drive);
							deviceScanner.removeListener('attach', onAttach);
						}
					}
					deviceScanner.on('attach', onAttach);
					deviceScanner.on('error', reject);
				},
			).catch(() => {
				console.log(`Caught promise reject`);
				// reAttachFail = true
			});
			deviceScanner.stop();

			if (dest instanceof Object) {
				await Bluebird.delay(1000); // Wait 1s before trying to flash
				console.log('Flashing started...');
				await this.testBot.flashToDisk(dest, stream);
				console.log('Flashed!');
				break;
			}

			console.log(`Flashing failed`);
			tries++;
		}
		await this.toggleUsb(false, 4);
		await this.testBot.powerOffDUT();
	}

	async powerOn() {
		console.log('Powering on Fin');
		await this.toggleUsb(false, 4);
		await Bluebird.delay(1000 * 8);
		await this.testBot.setVout(this.powerVoltage);
		await this.testBot.powerOnDUT();
	}
}

/** Implementation for balenaFin v1.0.0
 * @remark
 * The balenaFin `v1.0.0` (V09) has a slightly different USB boot power sequence that may
 * damage later versions (V10+) of the balenaFin.
 */
export class BalenaFinV09 extends BalenaFin {
	protected async powerOnFlash() {
		await this.toggleUsb(false, 4);
		await Bluebird.delay(1000); // Wait 1s before trying to turning USB back on
		await this.toggleUsb(true, 4);
		await this.testBot.setVout(this.powerVoltage);
		await this.testBot.powerOnDUT();
	}
}

/** Implementation for Intel NUC devices. */
export class IntelNuc extends DeviceInteractor {
	constructor(testBot: TestBot) {
		super(testBot, 12);
	}

	async powerOn() {
		await this.testBot.powerOffDUT();
		await this.testBot.setVout(this.powerVoltage);
		await this.testBot.switchSdToDUT(5000); // Wait for 5s after toggling mux, to ensure that the mux is toggled to DUT before powering it on
		await this.testBot.powerOnDUT();

		await Bluebird.delay(5000); // Wait 5s before measuring current for the first time, or we may power off again during flashing!
		let current = await this.testBot.readVoutAmperage();
		let timedOut = 0;
		console.log('Initial current measurement:' + current + ' Amps');

		const timeoutHandle = setTimeout(() => {
			timedOut = 1;
		}, 360000); // 6 minute timeout

		while (current > 0.1 && timedOut === 0) {
			await Bluebird.delay(5000); // Wait 5s before measuring current again.
			current = await this.testBot.readVoutAmperage();
			console.log(
				'Awaiting DUT to flash and power down, current: ' + current + ' Amps',
			);
		}

		clearTimeout(timeoutHandle);
		if (timedOut === 1) {
			throw new Error('Timed out while waiting for DUT to flash');
		} else {
			console.log('Internally flashed - powering off DUT');
			// Once current has dropped below the threshold, power off and toggle mux.
			await this.testBot.powerOffDUT();
			await this.testBot.switchSdToHost(1000);
			// Turn power back on, this should now get the NUC to boot from internal mmc as USB is no longer connected.
			await this.testBot.powerOnDUT();
			console.log('Powering on DUT - should now boot from internal storage');
		}
	}
}
