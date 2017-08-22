import * as vscode from 'vscode';
import { SalesforceResourceContentProvider } from './salesforceResourceContentProvider';
import { VisualforceFormattingProvider } from '../provider/visualforceFormattingProvider';
import { ISalesforceApexComponentRecord, DiffResult, SalesforceAPI, SalesforceResourceLocation } from './salesforceAPI';
import { ApexResourceType } from './salesforceResourceTypes';
import { SalesforceLocalFile } from './salesforceLocalFile';
import { SalesforceStaticFolder } from './salesforceStaticFolder';
import { l } from '../strings/Strings';
import { DiffContentStore } from '../diffContentStore';

export const salesforceAPI = new SalesforceAPI();

export const registerSalesforceExtension = (context: vscode.ExtensionContext) => {
  provideFormattingForVisualforce(context);
  provideDiffForSalesforceResources(context);
  provideCommandToRetrieveApexComponent();
  provideCommandToRetrieveApexPage();
  provideCommandToRetrieveStaticResources();
  provideCommandToUploadApexToSalesforce();
  provideCommandToDownloadApexFromSalesforce();
  provideCommandToTakeRemoteFileFromSalesforce();
  provideCommandToTakeLocalFileForSalesforce();
};

const provideDiffForSalesforceResources = (context: vscode.ExtensionContext) => {
  const salesforceResourceContentProvider = new SalesforceResourceContentProvider();
  const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
    SalesforceResourceContentProvider.scheme,
    salesforceResourceContentProvider
  );
  context.subscriptions.push(providerRegistration);
};

const provideFormattingForVisualforce = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('visualforce', new VisualforceFormattingProvider())
  );
};

const afterRetrieve = async (
  recordRetrieved: ISalesforceApexComponentRecord,
  outcome: DiffResult,
  type: ApexResourceType,
  content?: string
) => {
  if (outcome == DiffResult.FILE_DOES_NOT_EXIST_LOCALLY) {
    let contentType = '';
    if (recordRetrieved.ContentType) {
      contentType = recordRetrieved.ContentType;
    }
    if (!content) {
      content = recordRetrieved.Markup;
    }

    const defaultPath = SalesforceLocalFile.getStandardPathOfFileLocally(
      recordRetrieved.Name,
      type,
      salesforceAPI.config,
      contentType
    );
    if (defaultPath) {
      await SalesforceLocalFile.saveFile(recordRetrieved.Name, content, defaultPath);
      const doc = await vscode.workspace.openTextDocument(defaultPath);
      return vscode.window.showTextDocument(doc);
    }
  }
  return Promise.resolve(undefined);
};

const provideCommandToRetrieveApexComponent = () => {
  vscode.commands.registerCommand('coveo.salesforce.retrieveApexComponent', async () => {
    const recordRetrieved = await salesforceAPI.retrieveApexComponents();
    if (recordRetrieved) {
      return salesforceAPI
        .diffComponentWithLocalVersion(recordRetrieved.Name, ApexResourceType.APEX_COMPONENT)
        .then(outcome => afterRetrieve(recordRetrieved, outcome, ApexResourceType.APEX_COMPONENT));
    } else {
      return undefined;
    }
  });
};

const provideCommandToRetrieveApexPage = () => {
  vscode.commands.registerCommand('coveo.salesforce.retrieveApexPage', async () => {
    const recordRetrieved = await salesforceAPI.retrieveApexPages();
    if (recordRetrieved) {
      return salesforceAPI
        .diffComponentWithLocalVersion(recordRetrieved.Name, ApexResourceType.APEX_PAGE)
        .then(outcome => afterRetrieve(recordRetrieved, outcome, ApexResourceType.APEX_PAGE));
    } else {
      return undefined;
    }
  });
};

const provideCommandToRetrieveStaticResources = () => {
  vscode.commands.registerCommand('coveo.salesforce.retrieveStaticResource', async () => {
    const recordRetrieved = await salesforceAPI.retrieveStaticResource();

    if (recordRetrieved) {
      const outcome = await salesforceAPI.downloadStaticResource(recordRetrieved);
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
    } else {
      return undefined;
    }
  });
};

