UUID = vpn-monitor@kflihan.github.com
EXT_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

all: compile-schemas

compile-schemas:
	glib-compile-schemas schemas/

install: compile-schemas
	mkdir -p $(EXT_DIR)/schemas
	cp metadata.json $(EXT_DIR)/
	cp extension.js $(EXT_DIR)/
	cp prefs.js $(EXT_DIR)/
	cp stylesheet.css $(EXT_DIR)/
	cp schemas/org.gnome.shell.extensions.vpn-monitor.gschema.xml $(EXT_DIR)/schemas/
	cp schemas/gschemas.compiled $(EXT_DIR)/schemas/
	@echo "Installed to $(EXT_DIR)"

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

uninstall:
	rm -rf $(EXT_DIR)

.PHONY: all compile-schemas install enable disable uninstall
