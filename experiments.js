// Copyright (c) 2021, Jörg Knobloch. All rights reserved.

/* global ExtensionCommon */

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");
var { AppConstants } = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");
var appVersion = parseInt(AppConstants.MOZ_APP_VERSION, 10);

const EXTENSION_NAME = "CharsetMenu@jorgk.com";
var extension = ExtensionParent.GlobalManager.getExtension(EXTENSION_NAME);

// Implements the functions defined in the experiments section of schema.json.
var CharsetMenu = class extends ExtensionCommon.ExtensionAPI {
  onShutdown(isAppShutdown) {
    ExtensionSupport.unregisterWindowListener(EXTENSION_NAME);
    for (let win of Services.wm.getEnumerator("mail:3pane")) {
      unpaint(win);
    }
    if (isAppShutdown) return;
    // Looks like we got uninstalled. Maybe a new version will be installed now.
    // Due to new versions not taking effect (https://bugzilla.mozilla.org/show_bug.cgi?id=1634348)
    // we invalidate the startup cache. That's the same effect as starting with -purgecaches
    // (or deleting the startupCache directory from the profile).
    Services.obs.notifyObservers(null, "startupcache-invalidate");
  }

  getAPI(context) {
    return {
      CharsetMenu: {
        addWindowListener(dummy) {
          // Adds a listener to detect new windows.
          ExtensionSupport.registerWindowListener(EXTENSION_NAME, {
            chromeURLs: ["chrome://messenger/content/messenger.xhtml",
              "chrome://messenger/content/messageWindow.xhtml"],
            onLoadWindow: paint,
            onUnloadWindow: unpaint,
          });
        },
      },
    };
  }
};

function setTooltip(win, elName, charset) {
  let charsetText = charset;
  if (charset.toUpperCase() == "ISO-8859-8-I") charset = "windows-1255";
  else if (charset.toLowerCase() == "gb18030") charset = "GBK";

  if (charset == "UTF-8") charsetText = "Unicode (UTF-8)";
  else if (charset == "windows-1252") charsetText = "Western (windows-1252)";
  else if (charset == "windows-1256") charsetText = "Arabic (windows-1256)";
  else if (charset == "ISO-8859-6") charsetText = "Arabic (ISO-8859-6)";
  else if (charset == "windows-1257") charsetText = "Baltic (windows-1257)";
  else if (charset == "ISO-8859-4") charsetText = "Baltic (ISO-8859-4)";
  else if (charset == "windows-1250") charsetText = "Central European (windows-1250)";
  else if (charset == "ISO-8859-2") charsetText = "Central European (ISO-8859-2)";
  else if (charset == "GBK") charsetText = "Chinese, Simplified (GBK)";
  else if (charset == "Big5") charsetText = "Chinese, Traditional (Big5)";
  else if (charset == "windows-1251") charsetText = "Cyrillic (windows-1251)";
  else if (charset == "ISO-8859-5") charsetText = "Cyrillic (ISO-8859-5)";
  else if (charset == "KOI8-R") charsetText = "Cyrillic (KOI8-R)";
  else if (charset == "KOI8-U") charsetText = "Cyrillic (KOI8-U)";
  else if (charset == "IBM866") charsetText = "Cyrillic (IBM866)";
  else if (charset == "windows-1253") charsetText = "Greek (windows-1253)";
  else if (charset == "ISO-8859-7") charsetText = "Greek (ISO-8859-7)";
  else if (charset == "windows-1255") charsetText = "Hebrew (windows-1255)";
  else if (charset == "ISO-8859-8") charsetText = "Hebrew (ISO-8859-8)";
  else if (charset == "Shift_JIS") charsetText = "Japanese (Shift_JIS)";
  else if (charset == "EUC-JP") charsetText = "Japanese (EUC-JP)";
  else if (charset == "ISO-2022-JP") charsetText = "Japanese (ISO-2022-JP)";
  else if (charset == "EUC-KR") charsetText = "Korean (EUC-KR)";
  else if (charset == "windows-874") charsetText = "Thai (windows-874)";
  else if (charset == "windows-1254") charsetText = "Turkish (windows-1254)";
  else if (charset == "windows-1258") charsetText = "Vietnamese (windows-1258)";

  if (charsetText) {
    let repairMenu = win.document.getElementById(elName);
    repairMenu.setAttribute("tooltiptext", charsetText);
  }
}

function fixMessageMenu(message) {
  let tb_onShowOtherActionsPopup = message.onShowOtherActionsPopup;
  message.onShowOtherActionsPopup = () => {
    setTooltip(message, "charsetRepairMenuitem", message.currentCharacterSet);
    tb_onShowOtherActionsPopup();
  };
}

function paint(win) {
  if (appVersion <= 111) {
    win.tb_view_init = win.view_init;
    win.view_init = (event) => {
      let charset = win.msgWindow.mailCharacterSet;
      setTooltip(win, "repair-text-encoding", charset);
      win.tb_view_init(event);
    };
  } else {
    let tabmail = win.document.getElementById("tabmail");
    if (!tabmail) {
      // Stand-alone window.
      fixMessageMenu(win.document.getElementById("messageBrowser").contentWindow);
      return;
    }

    // The menu will only get fixed in the message tabs loaded after add-on
    // startup, so not on the currently open tabs when the add-on is first
    // installed. Let's not worry about this for now.
    tabmail.addEventListener("aboutMessageLoaded", (event) => {
      fixMessageMenu(event.target);
    });
  }
}

function unpaint(win) {
  // We won't clean-up about:message in version 111 and beyond
  // since we get a new window/document frequently.
  if (appVersion <= 111) {
    win.view_init = win.tb_view_init;
  }
}
