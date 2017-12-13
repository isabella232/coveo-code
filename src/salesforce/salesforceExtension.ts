import * as vscode from 'vscode';
import { SalesforceResourcePreviewContentProvider } from './salesforceResourcePreviewContentProvider';
import { VisualforceFormattingProvider } from '../provider/visualforceFormattingProvider';
import { ISalesforceApexComponentRecord, SalesforceAPI, SalesforceResourceLocation } from './salesforceAPI';
import { SalesforceLocalFileManager, DiffResult } from './salesforceLocalFileManager';
import { SalesforceStaticFolder } from './salesforceStaticFolder';
import { l } from '../strings/Strings';
import { DiffContentStore } from '../diffContentStore';
import { SalesforceAura } from './salesforceAuraFolder';
import { SalesforceConfig } from './salesforceConfig';
import { SalesforceResourceType } from '../filetypes/filetypesConverter';

export const config = new SalesforceConfig();
export const salesforceAPI = new SalesforceAPI(config);

export const registerSalesforceExtension = (context: vscode.ExtensionContext) => {
  provideFormattingForVisualforce(context);
  provideDiffForSalesforceResources(context);
  provideCommandToRetrieveApexComponent();
  provideCommandToRetrieveApexPage();
  provideCommandToRetrieveLightningComponent();
  provideCommandToRetrieveStaticResources();
  provideCommandToUploadApexToSalesforce();
  provideCommandToDownloadApexFromSalesforce();
  provideCommandToTakeRemoteFileFromSalesforce();
  provideCommandToTakeLocalFileForSalesforce();
};

const provideDiffForSalesforceResources = (context: vscode.ExtensionContext) => {
  const salesforceResourceContentProvider = new SalesforceResourcePreviewContentProvider();
  const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
    SalesforceResourcePreviewContentProvider.scheme,
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
  type: SalesforceResourceType,
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

    const defaultPath = SalesforceLocalFileManager.getStandardPathOfFileLocally(
      recordRetrieved.Name,
      type,
      config,
      contentType
    );
    if (defaultPath) {
      await SalesforceLocalFileManager.saveFile(recordRetrieved.Name, content, defaultPath);
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
      return SalesforceLocalFileManager.diffComponentWithLocalVersion(
        recordRetrieved.Name,
        SalesforceResourceType.APEX_COMPONENT,
        config
      ).then(outcome => afterRetrieve(recordRetrieved, outcome, SalesforceResourceType.APEX_COMPONENT));
    } else {
      return undefined;
    }
  });
};

const provideCommandToRetrieveApexPage = () => {
  vscode.commands.registerCommand('coveo.salesforce.retrieveApexPage', async () => {
    const recordRetrieved = await salesforceAPI.retrieveApexPages();
    if (recordRetrieved) {
      return SalesforceLocalFileManager.diffComponentWithLocalVersion(
        recordRetrieved.Name,
        SalesforceResourceType.APEX_PAGE,
        config
      ).then(outcome => afterRetrieve(recordRetrieved, outcome, SalesforceResourceType.APEX_PAGE));
    } else {
      return undefined;
    }
  });
};

