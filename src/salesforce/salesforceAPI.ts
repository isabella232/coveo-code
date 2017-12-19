import * as vscode from 'vscode';
import * as _ from 'lodash';
import { SalesforceResourcePreviewContentProvider } from './salesforceResourcePreviewContentProvider';
import { DiffContentStore } from '../diffContentStore';
import { l } from '../strings/Strings';
import { SalesforceConnection } from './salesforceConnection';
import { SalesforceStaticFolder, ExtractFolderResult } from './salesforceStaticFolder';
import { DiffResult, SalesforceLocalFileManager } from './salesforceLocalFileManager';
import { SalesforceStaticResourceAPI, ISalesforceStaticResourceRecord } from './salesforceStaticResourceAPI';
import { SalesforceConfig } from './salesforceConfig';
import { SalesforceAura } from './salesforceAuraFolder';
import { filetypesDefinition, SalesforceResourceType } from '../filetypes/filetypesConverter';
import { ConnectionExtends, IMedataUpsertResult } from '../definitions/jsforce';
import { SalesforceAuraAPI, ISalesforceAuraDefinitionBundle } from './salesforceAuraAPI';
import { SalesforceVisualforcePageAPI } from './salesforceVisualforcePageAPI';
import { ISalesforceApexComponentRecord, SalesforceApexComponentAPI } from './salesforceApexComponentAPI';

export interface ISalesforceResourceAPI {
  listAllRessources(): Promise<any>;
}

export type DownloadAndExtractionResult = DiffResult | ExtractFolderResult | null | undefined;
export type UploadToSalesforceResults = IMedataUpsertResult | null | undefined;

export interface ISalesforceRecord {
  Id: string;
  IsDeleted: boolean;
  attributes: {
    type: string;
    url: string;
  };
  CreatedDate: string;
  LastModifiedDate: string;
}

export enum SalesforceResourceLocation {
  LOCAL = 'local',
  DIST = 'dist'
}

export class SalesforceAPI {
  public static getDiffStoreScheme(
    componentName: string,
    resourceType: SalesforceResourceType,
    location: SalesforceResourceLocation
  ) {
    return `${SalesforceResourcePreviewContentProvider.scheme}:${location}:${resourceType}:${componentName.replace(
      /[\/\.]/g,
      ''
    )}`;
  }

  public static saveComponentInDiffStore(
    componentName: string,
    type: SalesforceResourceType,
    location: SalesforceResourceLocation,
    content: string
  ) {
    DiffContentStore.add(SalesforceAPI.getDiffStoreScheme(componentName, type, location), content);
  }

  public salesforceConnection: SalesforceConnection;

  public constructor(public config: SalesforceConfig) {
    this.salesforceConnection = new SalesforceConnection(config);
  }

  public async searchForLightningComponentAndExtractLocally() {
    const connection = await this.establishConnection(l('SalesforceListingAura'));
    const auraAPI = new SalesforceAuraAPI(connection);
    const allRecords = await auraAPI.listAllRessources();
    const selected = await this.selectValueFromQuickPick(allRecords, 'MasterLabel');
    if (selected) {
      await this.downloadAndExtractLightningComponentByName(selected, allRecords);
      return await vscode.window.showInformationMessage(l('SalesforceDownloadSuccess', selected));
    }
    return null;
  }

  public async searchForStaticResourceAndExtractLocally() {
    const connection = await this.establishConnection(l('SalesforceListingApex'));
    const allRecords = await new SalesforceStaticResourceAPI(connection).listAllRessources();
    const selected = await this.selectValueFromQuickPick(allRecords, 'Name');

    if (selected) {
      await this.downloadAndExtractStaticResourceByName(selected, allRecords);
      return await vscode.window.showInformationMessage(l('SalesforceDownloadSuccess', selected));
    }
    return null;
  }

  public async searchForVisualForcePageAndExtractLocally() {
    const connection = await this.establishConnection(l('SalesforceListingApex'));
    const visualForcePageAPI = new SalesforceVisualforcePageAPI(connection);
    const allRecords = await visualForcePageAPI.listAllRessources();
    const selected = await this.selectValueFromQuickPick(allRecords, 'Name');

    if (selected) {
      await this.downloadAndExtractVisualForcePageByName(selected, allRecords);
      return await vscode.window.showInformationMessage(l('SalesforceDownloadSuccess', selected));
    }
    return null;
  }

  public async searchForApexComponentAndExtractLocally() {
    const connection = await this.establishConnection(l('SalesforceListingApex'));
    const salesforceApexComponentAPI = new SalesforceApexComponentAPI(connection);
    const allRecords = await salesforceApexComponentAPI.listAllRessources();
    const selected = await this.selectValueFromQuickPick(allRecords, 'Name');

    if (selected) {
      await this.downloadAndExtractApexComponentByName(selected, allRecords);
      return await vscode.window.showInformationMessage(l('SalesforceDownloadSuccess', selected));
    }
    return null;
  }

