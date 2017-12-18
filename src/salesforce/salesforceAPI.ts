import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as jsforceextension from '../definitions/jsforce';
import { SalesforceResourcePreviewContentProvider } from './salesforceResourcePreviewContentProvider';
import { DiffContentStore } from '../diffContentStore';
import { l } from '../strings/Strings';
import { SalesforceConnection } from './salesforceConnection';
import { SalesforceStaticFolder, ExtractFolderResult } from './salesforceStaticFolder';
import { DiffResult } from './salesforceLocalFileManager';
import { SalesforceStaticResourceAPI } from './salesforceStaticResourceAPI';
import { SalesforceConfig } from './salesforceConfig';
import { SalesforceAura } from './salesforceAuraFolder';
import { filetypesDefinition, SalesforceResourceType } from '../filetypes/filetypesConverter';
import { ConnectionExtends } from '../definitions/jsforce';
import { SalesforceAuraAPI, ISalesforceAuraDefinitionBundle } from './salesforceAuraAPI';
import { SalesforceVisualforcePageAPI } from './salesforceVisualforcePageAPI';

export interface ISalesforceResourceAPI {
  listAllRessources(): Promise<any>;
}

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
export interface ISalesforceApexComponentRecord {
  Name: string;
  Markup: string;
  ContentType?: string;
}

export interface ISalesforceStaticResourceRecord extends ISalesforceApexComponentRecord {
  Body: string;
  ContentType: string;
}

