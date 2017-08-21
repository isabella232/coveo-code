'use strict';

import * as vscode from 'vscode';
import { l } from './strings/Strings';
import { ReferenceDocumentation } from './referenceDocumentation';
import { HTMLCompletionItemProvider } from './provider/htmlCompletionItemProvider';
import { DiagnosticProvider } from './provider/diagnosticProvider';
import { OnlineDocumentationProvider } from './provider/onlineDocumentationProvider';
import { SalesforceConnection } from './salesforce/salesforceConnection';
import {
  SalesforceAPI,
  DiffResult,
  SalesforceResourceLocation,
  ISalesforceApexComponentRecord,
  ISalesforceStaticResourceFromZip
} from './salesforce/salesforceAPI';
import { VisualforceFormattingProvider } from './provider/visualforceFormattingProvider';
import { SalesforceResourceContentProvider } from './salesforce/salesforceResourceContentProvider';
import { DiffContentStore } from './diffContentStore';
import { ApexResourceType } from './salesforce/salesforceResourceTypes';
import { SalesforceAPIStaticFolder } from './salesforce/salesforceAPIStaticFolder';

const refererenceDocumentation = new ReferenceDocumentation();
const salesforceAPI = new SalesforceAPI();

export function activate(context: vscode.ExtensionContext) {
  // Generic
  provideCompletionForMarkup(context);
  provideDiagnosticsForMarkup(context);
  provideContextMenu(context);

  // Salesforce specific
  provideFormattingForVisualforce(context);
  provideDiffForSalesforceResources(context);
  provideCommandToRetrieveApexComponent();
  provideCommandToRetrieveApexPage();
  provideCommandToRetrieveStaticResources();
  provideCommandToUploadApexToSalesforce();
  provideCommandToDownloadApexFromSalesforce();
  provideCommandToTakeRemoteFileFromSalesforce();
  provideCommandToTakeLocalFileForSalesforce();
}