  public async downloadFromLocalPath(uri: vscode.Uri) {
    const componentName = SalesforceLocalFileManager.getComponentNameFromFilePath(uri.fsPath);
    const componentType = SalesforceLocalFileManager.getResourceTypeFromFilePath(uri.fsPath);
    let processDownload: Promise<DownloadAndExtractionResult> | DownloadAndExtractionResult[] | null = null;
    if (componentName && componentType) {
      switch (componentType) {
        case SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP:
        case SalesforceResourceType.STATIC_RESOURCE_FOLDER:
        case SalesforceResourceType.STATIC_RESOURCE_FOLDER_UNZIP:
        case SalesforceResourceType.STATIC_RESOURCE_SIMPLE:
          processDownload = this.downloadAndExtractStaticResourceByName(componentName);
          break;
        case SalesforceResourceType.APEX_COMPONENT:
          processDownload = this.downloadAndExtractApexComponentByName(componentName);
          break;
        case SalesforceResourceType.APEX_PAGE:
          processDownload = this.downloadAndExtractVisualForcePageByName(componentName);
          break;
        default:
          if (componentType.indexOf('Aura') != -1) {
            processDownload = this.downloadAndExtractLightningComponentByName(name);
          }
      }
    }
    const outcome = await processDownload;
    if (outcome == null || outcome == undefined) {
      await vscode.window.showErrorMessage(l('SalesforceErrorWhileDownloading'));
    } else {
      await vscode.window.showInformationMessage(l('SalesforceDownloadSuccess', componentName));
    }
    return outcome;
  }

  public async uploadFromLocalPath(uri: vscode.Uri) {
    const componentName = SalesforceLocalFileManager.getComponentNameFromFilePath(uri.fsPath);
    const componentType = SalesforceLocalFileManager.getResourceTypeFromFilePath(uri.fsPath);
    const content = SalesforceLocalFileManager.getContentOfFileLocally(uri.fsPath);
    let processUpload: Promise<UploadToSalesforceResults> | null = null;

    if (componentName && componentType && content) {
      const connection = await this.establishConnection(l('SalesforceUploadProgress'));
      const cleanedUpName = componentName.replace(/[^a-zA-Z0-9]/g, '');

      switch (componentType) {
        case SalesforceResourceType.STATIC_RESOURCE_SIMPLE:
          processUpload = this.uploadSingleStaticResource(cleanedUpName, content, connection);
          break;
        case SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP:
        case SalesforceResourceType.STATIC_RESOURCE_FOLDER_UNZIP:
        case SalesforceResourceType.STATIC_RESOURCE_FOLDER:
          processUpload = this.uploadFolderStaticResource(uri, componentType, connection);
          break;
        default:
          if (componentType.indexOf('Aura') != -1) {
            processUpload = this.uploadAuraDefinitionBundle(uri, cleanedUpName, connection);
          } else {
            processUpload = connection.metadata.upsert(this.fromApexResourceTypeToMetadataAPIName(componentType), {
              fullName: cleanedUpName,
              label: componentName,
              content: new Buffer(content).toString('base64')
            });
          }
      }
    }

    const outcome = await processUpload;
    if (outcome == null || outcome == undefined) {
      await vscode.window.showErrorMessage(l('SalesforceErrorWhileUploading'));
    } else {
      await vscode.window.showInformationMessage(l('SalesforceUploadSuccess', componentType, componentName));
    }
    return outcome;
  }

  private async downloadAndExtractVisualForcePageByName(
    name: string,
    allRecords?: ISalesforceApexComponentRecord[]
  ): Promise<DownloadAndExtractionResult> {
    const connection = await this.establishConnection(l('SalesforceConnection'));
    const visualForceAPI = new SalesforceVisualforcePageAPI(connection);
    if (!allRecords) {
      allRecords = await visualForceAPI.listAllRessources();
    }
    const match = _.find(allRecords, record => record.Name == name);
    if (match) {
      return visualForceAPI.extract(match, this);
    }
    return null;
  }

  private async downloadAndExtractApexComponentByName(
    name: string,
    allRecords?: ISalesforceApexComponentRecord[]
  ): Promise<DownloadAndExtractionResult> {
    const connection = await this.establishConnection(l('SalesforceConnection'));
    const apexAPI = new SalesforceApexComponentAPI(connection);
    if (!allRecords) {
      allRecords = await apexAPI.listAllRessources();
    }
    const match = _.find(allRecords, record => record.Name == name);
    if (match) {
      return apexAPI.extract(match, this);
    }
    return null;
  }

