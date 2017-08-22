import * as vscode from 'vscode';
import * as jsforce from 'jsforce';
import * as _ from 'lodash';
import * as zlib from 'zlib';
import * as jsforceextension from '../definitions/jsforce';
import { SalesforceConfig } from './salesforceConfig';
import { SalesforceResourceContentProvider } from './salesforceResourceContentProvider';
import { DiffContentStore } from '../diffContentStore';
import { l } from '../strings/Strings';
import { PassThrough } from 'stream';
import { SalesforceConnection } from './salesforceConnection';
import { SalesforceStaticFolder, ExtractFolderResult } from './salesforceStaticFolder';
import { getExtensionFromTypeOrPath, getContentTypeFromExtension } from '../filetypes/filetypesConverter';
import { ApexResourceType } from './salesforceResourceTypes';
import { SalesforceLocalFile } from './salesforceLocalFile';
import { SalesforceStaticResource } from './salesforceStaticResource';
const fetch = require('node-fetch');
const parsePath = require('parse-filepath');

export interface ISalesforceApexComponentRecord {
  Name: string;
  Markup: string;
  attributes: {
    type: string;
    url: string;
  };
  Id: string;
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

export enum DiffResult {
  FILE_DOES_NOT_EXIST_LOCALLY,
  EDITOR_DIFF_OPENED,
  NOTHING_TO_DIFF,
  EDITOR_NOT_ABLE_TO_DIFF,
  EDITOR_ERROR_WHILE_EXECUTING_DIFF
}

export enum SalesforceResourceLocation {
  LOCAL = 'local',
  DIST = 'dist'
}

export class SalesforceAPI {
  public static getDiffStoreScheme(
    componentName: string,
    resourceType: ApexResourceType,
    location: SalesforceResourceLocation
  ) {
    return `${SalesforceResourceContentProvider.scheme}:${location}:${resourceType}:${componentName.replace(
      /[\/\.]/g,
      ''
    )}`;
  }

  public static saveComponentInDiffStore(
    componentName: string,
    type: ApexResourceType,
    location: SalesforceResourceLocation,
    content: string
  ) {
    DiffContentStore.add(SalesforceAPI.getDiffStoreScheme(componentName, type, location), content);
  }

  public config: SalesforceConfig;
  public salesforceConnection: SalesforceConnection;

  public constructor() {
    this.config = new SalesforceConfig();
    this.salesforceConnection = new SalesforceConnection(this.config);
  }