const provideCommandToUploadApexToSalesforce = () => {
  vscode.commands.registerCommand('coveo.upload', async (uri: vscode.Uri) => {
    if (!uri.fsPath && vscode.window.activeTextEditor) {
      uri = vscode.window.activeTextEditor.document.uri;
    }
    const componentName = SalesforceLocalFile.getComponentNameFromFilePath(uri);
    const componentType = SalesforceLocalFile.getResourceTypeFromFilePath(uri);
    const content = SalesforceLocalFile.getContentOfFileLocally(uri.fsPath);
    if (componentName && componentType) {
      const metadataUpsertResult = await salesforceAPI.uploadApex(componentName, componentType, content, uri);

      if (metadataUpsertResult.success) {
        vscode.window.showInformationMessage(
          l('SalesforceUploadSuccess', componentType, metadataUpsertResult.fullName)
        );
      } else {
        vscode.window.showErrorMessage(`Message: ${metadataUpsertResult.errors.message}`);
        vscode.window.showErrorMessage(`Status code: ${metadataUpsertResult.errors.statusCode}`);
      }
    } else {
      return Promise.reject(l('InvalidUriScheme', uri.toString()));
    }
  });
};

const provideCommandToDownloadApexFromSalesforce = () => {
  vscode.commands.registerCommand('coveo.download', async (uri: vscode.Uri) => {
    if (!uri.fsPath && vscode.window.activeTextEditor) {
      uri = vscode.window.activeTextEditor.document.uri;
    }
    const componentName = SalesforceLocalFile.getComponentNameFromFilePath(uri);
    const componentType = SalesforceLocalFile.getResourceTypeFromFilePath(uri);

    if (!componentName || !componentType) {
      return Promise.reject(l('InvalidUriScheme', uri.toString()));
    }

    switch (componentType) {
      case ApexResourceType.APEX_COMPONENT:
      case ApexResourceType.APEX_PAGE:
        const recordApex = await salesforceAPI.downloadApex(componentName, componentType);
        if (recordApex) {
          const localFileContent = SalesforceLocalFile.getContentOfFileLocally(uri.fsPath);
          if (localFileContent) {
            return salesforceAPI.diffComponentWithLocalVersion(componentName, componentType, uri.fsPath);
          } else {
            return SalesforceLocalFile.saveFile(componentName, recordApex.Markup, uri.fsPath);
          }
        } else {
          return Promise.reject(l('SalesforceComponentNotFound', componentName));
        }

      default:
        let toRetrieve = componentName;
        if (componentType == ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP) {
          const extract = SalesforceStaticFolder.extractResourceInfoForFileInsizeZip(uri.fsPath);
          if (extract) {
            toRetrieve = extract.resourceName;
          }
        }
        const recordStaticResource = await salesforceAPI.retrieveStaticResourceByName(toRetrieve);
        if (recordStaticResource) {
          return salesforceAPI.downloadStaticResource(recordStaticResource);
        } else {
          return Promise.reject(l('SalesforceComponentNotFound', componentName));
        }
    }
  });
};

const provideCommandToTakeRemoteFileFromSalesforce = () => {
  vscode.commands.registerCommand('coveo.takeRemote', async (uri: vscode.Uri) => {
    const componentName = SalesforceResourceContentProvider.getComponentNameFromPreviewUri(uri);
    const componentType = SalesforceResourceContentProvider.getComponentTypeFromPreviewUri(uri);
    const localPath = SalesforceResourceContentProvider.getQueryParameterByName('localPath', uri);

    if (!componentName || !localPath || !componentType) {
      return Promise.reject(l('InvalidUriScheme', uri.toString()));
    }

    if (componentType == ApexResourceType.APEX_COMPONENT || componentType == ApexResourceType.APEX_PAGE) {
      const record = await salesforceAPI.downloadApex(componentName, componentType);
      await SalesforceLocalFile.saveFile(componentName, record.Markup, localPath);
      return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    } else {
      const content = DiffContentStore.get(
        SalesforceAPI.getDiffStoreScheme(componentName, componentType, SalesforceResourceLocation.DIST)
      );

      if (content) {
        await SalesforceLocalFile.saveFile(componentName, content, localPath);
        return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      } else {
        return Promise.reject(l('FileNotFound'));
      }
    }
  });
};

const provideCommandToTakeLocalFileForSalesforce = () => {
  vscode.commands.registerCommand('coveo.takeLocal', (uri: vscode.Uri) => {
    // Nothing to do as far as saving file goes : simply close the editor.
    return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
};
