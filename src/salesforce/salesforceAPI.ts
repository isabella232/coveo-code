import { SalesforceConnection } from './salesforceConnection';
import * as jsforce from 'jsforce';
import * as _ from 'lodash';
import { SalesforceConfig } from './salesforceConfig';
import { SalesforceResourceContentProvider } from './salesforceResourceContentProvider';
import * as vscode from 'vscode';
import * as write from 'write';
import { DiffContentStore } from '../diffContentStore';
import path = require('path');
import fs = require('fs');
import * as jsforceextension from '../definitions/jsforce';
import { l } from '../strings/Strings';
import * as zlib from 'zlib';
import { PassThrough } from 'stream';
import { SalesforceAPIStaticFolder, ExtractFolderResult } from './salesforceAPIStaticFolder';
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

export interface ISalesforceStaticResourceFromZip extends ISalesforceApexComponentRecord {
  isDirectory: boolean;
  name: string;
  entryName: string;
  ContentType: string;
  getData: () => Uint8Array[];
}

export enum ApexResourceType {
  APEX_COMPONENT = 'ApexComponent',
  APEX_PAGE = 'ApexPage',
  STATIC_RESOURCE_SIMPLE = 'StaticResourceSimple',
  STATIC_RESOURCE_FOLDER = 'StaticResourceFolder',
  STATIC_RESOURCE_FOLDER_UNZIP = 'StaticResourceFolderUnzip',
  STATIC_RESOURCE_INSIDE_UNZIP = 'StaticResourceInsideUnzip'
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

  public static getComponentNameFromFilePath(filePath: vscode.Uri): string | undefined {
    if (filePath.fsPath) {
      const parsedPath: any = parsePath(filePath.fsPath);
      return parsedPath.name;
    }
    return undefined;
  }

  public static getResourceTypeFromFilePath(filePath: vscode.Uri): ApexResourceType | undefined {
    if (filePath.fsPath) {
      const parsedPath: any = parsePath(filePath.fsPath);
      const apexComponents = ['.cmp', '.component'];
      const apexPage = ['.page'];
      if (_.indexOf(apexComponents, parsedPath.ext) != -1) {
        return ApexResourceType.APEX_COMPONENT;
      }
      if (_.indexOf(apexPage, parsedPath.ext) != -1) {
        return ApexResourceType.APEX_PAGE;
      }
      if (parsedPath.dir.indexOf('_unzip') != -1) {
        return ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP;
      }
      return parsedPath.ext;
    }
    return undefined;
  }

  private config: SalesforceConfig;
  private salesforceConnection: SalesforceConnection;

  public constructor() {
    this.config = new SalesforceConfig();
    this.salesforceConnection = new SalesforceConnection(this.config);
  }

  public getFileExtensionFromResourceType(type: ApexResourceType, filePath: string) {
    if (type == ApexResourceType.APEX_COMPONENT) {
      return 'cmp';
    }
    if (type == ApexResourceType.APEX_PAGE) {
      return 'page';
    }
    try {
      return parsePath(filePath).extname.replace(/\./, '');
    } catch (e) {
      return '';
    }
  }

  public saveFile(componentName: string, content: string, filePath: string): Promise<boolean> {
    return write(filePath, content).then(() => {
      const resourceType = SalesforceAPI.getResourceTypeFromFilePath(vscode.Uri.parse(filePath));
      if (resourceType) {
        this.saveComponentInDiffStore(componentName, resourceType, SalesforceResourceLocation.LOCAL, content);
        return true;
      } else {
        return Promise.reject(`Could not detect type of resource from path: ${filePath}`);
      }
    });
  }

  public getStandardPathOfFileLocally(componentName: string, type: ApexResourceType, contentType?: string) {
    if (vscode.workspace.rootPath) {
      let extension = '';
      let subFolder = '';

      if (contentType) {
        switch (contentType.toLowerCase()) {
          case 'text/html':
            extension = 'html';
            break;
          case 'text/javascript':
            extension = 'js';
            break;
        }
      }

      if (type == ApexResourceType.APEX_COMPONENT) {
        extension = 'cmp';
        subFolder = 'components';
      }
      if (type == ApexResourceType.APEX_PAGE) {
        extension = 'page';
        subFolder = 'pages';
      }
      if (type == ApexResourceType.STATIC_RESOURCE_FOLDER) {
        extension = 'zip';
        subFolder = 'staticresources';
      }
      if (type == ApexResourceType.STATIC_RESOURCE_FOLDER_UNZIP) {
        extension = '';
        subFolder = 'staticresources';
      }
      if (type == ApexResourceType.STATIC_RESOURCE_SIMPLE) {
        subFolder = 'staticresources';
      }

      if (type == ApexResourceType.STATIC_RESOURCE_FOLDER_UNZIP) {
        return path.join(vscode.workspace.rootPath, this.config.getOutputFolder(), subFolder, `${componentName}_unzip`);
      } else {
        return path.join(
          vscode.workspace.rootPath,
          this.config.getOutputFolder(),
          subFolder,
          `${componentName}.${extension}`
        );
      }
    } else {
      return undefined;
    }
  }

