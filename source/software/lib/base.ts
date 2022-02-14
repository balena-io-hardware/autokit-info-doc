import * as Bluebird from 'bluebird';
import * as retry from 'bluebird-retry';
import * as sdk from 'etcher-sdk';
import * as Board from 'firmata';
import { fs } from 'mz';
import * as SerialPort from 'serialport';
import * as Stream from 'stream';

Bluebird.config({
	cancellation: true,
});

export type Logger = (msg: string) => void;

/**
 * returns available drives connected to the testbot to be flashed.
 *
 * @remark
 * Doesn't return any system drives while searching
 *
 * @throws error when it cannot find any drive connected to the testbot available to be flashed.
 */
async function getDrive(
	device: string,
): Promise<sdk.sourceDestination.BlockDevice> {
	// Do not include system drives in our search
	const adapter = new sdk.scanner.adapters.BlockDeviceAdapter(() => false);
	const scanner = new sdk.scanner.Scanner([adapter]);

	await scanner.start();

	let drive;

	try {
		drive = scanner.getBy('device', device);
	} finally {
		scanner.stop();
	}
	if (!(drive instanceof sdk.sourceDestination.BlockDevice)) {
		throw new Error(`Cannot find ${device}`);
	}

	return drive;
}

/** TestBot SDK base class. */
export abstract class TestBot extends Board {
	// Write promise configuration.
	private static PENDING_WRITE_MAX_CHECKS = 5;
	private static PENDING_WRITE_CHECK_DELAY_MS = 20;

	private activeFlash?: Bluebird<void>;

	private dutSerialPort?: SerialPort;

	protected abstract DEV_SD: string;

	protected constructor(
		serialPort: string,
		private readonly logger?: Logger,
		private readonly serialPortDutParams?: [string, number],
	) {
		super(serialPort, { skipCapabilities: true });
	}

	protected log(msg: string) {
		if (this.logger) {
			this.logger(`${Date.now()} ${msg}`);
		}
	}

	/** A helper method to ensure data is sent to Firmata transport. */
	private async flushWrites() {
		interface WriteState {
			pending: number;
		}
		const state = (this as unknown) as WriteState;

		for (let i = 0; i < TestBot.PENDING_WRITE_MAX_CHECKS; i++) {
			if (state.pending === 0) {
				break;
			}
			await Bluebird.delay(TestBot.PENDING_WRITE_CHECK_DELAY_MS);
		}
	}

	public async digitalWrite(pin: number, val: Board.PIN_STATE) {
		this.log(`write to pin ${pin} = ${val} -> started`);
		super.digitalWrite(pin, val);
		await this.flushWrites();
		this.log(`write to pin ${pin} = ${val} -> done`);
	}

	public async i2cWrite(
		address: number,
		registerOrBytes: number | number[],
		inBytes?: number[],
	) {
		const register = inBytes ? (registerOrBytes as number) : undefined;
		inBytes = inBytes ? inBytes : (registerOrBytes as number[]);
		this.log(
			`i2c write to address ${address} register ${register}, ${inBytes.length} bytes -> started`,
		);
		if (register === undefined) {
			super.i2cWrite(address, inBytes);
		} else {
			super.i2cWrite(address, register, inBytes);
		}
		await this.flushWrites();
		this.log(
			`i2c write to address ${address} register ${register}, ${inBytes.length} bytes -> done`,
		);
	}

	/**
	 * Get dev interface of the SD card
	 */
	private getDevInterface(
		devPath: string,
		timeout: retry.Options = { max_tries: 5, interval: 5000 },
	): Bluebird<string> {
		return retry(
			() => {
				return fs.realpath(devPath);
			},
			{ ...timeout, throw_original: true },
		);
	}

