'use strict';

import * as vscode from 'vscode';
import { ReferenceDocumentation } from './referenceDocumentation';
import { CodeLensProvider } from './provider/codeLensProvider';
import { HTMLCompletionItemProvider } from "./provider/htmlCompletionItemProvider";
import { PreviewProvider } from "./provider/previewProvider";

const refererenceDocumentation = new ReferenceDocumentation();

export function activate(context: vscode.ExtensionContext) {
  provideCompletionForMarkup(context);
  provideCodeLensForMarkup(context);
  providePreviewForComponents(context);
}

function provideCompletionForMarkup(context: vscode.ExtensionContext) {
  const htmlCompletionProvider = vscode.languages.registerCompletionItemProvider('html', new HTMLCompletionItemProvider(refererenceDocumentation));
  context.subscriptions.push(htmlCompletionProvider);
}

function provideCodeLensForMarkup(context: vscode.ExtensionContext) {
  const codeLensProvider = vscode.languages.registerCodeLensProvider(
    'html',
    new CodeLensProvider(refererenceDocumentation)
  );
  context.subscriptions.push(codeLensProvider);
}

function providePreviewForComponents(context: vscode.ExtensionContext) {
  const previewUri = vscode.Uri.parse('coveo-preview://authority/coveo-preview');
  const previewProvider = new PreviewProvider(refererenceDocumentation)
  vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
    if (e.document === vscode.window.activeTextEditor.document) {
      previewProvider.update(previewUri);
    }
  });

  const previewRegistration = vscode.workspace.registerTextDocumentContentProvider('coveo-preview', previewProvider);
  const commandProvider = vscode.commands.registerCommand('extension.showCoveoPreview', () => {
    return vscode.commands.executeCommand('vscode.showCoveoPreview', previewUri, vscode.ViewColumn.Two, 'Coveo Preview').then((success) => {
      console.log('success');
    }, (reason) => {
      vscode.window.showErrorMessage(reason);
    });
  });
  context.subscriptions.push(commandProvider, previewRegistration);
}
