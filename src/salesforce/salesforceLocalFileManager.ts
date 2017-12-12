import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as write from 'write';
import { SalesforceResourceLocation, SalesforceAPI } from './salesforceAPI';
import { filetypesDefinition, SalesforceResourceType } from '../filetypes/filetypesConverter';
import { SalesforceConfig } from './salesforceConfig';
import { DiffContentStore } from '../diffContentStore';
import { l } from '../strings/Strings';
import { SalesforceResourcePreviewContentProvider } from './salesforceResourcePreviewContentProvider';
const parsePath = require('parse-filepath');

export enum DiffResult {
  FILE_DOES_NOT_EXIST_LOCALLY,
  EDITOR_DIFF_OPENED,
  NOTHING_TO_DIFF,
  EDITOR_NOT_ABLE_TO_DIFF,
  EDITOR_ERROR_WHILE_EXECUTING_DIFF
}

export class SalesforceLocalFileManager {
  public static getComponentNameFromFilePath(filePath: string): string | undefined {
    const parsedPath: any = parsePath(filePath);
    return parsedPath.name.replace('_unzip', '');
  }

  public static diffComponentWithLocalVersion(
    componentName: string,
    type: SalesforceResourceType,
    config: SalesforceConfig,
    filePath?: string
  ): Promise<DiffResult> {
    return new Promise((resolve, reject) => {
      let contentOfLocalFile: string | undefined;

      if (!filePath) {
        filePath = SalesforceLocalFileManager.getStandardPathOfFileLocally(componentName, type, config);
        if (filePath) {
          contentOfLocalFile = SalesforceLocalFileManager.getContentOfFileLocally(filePath);
        }
      } else {
        contentOfLocalFile = SalesforceLocalFileManager.getContentOfFileLocally(filePath);
      }
      const matchOnSalesforceResourceType = _.find(
        filetypesDefinition,
        definition => definition.salesforceResourceType == type
      );
      const suffix =
        matchOnSalesforceResourceType && matchOnSalesforceResourceType.suffix
          ? matchOnSalesforceResourceType.suffix
          : '';

      const contentOfDistFile = this.getComponentInDiffStore(
        `${componentName}${suffix}`,
        type,
        SalesforceResourceLocation.DIST
      );
      if (contentOfLocalFile) {
        if (contentOfDistFile) {
          if (contentOfDistFile != contentOfLocalFile) {
            vscode.commands
              .executeCommand(
                'vscode.diff',
                SalesforceResourcePreviewContentProvider.getPreviewUri(
                  componentName,
                  type,
                  SalesforceResourceLocation.LOCAL,
                  filePath ? filePath : ''
                ),
                SalesforceResourcePreviewContentProvider.getPreviewUri(
                  componentName,
                  type,
                  SalesforceResourceLocation.DIST,
                  filePath ? filePath : ''
                ),
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

  public static getResourceTypeFromFilePath(filePath: string): SalesforceResourceType | undefined {
    const parsedPath = parsePath(filePath);
    if (parsedPath.ext == '' && parsedPath.base.indexOf('_unzip') != -1) {
      return SalesforceResourceType.STATIC_RESOURCE_FOLDER_UNZIP;
    }

    const extensionMatch = _.filter(
      filetypesDefinition,
      definition => definition.extension == parsedPath.ext.replace('.', '')
    );
    const folderMatch = _.filter(filetypesDefinition, definition =>
      new RegExp(`\\${path.sep}${definition.subfolder}\\${path.sep}`).test(parsedPath.absolute)
    );
    const suffixMatch = _.filter(filetypesDefinition, definition =>
      new RegExp(`${definition.suffix}`).test(parsedPath.name)
    );
    const rejectedEmpty = _.reject([extensionMatch, folderMatch, suffixMatch], possiblyEmpty =>
      _.isEmpty(possiblyEmpty)
    );
    const intersection = (_.intersectionWith as any)(...rejectedEmpty, _.isEqual);
    return intersection[0].salesforceResourceType;
  }

  public static getContentOfFileLocally(filePath: string): string | undefined {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const contentOfLocalFile = fs.readFileSync(filePath).toString();
      const componentName = SalesforceLocalFileManager.getComponentNameFromFilePath(filePath);
      const componentType = SalesforceLocalFileManager.getResourceTypeFromFilePath(filePath);
      if (componentName && componentType) {
        SalesforceAPI.saveComponentInDiffStore(
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

  public static getStandardNameOfFileLocally(
    componentName: string,
    type: SalesforceResourceType,
    contentType?: string
  ): string | undefined {
    if (vscode.workspace.rootPath) {
      const definitionMatchingSalesforceType = _.find(
        filetypesDefinition,
        definition => definition.salesforceResourceType == type
      );

      let extension;
      const suffix =
        definitionMatchingSalesforceType && definitionMatchingSalesforceType.suffix
          ? definitionMatchingSalesforceType.suffix
          : '';

      // It's possible to get a stricter/valid extension from the content type for static resource, so check with that first.
      // Fallback on the salesforce type if none is found.
      if (contentType) {
        const definitionFromContentType = _.find(
          filetypesDefinition,
          definition => definition.contentType == contentType
        );
        extension =
          definitionFromContentType && definitionFromContentType.extension ? definitionFromContentType.extension : '';
      } else if (type) {
        extension =
          definitionMatchingSalesforceType && definitionMatchingSalesforceType.extension
            ? definitionMatchingSalesforceType.extension
            : '';
      }

      if (type == SalesforceResourceType.STATIC_RESOURCE_FOLDER_UNZIP) {
        return `${componentName}_unzip`;
      } else {
        return `${componentName}${suffix}.${extension}`;
      }
    } else {
      return undefined;
    }
  }

  public static getSubFolderOfFileLocally(componentName: string, type: SalesforceResourceType) {
    const definitionMatchingSalesforceResourceType = _.find(
      filetypesDefinition,
      definition => definition.salesforceResourceType == type
    );
    let subFolder =
      definitionMatchingSalesforceResourceType && definitionMatchingSalesforceResourceType.subfolder
        ? definitionMatchingSalesforceResourceType.subfolder
        : '';
    if (type.indexOf('Aura') != -1) {
      subFolder = path.join('aura', componentName);
    }
    return subFolder;
  }

  public static getStandardPathOfFileLocally(
    componentName: string,
    type: SalesforceResourceType,
    config: SalesforceConfig,
    contentType?: string
  ) {
    const standardName = SalesforceLocalFileManager.getStandardNameOfFileLocally(componentName, type, contentType);
    if (vscode.workspace.rootPath && standardName) {
      const subFolder = SalesforceLocalFileManager.getSubFolderOfFileLocally(componentName, type);

      if (type == SalesforceResourceType.STATIC_RESOURCE_FOLDER_UNZIP) {
        return path.join(vscode.workspace.rootPath, config.getOutputFolder(), subFolder, standardName);
      } else {
        return path.join(vscode.workspace.rootPath, config.getOutputFolder(), subFolder, standardName);
      }
    } else {
      return undefined;
    }
  }

  public static saveFile(componentName: string, content: string, filePath: string): Promise<boolean> {
    return write(filePath, content).then(() => {
      const resourceType = SalesforceLocalFileManager.getResourceTypeFromFilePath(filePath);
      if (resourceType) {
        SalesforceAPI.saveComponentInDiffStore(componentName, resourceType, SalesforceResourceLocation.LOCAL, content);
        return true;
      } else {
        return Promise.reject(`Could not detect type of resource from path: ${filePath}`);
      }
    });
  }

  public static getComponentInDiffStore(
    componentName: string,
    type: SalesforceResourceType,
    location: SalesforceResourceLocation
  ) {
    return DiffContentStore.get(SalesforceAPI.getDiffStoreScheme(componentName, type, SalesforceResourceLocation.DIST));
  }
}
