import * as Bluebird from 'bluebird';
import * as Stream from 'stream';
import * as SerialPort from 'serialport';
import { Logger, TestBot } from './base';

/**
 * @returns I2c address of the device
 */
const parseI2cAddress = (value: string | undefined, def: number) => {
	if (!value) {
		return def;
	}
	const parsedValue = parseInt(value, undefined);
	if (isNaN(parsedValue)) {
		return def;
	}
	return parsedValue;
};

/** Implementation for testbot HAT extending on the native testbot class. */
export class TestBotHat extends TestBot {
	private static DEV_TESTBOT = '/dev/ttyS0';

	private static DEV_DUT_SERIAL = '/dev/ttyAMA0';
	private static DEV_DUT_SERIAL_BAUDRATE = 115200;

	private static SETUP_TIMEOUT_MS = 10000;

	private static PINS = {
		SD_RESET_N: 0,
		SD_MUX_SEL_PIN: 2,
		DUT_PW_EN: 14,
		OE_TXB: 13,
		OE_TXS: 15,
	};

	// Configuration for mcp4725.
	private static PSU_CONFIG = {
		// This address works for the testbot HATs used in the London rig but can differ depending on
		// what resistors are on the board.
		// TODO: Change it to configure in the constructor. This class should not consume env variables directly.
		ADDR: parseI2cAddress(process.env.TESTBOT_PSU_ADDRESS, 0x61),
		DAC: 0x40,
	};

	// Configuration for ina260.
	private static CURRENT_SENSOR_CONFIG = {
		ADDR: 0x40,
		CURRENT: 0x01,
		VOLTAGE: 0x02,
	};

	private static VDAC_MAX = 3.3;
	private static DIN_MAX = 4095;

	protected DEV_SD =
		'/dev/disk/by-id/usb-Generic_Ultra_HS-SD_MMC_000008264001-0:0';

	constructor(logger?: Logger) {
		super(TestBotHat.DEV_TESTBOT, logger, [
			TestBotHat.DEV_DUT_SERIAL,
			TestBotHat.DEV_DUT_SERIAL_BAUDRATE,
		]);
	}

