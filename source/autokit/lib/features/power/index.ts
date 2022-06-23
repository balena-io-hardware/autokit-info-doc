import { AutokitRelay } from "./implementations/autokit-relay";

const powerImplementations: {[key: string]: typeof AutokitRelay } = {
	autokitRelay: AutokitRelay,
};

export { powerImplementations }