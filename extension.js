import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class VpnMonitorExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._timeoutId = null;
        this._cancellable = new Gio.Cancellable();
        this._isChecking = false;

        // Build Indicator Button in Panel
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        this._icon = new St.Icon({
            icon_name: 'network-vpn-symbolic',
            style_class: 'system-status-icon vpn-status-icon vpn-status-down',
        });
        this._indicator.add_child(this._icon);

        // Menu Items
        this._titleItem = new PopupMenu.PopupMenuItem(_('VPN Monitor: Checking...'), {
            reactive: false,
        });
        this._indicator.menu.addMenuItem(this._titleItem);

        this._serviceStatusItem = new PopupMenu.PopupMenuItem(_('Service: Unknown'), {
            reactive: false,
        });
        this._indicator.menu.addMenuItem(this._serviceStatusItem);

        this._pingStatusItem = new PopupMenu.PopupMenuItem(_('Ping: Unknown'), {
            reactive: false,
        });
        this._indicator.menu.addMenuItem(this._pingStatusItem);

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Restart Service action
        this._restartItem = new PopupMenu.PopupMenuItem(_('Restart VPN Service'));
        this._restartItem.connect('activate', () => {
            this._restartService();
        });
        this._indicator.menu.addMenuItem(this._restartItem);

        // Refresh action
        const refreshItem = new PopupMenu.PopupMenuItem(_('Check Now'));
        refreshItem.connect('activate', () => {
            this._checkStatus();
        });
        this._indicator.menu.addMenuItem(refreshItem);

        // Open Preferences
        const prefsItem = new PopupMenu.PopupMenuItem(_('Settings'));
        prefsItem.connect('activate', () => {
            this.openPreferences();
        });
        this._indicator.menu.addMenuItem(prefsItem);

        // Add to panel (right side)
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Watch setting changes
        this._settingsChangedId = this._settings.connect('changed::check-interval', () => {
            this._resetTimer();
        });

        // Run initial check and start timer
        this._checkStatus();
        this._resetTimer();
    }

    _resetTimer() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        const intervalSec = Math.max(1, this._settings.get_int('check-interval'));
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            intervalSec,
            () => {
                this._checkStatus();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    async _execCommand(argv) {
        return new Promise((resolve) => {
            try {
                const proc = new Gio.Subprocess({
                    argv: argv,
                    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
                });
                proc.init(this._cancellable);

                proc.communicate_utf8_async(null, this._cancellable, (source, res) => {
                    try {
                        const [, stdout, stderr] = source.communicate_utf8_finish(res);
                        const exitCode = source.get_exit_status();
                        resolve({ success: exitCode === 0, stdout: stdout || '', stderr: stderr || '', exitCode });
                    } catch (e) {
                        resolve({ success: false, error: e.message, exitCode: -1 });
                    }
                });
            } catch (e) {
                resolve({ success: false, error: e.message, exitCode: -1 });
            }
        });
    }

    async _restartService() {
        const serviceName = this._settings.get_string('service-name') || 'openvpn-client@kflihan.service';
        this._titleItem.label.text = _('VPN Monitor: Restarting...');
        
        // Use pkexec so user gets polkit GUI password prompt if needed
        const result = await this._execCommand(['pkexec', 'systemctl', 'restart', serviceName]);
        if (!result.success) {
            // Try fallback without pkexec in case systemd user or polkit rule allows it
            await this._execCommand(['systemctl', 'restart', serviceName]);
        }

        // Wait 2 seconds for interface/handshake then check status
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._checkStatus();
            return GLib.SOURCE_REMOVE;
        });
    }

    async _checkStatus() {
        if (this._isChecking) return;
        this._isChecking = true;

        try {
            const serviceName = this._settings.get_string('service-name') || 'openvpn-client@kflihan.service';
            const interfaceName = this._settings.get_string('interface-name') || 'tun0';
            const pingTarget = this._settings.get_string('ping-target') || '8.8.8.8';
            const pingTimeout = this._settings.get_int('ping-timeout') || 2;

            // 1. Check systemd service status
            const svcResult = await this._execCommand(['systemctl', 'is-active', serviceName]);
            const isServiceActive = svcResult.success && svcResult.stdout.trim() === 'active';
            const serviceStateText = svcResult.stdout.trim() || (svcResult.success ? 'active' : 'inactive/failed');

            let isPingOk = false;
            let pingDetails = 'Not tested';

            if (isServiceActive) {
                // 2. Ping target through VPN interface
                const pingArgs = [
                    'ping',
                    '-c', '1',
                    '-W', pingTimeout.toString(),
                    '-I', interfaceName,
                    pingTarget,
                ];
                const pingResult = await this._execCommand(pingArgs);
                isPingOk = pingResult.success;

                if (isPingOk) {
                    const rttMatch = pingResult.stdout.match(/time=([\d.]+)\s*ms/);
                    pingDetails = rttMatch ? `OK (${rttMatch[1]} ms)` : 'OK';
                } else {
                    pingDetails = 'Failed (No Response/Loss)';
                }
            } else {
                pingDetails = 'Skipped (Service Inactive)';
            }

            this._updateUI(isServiceActive, isPingOk, serviceStateText, pingDetails, serviceName, pingTarget, interfaceName);
        } catch (err) {
            console.error(`[VPN Monitor] Error in _checkStatus: ${err}`);
        } finally {
            this._isChecking = false;
        }
    }

    _updateUI(isServiceActive, isPingOk, serviceStateText, pingDetails, serviceName, pingTarget, interfaceName) {
        if (!this._icon || !this._indicator) return;

        // Reset style classes
        this._icon.remove_style_class_name('vpn-status-ok');
        this._icon.remove_style_class_name('vpn-status-degraded');
        this._icon.remove_style_class_name('vpn-status-down');

        if (isServiceActive && isPingOk) {
            // All good: Green
            this._icon.add_style_class_name('vpn-status-ok');
            this._titleItem.label.text = _('VPN Status: Connected & Online');
        } else if (isServiceActive && !isPingOk) {
            // Service running but connection down: Yellow / Degraded
            this._icon.add_style_class_name('vpn-status-degraded');
            this._titleItem.label.text = _('VPN Status: Connected (No Internet)');
        } else {
            // Service stopped: Red
            this._icon.add_style_class_name('vpn-status-down');
            this._titleItem.label.text = _('VPN Status: Disconnected');
        }

        this._serviceStatusItem.label.text = `${_('Service')} (${serviceName}): ${serviceStateText}`;
        this._pingStatusItem.label.text = `${_('Ping')} (${interfaceName} -> ${pingTarget}): ${pingDetails}`;
    }

    disable() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._icon = null;
        this._titleItem = null;
        this._serviceStatusItem = null;
        this._pingStatusItem = null;
        this._restartItem = null;
        this._settings = null;
    }
}
