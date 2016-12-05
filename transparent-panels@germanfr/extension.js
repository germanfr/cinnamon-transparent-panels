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
		this.settings.bind('transparency-type', 'transparency_type', this.onSettingsUpdated, null);

		this._classname = this.transparency_type ? this.transparency_type : 'panel-transparent-gradient';
	},

	enable: function () {
		this._signals = new SignalManager.SignalManager(this);
		this._signals.connect(global.window_manager, 'maximize', this.onWindowsStateChange);
		this._signals.connect(global.window_manager, 'minimize', this.onWindowsStateChange);
		this._signals.connect(global.window_manager, 'unmaximize', this.onWindowsStateChange);
		this._signals.connect(global.window_manager, 'map', this.onWindowsStateChange);

		this._signals.connect(global.screen, 'window-added', this.onWindowsStateChange);
		this._signals.connect(global.screen, 'window-removed', this.onWindowsStateChange);

		this._signals.connect(global.window_manager, 'switch-workspace', this.onWindowsStateChange);

		this.onWindowsStateChange();
	},

	disable: function () {
		this._signals.disconnectAllSignals();
		this._makePanelsOpaque();
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
		return (mwin.get_maximized() & WINDOW_FLAGS_MAXIMIZED) === WINDOW_FLAGS_MAXIMIZED && !mwin.minimized;
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
	}
};


let extension = null;

function enable() {
	extension.enable();
}

function disable() {
	extension.disable();
	extension = null;
}

function init(metadata) {
	if(extension === null)
		extension = new MyExtension(metadata);
}
