import { LinuxNetwork } from "./implementations/linux-device";

const networkImplementations: {[key: string]: typeof LinuxNetwork } = {
	linuxNetwork: LinuxNetwork,
};

export { networkImplementations }