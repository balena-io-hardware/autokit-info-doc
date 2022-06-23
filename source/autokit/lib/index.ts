// import all features
import { networkImplementations } from './features/network';
import { powerImplementations } from './features/power';
import { videoImplementations } from './features/video';
import { sdMuxImplementations } from './features/sd-mux';

import { flash } from './flashing'

export class Autokit{
    private config: AutokitConfig;
    public power?: Power;
    public network?: Network;
    public video? : Video;
    public sdMux?: SdMux;

    constructor(config: AutokitConfig){
        this.config = config;
    }

    async setup(){
        // TODO: for each feature, detect the implementation - then create the instance of the class
        // For now, let the user specify the hardware configuration with a json object
        console.log(`Setting up automation kit...`)
        
        this.power = new powerImplementations[this.config.power]();
        await this.power.setup();

        this.network = new networkImplementations[this.config.network]();
        await this.network.setup();

        this.video = new videoImplementations[this.config.video]();
        await this.video.setup();

        this.sdMux = new sdMuxImplementations[this.config.sdMux]();
        await this.sdMux.setup()


        // TODO check for what features are enabled, and expose this to the user - give a summary
    }


    // flash a DUT from a file
    async flash(filename: string){
        await flash(filename, this.config.deviceType, this ,this.config.usbBootPort);
    }
}