const provideCommandToRetrieveLightningComponent = () => {
  vscode.commands.registerCommand('coveo.salesforce.retrieveLightningComponent', async () => {
    const recordsRetrieved = await salesforceAPI.retrieveLightningComponent();
    if (recordsRetrieved) {
      //const
      new SalesforceAura().extract(recordsRetrieved.name, recordsRetrieved.bundle, config);
    }

    /*if (recordRetrieved) {
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
    }*/
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
          SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
          SalesforceLocalFileManager.getComponentInDiffStore(
            recordRetrieved.Name,
            SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
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
    const componentName = SalesforceLocalFileManager.getComponentNameFromFilePath(uri.fsPath);
    const componentType = SalesforceLocalFileManager.getResourceTypeFromFilePath(uri.fsPath);
    const content = SalesforceLocalFileManager.getContentOfFileLocally(uri.fsPath);
    const showErrorFeedback = (message: string, statusCode: string) => {
      vscode.window.showErrorMessage(`Message: ${message}`);
      vscode.window.showErrorMessage(`Status code: ${statusCode}`);
    };

    if (componentName && componentType) {
      try {
        const metadataUpsertResult = await salesforceAPI.uploadByName(componentName, componentType, content, uri);
        if (metadataUpsertResult.success) {
          vscode.window.showInformationMessage(
            l('SalesforceUploadSuccess', componentType, metadataUpsertResult.fullName)
          );
        } else {
          showErrorFeedback(metadataUpsertResult.errors.message, metadataUpsertResult.errors.statusCode);
        }
      } catch (err) {
        showErrorFeedback(err.message, err.statusCode);
      }
    } else {
      showErrorFeedback(l('InvalidUriScheme'), uri.toString());
    }
  });
};

const provideCommandToDownloadApexFromSalesforce = () => {
  vscode.commands.registerCommand('coveo.download', async (uri: vscode.Uri) => {
    if (!uri.fsPath && vscode.window.activeTextEditor) {
      uri = vscode.window.activeTextEditor.document.uri;
    }
    const componentName = SalesforceLocalFileManager.getComponentNameFromFilePath(uri.fsPath);
    const componentType = SalesforceLocalFileManager.getResourceTypeFromFilePath(uri.fsPath);

    if (!componentName || !componentType) {
      return Promise.reject(l('InvalidUriScheme', uri.toString()));
    }
    let recordStaticResource;
    switch (componentType) {
      case SalesforceResourceType.STATIC_RESOURCE_FOLDER:
      case SalesforceResourceType.STATIC_RESOURCE_FOLDER_UNZIP:
      case SalesforceResourceType.STATIC_RESOURCE_SIMPLE:
        recordStaticResource = await salesforceAPI.retrieveStaticResourceByName(componentName);
        if (recordStaticResource) {
          return salesforceAPI.downloadStaticResource(recordStaticResource);
        } else {
          return Promise.reject(l('SalesforceComponentNotFound', componentName));
        }
      case SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP:
        let toRetrieve = componentName;
        const extract = SalesforceStaticFolder.extractResourceInfoForFileInsizeZip(uri.fsPath);
        if (extract) {
          toRetrieve = extract.resourceName;
        }
        recordStaticResource = await salesforceAPI.retrieveStaticResourceByName(toRetrieve);
        if (recordStaticResource) {
          return salesforceAPI.downloadStaticResource(recordStaticResource);
        } else {
          return Promise.reject(l('SalesforceComponentNotFound', componentName));
        }

      /*const recordApex = await salesforceAPI.downloadByName(componentName, componentType);
      if (recordApex) {
        const localFileContent = SalesforceLocalFileManager.getContentOfFileLocally(uri.fsPath);
        if (localFileContent) {
          return SalesforceLocalFileManager.diffComponentWithLocalVersion(
            componentName,
            componentType,
            config,
            uri.fsPath
          );
        } else {
          return SalesforceLocalFileManager.saveFile(componentName, recordApex.Markup, uri.fsPath);
        }
      } else {
        return Promise.reject(l('SalesforceComponentNotFound', componentName));
      }*/

      default:
        return null;
      /*let toRetrieve = componentName;
        if (componentType == SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP) {
          
        }*/
    }
  });
};

const provideCommandToTakeRemoteFileFromSalesforce = () => {
  vscode.commands.registerCommand('coveo.takeRemote', async (uri: vscode.Uri) => {
    const componentName = SalesforceResourcePreviewContentProvider.getComponentNameFromPreviewUri(uri);
    const componentType = SalesforceResourcePreviewContentProvider.getComponentTypeFromPreviewUri(uri);
    const localPath = SalesforceResourcePreviewContentProvider.getQueryParameterByName('localPath', uri);

    if (!componentName || !localPath || !componentType) {
      return Promise.reject(l('InvalidUriScheme', uri.toString()));
    }

    if (componentType == SalesforceResourceType.APEX_COMPONENT || componentType == SalesforceResourceType.APEX_PAGE) {
      const record = await salesforceAPI.downloadByName(componentName, componentType);
      await SalesforceLocalFileManager.saveFile(componentName, record.Markup, localPath);
      return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    } else {
      const content = DiffContentStore.get(
        SalesforceAPI.getDiffStoreScheme(componentName, componentType, SalesforceResourceLocation.DIST)
      );

      if (content) {
        await SalesforceLocalFileManager.saveFile(componentName, content, localPath);
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
