import * as vscode from 'vscode';
import { getTelemetryWebviewContent } from './ui/telemetryView.js';
import { ContextBrokerClient } from './client.js';
import type { ToolExecutionEvent } from '@context-broker/contracts';

export class ContextBrokerViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'contextBroker.telemetryView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _client: ContextBrokerClient,
    private readonly _getHistory: () => ToolExecutionEvent[]
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = getTelemetryWebviewContent(false);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case 'requestInitialHistory': {
          const events = this._getHistory();
          webviewView.webview.postMessage({
            command: 'setInitialEvents',
            events
          });
          break;
        }
        case 'refreshStatus': {
          const health = await this._client.checkHealth();
          vscode.window.showInformationMessage(`Context Broker: ${health.message}`);
          webviewView.webview.postMessage({
            command: 'updateHealth',
            summary: `${health.activeAdaptersCount} / 5 Healthy`
          });
          break;
        }
        case 'popOutWindow': {
          vscode.commands.executeCommand('contextBroker.popOutWindow');
          break;
        }
        case 'openFloatingHUD': {
          vscode.commands.executeCommand('contextBroker.openDraggableHUD');
          break;
        }
        case 'quickSearch': {
          vscode.commands.executeCommand('contextBroker.quickSearch');
          break;
        }
        case 'recordDecision': {
          vscode.commands.executeCommand('contextBroker.recordDecision');
          break;
        }
        case 'simulateRan': {
          vscode.window.setStatusBarMessage(`Context Broker: Simulated ${data.tool} call`, 3000);
          break;
        }
      }
    });
  }

  public postMessage(msg: Record<string, unknown>) {
    if (this._view) {
      this._view.webview.postMessage(msg);
    }
  }

  public notifyCommandLogged(tool: string, args: string, latency: number, tokensSaved: number) {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'mcpCommandLogged',
        tool,
        args,
        latency,
        tokensSaved
      });
    }
  }
}
