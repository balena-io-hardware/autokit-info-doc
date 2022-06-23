import { Autokit } from '../lib';

async function main(){
    const IMAGE_PATH = '/tmp/os.img';

    console.log(`setting up autokit`);

    const autokitConfig = {
        power: 'autokit-relay',
        deviceType: 'fincm3',
        sdMux: '',
        network: 'linux-device',
        video: 'linux-video',
        usbBootPort: 4
    }

    const autoKit = new Autokit(autokitConfig);

    await autoKit.setup();
    
    // ensure the DUT is powered off
    await autoKit.power?.off();

    // flash the DUT
    await autoKit.flash(IMAGE_PATH);

    // power on the DUT
    await autoKit.power?.on();
}

main();