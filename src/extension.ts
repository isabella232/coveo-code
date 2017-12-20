'use strict';

import * as vscode from 'vscode';
import { ReferenceDocumentation } from './referenceDocumentation';
import { HTMLCompletionItemProvider } from './provider/htmlCompletionItemProvider';
import { DiagnosticProvider } from './provider/diagnosticProvider';
import { OnlineDocumentationProvider } from './provider/onlineDocumentationProvider';
import { config as salesforceConfig, registerSalesforceExtension } from './salesforce/salesforceExtension';
import { l } from './strings/Strings';

const refererenceDocumentation = new ReferenceDocumentation();

export function activate(context: vscode.ExtensionContext) {
  // Generic
  provideCompletionForMarkup(context);
  provideDiagnosticsForMarkup(context);
  provideContextMenu(context);

  let commandsAreHandled = false;

  const doRegisterForSalesforceChange = () => {
    // Salesforce specific
    if (!commandsAreHandled) {
      if (salesforceConfig.doValidation(true)) {
        registerSalesforceExtension(context);
        commandsAreHandled = true;
      } else if (salesforceConfig.configPartiallyExist()) {
        salesforceConfig.doValidation(false);
      }
    }
  };

  vscode.workspace.onDidChangeConfiguration(e => doRegisterForSalesforceChange());
  doRegisterForSalesforceChange();
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
    vscode.window.showWarningMessage(l('MissingConfig'), {
      modal: true
    });
  });
  vscode.commands.registerCommand('coveo.upload', (uri: vscode.Uri) => {
    vscode.window.showWarningMessage(l('MissingConfig'), {
      modal: true
    });
  });
};
