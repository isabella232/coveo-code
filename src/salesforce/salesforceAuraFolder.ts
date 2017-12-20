import { DiffResult, SalesforceLocalFileManager } from './salesforceLocalFileManager';
import { SalesforceConfig } from './salesforceConfig';
import { SalesforceResourceType } from '../filetypes/filetypesConverter';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as bluebird from 'bluebird';
import * as _ from 'lodash';
import { ISalesforceAuraDefinition } from './salesforceAuraAPI';
import { DownloadAndExtractionResult } from './salesforceAPI';
const parsepath = require('parse-filepath');
const readdir = bluebird.promisify(fs.readdir);
const readfile = bluebird.promisify(fs.readFile);

export class SalesforceAura {
  public static coerceApiNameToEnum(bundleFile: ISalesforceAuraDefinition): SalesforceResourceType {
    return SalesforceResourceType[`AURA_${bundleFile.DefType}` as any] as SalesforceResourceType;
  }

  public static async extract(
    name: string,
    bundle: ISalesforceAuraDefinition[],
    config: SalesforceConfig
  ): Promise<DownloadAndExtractionResult> {
    const results = bundle.map(async fileInBundle => {
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
          await SalesforceLocalFileManager.saveFile(baseName, fileInBundle.Source, standardPath);
        }
        return outcome;
      }
      return null;
    });
    const allResolved = await Promise.all(results);
    const first = _.first(allResolved);
    if (first) {
      return <DiffResult>first;
    }
    return null;
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
          type,
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
      const metadataType = this.mapResourceTypeToMetadataApiType(result.type);
      if (metadataType) {
        ret.type = metadataType;
      }
    });
    return ret;
  }

  private mapResourceTypeToMetadataApiType(type: SalesforceResourceType) {
    // See : https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_auradefinitionbundle.htm
    switch (type) {
      case SalesforceResourceType.AURA_APPLICATION:
        return 'Application';
      case SalesforceResourceType.AURA_COMPONENT:
        return 'Component';
      case SalesforceResourceType.AURA_EVENT:
        return 'Event';
      case SalesforceResourceType.AURA_INTERFACE:
        return 'Interface';
      case SalesforceResourceType.AURA_TOKENS:
        return 'Tokens';
      default:
        return null;
    }
  }

  private mapResourceTypeToMetadataApiField(type: SalesforceResourceType) {
    // See : https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_auradefinitionbundle.htm
    switch (type) {
      case SalesforceResourceType.AURA_EVENT:
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
        throw new Error(`Type not found in mapResourceTypeToMetadataApiField : ${type}`);
    }
  }
}
