/*
* Transparent panels - Cinnamon desktop extension
* Transparentize your panels when there are no any maximized windows
* Copyright (C) 2016  Germán Franco Dorca
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

const Meta = imports.gi.Meta;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const SignalManager = imports.misc.signalManager;
const Util = imports.misc.util;
const MessageTray = imports.ui.messageTray;
const St = imports.gi.St;
const Lang = imports.lang;

const WINDOW_FLAGS_MAXIMIZED = (Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL);

function log(msg) {
	global.log('transparent-panels@germanfr: ' + msg);
}

function MyExtension(meta) {
	this._init(meta);
}

MyExtension.prototype = {

	_init: function (meta) {
		this._meta = meta;
		this._signals = null;
		this.transparent = false;

		this.settings = new Settings.ExtensionSettings(this, meta.uuid);
		this._settings_bind_property('transparency-type', 'transparency_type', this.onSettingsUpdated);
		this._settings_bind_property('first-launch', 'firstLaunch');
		this._classname = this.transparency_type ? this.transparency_type : 'panel-transparent-gradient';
	},

	enable: function () {
		this._signals = new SignalManager.SignalManager(this);
		this._signals.connect(global.window_manager, 'maximize', this._onWindowMaximized);
		this._signals.connect(global.window_manager, 'minimize', this.onWindowsStateChange);
		this._signals.connect(global.window_manager, 'unmaximize', this.onWindowsStateChange);
		this._signals.connect(global.window_manager, 'map', this._onWindowShown);

		this._signals.connect(global.screen, 'window-removed', this.onWindowsStateChange);

		this._signals.connect(global.window_manager, 'switch-workspace', this.onWindowsStateChange);

		this.onWindowsStateChange();

		if(this.firstLaunch) {
			this.showStartupNotification();
			this.firstLaunch = false;
		}
	},

	disable: function () {
		this._signals.disconnectAllSignals();
		this._signals = null;

		this.settings.finalize();
		this.settings = null;

		this._makePanelsOpaque();
	},

	_onWindowMaximized: function() {
		this._makePanelsOpaque();
	},

	_onWindowShown: function(cinnwm, win) {
		if(this._isWindowMaximized(win)) {
			this._makePanelsOpaque();
		}
	},

	onWindowsStateChange: function () {
		if(this._checkAnyWindowMaximized()) {
			this._makePanelsOpaque();
		} else {
			this._makePanelsTransparent();
		}
	},

	_checkAnyWindowMaximized: function() {
		let workspaceIndex = global.screen.get_active_workspace_index();
		let workspaceWins = Main.getWindowActorsForWorkspace(workspaceIndex);

		for(let i=0, nWins = workspaceWins.length; i < nWins; ++i) {
			if(this._isWindowMaximized(workspaceWins[i])) {
				return true;
			}
		}
		return false;
	},

	_isWindowMaximized: function (win) {
		let mwin = win.get_meta_window();
		return !mwin.minimized &&
			(mwin.get_maximized() & WINDOW_FLAGS_MAXIMIZED) === WINDOW_FLAGS_MAXIMIZED &&
			mwin.get_window_type() !== Meta.WindowType.DESKTOP;
	},

	_makePanelsTransparent: function() {
		if(this.transparent)
			return;

		Main.getPanels().forEach(function (panel, index) {
			panel.actor.add_style_class_name(this._classname);
		}, this);
		this.transparent = true;
	},

	_makePanelsOpaque: function() {
		if(this.transparent) {
			Main.getPanels().forEach(function (panel, index) {
				panel.actor.remove_style_class_name(this._classname);
			}, this);
			this.transparent = false;
		}
	},

	onSettingsUpdated: function () {
		// Remove old classes
		this.transparent = true;
		this._makePanelsOpaque();

		if (this.transparency_type) {
			this._classname = this.transparency_type;
		}
		this.onWindowsStateChange();
	},

	// This will be called only once the first
	// time the extension is loaded. It's not worth it to
	// create a separate class, so we build everything here.
	showStartupNotification: function() {
		let source = new MessageTray.Source('Extension settings');
		let self = this;
		let params = {
			icon: new St.Icon({
					icon_name: 'preferences-desktop-theme',
					icon_type: St.IconType.FULLCOLOR,
					icon_size: source.ICON_SIZE })
		};

		let notification = new MessageTray.Notification(source,
			this._meta.name + ' enabled',
			'Open the extension settings and customize your panels',
			params);

		notification.addButton('open-settings', 'Open settings');
		notification.connect('action-invoked', Lang.bind(this, this.launchSettings));

		Main.messageTray.add(source);
		source.notify(notification);
	},

	launchSettings: function() {
		Util.spawnCommandLine('xlet-settings extension ' + this._meta.uuid);
	},

	// Keep backwards compatibility with 3.0.x for now
	// but keep working if bindProperty was removed.
	// To be removed soon
	_settings_bind_property: function (key, applet_prop, callback) {
		if(this.settings.bind) {
			this.settings.bind(key, applet_prop, callback, null);
		} else {
			this.settings.bindProperty( Settings.BindingDirection.BIDIRECTIONAL,
				key, applet_prop, callback, null);
		}
	}
};


let extension = null;

function enable() {
	try {
		extension.enable();
	} catch (err) {
		global.logError(err);
		disable();
	}
}

function disable() {
	extension.disable();
	extension = null;
}

function init(metadata) {
	if(extension === null)
		extension = new MyExtension(metadata);
}
