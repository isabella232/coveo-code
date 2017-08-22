import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as write from 'write';
import { ApexResourceType } from './salesforceResourceTypes';
import { SalesforceResourceLocation, SalesforceAPI } from './salesforceAPI';
import { getExtensionFromContentType } from '../filetypes/filetypesConverter';
import { SalesforceConfig } from './salesforceConfig';
const parsePath = require('parse-filepath');

export class SalesforceLocalFile {
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
      return ApexResourceType.STATIC_RESOURCE_SIMPLE;
    }
    return undefined;
  }

  public static getContentOfFileLocally(filePath: string): string | undefined {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const contentOfLocalFile = fs.readFileSync(filePath).toString();
      const componentName = SalesforceLocalFile.getComponentNameFromFilePath(vscode.Uri.parse(filePath));
      const componentType = SalesforceLocalFile.getResourceTypeFromFilePath(vscode.Uri.parse(filePath));
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

  public static getStandardPathOfFileLocally(
    componentName: string,
    type: ApexResourceType,
    config: SalesforceConfig,
    contentType?: string
  ) {
    if (vscode.workspace.rootPath) {
      let extension = '';
      let subFolder = '';

      if (contentType) {
        extension = getExtensionFromContentType(contentType) || '';
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
        return path.join(vscode.workspace.rootPath, config.getOutputFolder(), subFolder, `${componentName}_unzip`);
      } else {
        return path.join(
          vscode.workspace.rootPath,
          config.getOutputFolder(),
          subFolder,
          `${componentName}.${extension}`
        );
      }
    } else {
      return undefined;
    }
  }

  public static saveFile(componentName: string, content: string, filePath: string): Promise<boolean> {
    return write(filePath, content).then(() => {
      const resourceType = SalesforceLocalFile.getResourceTypeFromFilePath(vscode.Uri.parse(filePath));
      if (resourceType) {
        SalesforceAPI.saveComponentInDiffStore(componentName, resourceType, SalesforceResourceLocation.LOCAL, content);
        return true;
      } else {
        return Promise.reject(`Could not detect type of resource from path: ${filePath}`);
      }
    });
  }
}
