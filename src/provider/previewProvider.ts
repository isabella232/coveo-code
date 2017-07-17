import * as vscode from 'vscode';
import { ReferenceDocumentation } from '../referenceDocumentation';
import { getComponentAtPosition, getCurrentSymbol } from '../documentService';
import * as _ from 'lodash';

export class PreviewProvider implements vscode.TextDocumentContentProvider {
  private onDidChangeInternal = new vscode.EventEmitter<vscode.Uri>();

  public constructor(public referenceDocumentation: ReferenceDocumentation) {}
  public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId !== 'html') {
      return null;
    }
    return new Promise((resolve, reject) => {
      if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.selection.start) {
        const currentPosition = vscode.window.activeTextEditor.selection.start;
        const currentComponent = getComponentAtPosition(
          this.referenceDocumentation,
          currentPosition,
          vscode.window.activeTextEditor.document
        );
        if (currentComponent) {
          const currentSymbol = getCurrentSymbol(currentPosition, vscode.window.activeTextEditor.document);
          if (currentSymbol) {
            const currentRange = new vscode.Range(currentSymbol.location.range.start, currentSymbol.location.range.end);
            const currentHTml = vscode.window.activeTextEditor.document.getText(currentRange);
            resolve(
              '<html><head></head><body>Current component is ' +
                currentComponent.name +
                '<br/><pre>' +
                _.escape(currentHTml) +
                '</pre></body></html>'
            );
          }
        } else {
          resolve('<html><head></head><body>Not a component !</body></html>');
        }
      }
    });
  }

  public update(uri: vscode.Uri) {
    this.onDidChangeInternal.fire(uri);
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this.onDidChangeInternal.event;
  }
}