  private async downloadAndExtractStaticResourceByRecord(resourceRecord: any): Promise<DownloadAndExtractionResult> {
    const connection = await this.establishConnection(l('SalesforceDownloadProgress'));
    const salesforceStaticResourceAPI = new SalesforceStaticResourceAPI(connection);
    const staticResourceData = await salesforceStaticResourceAPI.downloadResource(resourceRecord);
    const outcome = await salesforceStaticResourceAPI.extractLocally(resourceRecord, staticResourceData, this);
    return outcome;
  }

  private async downloadAndExtractStaticResourceByName(
    name: string,
    allRecords?: ISalesforceStaticResourceRecord[]
  ): Promise<DownloadAndExtractionResult> {
    if (!allRecords) {
      const connection = await this.establishConnection(l('SalesforceConnection'));
      allRecords = await new SalesforceStaticResourceAPI(connection).listAllRessources();
    }
    const match = _.find(allRecords, record => record.Name == name);
    if (match) {
      return this.downloadAndExtractStaticResourceByRecord(match);
    }
    return null;
  }

  private async downloadAndExtractLightningComponentByName(
    name: string,
    allRecords?: ISalesforceAuraDefinitionBundle[]
  ) {
    const connection = await this.establishConnection(l('SalesforceListingAura'));
    const auraAPI = new SalesforceAuraAPI(connection);
    if (!allRecords) {
      allRecords = await auraAPI.listAllRessources();
    }
    const bundle = await auraAPI.retrieveLightningBundle(name, allRecords);
    if (bundle) {
      vscode.window.showInformationMessage(l('SalesforceDownloadSuccess', name));
      return await SalesforceAura.extract(name, bundle, this.config);
    }
    return null;
  }

  private async establishConnection(
    messageFeedback: string,
    progressStatus?: (reporter: vscode.Progress<any>, connection: ConnectionExtends) => void
  ) {
    const connection = <ConnectionExtends>await this.salesforceConnection.login();
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: l('SalesforceConnection')
      },
      async progress => {
        progress.report({ message: messageFeedback });
        progressStatus ? progressStatus(progress, connection) : null;
      }
    );
    return connection;
  }

  private uploadSingleStaticResource(fullName: string, content: string, connection: ConnectionExtends) {
    const match = _.find(
      filetypesDefinition,
      definition => definition.salesforceResourceType == SalesforceResourceType.STATIC_RESOURCE_SIMPLE
    );

    if (match && match.contentType) {
      const contentType = match.contentType;
      return connection.metadata.upsert(
        this.fromApexResourceTypeToMetadataAPIName(SalesforceResourceType.STATIC_RESOURCE_SIMPLE),
        {
          fullName,
          contentType,
          content: new Buffer(content).toString('base64'),
          cacheControl: 'Public'
        }
      );
    }
    return null;
  }

  private async uploadFolderStaticResource(
    filePath: vscode.Uri,
    type: SalesforceResourceType,
    connection: ConnectionExtends
  ) {
    const contentType = 'application/zip';
    const { buffer, resourceName } = await SalesforceStaticFolder.zip(filePath.fsPath);
    return connection.metadata.upsert(this.fromApexResourceTypeToMetadataAPIName(type), {
      fullName: resourceName,
      contentType,
      content: buffer.toString('base64'),
      cacheControl: 'Public'
    });
  }

  private async uploadAuraDefinitionBundle(filePath: vscode.Uri, fullName: string, connection: ConnectionExtends) {
    const uploadData = await new SalesforceAura().getMetadataForUpload(filePath);
    return connection.metadata.upsert('AuraDefinitionBundle', {
      type: 'Component',
      fullName,
      ...uploadData
    });
  }

  private fromApexResourceTypeToMetadataAPIName(type: SalesforceResourceType): string {
    const matchOnSalesforceResourceType = _.find(
      filetypesDefinition,
      definition => definition.salesforceResourceType == type
    );
    const metadataApiName =
      matchOnSalesforceResourceType && matchOnSalesforceResourceType.metadataApiName
        ? matchOnSalesforceResourceType.metadataApiName
        : `InvalidApiName : ${type}`;
    return metadataApiName;
  }

  private async selectValueFromQuickPick(allRecords: { [key: string]: any }, keyForComparison: string) {
    const map: string[] = _.map(allRecords, record => record[keyForComparison]);

    return await vscode.window.showQuickPick(map, {
      ignoreFocusOut: true,
      placeHolder: l('SalesforceSelectComponent'),
      matchOnDetail: true,
      matchOnDescription: true
    });
  }
}
