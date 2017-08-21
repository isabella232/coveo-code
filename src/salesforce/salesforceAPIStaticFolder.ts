import {
  SalesforceAPI,
  ISalesforceApexComponentRecord,
  ISalesforceStaticResourceFromZip,
  SalesforceResourceLocation
} from './salesforceAPI';
import * as zlib from 'zlib';
import { PassThrough } from 'stream';
const parsePath = require('parse-filepath');
const mkdirp = require('mkdirp');
import * as fs from 'fs';
import * as path from 'path';
import { ApexResourceType } from './salesforceResourceTypes';
import { l } from '../strings/Strings';
const AdmZip = require('adm-zip');
const walk = require('walk');

interface IAdmZip {
  extractAllTo: (path: string, overwrite: boolean) => Promise<boolean>;
  getEntries: () => ISalesforceStaticResourceFromZip[];
}

export enum ExtractFolderResult {
  NEW_FOLDER,
  FOLDER_MERGE
}

export class SalesforceAPIStaticFolder {
  public static zip(fileInsideFolder: string): Promise<{ buffer: Buffer; resourceName: string }> {
    const extract = SalesforceAPIStaticFolder.extractResourceInfoForFileInsizeZip(fileInsideFolder);
    if (extract) {
      return new Promise((resolve, reject) => {
        const zip = new AdmZip();
        const walker = walk.walk(extract.folderToZip);
        walker.on('file', (root: string, fileStats: any, next: () => void) => {
          zip.addLocalFile(path.join(root, fileStats.name));
          next();
        });
        walker.on('end', () => {
          zip.writeZip(extract.zipToWrite + '.zip');
          resolve({ buffer: zip.toBuffer(), resourceName: extract.resourceName });
        });
      });
    } else {
      return Promise.reject(l('CouldNotExtractLocalPath', fileInsideFolder));
    }
  }

  public static extractResourceInfoForFileInsizeZip(fileInsizeZip: string) {
    const regex = /(.*\/([a-zA-Z]+))_unzip\//;
    const match = fileInsizeZip.match(regex);
    if (match) {
      return {
        folderToZip: match[0],
        zipToWrite: match[1],
        resourceName: match[2]
      };
    } else {
      return null;
    }
  }

  constructor(public salesforceAPI: SalesforceAPI, public record: ISalesforceApexComponentRecord) {}

  public extract(res: { body: zlib.Gunzip | PassThrough }) {
    if (this.record != null) {
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
                this.extractNewFolder(zip, standardPathUnzip).then(() => {
                  const allEntries = zip.getEntries();
                  allEntries.forEach(entry => {
                    this.saveContentInDiffStore(entry, standardPathUnzip);
                  });
                  resolve(ExtractFolderResult.NEW_FOLDER);
                });
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
    } else {
      return Promise.reject('No record');
    }
  }

  private extractNewFolder(zip: IAdmZip, pathToUnzip: string) {
    return Promise.resolve(zip.extractAllTo(pathToUnzip, true));
  }

  private saveContentInDiffStore(entry: ISalesforceStaticResourceFromZip, pathToUnzip: string) {
    this.salesforceAPI.saveComponentInDiffStore(
      entry.entryName,
      ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP,
      SalesforceResourceLocation.DIST,
      entry.getData().toString()
    );
    const localContent = this.salesforceAPI.getContentOfFileLocally(path.join(pathToUnzip, entry.entryName));
    if (localContent) {
      this.salesforceAPI.saveComponentInDiffStore(
        entry.entryName,
        ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP,
        SalesforceResourceLocation.LOCAL,
        localContent
      );
    }
  }

  private extractSingleFile(entry: ISalesforceStaticResourceFromZip, pathToUnzip: string) {
    this.saveContentInDiffStore(entry, pathToUnzip);
    const localContent = this.salesforceAPI.getContentOfFileLocally(path.join(pathToUnzip, entry.entryName));
    if (!entry.isDirectory) {
      if (localContent) {
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
