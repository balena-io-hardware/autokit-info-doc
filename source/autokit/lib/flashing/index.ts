import { exec } from 'mz/child_process';
import { delay } from 'bluebird';
import * as Bluebird from 'bluebird';
import * as retry from 'bluebird-retry';
import * as sdk from 'etcher-sdk';
import { fs } from 'mz';
import { BlockDeviceAdapter } from 'etcher-sdk/build/scanner/adapters';
import { Autokit } from '../';

// Flash an image to a disk - this is the low level function used to flash a disk (sd card, usb sotrage device etc)
async function flashToDisk(
    dst: sdk.sourceDestination.BlockDevice,
    src: string,
) {
    const sdkSource: sdk.sourceDestination.SourceDestination = new sdk.sourceDestination.File(
        {
            path: src,
        },
    );
    const innerSource = await sdkSource.getInnerSource();
    const result = await sdk.multiWrite.pipeSourceToDestinations({
        source: innerSource,
        destinations: [dst],
        onFail: (_: any, error: Error) =>
            console.log(`Failure during flashing: ${error}`),
        onProgress: (_progress: sdk.multiWrite.MultiDestinationProgress) => {
        },
        verify: true,
    });
    if (result.failures.size > 0) {
        const errorsMessage = new Array(...result.failures.values())
            .map((e) => e.message)
            .join('\n');
        throw new Error(
            `Flashing failed with the following errors: ${errorsMessage}`,
        );
    }
}

function getDevInterface(
    devPath: string | undefined,
    timeout: retry.Options = { max_tries: 5, interval: 5000 },
): Bluebird<string> {

    if(devPath === undefined){
        throw new Error(`No device defined!`)
    }

    return retry(
        () => {
            return fs.realpath(devPath);
        },
        { ...timeout, throw_original: true },
    );

}

async function getDrive(
	device: string,
): Promise<sdk.sourceDestination.BlockDevice> {
	// Do not include system drives in our search
	const adapter = new BlockDeviceAdapter({
		includeSystemDrives: () => false,
		unmountOnSuccess: false,
		write: true,
		direct: true,
	});
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

async function toggleUsb(state: boolean, port: number) {
    console.log(`Toggling USB ${state ? 'on' : 'off'}`);
    await exec(
        `uhubctl -r 1000 -a ${state ? 'on' : 'off'} -p ${port} -l 1-1`,
    ).catch(() => {
        console.log(`Failed. Check that uhubctl is available.`);
    });
}

async function flashSD(filename: string, autoKit: Autokit){
    await autoKit.sdMux?.toggleMux('host');

    // For linux, udev will provide us with a nice id.
    const drive = await getDrive(await getDevInterface(autoKit.sdMux?.DEV_SD));

    console.log(`Start flashing the image`);
    await flashToDisk(drive, filename);
    console.log('Flashing completed');
    
}

async function flashUsbBoot(filename: string, autoKit: Autokit, port: number){
        console.log(`Entering flash method for USB-Boot devicse...`);

        await toggleUsb(false, port);
        await autoKit.power?.off();
        await delay(1000 * 8); // Wait 5s before trying to turning USB back on

        // power on the USB - but ensure it is powered off first - this way we ensure we get the device in a fresh state
        await toggleUsb(false, 4);
        await delay(2*1000);
        await toggleUsb(true, 4);
        // etcher-sdk (power on) usboot
        const adapters: sdk.scanner.adapters.Adapter[] = [
            new BlockDeviceAdapter({
                includeSystemDrives: () => false,
                unmountOnSuccess: false,
                write: true,
                direct: true,
            }),
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
                    console.log(`Timed out!`);
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
            await delay(1000); // Wait 1s before trying to flash
            console.log('Flashing started...');
            await flashToDisk(dest, filename);
            console.log('Flashed!');
        }

        // put the DUT in entirely powered off state
        await toggleUsb(false, port);
        await autoKit.power?.off();
    }
   


async function flash(filename: string, deviceType: string, autoKit: Autokit, port?: number){
    const flashProcedure = await import(`devices/${deviceType}`);
    switch(flashProcedure.type){
        case 'sd': {
            await flashSD(filename, autoKit);
            break;
        }
        case 'usbboot': {
            if(port === undefined){
                throw new Error('No usb port specified!')
            }
            await flashUsbBoot(filename, autoKit, port);
            break;
        }
    }
}

export { flash }