	public async flashToDisk(
		dst: sdk.sourceDestination.BlockDevice,
		src: Stream.Readable,
	) {
		const sdkSource = new sdk.sourceDestination.SingleUseStreamSource(src);

		const result = await sdk.multiWrite.pipeSourceToDestinations(
			sdkSource,
			// @ts-ignore
			[dst],
			(_: any, error: Error) => this.log(`Failure during flashing: ${error}`),
			(progress: sdk.multiWrite.MultiDestinationProgress) => {
				this.emit('progress', progress);
			},
			true,
		);
		if (result.failures.size > 0) {
			const errorsMessage = new Array(...result.failures.values())
				.map((e) => e.message)
				.join('\n');
			throw new Error(
				`Flashing failed with the following errors: ${errorsMessage}`,
			);
		}
	}

	/**
	 * Flash SD card with operating system
	 */
	public async flash(stream: Stream.Readable): Promise<void> {
		this.activeFlash = Bluebird.try(async () => {
			await this.switchSdToHost(5000);

			// For linux, udev will provide us with a nice id for the testbot.
			const drive = await getDrive(await this.getDevInterface(this.DEV_SD));

			this.log(`Start flashing the image`);
			await this.flashToDisk(drive, stream);
			this.log('Flashing completed');
		});

		await this.activeFlash;
		this.activeFlash = undefined;
	}

	/** Open the DUT serial output stream if it's available. */
	public async openDutSerial(): Promise<Stream.Readable | null> {
		if (this.dutSerialPort != null) {
			return this.dutSerialPort;
		}

		if (this.serialPortDutParams == null) {
			return null;
		}

		// Ensure the device is available.
		let devPath: string;
		try {
			devPath = await this.getDevInterface(this.serialPortDutParams[0]);
		} catch (e) {
			return null;
		}
		this.log('DUT serial is enabled');

		this.dutSerialPort = new SerialPort(devPath, {
			baudRate: this.serialPortDutParams[1],
			autoOpen: false,
		});
		this.dutSerialPort.open(() => {
			this.log('DUT serial is opened');
			this.dutSerialPort?.flush();
		});

		return this.dutSerialPort;
	}

	/** Close the DUT serial output stream if open */
	public async closeDutSerial() {
		if (this.dutSerialPort) {
			const serialPort = this.dutSerialPort;
			this.dutSerialPort = undefined;

			if (serialPort.isOpen) {
				await Bluebird.fromCallback((c) => serialPort.close(c));
			}
			this.log('DUT serial port is closed');
		} else {
			this.log('DUT serial port was not opened before');
		}
	}

	/**
	 * Method to teardown testbot HAT & turn off DUT gracefully at end of testing
	 *
	 * @param if value is true firmata connection is closed
	 *
	 */
	public async teardown(destroy: boolean = false) {
		this.log(`Performing teardown (destroy=${destroy})...`);
		try {
			if (this.activeFlash != null) {
				this.activeFlash.cancel();
			}

			await this.closeDutSerial();
			await this.powerOffDUT();
			// We try to keep the SD card detached from the host as long as possible.
			// The motivation is that we flash an OS image to the attached drive, and want to minimize the risk
			// of the host OS picking up the wrong OS image on boot.
			await this.switchSdToDUT(0);
		} finally {
			if (destroy) {
				this.teardownBoard();
			}
		}
	}

	/** Prepare testbot for performing actions on a DUT. */
	public abstract async setup(): Promise<void>;

	/** Set target Vout to power the DUT. Should be executed before powerOn(). */
	public abstract async setVout(target: number): Promise<void>;

	/** Get current Vout. */
	public abstract async readVout(): Promise<number>;

	/** Get current amperage on Vout. */
	public abstract async readVoutAmperage(): Promise<number>;

	public abstract async powerOffDUT(): Promise<void>;

	public abstract async powerOnDUT(): Promise<void>;

	public abstract async switchSdToDUT(delay: number): Promise<void>;

	public abstract async switchSdToHost(delay: number): Promise<void>;

	protected abstract teardownBoard(): void;
}
