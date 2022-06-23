import NetworkManager  from './networkManager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class LinuxNetwork implements Network{
    private networkManager: NetworkManager;
    private wirelessIface = '';
    private wiredIface = '';
    constructor(){
        this.networkManager = new NetworkManager()
    }
    
    async setup(){
        // find the name of the interfaces? The wired and wireless interface we need

        // First get lshw
        const lshw = await execAsync('lshw -json -class network');
        const lshwJson = JSON.parse(lshw.stdout);
        for(let networkDevice of lshwJson){
            if(networkDevice.capabilities.wireless === 'Wireless-LAN'){
                // we only want to use an unused interface - so the tester unit doesn't lose its network connection
                if(networkDevice.configuration.link === 'no'){
                    this.wirelessIface = networkDevice.logicalname
                }
            }

            if(networkDevice.capabilities.ethernet === true){
                // we only want to use an unused interface - so the tester unit doesn't lose its network connection
                if(networkDevice.configuration.link === 'no'){
                    this.wiredIface = networkDevice.logicalname
                }
            }
        }
    }

    async createWiredNetwork(): Promise<void> {
        console.log('Creating wired connection...');
        await this.networkManager.addWiredConnection(this.wiredIface);
    }

    async createWirelessNetwork(ssid?: string | undefined, psk?: string) {
        console.log('Creating wireless connection');
        if(ssid === undefined){
            ssid = 'autokit-wifi';
        }
        if (psk === undefined){
            psk = 'autokit-wifi-psk'
        }
        await this.networkManager.addWirelessConnection(ssid, psk, this.wirelessIface);
    }

    async enableInternet(){
        await execAsync('echo 0 > /proc/sys/net/ipv4/ip_forward')
    };

    async disableInternet(){
        await execAsync('echo 1 > /proc/sys/net/ipv4/ip_forward')

    };

    // tear down the connection
    async teardown(){
        await this.networkManager.teardown();
    }
}