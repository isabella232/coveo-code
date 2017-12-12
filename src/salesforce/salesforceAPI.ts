import * as vscode from 'vscode';
import * as jsforce from 'jsforce';
import * as _ from 'lodash';
import * as zlib from 'zlib';
import * as jsforceextension from '../definitions/jsforce';
import { SalesforceResourcePreviewContentProvider } from './salesforceResourcePreviewContentProvider';
import { DiffContentStore } from '../diffContentStore';
import { l } from '../strings/Strings';
import { PassThrough } from 'stream';
import { SalesforceConnection } from './salesforceConnection';
import { SalesforceStaticFolder, ExtractFolderResult } from './salesforceStaticFolder';
import { SalesforceLocalFileManager, DiffResult } from './salesforceLocalFileManager';
import { SalesforceStaticResource } from './salesforceStaticResource';
import { SalesforceConfig } from './salesforceConfig';
import { SalesforceAura } from './salesforceAuraFolder';
import { filetypesDefinition, SalesforceResourceType } from '../filetypes/filetypesConverter';
const fetch = require('node-fetch');

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

export interface ISalesforceAuraDefinitionBundle extends ISalesforceRecord {
  DeveloperName: string;
  Language: string;
  MasterLabel: string;
  NameSpacePrefix: string;
  Description: string;
}

export interface ISalesforceAuraDefinition extends ISalesforceRecord {
  Source: string;
  DefType: SalesforceResourceType;
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