  public getContentOfFileLocally(filePath: string): string | undefined {
    if (fs.existsSync(filePath)) {
      const contentOfLocalFile = fs.readFileSync(filePath).toString();
      // TODO detect ressource type
      const componentName = SalesforceAPI.getComponentNameFromFilePath(vscode.Uri.parse(filePath));
      const componentType = SalesforceAPI.getResourceTypeFromFilePath(vscode.Uri.parse(filePath));
      if (componentName && componentType) {
        this.saveComponentInDiffStore(
          componentName,
          componentType,
          SalesforceResourceLocation.LOCAL,
          contentOfLocalFile
        );
      }
      return contentOfLocalFile;
    }
    return undefined;
  }

  public diffComponentWithLocalVersion(
    componentName: string,
    type: ApexResourceType,
    filePath?: string
  ): Promise<DiffResult> {
    return new Promise((resolve, reject) => {
      let contentOfLocalFile: string | undefined;

      if (!filePath) {
        filePath = this.getStandardPathOfFileLocally(componentName, type);
        if (filePath) {
          contentOfLocalFile = this.getContentOfFileLocally(filePath);
        }
      } else {
        contentOfLocalFile = this.getContentOfFileLocally(filePath);
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

  public retrieveApexPages(): Promise<ISalesforceApexComponentRecord | null> {
    return this.salesforceConnection.login().then((connection: jsforce.Connection) => {
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: l('SalesforceConnection')
        },
        progress => {
          progress.report({ message: l('SalesforceListingApex') });
          return connection
            .sobject('ApexPage')
            .find({})
            .execute({ autoFetch: true })
            .then((records: ISalesforceApexComponentRecord[]) => {
              progress.report({ message: l('SalesforceChooseList') });
              return vscode.window
                .showQuickPick(_.map(records, record => record.Name), {
                  ignoreFocusOut: true,
                  placeHolder: l('SalesforceSelectComponent'),
                  matchOnDetail: true,
                  matchOnDescription: true
                })
                .then(selected => {
                  if (selected) {
                    const recordSelected = _.find(records, record => record.Name == selected);
                    if (recordSelected) {
                      this.saveComponentInDiffStore(
                        recordSelected.Name,
                        ApexResourceType.APEX_PAGE,
                        SalesforceResourceLocation.DIST,
                        recordSelected.Markup
                      );
                      return recordSelected;
                    }
                  }
                  return null;
                });
            });
        }
      );
    });
  }

  public retrieveApexComponents(): Promise<ISalesforceApexComponentRecord | null> {
    return this.salesforceConnection.login().then((connection: jsforce.Connection) => {
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: l('SalesforceConnection')
        },
        progress => {
          progress.report({ message: l('SalesforceListingApex') });
          return connection
            .sobject('ApexComponent')
            .find({})
            .execute({ autoFetch: true })
            .then((records: ISalesforceApexComponentRecord[]) => {
              progress.report({ message: l('SalesforceChooseList') });
              return vscode.window
                .showQuickPick(_.map(records, record => record.Name), {
                  ignoreFocusOut: true,
                  placeHolder: l('SalesforceSelectComponent'),
                  matchOnDetail: true,
                  matchOnDescription: true
                })
                .then(selected => {
                  if (selected) {
                    const recordSelected = _.find(records, record => record.Name == selected);
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
                });
            });
        }
      );
    });
  }

  public retrieveStaticResource(): Promise<ISalesforceStaticResourceRecord | null> {
    return this.salesforceConnection.login().then((connection: jsforceextension.ConnectionExtends) => {
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: l('SalesforceConnection')
        },
        progress => {
          progress.report({ message: l('SalesforceListingApex') });
          return connection
            .sobject('StaticResource')
            .find({})
            .execute({ autoFetch: true })
            .then((records: ISalesforceStaticResourceRecord[]) => {
              progress.report({ message: l('SalesforceChooseList') });
              return vscode.window
                .showQuickPick(_.map(records, record => record.Name), {
                  ignoreFocusOut: true,
                  placeHolder: l('SalesforceSelectComponent'),
                  matchOnDetail: true,
                  matchOnDescription: true
                })
                .then(selected => {
                  if (selected) {
                    const recordSelected: any = _.find(records, record => record.Name == selected);
                    if (recordSelected) {
                      return recordSelected;
                    }
                  }
                  return null;
                });
            });
        }
      );
    });
  }

  public downloadStaticResource(
    resourceRecord: ISalesforceStaticResourceRecord
  ): Promise<DiffResult | ExtractFolderResult> {
    return <Promise<DiffResult | ExtractFolderResult>>vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: l('SalesforceConnection')
      },
      progress => {
        progress.report({ message: l('SalesforceDownloadProgress') });
        return this.salesforceConnection.login().then((connection: jsforceextension.ConnectionExtends) => {
          return fetch(`${connection.instanceUrl}${resourceRecord.Body}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${connection.accessToken}`
            }
          }).then((res: { body: zlib.Gunzip | PassThrough }) => {
            if (resourceRecord.ContentType == 'application/zip') {
              return new SalesforceAPIStaticFolder(this, resourceRecord).extract(res);
            } else {
              return new Promise((resolve, reject) => {
                let content = '';
                res.body.on('data', (data: Uint8Array) => {
                  content += data.toString();
                });
                res.body.on('finish', () => {
                  this.saveComponentInDiffStore(
                    resourceRecord.Name,
                    ApexResourceType.STATIC_RESOURCE_SIMPLE,
                    SalesforceResourceLocation.DIST,
                    content
                  );
                  this.diffComponentWithLocalVersion(resourceRecord.Name, ApexResourceType.STATIC_RESOURCE_SIMPLE)
                    .then(outcome => resolve(outcome))
                    .catch(err => reject(err));
                });
                res.body.on('error', (err: any) => {
                  reject(err);
                });
                res.body.read();
              });
            }
          });
        });
      }
    );
  }

  public downloadApex(componentName: string, type: ApexResourceType): Promise<ISalesforceApexComponentRecord> {
    return <Promise<ISalesforceApexComponentRecord>>vscode.window.withProgress(
      {
        title: l('SalesforceConnection'),
        location: vscode.ProgressLocation.Window
      },
      progress => {
        return this.salesforceConnection.login().then((connection: jsforce.Connection) => {
          progress.report({ message: l('SalesforceListingApex') });
          return connection
            .sobject(this.fromApexResourceTypeToMetadataAPIName(type))
            .find({
              name: componentName
            })
            .limit(1)
            .execute()
            .then((records: ISalesforceApexComponentRecord[]) => {
              if (records && !_.isEmpty(records)) {
                this.saveComponentInDiffStore(componentName, type, SalesforceResourceLocation.DIST, records[0].Markup);
                return records[0];
              } else {
                return Promise.reject(l('SalesforceComponentNotFound', componentName));
              }
            });
        });
      }
    );
  }

  public uploadApex(
    componentName: string,
    type: ApexResourceType,
    content: any
  ): Promise<jsforceextension.IMedataUpsertResult> {
    return <Promise<jsforceextension.IMedataUpsertResult>>vscode.window.withProgress(
      {
        title: l('SalesforceConnection'),
        location: vscode.ProgressLocation.Window
      },
      progress => {
        return this.salesforceConnection.login().then((connection: jsforceextension.ConnectionExtends) => {
          progress.report({ message: l('SalesforceUploadProgress') });

          return connection.metadata.upsert(this.fromApexResourceTypeToMetadataAPIName(type), {
            apiVersion: 25,
            fullName: componentName,
            label: componentName,
            content: new Buffer(content).toString('base64')
          });
        });
      }
    );
  }

  public saveComponentInDiffStore(
    componentName: string,
    type: ApexResourceType,
    location: SalesforceResourceLocation,
    content: string
  ) {
    DiffContentStore.add(SalesforceAPI.getDiffStoreScheme(componentName, type, location), content);
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
      )}/preview.${this.getFileExtensionFromResourceType(
        type,
        filePath
      )}?tstamp=${Date.now()}&localPath=${encodeURIComponent(filePath)}`
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
    return metadataApiName;
  }
}
