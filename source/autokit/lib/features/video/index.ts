import { LinuxVideo } from "./implementations/linux-video";

const videoImplementations: {[key: string]: typeof LinuxVideo } = {
	linuxVideo: LinuxVideo,
};

export { videoImplementations }