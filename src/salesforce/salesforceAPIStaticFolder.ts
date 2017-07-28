import {
  SalesforceAPI,
  ISalesforceApexComponentRecord,
  ApexResourceType,
  ISalesforceStaticResourceFromZip,
  SalesforceResourceLocation
} from './salesforceAPI';
import * as zlib from 'zlib';
import { PassThrough } from 'stream';
const parsePath = require('parse-filepath');
const mkdirp = require('mkdirp');
import * as fs from 'fs';
import * as path from 'path';
const AdmZip = require('adm-zip');

interface IAdmZip {
  extractAllTo: (path: string, overwrite: boolean) => Promise<boolean>;
  getEntries: () => ISalesforceStaticResourceFromZip[];
}

export enum ExtractFolderResult {
  NEW_FOLDER,
  FOLDER_MERGE
}

export class SalesforceAPIStaticFolder {
  constructor(public salesforceAPI: SalesforceAPI, public record: ISalesforceApexComponentRecord) {}
  public extract(res: { body: zlib.Gunzip | PassThrough }) {
    return new Promise<ExtractFolderResult>((resolve, reject) => {
      const standardPath = this.salesforceAPI.getStandardPathOfFileLocally(
        this.record.Name,
        ApexResourceType.STATIC_RESOURCE_FOLDER
      );
      if (standardPath) {
        const parsedPath = parsePath(standardPath);
        mkdirp.sync(parsedPath.dir);
        res.body.pipe(fs.createWriteStream(standardPath)).on('finish', () => {
          const standardPathUnzip = this.salesforceAPI.getStandardPathOfFileLocally(
            this.record.Name,
            ApexResourceType.STATIC_RESOURCE_FOLDER_UNZIP
          );
          if (standardPathUnzip) {
            const zip = <IAdmZip>new AdmZip(standardPath);

            if (!fs.existsSync(standardPathUnzip)) {
              this.extractNewFolder(zip, standardPathUnzip);
              resolve(ExtractFolderResult.NEW_FOLDER);
            } else {
              const allEntries = zip.getEntries();
              allEntries.map(entry => {
                return this.extractSingleFile(entry, standardPathUnzip);
              });

              Promise.all(allEntries).then(() => resolve(ExtractFolderResult.FOLDER_MERGE));
            }
          }
        });
      } else {
        resolve();
      }
    });
  }

  private extractNewFolder(zip: IAdmZip, pathToUnzip: string) {
    return Promise.resolve(zip.extractAllTo(pathToUnzip, true));
  }

  private extractSingleFile(entry: ISalesforceStaticResourceFromZip, pathToUnzip: string) {
    if (!entry.isDirectory) {
      const localContent = this.salesforceAPI.getContentOfFileLocally(path.join(pathToUnzip, entry.entryName));
      if (localContent) {
        this.salesforceAPI.saveComponentInDiffStore(
          entry.entryName,
          ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP,
          SalesforceResourceLocation.DIST,
          entry.getData().toString()
        );
        return this.salesforceAPI.diffComponentWithLocalVersion(
          entry.entryName,
          ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP,
          path.join(pathToUnzip, entry.entryName)
        );
      } else {
        return this.salesforceAPI.saveFile(
          entry.entryName,
          entry.getData().toString(),
          path.join(pathToUnzip, entry.entryName)
        );
      }
    } else {
      return Promise.resolve();
    }
  }
}
