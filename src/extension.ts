'use strict';

import * as vscode from 'vscode';
import { ReferenceDocumentation } from './referenceDocumentation';
import { HTMLCompletionItemProvider } from './provider/htmlCompletionItemProvider';
import { DiagnosticProvider } from './provider/diagnosticProvider';
import { OnlineDocumentationProvider } from './provider/onlineDocumentationProvider';
import { SalesforceConnection } from './salesforce/salesforceConnection';
import { SalesforceAPI, DiffResult } from './salesforce/salesforceAPI';
import { VisualforceFormattingProvider } from './provider/visualforceFormattingProvider';
import {
  SalesforceResourceContentProvider,
  SalesforceResourceLocation
} from './salesforce/salesforceResourceContentProvider';

const refererenceDocumentation = new ReferenceDocumentation();
const salesforceAPI = new SalesforceAPI();

export function activate(context: vscode.ExtensionContext) {
  // Generic
  provideCompletionForMarkup(context, 'html');
  provideDiagnosticsForMarkup(context, 'html');
  provideContextMenu(context);

  // Salesforce specific
  provideFormattingForVisualforce(context);
  provideDiffForSalesforceResources(context);
  provideCommandToRetrieveComponentFromSalesforce();
  provideCommandToTakeRemoteFileFromSalesforce();
  provideCommandToTakeLocalFileForSalesforce();
  provideCompletionForMarkup(context, 'visualforce');
  provideDiagnosticsForMarkup(context, 'visualforce');
}

function provideDiffForSalesforceResources(context: vscode.ExtensionContext) {
  const salesforceResourceContentProvider = new SalesforceResourceContentProvider();
  const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
    SalesforceResourceContentProvider.scheme,
    salesforceResourceContentProvider
  );
  context.subscriptions.push(providerRegistration);
}

function provideFormattingForVisualforce(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('visualforce', new VisualforceFormattingProvider())
  );
}

function provideCommandToRetrieveComponentFromSalesforce() {
  const commandProvider = vscode.commands.registerCommand('coveo.salesforce.retrieveSearchPageComponent', () => {
    salesforceAPI.retrieveApexComponent().then(recordRetrieved => {
      if (recordRetrieved) {
        salesforceAPI.diffComponentWithLocalVersion(recordRetrieved.Name).then(outcome => {
          if (outcome == DiffResult.FILE_DOES_NOT_EXIST_LOCALLY) {
            salesforceAPI.saveFile(
              SalesforceResourceContentProvider.getUri(recordRetrieved.Name, SalesforceResourceLocation.DIST),
              SalesforceResourceLocation.DIST
            );
          }
        });
      }
    });
  });
}

function provideCommandToTakeRemoteFileFromSalesforce() {
  vscode.commands.registerCommand('coveo.takeRemote', (uri: vscode.Uri) => {
    if (uri.scheme == SalesforceResourceContentProvider.scheme) {
      salesforceAPI.saveFile(uri, SalesforceResourceLocation.DIST).then(success => {
        if (success) {
          vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
      });
    }
  });
}

function provideCommandToTakeLocalFileForSalesforce() {
  vscode.commands.registerCommand('coveo.takeLocal', (uri: vscode.Uri) => {
    // Nothing to do as far as saving file goes : simply close the editor.
    vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
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

function provideDiagnosticsForMarkup(context: vscode.ExtensionContext, langId: string) {
  const diagnosticsCollection = vscode.languages.createDiagnosticCollection(langId);
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

function provideCompletionForMarkup(context: vscode.ExtensionContext, langId: string) {
  const htmlCompletionProvider = vscode.languages.registerCompletionItemProvider(
    langId,
    new HTMLCompletionItemProvider(refererenceDocumentation)
  );
  context.subscriptions.push(htmlCompletionProvider);
}
