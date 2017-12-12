'use strict';

import * as vscode from 'vscode';
import { ReferenceDocumentation } from './referenceDocumentation';
import { HTMLCompletionItemProvider } from './provider/htmlCompletionItemProvider';
import { DiagnosticProvider } from './provider/diagnosticProvider';
import { OnlineDocumentationProvider } from './provider/onlineDocumentationProvider';
import { registerSalesforceExtension, config as salesforceConfig } from './salesforce/salesforceExtension';
import { l } from './strings/Strings';
// const child_process = require('child_process');

const refererenceDocumentation = new ReferenceDocumentation();

export function activate(context: vscode.ExtensionContext) {
  // Generic
  provideCompletionForMarkup(context);
  provideDiagnosticsForMarkup(context);
  provideContextMenu(context);
  provideGenerator(context);

  let commandsAreHandled = false;
  // Salesforce specific
  if (salesforceConfig.doValidation(true)) {
    registerSalesforceExtension(context);
    commandsAreHandled = true;
  } else if (salesforceConfig.configPartiallyExist()) {
    salesforceConfig.doValidation(false);
  }

  if (!commandsAreHandled) {
    provideHandlerForMissingConfig();
  }
}

const provideContextMenu = (context: vscode.ExtensionContext) => {
  const contextMenuProvider = new OnlineDocumentationProvider(refererenceDocumentation);
  const commandProvider = vscode.commands.registerCommand('coveo.showDocumentation', () => {
    if (vscode.window.activeTextEditor) {
      const currentDocument = vscode.window.activeTextEditor.document;
      const currentPosition = vscode.window.activeTextEditor.selection.active;
      contextMenuProvider.openDocumentation(currentPosition, currentDocument);
    }
  });
  context.subscriptions.push(commandProvider);
};

const provideGenerator = (context: vscode.ExtensionContext) => {
  const commandProvider = vscode.commands.registerCommand('coveo.generateProject', () => {
    // vscode.commands.getCommands().then(vals => console.log(vals));
    // console.log(vscode.workspace.asRelativePath('./node_modules'));
    // vscode.workspace.
    const term = vscode.window.createTerminal('Generator');
    term.sendText('npm install -g yo');
    term.sendText('npm install -g generator-coveo');
    term.sendText('yo coveo');
    term.show();
    //term.sendText(`yo coveo`);
  });

  context.subscriptions.push(commandProvider);
};

const provideDiagnosticsForMarkup = (context: vscode.ExtensionContext) => {
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
};

const provideCompletionForMarkup = (context: vscode.ExtensionContext) => {
  const htmlCompletionProvider = vscode.languages.registerCompletionItemProvider(
    ['html', 'visualforce'],
    new HTMLCompletionItemProvider(refererenceDocumentation)
  );
  context.subscriptions.push(htmlCompletionProvider);
};

const provideHandlerForMissingConfig = () => {
  vscode.commands.registerCommand('coveo.download', (uri: vscode.Uri) => {
    vscode.window.showWarningMessage(l('MissingConfig'));
  });
  vscode.commands.registerCommand('coveo.upload', (uri: vscode.Uri) => {
    vscode.window.showWarningMessage(l('MissingConfig'));
  });
};