	/**
	 *  Method to setup HAT's firmata connection and ready the testbot for testing
	 */
	public async setup() {
		await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Firmata connection timed out'));
			}, TestBotHat.SETUP_TIMEOUT_MS);

			const resolver = () => {
				clearTimeout(timeout);
				resolve();
			};

			this.once('error', (error) => {
				clearTimeout(timeout);
				reject(error);
			});

			if (Object.keys(this.version).length === 0) {
				this.once('ready', resolver);
			} else {
				resolver();
			}
		});

		this.on('string', (msg) => this.log(`coprocessor: ${msg}`));

		Object.values(TestBotHat.PINS).forEach((pin) => {
			this.pinMode(pin, TestBotHat.PIN_MODE.OUTPUT);
		});

		// Ensure DUT is off.
		await this.powerOffDUT();
		// And SD card is not yet attached to the host. This will also reset the USB hub.
		await this.switchSdToDUT();

		this.log('testbot is ready!');
	}

	/** Reset SD mux hub. It takes the mux at most 500us to recover. */
	private async resetHub() {
		// We need to send an active-low signal, at least 1us wide.
		this.log('Start resetting the hub');
		await this.digitalWrite(TestBotHat.PINS.SD_RESET_N, 0);

		// Await calls here take at least a dozen of ms to complete. So, no extra delays are neeed.
		await this.digitalWrite(TestBotHat.PINS.SD_RESET_N, 1);
		this.log('Completed resetting the hub');
	}

	/**
	 *  Switches SD card control to the DUT
	 */
	public async switchSdToDUT(settle: number = 0) {
		this.log('Switching SD card to device...');
		await this.digitalWrite(TestBotHat.PINS.SD_MUX_SEL_PIN, this.LOW);
		await this.resetHub();
		await Bluebird.delay(settle);
	}

	/**
	 *  Switches SD card control to the host (Testbot)
	 */
	public async switchSdToHost(settle: number = 0) {
		this.log('Switching SD card to host...');
		await this.digitalWrite(TestBotHat.PINS.SD_MUX_SEL_PIN, this.HIGH);
		await this.resetHub();
		await Bluebird.delay(settle);
	}

	/**
	 *  Signals to power on the DUT
	 */
	public async powerOnDUT() {
		this.log('Switching DUT on...');
		await this.digitalWrite(TestBotHat.PINS.DUT_PW_EN, this.HIGH);
	}

	/**
	 *  Signals to power off the DUT
	 */
	public async powerOffDUT() {
		this.log('Switching DUT off...');
		await this.digitalWrite(TestBotHat.PINS.DUT_PW_EN, this.LOW);
	}

	protected teardownBoard() {
		// Firmata types module has a dependency on serialport 4.x, while a newer version is used.
		// Hence, here we manually cast the transport.
		const transport = (this.transport as unknown) as SerialPort;
		if (transport.isOpen) {
			this.log('Closing the firmata transport...');
			transport.close();
		}
		this.log('HAT teardown is completed');
	}

	/**
	 *  Opens the DUT serial output stream of the Device Under Test (DUT) if available.
	 *
	 *  @example
	 *  ```
	 *  const testbotHat = new TestBotHat()
	 *  const serialOutput = await testbotHat.openDutSerial();
	 *  const collectedLogs: any[] = [];
	 *  serialOutput?.on('data', (d) => collectedLogs.push(d));
	 *  console.log(collectedLogs)
	 *   ```
	 *
	 *  @remark
	 *  The method enables level shifter output before reading from UART. Two coprocessor pins
	 *  control different level shifters for different GPIO pins.
	 *
	 *  @returns returns DUT output stream if available.
	 */
	public async openDutSerial(): Promise<Stream.Readable | null> {
		await this.digitalWrite(TestBotHat.PINS.OE_TXB, this.HIGH);
		await this.digitalWrite(TestBotHat.PINS.OE_TXS, this.HIGH);

		return super.openDutSerial();
	}

	// This formula depends on resistors on the board.
	// See https://github.com/balena-io/testbot/tree/pw-description/documentation/hardware#adjustable-voltage-regulator-avr
	private static vOutToVdac(vOut: number) {
		return (13.57 - vOut) / 3.72;
	}

	// tslint:disable:no-bitwise
	/**
	 *  Sets voltage to be provided to the DUT within a regulated range.
	 *
	 * 	@param target The value of target voltage in volts needed by the DUT as specified
	 *  by the value of `powerVoltage` in the interactor class of the specific device.
	 *
	 *  @remark
	 *  Allowed range is 1.3 to 12 V, specifiying target parameter outside the range leads
	 *  to an error. The value of `powerVoltage` can be extremely precise as it contains 12 bit resolution.
	 */
	public async setVout(target: number) {
		if (target < 1.3 || target > 12) {
			throw new Error(
				`Incorrect target value for Vout ${target}. Allowed range is [1.3; 12] V.`,
			);
		}
		this.log(`requested Vout=${target}`);

		// Input range for the target is safe for this formula.
		const vDac = TestBotHat.vOutToVdac(target);
		const digitalValue = Math.floor(
			(TestBotHat.DIN_MAX * vDac) / TestBotHat.VDAC_MAX,
		);
		this.log(`Vdac=${vDac} Din=${digitalValue}`);

		this.i2cConfig(0);
		await this.i2cWrite(TestBotHat.PSU_CONFIG.ADDR, TestBotHat.PSU_CONFIG.DAC, [
			digitalValue >> 4,
			(digitalValue & 0x0f) << 4,
		]);
	}

	private readCurrentSensor(
		register: keyof Omit<typeof TestBotHat.CURRENT_SENSOR_CONFIG, 'ADDR'>,
	): Promise<number> {
		const registerValue = TestBotHat.CURRENT_SENSOR_CONFIG[register];
		// @ts-ignore
		if (registerValue == null || register === 'ADDR') {
			throw new Error('invalid register value: ' + register);
		}
		return new Promise((resolve) => {
			this.i2cReadOnce(
				TestBotHat.CURRENT_SENSOR_CONFIG.ADDR,
				registerValue,
				2,
				(data) => {
					// See http://www.ti.com/lit/ds/symlink/ina260.pdf?&ts=1589896714912 (page 17).
					const output = (data[0] << 8) | data[1];
					resolve(output * 0.00125);
				},
			);
		});
	}

	/**
	 * Reads output voltage value that is supplied to the DUT.
	 *
	 * @remark
	 * The unit of voltage reading is in volt.
	 */
	public readVout = async () => await this.readCurrentSensor('VOLTAGE');

	/**
	 * Reads output current value that is supplied to the DUT.
	 *
	 * @remark
	 * The unit of current reading is in ampere.
	 */
	public readVoutAmperage = async () => await this.readCurrentSensor('CURRENT');
}
