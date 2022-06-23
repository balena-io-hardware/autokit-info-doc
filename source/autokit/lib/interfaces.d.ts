interface Base{
    setup(): Promise<void>;
    teardown(): Promise<void>;
}


interface Power extends Base{
    on(voltage?: number): Promise<void>;
    off(): Promise<void>;
    getState(): Promise<string>;
}

interface Network extends Base{
    createWiredNetwork(): Promise<void>;
    createWirelessNetwork(ssid?: string, psk?: string): Promise<void>;
}

interface Video extends Base{
    startCapture(): Promise<string>;
    stopCapture(): Promise<void>;
}

interface SdMux extends Base{
    toggleMux(state: string): Promise<void>;
    DEV_SD: string;
}


// specify which peripherals are in use
interface AutokitConfig{
    power: string;
    deviceType: string;
    sdMux: string;
    network: string; 
    video: string;
    usbBootPort?: number;
}
