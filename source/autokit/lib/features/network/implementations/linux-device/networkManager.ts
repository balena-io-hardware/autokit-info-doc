import * as dbus from 'dbus-next';

type ActiveConnection = string;
type Connection = ActiveConnection;

interface Options {
	wireless?: {
		psk: string;
		ssid: string;
		nat: boolean;
	};
	wired?: { nat: boolean };
}

const emptyFunc = () => {
	// Nothing.
};

class Teardown {
	constructor(private fn: () => void = emptyFunc) {}

	public register(fn: () => void) {
		this.fn = fn;
	}

	public async run() {
		await this.fn();
		this.fn = emptyFunc;
	}
}

class NetworkManager {
	constructor(
		private bus = dbus.sessionBus({
			busAddress:
				process.env.DBUS_SYSTEM_BUS_ADDRESS ||
				'unix:path=/host/run/dbus/system_bus_socket',
		}),
		public teardowns: { wired: Teardown; wireless: Teardown } = {
			wired: new Teardown(),
			wireless: new Teardown(),
		},
	) {
		// Cleanup code
		process.on('SIGINT', this.teardown);
		process.on('SIGTERM', this.teardown);
	}

	private static stringToArrayOfBytes(str: string): number[] {
		const bytes = [];
		for (let i = 0; i < str.length; ++i) {
			bytes.push(str.charCodeAt(i));
		}
		return bytes;
	}

	private static generateId(): string {
		return Math.random().toString(36).substring(2, 10);
	}

	private static wiredTemplate(method: string) {
		return {
			connection: {
				id: new dbus.Variant('s', NetworkManager.generateId()),
				type: new dbus.Variant('s', '802-3-ethernet'),
				autoconnect: new dbus.Variant('b', false),
			},
			ipv4: { method: new dbus.Variant('s', method) },
			ipv6: { method: new dbus.Variant('s', 'ignore') },
		};
	}

	private static wirelessTemplate(method: string, ssid: string, psk: string) {
		return {
			connection: {
				id: new dbus.Variant('s', NetworkManager.generateId()),
				type: new dbus.Variant('s', '802-11-wireless'),
				autoconnect: new dbus.Variant('b', false),
			},
			'802-11-wireless': {
				mode: new dbus.Variant('s', 'ap'),
				ssid: new dbus.Variant('ay', NetworkManager.stringToArrayOfBytes(ssid)),
			},
			'802-11-wireless-security': {
				'key-mgmt': new dbus.Variant('s', 'wpa-psk'),
				psk: new dbus.Variant('s', psk),
			},
			ipv4: { method: new dbus.Variant('s', method) },
			ipv6: { method: new dbus.Variant('s', 'ignore') },
		};
	}

	private async addConnection(connection: any): Promise<string> {
		const con = (
			await this.bus.getProxyObject(
				'org.freedesktop.NetworkManager',
				'/org/freedesktop/NetworkManager/Settings',
			)
		).getInterface('org.freedesktop.NetworkManager.Settings');

		return con.AddConnectionUnsaved(connection);
	}

	private async removeConnection(reference: Connection): Promise<void> {
		const nodes = (
			await this.bus.getProxyObject(
				'org.freedesktop.NetworkManager',
				'/org/freedesktop/NetworkManager/Settings',
			)
		).nodes;

		if (nodes.includes(reference)) {
			const con = (
				await this.bus.getProxyObject(
					'org.freedesktop.NetworkManager',
					reference,
				)
			).getInterface('org.freedesktop.NetworkManager.Settings.Connection');

			await con.Delete();
		}
	}

	private async getDevice(iface: string): Promise<string> {
		const con = (
			await this.bus.getProxyObject(
				'org.freedesktop.NetworkManager',
				'/org/freedesktop/NetworkManager',
			)
		).getInterface('org.freedesktop.NetworkManager');

		return con.GetDeviceByIpIface(iface);
	}

	private async activateConnection(
		reference: Connection,
		device: string,
	): Promise<string> {
		const con = (
			await this.bus.getProxyObject(
				'org.freedesktop.NetworkManager',
				'/org/freedesktop/NetworkManager',
			)
		).getInterface('org.freedesktop.NetworkManager');

		return con.ActivateConnection(reference, device, '/');
	}

	private async deactivateConnection(
		reference: ActiveConnection,
	): Promise<void> {
		const nodes = (
			await this.bus.getProxyObject(
				'org.freedesktop.NetworkManager',
				'/org/freedesktop/NetworkManager/ActiveConnection',
			)
		).nodes;

		if (nodes.includes(reference)) {
			const con = (
				await this.bus.getProxyObject(
					'org.freedesktop.NetworkManager',
					'/org/freedesktop/NetworkManager',
				)
			).getInterface('org.freedesktop.NetworkManager');

			await con.DeactivateConnection(reference);
		}
	}

	public async addWiredConnection(iface: string): Promise<void> {
        // tear down any existing AP - this is to prevent any conflicts
		await this.teardowns.wired.run();

		const conn = await this.addConnection(
			NetworkManager.wiredTemplate('shared'),
		);
		const activeConn = await this.activateConnection(
			conn,
			await this.getDevice(iface),
		);

		console.log(`Wired AP; IFACE: ${iface}`);

		this.teardowns.wired.register(async () => {
			await this.deactivateConnection(activeConn);
			await this.removeConnection(conn);
		});
	}

	public async addWirelessConnection(
		ssid: string,
		psk: string,
        iface: string
	): Promise<void> {

        // tear down any existing AP - this is to prevent any conflicts
		await this.teardowns.wireless.run();

		const conn = await this.addConnection(
			NetworkManager.wirelessTemplate(
				'shared',
				ssid,
				psk,
			),
		);

		const activeConn = await this.activateConnection(
			conn,
			await this.getDevice(iface),
		);

		console.log(
			`Wireless AP; SSID: ${ssid} IFACE: ${iface}`,
		);

		this.teardowns.wireless.register(async () => {
			await this.deactivateConnection(activeConn);
			await this.removeConnection(conn);
		});
	}

	public async teardown(signal?: NodeJS.Signals): Promise<void> {
		process.removeListener('SIGINT', this.teardown);
		process.removeListener('SIGTERM', this.teardown);

		await this.teardowns.wired.run();
		await this.teardowns.wireless.run();

		if (signal === 'SIGINT' || signal === 'SIGTERM') {
			this.bus.disconnect();
		}
	}
}

export default NetworkManager;