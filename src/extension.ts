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
  provideCommandToRetrieveAnyComponentFromSalesforce();
  provideCommandToUploadComponentToSalesforce();
  provideCommandToDownloadComponentFromSalesforce();
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

function provideCommandToRetrieveAnyComponentFromSalesforce() {
  const commandProvider = vscode.commands.registerCommand('coveo.salesforce.retrieveSearchPageComponent', () => {
    return salesforceAPI.retrieveApexComponents().then(recordRetrieved => {
      if (recordRetrieved) {
        return salesforceAPI.diffComponentWithLocalVersion(recordRetrieved.Name).then((outcome): Promise<
          boolean | undefined
        > => {
          if (outcome == DiffResult.FILE_DOES_NOT_EXIST_LOCALLY) {
            return salesforceAPI.saveFile(recordRetrieved.Name, recordRetrieved.Markup).then(() => {
              const localPath = salesforceAPI.getPathOfFileLocally(recordRetrieved.Name);
              if (localPath) {
                return vscode.workspace.openTextDocument(localPath).then(doc => {
                  return vscode.window.showTextDocument(doc).then(() => true);
                });
              } else {
                return false;
              }
            });
          } else {
            return Promise.resolve(undefined);
          }
        });
      } else {
        return undefined;
      }
    });
  });
}

function provideCommandToUploadComponentToSalesforce() {
  vscode.commands.registerCommand('coveo.salesforce.upload', (uri: vscode.Uri) => {
    const componentName = SalesforceResourceContentProvider.getComponentNameFromFilePath(uri);
    if (componentName) {
      return salesforceAPI.uploadApexComponent(componentName).then(metadataUpsertResult => {
        if (metadataUpsertResult.success) {
          vscode.window.showInformationMessage(
            `Ressource succesfully uploaded to Salesforce as a Visualforce Component with the name ${metadataUpsertResult.fullName}`
          );
        } else {
          vscode.window.showErrorMessage(`Message: ${metadataUpsertResult.errors.message}`);
          vscode.window.showErrorMessage(`Status code: ${metadataUpsertResult.errors.statusCode}`);
        }
      });
    } else {
      return Promise.reject(`Invalid uri scheme : ${uri.toString()}`);
    }
  });
}

function provideCommandToDownloadComponentFromSalesforce() {
  vscode.commands.registerCommand('coveo.salesforce.download', (uri: vscode.Uri) => {
    const componentName = SalesforceResourceContentProvider.getComponentNameFromFilePath(uri);
    if (componentName) {
      return salesforceAPI.downloadApexComponent(componentName).then((record): Promise<DiffResult | boolean> => {
        if (record) {
          const localFileContent = salesforceAPI.getContentOfFileLocally(record.Name);
          if (localFileContent) {
            return salesforceAPI.diffComponentWithLocalVersion(componentName);
          } else {
            return salesforceAPI.saveFile(componentName, record.Markup);
          }
        } else {
          return Promise.reject(`Component not found in our salesforce organization : ${componentName}`);
        }
      });
    } else {
      return Promise.reject(`Invalid uri scheme : ${uri.toString()}`);
    }
  });
}

function provideCommandToTakeRemoteFileFromSalesforce() {
  vscode.commands.registerCommand('coveo.takeRemote', (uri: vscode.Uri) => {
    const componentName = SalesforceResourceContentProvider.getComponentNameFromUri(uri);
    if (componentName && uri.scheme == SalesforceResourceContentProvider.scheme) {
      return salesforceAPI.downloadApexComponent(componentName).then(record => {
        return salesforceAPI.saveFile(componentName, record.Markup).then(() => {
          return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });
      });
    } else {
      return Promise.reject(`Invalid uri scheme : ${uri.toString()}`);
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
