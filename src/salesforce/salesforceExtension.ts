import * as vscode from 'vscode';
import { SalesforceResourcePreviewContentProvider } from './salesforceResourcePreviewContentProvider';
import { VisualforceFormattingProvider } from '../provider/visualforceFormattingProvider';
import { SalesforceAPI, SalesforceResourceLocation } from './salesforceAPI';
import { SalesforceLocalFileManager } from './salesforceLocalFileManager';
import { l } from '../strings/Strings';
import { DiffContentStore } from '../diffContentStore';
import { SalesforceConfig } from './salesforceConfig';

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

const provideCommandToRetrieveApexComponent = () => {
  vscode.commands.registerCommand('coveo.salesforce.retrieveApexComponent', async () => {
    return await salesforceAPI.searchForApexComponentAndExtractLocally();
  });
};

const provideCommandToRetrieveApexPage = () => {
  vscode.commands.registerCommand('coveo.salesforce.retrieveApexPage', async () => {
    return await salesforceAPI.searchForVisualForcePageAndExtractLocally();
  });
};

const provideCommandToRetrieveLightningComponent = () => {
  vscode.commands.registerCommand('coveo.salesforce.retrieveLightningComponent', async () => {
    return await salesforceAPI.searchForLightningComponentAndExtractLocally();
  });
};

const provideCommandToRetrieveStaticResources = () => {
  vscode.commands.registerCommand('coveo.salesforce.retrieveStaticResource', async () => {
    return await salesforceAPI.searchForStaticResourceAndExtractLocally();
  });
};

const provideCommandToUploadApexToSalesforce = () => {
  vscode.commands.registerCommand('coveo.upload', async (uri: vscode.Uri) => {
    if (!uri.fsPath && vscode.window.activeTextEditor) {
      uri = vscode.window.activeTextEditor.document.uri;
    }
    return await salesforceAPI.uploadFromLocalPath(uri);
  });
};

const provideCommandToDownloadApexFromSalesforce = () => {
  vscode.commands.registerCommand('coveo.download', async (uri: vscode.Uri) => {
    if (!uri.fsPath && vscode.window.activeTextEditor) {
      uri = vscode.window.activeTextEditor.document.uri;
    }
    return await salesforceAPI.downloadFromLocalPath(uri);
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

    const content = DiffContentStore.get(
      SalesforceAPI.getDiffStoreScheme(componentName, componentType, SalesforceResourceLocation.DIST)
    );

    if (content) {
      await SalesforceLocalFileManager.saveFile(componentName, content, localPath);
      return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    } else {
      return Promise.reject(l('FileNotFound'));
    }
  });
};

const provideCommandToTakeLocalFileForSalesforce = () => {
  vscode.commands.registerCommand('coveo.takeLocal', (uri: vscode.Uri) => {
    // Nothing to do as far as saving file goes : simply close the editor.
    return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
};