export interface ISalesforceApexPageRecord {
  label: string;
  content: string;
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
      return await this.downloadAndExtractLightningComponent(selected, allRecords);
    }
    return null;
  }

  public async searchForStaticResourceAndExtractLocally() {
    const connection = await this.establishConnection(l('SalesforceListingApex'));
    const allRecords = await new SalesforceStaticResourceAPI(connection).listAllRessources();
    const selected = await this.selectValueFromQuickPick(allRecords, 'Name');

    if (selected) {
      return await this.downloadAndExtractStaticResourceByName(selected, allRecords);
    }
    return null;
  }

  public async searchForVisualForcePageAndExtractLocally(): Promise<ISalesforceApexComponentRecord | null> {
    const connection = await this.establishConnection(l('SalesforceListingApex'));
    const visualForcePageAPI = new SalesforceVisualforcePageAPI(connection);
    const allRecords = await visualForcePageAPI.listAllRessources();
    const selected = await this.selectValueFromQuickPick(allRecords, 'Name');

    if (selected) {
      const recordSelected = _.find(allRecords, record => record.Name == selected);
      if (recordSelected) {
        SalesforceAPI.saveComponentInDiffStore(
          recordSelected.Name,
          SalesforceResourceType.APEX_PAGE,
          SalesforceResourceLocation.DIST,
          recordSelected.Markup
        );
        vscode.window.showInformationMessage(l('SalesforceDownloadSuccess', selected));
        return recordSelected;
      }
    }
    return null;
  }

  public async retrieveApexComponents(): Promise<ISalesforceApexComponentRecord | null> {
    const connection = await this.establishConnection(l('SalesforceListingApex'));

    const allRecords: ISalesforceApexComponentRecord[] = await connection
      .sobject('ApexComponent')
      .find({})
      .execute({ autoFetch: true })
      .then((records: ISalesforceApexComponentRecord[]) => records);

    const selected = await vscode.window.showQuickPick(_.map(allRecords, record => record.Name), {
      ignoreFocusOut: true,
      placeHolder: l('SalesforceSelectComponent'),
      matchOnDetail: true,
      matchOnDescription: true
    });

    if (selected) {
      const recordSelected = _.find(allRecords, record => record.Name == selected);
      if (recordSelected) {
        DiffContentStore.add(
          `${SalesforceAPI.getDiffStoreScheme(
            recordSelected.Name,
            SalesforceResourceType.APEX_COMPONENT,
            SalesforceResourceLocation.DIST
          )}`,
          recordSelected.Markup
        );
        vscode.window.showInformationMessage(l('SalesforceDownloadSuccess', selected));
        return recordSelected;
      }
    }
    return null;
  }

  public async downloadAndExtractStaticResourceByRecord(
    resourceRecord: any
  ): Promise<DiffResult | ExtractFolderResult | null> {
    const connection = await this.establishConnection(l('SalesforceDownloadProgress'));
    const salesforceStaticResourceAPI = new SalesforceStaticResourceAPI(connection);
    const staticResourceData = await salesforceStaticResourceAPI.downloadResource(resourceRecord);
    const outcome = await salesforceStaticResourceAPI.extractLocally(resourceRecord, staticResourceData, this);
    return outcome;
  }

  public async downloadAndExtractStaticResourceByName(name: string, allRecords?: ISalesforceStaticResourceRecord[]) {
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

  public async downloadAndExtractVisualForcePageByName(name: string, allRecords?: ISalesforceApexComponentRecord[]) {
    if (!allRecords) {
      const connection = await this.establishConnection(l('SalesforceConnection'));
      allRecords = await new SalesforceVisualforcePageAPI(connection).listAllRessources();
    }
    const match = _.find(allRecords, record => record.Name == name);
  }

  public async downloadByName(componentName: string, type: SalesforceResourceType, uri: vscode.Uri) {
    switch (type) {
      case SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP:
        this.downloadFolderStaticResource(uri);
        break;
      case SalesforceResourceType.STATIC_RESOURCE_SIMPLE:
        this.downloadSingleStaticResource(componentName);
        break;
      default:
        if (type.indexOf('Aura') != -1) {
          this.downloadAndExtractLightningComponent(componentName);
        } else {
          /*ret = connection.metadata.upsert(this.fromApexResourceTypeToMetadataAPIName(type), {
            fullName: cleanedUpName,
            label: componentName,
            content: new Buffer(content).toString('base64')
          });*/
        }
    }
    /*
    if (!_.isEmpty(allRecords)) {
      SalesforceAPI.saveComponentInDiffStore(
        componentName,
        type,
        SalesforceResourceLocation.DIST,
        allRecords[0].Markup
      );
      vscode.window.showInformationMessage(l('SalesforceDownloadSuccess', componentName));
      return allRecords[0];
    } else {
      vscode.window.showErrorMessage(l('SalesforceComponentNotFound', componentName));
      return Promise.reject(l('SalesforceComponentNotFound', componentName));
    }*/
  }

  public async uploadByName(
    componentName: string,
    type: SalesforceResourceType,
    content: any,
    filePath: vscode.Uri
  ): Promise<jsforceextension.IMedataUpsertResult> {
    const connection = await this.establishConnection(l('SalesforceUploadProgress'));
    const cleanedUpName = componentName.replace(/[^a-zA-Z0-9]/g, '');
    let ret;
    switch (type) {
      case SalesforceResourceType.STATIC_RESOURCE_SIMPLE:
        ret = this.uploadSingleStaticResource(cleanedUpName, content, connection);
        break;
      case SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP:
      case SalesforceResourceType.STATIC_RESOURCE_FOLDER_UNZIP:
      case SalesforceResourceType.STATIC_RESOURCE_FOLDER:
        ret = this.uploadFolderStaticResource(filePath, type, connection);
        break;
      default:
        if (type.indexOf('Aura') != -1) {
          ret = this.uploadAuraDefinitionBundle(filePath, cleanedUpName, connection);
        } else {
          ret = connection.metadata.upsert(this.fromApexResourceTypeToMetadataAPIName(type), {
            fullName: cleanedUpName,
            label: componentName,
            content: new Buffer(content).toString('base64')
          });
        }
    }

    return ret;
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
    const contentType = _.find(
      filetypesDefinition,
      definition => definition.salesforceResourceType == SalesforceResourceType.STATIC_RESOURCE_SIMPLE
    );
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

  private async downloadSingleStaticResource(name: string) {
    const connection = await this.establishConnection(l('SalesforceListingApex'));
    const salesforceStaticResourceAPI = new SalesforceStaticResourceAPI(connection);
    const record = await salesforceStaticResourceAPI.getResourceRecordByName(name);
    if (record) {
      this.downloadAndExtractStaticResourceByRecord(record);
    }
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

  private async downloadFolderStaticResource(uri: vscode.Uri) {
    const connection = await this.establishConnection(l('SalesforceListingApex'));
    const salesforceStaticResourceAPI = new SalesforceStaticResourceAPI(connection);
    const info = SalesforceStaticFolder.extractResourceInfoForFileInsizeZip(uri.fsPath);

    if (info) {
      const record = await salesforceStaticResourceAPI.getResourceRecordByName(info.resourceName);
      if (record) {
        this.downloadAndExtractStaticResourceByRecord(record);
      }
    }
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

  private async downloadAndExtractLightningComponent(name: string, allRecords?: ISalesforceAuraDefinitionBundle[]) {
    const connection = await this.establishConnection(l('SalesforceListingAura'));
    const auraAPI = new SalesforceAuraAPI(connection);
    if (!allRecords) {
      allRecords = await auraAPI.listAllRessources();
    }
    const bundle = await auraAPI.retrieveLightningBundle(name, allRecords);
    if (bundle) {
      vscode.window.showInformationMessage(l('SalesforceDownloadSuccess', name));
      await SalesforceAura.extract(name, bundle, this.config);
    }
  }
}