  public diffComponentWithLocalVersion(
    componentName: string,
    type: ApexResourceType,
    filePath?: string
  ): Promise<DiffResult> {
    return new Promise((resolve, reject) => {
      let contentOfLocalFile: string | undefined;

      if (!filePath) {
        filePath = SalesforceLocalFile.getStandardPathOfFileLocally(componentName, type, this.config);
        if (filePath) {
          contentOfLocalFile = SalesforceLocalFile.getContentOfFileLocally(filePath);
        }
      } else {
        contentOfLocalFile = SalesforceLocalFile.getContentOfFileLocally(filePath);
      }
      const contentOfDistFile = this.getComponentInDiffStore(componentName, type, SalesforceResourceLocation.DIST);
      if (contentOfLocalFile) {
        if (contentOfDistFile) {
          if (contentOfDistFile != contentOfLocalFile) {
            vscode.commands
              .executeCommand(
                'vscode.diff',
                this.getUri(componentName, type, SalesforceResourceLocation.LOCAL, filePath ? filePath : ''),
                this.getUri(componentName, type, SalesforceResourceLocation.DIST, filePath ? filePath : ''),
                l('CompareLocalRemote', parsePath(filePath).base)
              )
              .then(
                success => {
                  resolve(DiffResult.EDITOR_DIFF_OPENED);
                },
                err => {
                  reject(err);
                }
              );
          } else {
            resolve(DiffResult.NOTHING_TO_DIFF);
          }
        } else {
          reject(DiffResult.EDITOR_NOT_ABLE_TO_DIFF);
        }
      } else {
        resolve(DiffResult.FILE_DOES_NOT_EXIST_LOCALLY);
      }
    });
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
              ApexResourceType.APEX_PAGE,
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
                ApexResourceType.APEX_COMPONENT,
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
    resourceRecord: ISalesforceStaticResourceRecord
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
        } = await fetch(`${connection.instanceUrl}${resourceRecord.Body}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${connection.accessToken}`
          }
        });

        if (resourceRecord.ContentType == 'application/zip') {
          return new SalesforceStaticFolder(this, resourceRecord).extract(res);
        } else {
          const content = await new SalesforceStaticResource().read(res);

          SalesforceAPI.saveComponentInDiffStore(
            resourceRecord.Name,
            ApexResourceType.STATIC_RESOURCE_SIMPLE,
            SalesforceResourceLocation.DIST,
            content
          );
          return this.diffComponentWithLocalVersion(
            resourceRecord.Name,
            ApexResourceType.STATIC_RESOURCE_SIMPLE,
            SalesforceLocalFile.getStandardPathOfFileLocally(
              resourceRecord.Name,
              ApexResourceType.STATIC_RESOURCE_SIMPLE,
              this.config,
              resourceRecord.ContentType
            )
          );
        }
      }
    );
  }

  public async downloadApex(componentName: string, type: ApexResourceType): Promise<ISalesforceApexComponentRecord> {
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

  public async uploadApex(
    componentName: string,
    type: ApexResourceType,
    content: any,
    filePath: vscode.Uri
  ): Promise<jsforceextension.IMedataUpsertResult> {
    const connection = (await this.salesforceConnection.login()) as jsforceextension.ConnectionExtends;

    return <Promise<jsforceextension.IMedataUpsertResult>>vscode.window.withProgress(
      {
        title: l('SalesforceConnection'),
        location: vscode.ProgressLocation.Window
      },
      async progress => {
        progress.report({ message: l('SalesforceUploadProgress') });

        if (type == ApexResourceType.STATIC_RESOURCE_SIMPLE) {
          const contentType = getContentTypeFromExtension(getExtensionFromTypeOrPath(type, filePath.fsPath));
          return connection.metadata.upsert(this.fromApexResourceTypeToMetadataAPIName(type), {
            fullName: componentName,
            contentType,
            content: new Buffer(content).toString('base64'),
            cacheControl: 'Public'
          });
        } else if (type == ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP) {
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
            fullName: componentName,
            label: componentName,
            content: new Buffer(content).toString('base64')
          });
        }
      }
    );
  }

  public getComponentInDiffStore(componentName: string, type: ApexResourceType, location: SalesforceResourceLocation) {
    return DiffContentStore.get(SalesforceAPI.getDiffStoreScheme(componentName, type, SalesforceResourceLocation.DIST));
  }

  private getUri(
    componentName: string,
    type: ApexResourceType,
    location: SalesforceResourceLocation,
    filePath: string
  ): vscode.Uri {
    return vscode.Uri.parse(
      `${SalesforceResourceContentProvider.scheme}://location-${encodeURIComponent(
        location.replace(/[\/\.]/g, '')
      )}/key-${encodeURIComponent(componentName.replace(/[\/\.]/g, ''))}/type-${type.replace(
        /[\/\.]/g,
        ''
      )}/preview.${getExtensionFromTypeOrPath(type, filePath)}?tstamp=${Date.now()}&localPath=${encodeURIComponent(
        filePath
      )}`
    );
  }

  private fromApexResourceTypeToMetadataAPIName(type: ApexResourceType) {
    let metadataApiName = '';
    if (type == ApexResourceType.APEX_COMPONENT) {
      metadataApiName = 'ApexComponent';
    }
    if (type == ApexResourceType.APEX_PAGE) {
      metadataApiName = 'ApexPage';
    }
    if (type == ApexResourceType.STATIC_RESOURCE_SIMPLE) {
      metadataApiName = 'StaticResource';
    }
    if (type == ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP) {
      metadataApiName = 'StaticResource';
    }
    return metadataApiName;
  }
}
