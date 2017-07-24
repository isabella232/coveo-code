import { SalesforceConnection } from './salesforceConnection';
import * as jsforce from 'jsforce';
import * as _ from 'lodash';
import { SalesforceConfig } from './salesforceConfig';
import { SalesforceResourceContentProvider, SalesforceResourceLocation } from './salesforceResourceContentProvider';
import * as vscode from 'vscode';
import * as write from 'write';
import { DiffContentStore } from '../diffContentStore';
import path = require('path');
import fs = require('fs');
import * as jsforceextension from '../definitions/jsforce';
import { l } from '../strings/Strings';

interface ISalesforceApexComponentRecord {
  Name: string;
  Markup: string;
}

export enum DiffResult {
  FILE_DOES_NOT_EXIST_LOCALLY,
  EDITOR_DIFF_OPENED,
  NOTHING_TO_DIFF,
  EDITOR_NOT_ABLE_TO_DIFF,
  EDITOR_ERROR_WHILE_EXECUTING_DIFF
}

export class SalesforceAPI {
  private config: SalesforceConfig;
  private salesforceConnection: SalesforceConnection;

  public constructor() {
    this.config = new SalesforceConfig();
    this.salesforceConnection = new SalesforceConnection(this.config);
  }

  public replaceEditorContent(
    editor: vscode.TextEditor,
    editBuilder: vscode.TextEditorEdit,
    key: string,
    locationToFetch: SalesforceResourceLocation
  ) {
    const editRange = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.positionAt(editor.document.getText().length)
    );
    const position = new vscode.Position(0, 0);
    const newValueToReplace = DiffContentStore.get(
      SalesforceResourceContentProvider.getDiffStoreScheme(key, locationToFetch)
    );
    editBuilder.delete(editRange);
    editBuilder.insert(position, newValueToReplace);
    editBuilder.setEndOfLine(vscode.EndOfLine.LF);
  }

  public saveFile(componentName: string, content: string): Promise<boolean> {
    const activeRoothPath = vscode.workspace.rootPath;
    if (activeRoothPath) {
      const filePathOnSystem = path.join(activeRoothPath, this.config.getOutputFolder(), `${componentName}.cmp`);
      return write(filePathOnSystem, content).then(() => {
        this.saveComponentInDiffStore(componentName, SalesforceResourceLocation.LOCAL, content);
        return true;
      });
    }
    return Promise.reject(l('NoActivePath'));
  }

  public getPathOfFileLocally(componentName: string) {
    if (vscode.workspace.rootPath) {
      return path.join(vscode.workspace.rootPath, this.config.getOutputFolder(), `${componentName}.cmp`);
    } else {
      return undefined;
    }
  }

  public getContentOfFileLocally(componentName: string): string | undefined {
    const localPathOfComponent = this.getPathOfFileLocally(componentName);
    if (localPathOfComponent) {
      if (fs.existsSync(localPathOfComponent)) {
        const contentOfLocalFile = fs.readFileSync(localPathOfComponent).toString();
        this.saveComponentInDiffStore(componentName, SalesforceResourceLocation.LOCAL, contentOfLocalFile);
        return contentOfLocalFile;
      }
    }
    return undefined;
  }

  public diffComponentWithLocalVersion(componentName: string): Promise<DiffResult> {
    return new Promise((resolve, reject) => {
      const contentOfLocalFile = this.getContentOfFileLocally(componentName);
      const contentOfDistFile = DiffContentStore.get(
        SalesforceResourceContentProvider.getDiffStoreScheme(componentName, SalesforceResourceLocation.DIST)
      );
      if (contentOfLocalFile) {
        if (contentOfDistFile) {
          if (contentOfDistFile != contentOfLocalFile) {
            vscode.commands
              .executeCommand(
                'vscode.diff',
                SalesforceResourceContentProvider.getUri(componentName, SalesforceResourceLocation.LOCAL),
                SalesforceResourceContentProvider.getUri(componentName, SalesforceResourceLocation.DIST),
                l('CompareLocalRemote', 'Salesforce')
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

  public retrieveApexComponents(): Promise<ISalesforceApexComponentRecord | undefined> {
    return new Promise((resolve, reject) => {
      this.salesforceConnection.login().then((connection: jsforce.Connection) => {
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
                          `${SalesforceResourceContentProvider.getDiffStoreScheme(
                            recordSelected.Name,
                            SalesforceResourceLocation.DIST
                          )}`,
                          recordSelected.Markup
                        );
                      }
                      resolve(recordSelected);
                    }
                    resolve(undefined);
                  });
              });
          }
        );
      });
    });
  }

  public downloadApexComponent(componentName: string): Promise<ISalesforceApexComponentRecord> {
    return <Promise<ISalesforceApexComponentRecord>>vscode.window.withProgress(
      {
        title: l('SalesforceConnection'),
        location: vscode.ProgressLocation.Window
      },
      progress => {
        return this.salesforceConnection.login().then((connection: jsforce.Connection) => {
          progress.report({ message: l('SalesforceListingApex') });
          return connection
            .sobject('ApexComponent')
            .find({
              name: componentName
            })
            .limit(1)
            .execute()
            .then((records: ISalesforceApexComponentRecord[]) => {
              if (records && !_.isEmpty(records)) {
                return records[0];
              } else {
                return Promise.reject(l('SalesforceComponentNotFound', componentName));
              }
            });
        });
      }
    );
  }

  public uploadApexComponent(componentName: string): Promise<jsforceextension.IMedataUpsertResult> {
    return <Promise<jsforceextension.IMedataUpsertResult>>vscode.window.withProgress(
      {
        title: l('SalesforceConnection'),
        location: vscode.ProgressLocation.Window
      },
      progress => {
        return this.salesforceConnection.login().then((connection: jsforceextension.ConnectionExtends) => {
          progress.report({ message: l('SalesforceUploadProgress') });
          const content = this.getContentOfFileLocally(componentName);
          if (content) {
            return connection.metadata.upsert('ApexComponent', {
              apiVersion: 25,
              fullName: componentName,
              label: componentName,
              content: new Buffer(content).toString('base64')
            });
          } else {
            return Promise.reject(l('CannotUploadEmpty'));
          }
        });
      }
    );
  }

  private saveComponentInDiffStore(componentName: string, location: SalesforceResourceLocation, content: string) {
    DiffContentStore.add(SalesforceResourceContentProvider.getDiffStoreScheme(componentName, location), content);
  }
}
