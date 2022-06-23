export class AutokitRelay implements Power {
    constructor(){

    }

    async setup(): Promise<void> {
        
    }

    // Power on the DUT
    async on(voltage?: number): Promise<void> {
        
    }

    // Power off the DUT
    async off(): Promise<void> {
        
    }

    async getState(): Promise<string> {
        // return state of power on/off
        return 'off'
    }

    async teardown(): Promise<void> {
        
    }

}
