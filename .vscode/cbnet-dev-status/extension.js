const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

/** @param {string} envPath */
function readDevPortFromEnv(envPath) {
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(/^VITE_DEV_PORT=(\d+)/m);
  return match ? Number.parseInt(match[1], 10) : null;
}

function activate(context) {
  const cfg = vscode.workspace.getConfiguration("cbnetDevStatus");
  let projectName = cfg.get("projectName") || "CBnet";
  let port = cfg.get("port") || 5175;

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder) {
    const envPort = readDevPortFromEnv(path.join(folder.uri.fsPath, ".env"));
    if (envPort) port = envPort;
  }

  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  const url = `http://localhost:${port}/login`;

  const refresh = () => {
    item.text = `$(server-process) ${projectName} :${port}`;
    item.tooltip = `${projectName} — dev server su ${url}\n(Clic per aprire)`;
  };

  refresh();
  item.command = "cbnetDevStatus.openBrowser";
  item.show();

  context.subscriptions.push(
    item,
    vscode.commands.registerCommand("cbnetDevStatus.openBrowser", () => {
      vscode.env.openExternal(vscode.Uri.parse(url));
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("cbnetDevStatus")) return;
      projectName = cfg.get("projectName") || "CBnet";
      port = cfg.get("port") || port;
      if (folder) {
        const envPort = readDevPortFromEnv(path.join(folder.uri.fsPath, ".env"));
        if (envPort) port = envPort;
      }
      refresh();
    }),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
