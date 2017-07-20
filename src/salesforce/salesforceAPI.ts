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

interface ISalesforceApexComponentRecord {
  Name: string;
  Markup: string;
}

export enum DiffResult {
  FILE_DOES_NOT_EXIST_LOCALLY,
  EDITOR_DIFF_OPENED,
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

  public saveFile(uri: vscode.Uri, location: SalesforceResourceLocation, showDiff = false): Promise<boolean> {
    const key = SalesforceResourceContentProvider.getKeyFromUri(uri);
    if (key) {
      const diffStoreKey = SalesforceResourceContentProvider.getDiffStoreScheme(key, location);
      const contentOfFile = DiffContentStore.get(diffStoreKey);
      const activeRoothPath = vscode.workspace.rootPath;
      if (activeRoothPath) {
        const filePathOnSystem = path.join(activeRoothPath, this.config.getOutputFolder(), `${key}.cmp`);
        return write(filePathOnSystem, contentOfFile)
          .then(() => {
            DiffContentStore.add(
              SalesforceResourceContentProvider.getDiffStoreScheme(key, SalesforceResourceLocation.LOCAL),
              contentOfFile
            );
            if (showDiff) {
              return this.diffComponentWithLocalVersion(key, true).then(() => {
                return true;
              });
            }
            return true;
          })
          .catch(() => false);
      }
    }
    return Promise.resolve(false);
  }

  public diffComponentWithLocalVersion(componentName: string, showIdentical = false): Promise<DiffResult> {
    if (vscode.workspace.rootPath) {
      const localPathOfComponent = path.join(
        vscode.workspace.rootPath,
        this.config.getOutputFolder(),
        `${componentName}.cmp`
      );

      return new Promise((resolve, reject) => {
        if (fs.existsSync(localPathOfComponent)) {
          const contentOfLocalFile = fs.readFileSync(localPathOfComponent).toString();
          const contentOfDistFile = DiffContentStore.get(
            SalesforceResourceContentProvider.getDiffStoreScheme(componentName, SalesforceResourceLocation.DIST)
          );
          if (contentOfLocalFile && contentOfDistFile) {
            DiffContentStore.add(
              SalesforceResourceContentProvider.getDiffStoreScheme(componentName, SalesforceResourceLocation.LOCAL),
              contentOfLocalFile
            );
            if (contentOfDistFile != contentOfLocalFile || showIdentical) {
              vscode.commands
                .executeCommand(
                  'vscode.diff',
                  SalesforceResourceContentProvider.getUri(componentName, SalesforceResourceLocation.LOCAL),
                  SalesforceResourceContentProvider.getUri(componentName, SalesforceResourceLocation.DIST),
                  'Comparing: Local \u2194 Remote (Salesforce)'
                )
                .then(
                  success => {
                    resolve(DiffResult.EDITOR_DIFF_OPENED);
                  },
                  err => {
                    reject(DiffResult.EDITOR_ERROR_WHILE_EXECUTING_DIFF);
                  }
                );
            }
          }
        } else {
          resolve(DiffResult.FILE_DOES_NOT_EXIST_LOCALLY);
        }
      });
    } else {
      return Promise.reject(DiffResult.EDITOR_NOT_ABLE_TO_DIFF);
    }
  }

  public retrieveApexComponent(): Promise<ISalesforceApexComponentRecord | undefined> {
    return new Promise((resolve, reject) => {
      this.salesforceConnection.login().then((connection: jsforce.Connection) => {
        connection
          .sobject('ApexComponent')
          .find({})
          .execute({ autoFetch: true })
          .then((records: ISalesforceApexComponentRecord[]) => {
            return vscode.window
              .showQuickPick(_.map(records, record => record.Name), {
                ignoreFocusOut: true,
                placeHolder: `Please select the Apex component which contains the Coveo component to edit`,
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
      });
    });
  }
}
