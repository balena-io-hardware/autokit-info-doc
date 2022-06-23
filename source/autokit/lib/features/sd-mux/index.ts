import { AutoKitSdMux } from "./implementations/autokit-sd-mux"

const sdMuxImplementations: {[key: string]: typeof AutoKitSdMux } = {
	autokitSdMux: AutoKitSdMux,
};

export { sdMuxImplementations }