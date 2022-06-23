import { ChildProcess, exec, spawn } from 'child_process';
import { fs } from 'mz';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class LinuxVideo implements Video {
    public captureFolder = `/tmp/capture`
    private proc?: ChildProcess;
    private exit: {
		reason?: string;
		details: {
			error?: Error;
			stdout: string;
			stderr: string;
			code: number | null;
		};
	};
    constructor(){
        this.exit = {
            details: {
                stdout: '',
                stderr: '',
                code: null,
            },
        };
    }

    async setup(): Promise<void> {
		
    }

    async startCapture(): Promise<string> {
        const gstreamerHandle = () => {
			this.proc = spawn(
				'gst-launch-1.0',
				[
					`v4l2src ! decodebin ! videocrop left=90 right=90 bottom=70 top=70 ! jpegenc quality=10 ! multifilesink location="${
						this.captureFolder
					}/%06d.jpg"`,
				],
				{
					shell: '/bin/bash',
				},
			);
            if(this.proc.stdout !== null){
			    this.proc.stdout.on('data', (data) => {
				    this.exit.details.stdout += `${data.toString('utf-8')}\n`;
			    });
            }
            if(this.proc.stderr !== null){
                this.proc.stderr.on('data', (data) => {
                    this.exit.details.stderr += `${data.toString('utf-8')}\n`;
                });
            }
			this.proc.on('exit', (code) => {
				this.exit.details.code = code;
				this.proc = undefined;
			});
			this.proc.on('error', (error) => {
				this.exit.reason = 'Could not start gstreamer pipeline';
				this.exit.details.error = error;
				this.proc = undefined;
			});
		};
		gstreamerHandle();
        return this.captureFolder
	}       
    

   
    async stopCapture(): Promise<void> {
        return new Promise(async (resolve, reject) => {
			if (this.proc != null) {
				const clean = () => {
					if (timeout != null) {
						clearTimeout(timeout);
					}
					if (interval != null) {
						clearInterval(interval);
					}
					this.proc = undefined;
				};
				const exitHandler = () => {
					clean();
					resolve();
				};

				// For an unknown reason the gst process sometimes refuses to die, so let's check
				// if it has not periodaclly and retry
				const interval = setInterval(async () => {
					if (this.proc != null) {
						const procInfo = (
							await fs.readFile('/proc/' + this.proc.pid + '/status')
						).toString();

						if (procInfo.match(/State:\s+[RSDT]/)) {
							this.proc.kill('SIGINT');
						} else {
							this.proc.removeListener('exit', exitHandler);
							exitHandler();
						}
					}
				}, 2000);
				const timeout = setTimeout(() => {
					if (this.proc != null) {
						this.proc.removeListener('exit', exitHandler);
					}
					reject(new Error('Could not stop gstreamer pipeline.'));
				}, 30000);
				this.proc.on('exit', exitHandler);
			} else {
				reject(new Error(JSON.stringify(this.exit)));
			}
		});
    }

	async teardown(): Promise<void> {
		
	}

}
