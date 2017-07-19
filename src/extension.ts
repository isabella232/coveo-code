'use strict';

import * as vscode from 'vscode';
import { ReferenceDocumentation } from './referenceDocumentation';
import { HTMLCompletionItemProvider } from './provider/htmlCompletionItemProvider';
import { PreviewProvider } from './provider/previewProvider';
import { DiagnosticProvider } from './provider/diagnosticProvider';
import { OnlineDocumentationProvider } from './provider/onlineDocumentationProvider';

const refererenceDocumentation = new ReferenceDocumentation();

export function activate(context: vscode.ExtensionContext) {
  provideCompletionForMarkup(context);
  //providePreviewForComponents(context);
  provideDiagnosticsForMarkup(context);
  provideContextMenu(context);
}

function provideContextMenu(context: vscode.ExtensionContext) {
  const contextMenuProvider = new OnlineDocumentationProvider(refererenceDocumentation);
  const commandProvider = vscode.commands.registerCommand('coveo.showDocumentation', () => {
    if (vscode.window.activeTextEditor) {
      const currentDocument = vscode.window.activeTextEditor.document;
      const currentPosition = vscode.window.activeTextEditor.selection.active;
      contextMenuProvider.openDocumentation(currentPosition, currentDocument);
    }
  });
  context.subscriptions.push(commandProvider);
}

function provideDiagnosticsForMarkup(context: vscode.ExtensionContext) {
  const diagnosticsCollection = vscode.languages.createDiagnosticCollection('html');
  const diagnosticProvider = new DiagnosticProvider(diagnosticsCollection, refererenceDocumentation);
  const doUpdateDiagnostics = (documentOpened: vscode.TextDocument) => {
    if (vscode.window.activeTextEditor && documentOpened === vscode.window.activeTextEditor.document) {
      diagnosticProvider.updateDiagnostics(documentOpened);
    }
  };
  vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => doUpdateDiagnostics(e.document));
  if (vscode.window.activeTextEditor) {
    diagnosticProvider.updateDiagnostics(vscode.window.activeTextEditor.document);
  }
  context.subscriptions.push(diagnosticsCollection);
}

function provideCompletionForMarkup(context: vscode.ExtensionContext) {
  const htmlCompletionProvider = vscode.languages.registerCompletionItemProvider(
    'html',
    new HTMLCompletionItemProvider(refererenceDocumentation)
  );
  context.subscriptions.push(htmlCompletionProvider);
}

/*function providePreviewForComponents(context: vscode.ExtensionContext) {
  const previewUri = vscode.Uri.parse('coveo-preview://authority/coveo-preview');
  const previewProvider = new PreviewProvider(refererenceDocumentation);
  vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
    if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
      previewProvider.update(previewUri);
    }
  });

  const previewRegistration = vscode.workspace.registerTextDocumentContentProvider('coveo-preview', previewProvider);
  const commandProvider = vscode.commands.registerCommand('extension.showCoveoPreview', () => {
    return vscode.commands
      .executeCommand('vscode.showCoveoPreview', previewUri, vscode.ViewColumn.Two, 'Coveo Preview')
      .then(
        success => {
          console.log('success');
        },
        reason => {
          vscode.window.showErrorMessage(reason);
        }
      );
  });
  context.subscriptions.push(commandProvider, previewRegistration);
}*/
