// Copyright (c) 2021, Jörg Knobloch. All rights reserved.

/* global ExtensionCommon */

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");

const EXTENSION_NAME = "CharsetMenu@jorgk.com";
var extension = ExtensionParent.GlobalManager.getExtension(EXTENSION_NAME);
Cu.importGlobalProperties(["TextEncoder"]); // Don't ask :-(

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
          let defaultsBranch = Services.prefs.getDefaultBranch("extensions.CharsetMenu.");
          defaultsBranch.setBoolPref("fixThreadTree", false);

          // Adds a listener to detect new windows.
          ExtensionSupport.registerWindowListener(EXTENSION_NAME, {
            chromeURLs: ["chrome://messenger/content/messenger.xul",
              "chrome://messenger/content/messenger.xhtml"],
            onLoadWindow: paint,
            onUnloadWindow: unpaint,
          });
        },
      },
    };
  }
};

function paint(win) {
  win.MailSetCharacterSetNew = (aEvent) => {
    if (aEvent.target.hasAttribute("charset")) {
      win.msgWindow.charsetOverride = true;
      win.gMessageDisplay.keyForCharsetOverride =
        "messageKey" in win.gMessageDisplay.displayedMessage
          ? win.gMessageDisplay.displayedMessage.messageKey
          : null;
      let canSetCharset = false;
      try {
        let charset = aEvent.target.getAttribute("charset");
        // From TB 91.3 or TB 94 beta the following call will fail since the API was removed.
        win.messenger.setDocumentCharset(charset);
        win.msgWindow.mailCharacterSet = charset;
        canSetCharset = true;
      } catch (ex) {
        win.messenger.forceDetectDocumentCharset();
      }

      // messenger.setDocumentCharset() also fixes the subject in the header pane,
      // so we can fix the tree using it. 100ms should be good enough to redisplay the message
      // so get can get the fixed subject. Hacky, ...
      if (canSetCharset && Services.prefs.getBoolPref("extensions.CharsetMenu.fixThreadTree", false)) {
        win.setTimeout(() => {
          let subject = win.document.getElementById("expandedsubjectBox").textContent;
          let subjectUTF8 = String.fromCharCode.apply(undefined, new TextEncoder("UTF-8").encode(subject));
          const { selectedMessage, tree, selectedMessageUris } = win.gFolderDisplay;
          // console.log(selectedMessage, tree, subject, subjectUTF8);
          if (selectedMessage) {
            selectedMessage.subject = subjectUTF8;
            if (tree && tree.view && tree.view.selection && tree.view.selection.currentIndex >= 0) {
              tree.invalidateRow(tree.view.selection.currentIndex);
            }
          }
        }, 100);
      }
    }
  };
  win.UpdateCharsetMenuNew = (aCharset, aNode) => {
    // console.log("UpdateCharsetMenuNew", aCharset);
    if (aCharset.toUpperCase() == "ISO-8859-8-I") aCharset = "windows-1255";
    else if (aCharset.toLowerCase() == "gb18030") aCharset = "GBK";
    let menuitem = aNode
      .getElementsByAttribute("charset", aCharset)
      .item(0);
    if (menuitem) {
      menuitem.setAttribute("checked", "true");
    }
  };

  /* eslint-disable max-len */
  let xul = win.MozXULElement.parseXULToFragment(`
    <menu id="charsetMenuNew"
          onpopupshowing="UpdateCharsetMenuNew(msgWindow.mailCharacterSet, this);"
          oncommand="MailSetCharacterSetNew(event);"
          label="Text Encoding">
    <menupopup id="charsetPopupNew">
    <menuitem type="radio" charset="UTF-8" label="Unicode (UTF-8)"></menuitem>
    <menuitem type="radio" charset="windows-1252" label="Western (windows-1252)"></menuitem>
    <menuseparator/>
    <menuitem type="radio" charset="windows-1256" label="Arabic (windows-1256)"></menuitem>
    <menuitem type="radio" charset="ISO-8859-6" label="Arabic (ISO-8859-6)"></menuitem>

    <menuitem type="radio" charset="windows-1257" label="Baltic (windows-1257)"></menuitem>
    <menuitem type="radio" charset="ISO-8859-4" label="Baltic (ISO-8859-4)"></menuitem>

    <menuitem type="radio" charset="windows-1250" label="Central European (windows-1250)"></menuitem>
    <menuitem type="radio" charset="ISO-8859-2" label="Central European (ISO-8859-2)"></menuitem>

    <menuitem type="radio" charset="GBK" label="Chinese, Simplified (GBK)"></menuitem>
    <menuitem type="radio" charset="Big5" label="Chinese, Traditional (Big5)"></menuitem>

    <menuitem type="radio" charset="windows-1251" label="Cyrillic (windows-1251)"></menuitem>
    <menuitem type="radio" charset="ISO-8859-5" label="Cyrillic (ISO-8859-5)"></menuitem>
    <menuitem type="radio" charset="KOI8-R" label="Cyrillic (KOI8-R)"></menuitem>
    <menuitem type="radio" charset="KOI8-U" label="Cyrillic (KOI8-U)"></menuitem>
    <menuitem type="radio" charset="IBM866" label="Cyrillic (IBM866)"></menuitem>

    <menuitem type="radio" charset="windows-1253" label="Greek (windows-1253)"></menuitem>
    <menuitem type="radio" charset="ISO-8859-7" label="Greek (ISO-8859-7)"></menuitem>

    <menuitem type="radio" charset="windows-1255" label="Hebrew (windows-1255)"></menuitem>
    <menuitem type="radio" charset="ISO-8859-8" label="Hebrew (ISO-8859-8)"></menuitem>

    <menuitem type="radio" charset="Shift_JIS" label="Japanese (Shift_JIS)"></menuitem>
    <menuitem type="radio" charset="EUC-JP" label="Japanese (EUC-JP)"></menuitem>
    <menuitem type="radio" charset="ISO-2022-JP" label="Japanese (ISO-2022-JP)"></menuitem>

    <menuitem type="radio" charset="EUC-KR" label="Korean (EUC-KR)"></menuitem>
    <menuitem type="radio" charset="windows-874" label="Thai (windows-874)"></menuitem>
    <menuitem type="radio" charset="windows-1254" label="Turkish (windows-1254)"></menuitem>
    <menuitem type="radio" charset="windows-1258" label="Vietnamese (windows-1258)"></menuitem>
    </menupopup>
    </menu>
  `);
  /* eslint-enable max-len */
  let old = win.document.getElementById("charsetMenu");
  if (!old) old = win.document.getElementById("repair-text-encoding");  // TB 91 item.
  old.parentNode.insertBefore(xul, old.nextSibling);
}

function unpaint(win) {
  let menu = win.document.getElementById("charsetMenuNew");
  if (menu) menu.remove();
}