  public async retrieveLightningComponent(): Promise<{ bundle: ISalesforceAuraDefinition[]; name: string } | null> {
    const connection = await this.salesforceConnection.login();

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: l('SalesforceConnection')
      },
      async progress => {
        progress.report({ message: l('SalesforceListingApex') });

        const allRecords: ISalesforceAuraDefinitionBundle[] = await connection
          .sobject('AuraDefinitionBundle')
          .find({})
          .execute({ autoFetch: true })
          .then((records: ISalesforceAuraDefinitionBundle[]) => records);

        progress.report({ message: l('SalesforceChooseList') });

        const selected = await vscode.window.showQuickPick(_.map(allRecords, record => record.MasterLabel), {
          ignoreFocusOut: true,
          placeHolder: l('SalesforceSelectComponent'),
          matchOnDetail: true,
          matchOnDescription: true
        });

        if (selected) {
          const recordSelected = _.find(allRecords, record => record.MasterLabel == selected);
          if (recordSelected) {
            const matchingAuraComponents: ISalesforceAuraDefinition[] = await connection
              .sobject('AuraDefinition')
              .find({ AuraDefinitionBundleId: recordSelected.Id })
              .execute({ autoFetch: true })
              .then((records: any) => records);
            matchingAuraComponents.forEach(matchingAuraComponent => {
              const salesforceResourceType = SalesforceAura.coerceApiNameToEnum(matchingAuraComponent);
              const matchOnSalesforceResourceType = _.find(
                filetypesDefinition,
                definition => definition.salesforceResourceType == salesforceResourceType
              );
              const suffix =
                matchOnSalesforceResourceType && matchOnSalesforceResourceType.suffix
                  ? matchOnSalesforceResourceType.suffix
                  : '';
              SalesforceAPI.saveComponentInDiffStore(
                `${recordSelected.MasterLabel}${suffix}`,
                salesforceResourceType,
                SalesforceResourceLocation.DIST,
                matchingAuraComponent.Source
              );
            });
            return { bundle: matchingAuraComponents, name: recordSelected.MasterLabel };
          }
        }
        return null;
      }
    );
  }

  public async retrieveApexPages(): Promise<ISalesforceApexComponentRecord | null> {
    const connection = await this.salesforceConnection.login();

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: l('SalesforceConnection')
      },
      async progress => {
        progress.report({ message: l('SalesforceListingApex') });

        const allRecords: ISalesforceApexComponentRecord[] = await connection
          .sobject('ApexPage')
          .find({})
          .execute({ autoFetch: true })
          .then((records: ISalesforceApexComponentRecord[]) => records);

        progress.report({ message: l('SalesforceChooseList') });

        const selected = await vscode.window.showQuickPick(_.map(allRecords, record => record.Name), {
          ignoreFocusOut: true,
          placeHolder: l('SalesforceSelectComponent'),
          matchOnDetail: true,
          matchOnDescription: true
        });

        if (selected) {
          const recordSelected = _.find(allRecords, record => record.Name == selected);
          if (recordSelected) {
            SalesforceAPI.saveComponentInDiffStore(
              recordSelected.Name,
              SalesforceResourceType.APEX_PAGE,
              SalesforceResourceLocation.DIST,
              recordSelected.Markup
            );
            return recordSelected;
          }
        }
        return null;
      }
    );
  }

  public async retrieveApexComponents(): Promise<ISalesforceApexComponentRecord | null> {
    const connection: jsforce.Connection = await this.salesforceConnection.login();

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: l('SalesforceConnection')
      },
      async progress => {
        progress.report({ message: l('SalesforceListingApex') });

        const allRecords: ISalesforceApexComponentRecord[] = await connection
          .sobject('ApexComponent')
          .find({})
          .execute({ autoFetch: true })
          .then((records: ISalesforceApexComponentRecord[]) => records);

        progress.report({ message: l('SalesforceChooseList') });
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
            return recordSelected;
          }
        }

        return null;
      }
    );
  }

  public async retrieveStaticResourceByName(componentName: string): Promise<ISalesforceStaticResourceRecord | null> {
    const connection = await this.salesforceConnection.login();
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: l('SalesforceConnection')
      },
      progress => {
        progress.report({ message: l('SalesforceConnection') });
        return connection
          .sobject('StaticResource')
          .find({ name: componentName })
          .execute({ autoFetch: true })
          .then((records: ISalesforceStaticResourceRecord[]) => _.first(records));
      }
    );
  }

  public async retrieveStaticResource(condition = {}): Promise<ISalesforceStaticResourceRecord | null> {
    const connection = await this.salesforceConnection.login();

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: l('SalesforceConnection')
      },
      async progress => {
        progress.report({ message: l('SalesforceListingApex') });

        const allRecords: ISalesforceStaticResourceRecord[] = await connection
          .sobject('StaticResource')
          .find(condition)
          .execute({ autoFetch: true })
          .then((records: ISalesforceStaticResourceRecord[]) => records);

        progress.report({ message: l('SalesforceChooseList') });

        const selected = await vscode.window.showQuickPick(_.map(allRecords, record => record.Name), {
          ignoreFocusOut: true,
          placeHolder: l('SalesforceSelectComponent'),
          matchOnDetail: true,
          matchOnDescription: true
        });

        if (selected) {
          const recordSelected = _.find(allRecords, record => record.Name == selected);
          if (recordSelected) {
            return recordSelected;
          }
        }
        return null;
      }
    );
  }

  public async downloadStaticResource(
    resourceRecord: any //ISalesforceStaticResourceRecord | ISalesforceAuraDefinitionBundle
  ): Promise<DiffResult | ExtractFolderResult> {
    const connection = (await this.salesforceConnection.login()) as jsforceextension.ConnectionExtends;

    return <Promise<DiffResult | ExtractFolderResult>>vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: l('SalesforceConnection')
      },
      async progress => {
        progress.report({ message: l('SalesforceDownloadProgress') });
        const res: {
          body: zlib.Gunzip | PassThrough;
        } = await fetch(`${connection.instanceUrl}${resourceRecord.Body || resourceRecord.attributes.url}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${connection.accessToken}`
          }
        });

        if (resourceRecord.ContentType == 'application/zip') {
          return new SalesforceStaticFolder(this, resourceRecord).extract(res, this.config);
        } else {
          const content = await new SalesforceStaticResource().read(res);

          SalesforceAPI.saveComponentInDiffStore(
            resourceRecord.Name,
            SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
            SalesforceResourceLocation.DIST,
            content
          );
          return SalesforceLocalFileManager.diffComponentWithLocalVersion(
            resourceRecord.Name,
            SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
            this.config,
            SalesforceLocalFileManager.getStandardPathOfFileLocally(
              resourceRecord.Name,
              SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
              this.config,
              resourceRecord.ContentType
            )
          );
        }
      }
    );
  }

  public async downloadByName(
    componentName: string,
    type: SalesforceResourceType
  ): Promise<ISalesforceApexComponentRecord> {
    const connection = await this.salesforceConnection.login();

    return <Promise<ISalesforceApexComponentRecord>>vscode.window.withProgress(
      {
        title: l('SalesforceConnection'),
        location: vscode.ProgressLocation.Window
      },
      async progress => {
        progress.report({ message: l('SalesforceListingApex') });

        const allRecords = await connection
          .sobject(this.fromApexResourceTypeToMetadataAPIName(type))
          .find({
            name: componentName
          })
          .limit(1)
          .execute()
          .then((records: ISalesforceApexComponentRecord[]) => records);

        if (allRecords && !_.isEmpty(allRecords)) {
          SalesforceAPI.saveComponentInDiffStore(
            componentName,
            type,
            SalesforceResourceLocation.DIST,
            allRecords[0].Markup
          );
          return allRecords[0];
        } else {
          return Promise.reject(l('SalesforceComponentNotFound', componentName));
        }
      }
    );
  }

  public async uploadByName(
    componentName: string,
    type: SalesforceResourceType,
    content: any,
    filePath: vscode.Uri
  ): Promise<jsforceextension.IMedataUpsertResult> {
    const connection = (await this.salesforceConnection.login()) as jsforceextension.ConnectionExtends;
    const cleanedUpName = componentName.replace(/[^a-zA-Z0-9]/g, '');
    return <Promise<jsforceextension.IMedataUpsertResult>>vscode.window.withProgress(
      {
        title: l('SalesforceConnection'),
        location: vscode.ProgressLocation.Window
      },
      async progress => {
        progress.report({ message: l('SalesforceUploadProgress') });

        if (type == SalesforceResourceType.STATIC_RESOURCE_SIMPLE) {
          const contentType = _.find(filetypesDefinition, definition => definition.salesforceResourceType == type);
          return connection.metadata.upsert(this.fromApexResourceTypeToMetadataAPIName(type), {
            fullName: cleanedUpName,
            contentType,
            content: new Buffer(content).toString('base64'),
            cacheControl: 'Public'
          });
        } else if (
          type == SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP ||
          type == SalesforceResourceType.STATIC_RESOURCE_FOLDER_UNZIP ||
          type == SalesforceResourceType.STATIC_RESOURCE_FOLDER
        ) {
          const contentType = 'application/zip';
          const { buffer, resourceName } = await SalesforceStaticFolder.zip(filePath.fsPath);

          return connection.metadata.upsert(this.fromApexResourceTypeToMetadataAPIName(type), {
            fullName: resourceName,
            contentType,
            content: buffer.toString('base64'),
            cacheControl: 'Public'
          });
        } else {
          return connection.metadata.upsert(this.fromApexResourceTypeToMetadataAPIName(type), {
            fullName: cleanedUpName,
            label: componentName,
            content: new Buffer(content).toString('base64')
          });
        }
      }
    );
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
}
