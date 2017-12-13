import { ISalesforceAuraDefinition } from './salesforceAPI';
import { DiffResult, SalesforceLocalFileManager } from './salesforceLocalFileManager';
import { SalesforceConfig } from './salesforceConfig';
import { SalesforceResourceType } from '../filetypes/filetypesConverter';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as bluebird from 'bluebird';
import * as _ from 'lodash';
const parsepath = require('parse-filepath');
const readdir = bluebird.promisify(fs.readdir);
const readfile = bluebird.promisify(fs.readFile);

export class SalesforceAura {
  public static coerceApiNameToEnum(bundleFile: ISalesforceAuraDefinition): SalesforceResourceType {
    return SalesforceResourceType[`AURA_${bundleFile.DefType}` as any] as SalesforceResourceType;
  }

  public async extract(name: string, bundle: ISalesforceAuraDefinition[], config: SalesforceConfig) {
    return await bundle.map(async fileInBundle => {
      const standardPath = SalesforceLocalFileManager.getStandardPathOfFileLocally(
        name,
        SalesforceAura.coerceApiNameToEnum(fileInBundle),
        config
      );
      if (standardPath) {
        const baseName = parsepath(standardPath).basename;
        const outcome = await SalesforceLocalFileManager.diffComponentWithLocalVersion(
          name,
          SalesforceAura.coerceApiNameToEnum(fileInBundle),
          config,
          standardPath
        );
        if (outcome == DiffResult.FILE_DOES_NOT_EXIST_LOCALLY) {
          return SalesforceLocalFileManager.saveFile(baseName, fileInBundle.Source, standardPath);
        }
      }

      return null;
    });
  }

  public async getMetadataForUpload(uri: vscode.Uri) {
    const parsedPath = parsepath(uri.fsPath);
    const dir = parsedPath.dir;
    const files = await readdir(dir);
    const values = files.map(async file => {
      const filePath = path.join(dir, file);
      const type = SalesforceLocalFileManager.getResourceTypeFromFilePath(filePath);
      if (type) {
        const buffer = await readfile(filePath);
        return {
          apiField: this.mapResourceTypeToMetadataApiField(type),
          buffer
        };
      }
      return null;
    });
    const results = await Promise.all(values);
    const ret: { [key: string]: string } = {};
    _.compact(results).forEach(result => {
      ret[result.apiField] = result.buffer.toString('base64');
    });
    return ret;
  }

  private mapResourceTypeToMetadataApiField(type: SalesforceResourceType) {
    // See : https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_auradefinitionbundle.htm
    switch (type) {
      case SalesforceResourceType.AURA_COMPONENT:
        return 'markup';
      case SalesforceResourceType.AURA_CONTROLLER:
        return 'controllerContent';
      case SalesforceResourceType.AURA_DESIGN:
        return 'designContent';
      case SalesforceResourceType.AURA_DOCUMENTATION:
        return 'documentationContent';
      case SalesforceResourceType.AURA_RENDERER:
        return 'rendererContent';
      case SalesforceResourceType.AURA_HELPER:
        return 'helperContent';
      case SalesforceResourceType.AURA_STYLE:
        return 'styleContent';
      case SalesforceResourceType.AURA_SVG:
        return 'SVGContent';
      default:
        throw `Type not found in mapResourceTypeToMetadataApiField : ${type}`;
    }
  }
}
