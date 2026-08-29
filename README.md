# VPN Service & Connectivity Monitor GNOME Extension

A GNOME Shell extension that resides in the top dash/panel to monitor OpenVPN service status and active ping connectivity through the VPN interface.

## Features

- **Systemd Service Monitoring**: Checks whether `openvpn-client@kflihan.service` (or your configured service) is active.
- **Traffic / Interface Ping Test**: Pings `8.8.8.8` directly through the specified interface (`tun0`) to verify true end-to-end routing.
- **Color-Coded Status Icon**:
  - 🟢 **Green**: Service is running and ping succeeds (VPN fully online).
  - 🟡 **Yellow**: Service is running but ping fails (VPN interface up, but connection broken).
  - 🔴 **Red**: Service is stopped / inactive.
- **Configurable Settings via GUI**:
  - `Service Name` (Default: `openvpn-client@kflihan.service`)
  - `Interface Name` (Default: `tun0`)
  - `Ping Target` (Default: `8.8.8.8`)
  - `Check Interval` (Default: `5` seconds)
  - `Ping Timeout` (Default: `2` seconds)
- **Interactive Menu**: Displays current status, latency (ms), a "Check Now" button, and shortcut to Settings.

## Installation & Activation

1. **Install to local extension folder**:
   ```bash
   make install
   ```

2. **Reload GNOME Shell**:
   - On **Wayland**: Log out and log back in (or restart session).
   - On **X11**: Press `Alt + F2`, type `r`, and press `Enter`.

3. **Enable Extension**:
   ```bash
   gnome-extensions enable vpn-monitor@kflihan.github.com
   ```
   Or toggle it on using the **Extensions** app (`gnome-extensions-app`).

## Preferences

Open the extension settings either via the top panel drop-down or by running:
```bash
gnome-extensions prefs vpn-monitor@kflihan.github.com
```
