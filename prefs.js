import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class VpnMonitorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'network-vpn-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('VPN Settings'),
            description: _('Configure systemd service, ping target, and check interval'),
        });
        page.add(group);

        // Service Name Row
        const serviceRow = new Adw.EntryRow({
            title: _('systemd Service Name'),
            text: settings.get_string('service-name'),
        });
        serviceRow.connect('changed', (entry) => {
            settings.set_string('service-name', entry.get_text());
        });
        group.add(serviceRow);

        // Interface Name Row
        const interfaceRow = new Adw.EntryRow({
            title: _('Network Interface'),
            text: settings.get_string('interface-name'),
        });
        interfaceRow.connect('changed', (entry) => {
            settings.set_string('interface-name', entry.get_text());
        });
        group.add(interfaceRow);

        // Ping Target Row
        const pingTargetRow = new Adw.EntryRow({
            title: _('Ping Target (IP/Host)'),
            text: settings.get_string('ping-target'),
        });
        pingTargetRow.connect('changed', (entry) => {
            settings.set_string('ping-target', entry.get_text());
        });
        group.add(pingTargetRow);

        // Check Interval Row
        const intervalRow = new Adw.SpinRow({
            title: _('Check Interval (seconds)'),
            subtitle: _('How often to check service and ping connectivity'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 300,
                step_increment: 1,
                value: settings.get_int('check-interval'),
            }),
        });
        intervalRow.connect('notify::value', (spin) => {
            settings.set_int('check-interval', spin.get_value());
        });
        group.add(intervalRow);

        // Ping Timeout Row
        const timeoutRow = new Adw.SpinRow({
            title: _('Ping Timeout (seconds)'),
            subtitle: _('Maximum time to wait for ping response'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 10,
                step_increment: 1,
                value: settings.get_int('ping-timeout'),
            }),
        });
        timeoutRow.connect('notify::value', (spin) => {
            settings.set_int('ping-timeout', spin.get_value());
        });
        group.add(timeoutRow);
    }
}
