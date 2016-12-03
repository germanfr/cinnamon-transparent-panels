const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const SignalManager = imports.misc.signalManager;
const Panel = imports.ui.panel;

const WINDOW_FLAGS_MAXIMIZED = (Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL);

function log(msg) {
	global.log("Transparent panel: " + msg);
}

function MyExtension(meta) {
	this._init(meta);
}

MyExtension.prototype = {

	_init: function (meta) {
		this._meta = meta;
		this._signals = null;
		this.transparent = false;
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
			panel.actor.add_style_class_name("panel-transparent");
		});
		this.transparent = true;
	},

	_makePanelsOpaque: function() {
		if(this.transparent) {
			Main.getPanels().forEach(function (panel, index) {
				panel.actor.remove_style_class_name("panel-transparent");
			});
			this.transparent = false;
		}
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