export function deactivate() {
  return undefined;
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

function afterRetrieve(
  recordRetrieved: ISalesforceApexComponentRecord,
  outcome: DiffResult,
  type: ApexResourceType,
  content?: string
) {
  if (outcome == DiffResult.FILE_DOES_NOT_EXIST_LOCALLY) {
    let contentType = '';
    if (recordRetrieved.ContentType) {
      contentType = recordRetrieved.ContentType;
    }
    if (!content) {
      content = recordRetrieved.Markup;
    }

    const defaultPath = salesforceAPI.getStandardPathOfFileLocally(recordRetrieved.Name, type, contentType);
    if (defaultPath) {
      return salesforceAPI.saveFile(recordRetrieved.Name, content, defaultPath).then(() => {
        return vscode.workspace.openTextDocument(defaultPath).then(doc => {
          return vscode.window.showTextDocument(doc).then(() => true);
        });
      });
    }
  }
  return Promise.resolve(undefined);
}

function provideCommandToRetrieveApexComponent() {
  vscode.commands.registerCommand('coveo.salesforce.retrieveApexComponent', () => {
    return salesforceAPI.retrieveApexComponents().then(recordRetrieved => {
      if (recordRetrieved) {
        return salesforceAPI
          .diffComponentWithLocalVersion(recordRetrieved.Name, ApexResourceType.APEX_COMPONENT)
          .then(outcome => afterRetrieve(recordRetrieved, outcome, ApexResourceType.APEX_COMPONENT));
      } else {
        return undefined;
      }
    });
  });
}

function provideCommandToRetrieveApexPage() {
  vscode.commands.registerCommand('coveo.salesforce.retrieveApexPage', () => {
    return salesforceAPI.retrieveApexPages().then(recordRetrieved => {
      if (recordRetrieved) {
        return salesforceAPI
          .diffComponentWithLocalVersion(recordRetrieved.Name, ApexResourceType.APEX_PAGE)
          .then(outcome => afterRetrieve(recordRetrieved, outcome, ApexResourceType.APEX_PAGE));
      } else {
        return undefined;
      }
    });
  });
}

function provideCommandToRetrieveStaticResources() {
  vscode.commands.registerCommand('coveo.salesforce.retrieveStaticResource', () => {
    return salesforceAPI.retrieveStaticResource().then(recordRetrieved => {
      if (recordRetrieved) {
        return salesforceAPI.downloadStaticResource(recordRetrieved).then(outcome => {
          if (outcome == DiffResult.FILE_DOES_NOT_EXIST_LOCALLY) {
            return afterRetrieve(
              recordRetrieved,
              outcome,
              ApexResourceType.STATIC_RESOURCE_SIMPLE,
              salesforceAPI.getComponentInDiffStore(
                recordRetrieved.Name,
                ApexResourceType.STATIC_RESOURCE_SIMPLE,
                SalesforceResourceLocation.DIST
              )
            );
          } else {
            return undefined;
          }
        });
      } else {
        return undefined;
      }
    });
  });
}

function provideCommandToUploadApexToSalesforce() {
  vscode.commands.registerCommand('coveo.salesforce.upload', (uri: vscode.Uri) => {
    if (!uri.fsPath && vscode.window.activeTextEditor) {
      uri = vscode.window.activeTextEditor.document.uri;
    }
    const componentName = SalesforceAPI.getComponentNameFromFilePath(uri);
    const componentType = SalesforceAPI.getResourceTypeFromFilePath(uri);
    const content = salesforceAPI.getContentOfFileLocally(uri.fsPath);
    if (componentName && componentType) {
      return salesforceAPI.uploadApex(componentName, componentType, content, uri).then(metadataUpsertResult => {
        if (metadataUpsertResult.success) {
          vscode.window.showInformationMessage(
            l('SalesforceUploadSuccess', componentType, metadataUpsertResult.fullName)
          );
        } else {
          vscode.window.showErrorMessage(`Message: ${metadataUpsertResult.errors.message}`);
          vscode.window.showErrorMessage(`Status code: ${metadataUpsertResult.errors.statusCode}`);
        }
      });
    } else {
      return Promise.reject(l('InvalidUriScheme', uri.toString()));
    }
  });
}

function provideCommandToDownloadApexFromSalesforce() {
  vscode.commands.registerCommand('coveo.salesforce.download', (uri: vscode.Uri) => {
    if (!uri.fsPath && vscode.window.activeTextEditor) {
      uri = vscode.window.activeTextEditor.document.uri;
    }
    const componentName = SalesforceAPI.getComponentNameFromFilePath(uri);
    const componentType = SalesforceAPI.getResourceTypeFromFilePath(uri);
    if (componentName && componentType) {
      if (componentType == ApexResourceType.APEX_COMPONENT || componentType == ApexResourceType.APEX_PAGE) {
        return salesforceAPI.downloadApex(componentName, componentType).then((record): Promise<
          DiffResult | boolean
        > => {
          if (record) {
            const localFileContent = salesforceAPI.getContentOfFileLocally(uri.fsPath);
            if (localFileContent) {
              return salesforceAPI.diffComponentWithLocalVersion(componentName, componentType, uri.fsPath);
            } else {
              return salesforceAPI.saveFile(componentName, record.Markup, uri.fsPath);
            }
          } else {
            return Promise.reject(l('SalesforceComponentNotFound', componentName));
          }
        });
      } else {
        let toRetrieve = componentName;
        if (componentType == ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP) {
          const extract = SalesforceAPIStaticFolder.extractResourceInfoForFileInsizeZip(uri.fsPath);
          if (extract) {
            toRetrieve = extract.resourceName;
          }
        }
        return salesforceAPI.retrieveStaticResourceByName(toRetrieve).then(rec => {
          if (rec) {
            return salesforceAPI.downloadStaticResource(rec);
          } else {
            return Promise.reject(l('SalesforceComponentNotFound', componentName));
          }
        });
      }
    } else {
      return Promise.reject(l('InvalidUriScheme', uri.toString()));
    }
  });
}

function provideCommandToTakeRemoteFileFromSalesforce() {
  vscode.commands.registerCommand('coveo.takeRemote', (uri: vscode.Uri) => {
    const componentName = SalesforceResourceContentProvider.getComponentNameFromPreviewUri(uri);
    const componentType = SalesforceResourceContentProvider.getComponentTypeFromPreviewUri(uri);
    const localPath = SalesforceResourceContentProvider.getQueryParameterByName('localPath', uri);

    if (componentName && localPath && componentType) {
      if (componentType == ApexResourceType.APEX_COMPONENT || componentType == ApexResourceType.APEX_PAGE) {
        return salesforceAPI
          .downloadApex(componentName, componentType)
          .then(record => record.Markup)
          .then(content => {
            return salesforceAPI
              .saveFile(componentName, content, localPath)
              .then(() => vscode.commands.executeCommand('workbench.action.closeActiveEditor'));
          })
          .catch(() => Promise.reject(l('FileNotFound')));
      } else {
        const content = DiffContentStore.get(
          SalesforceAPI.getDiffStoreScheme(componentName, componentType, SalesforceResourceLocation.DIST)
        );
        if (content) {
          return salesforceAPI
            .saveFile(componentName, content, localPath)
            .then(() => vscode.commands.executeCommand('workbench.action.closeActiveEditor'));
        } else {
          return Promise.reject(l('FileNotFound'));
        }
      }
    } else {
      return Promise.reject(l('InvalidUriScheme', uri.toString()));
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
    ['html', 'visualforce'],
    new HTMLCompletionItemProvider(refererenceDocumentation)
  );
  context.subscriptions.push(htmlCompletionProvider);
}
