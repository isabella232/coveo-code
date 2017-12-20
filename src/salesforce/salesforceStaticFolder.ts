import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { SalesforceAPI, SalesforceResourceLocation } from './salesforceAPI';
import { PassThrough } from 'stream';
import { l } from '../strings/Strings';
import { SalesforceLocalFileManager, DiffResult } from './salesforceLocalFileManager';
import { SalesforceConfig } from './salesforceConfig';
import { SalesforceResourceType } from '../filetypes/filetypesConverter';
import { ISalesforceApexComponentRecord } from './salesforceApexComponentAPI';
const AdmZip = require('adm-zip');
const archiver = require('archiver');
const parsePath = require('parse-filepath');
const mkdirp = require('mkdirp');

interface IAdmZip {
  extractAllTo: (path: string, overwrite: boolean) => Promise<boolean>;
  getEntries: () => ISalesforceStaticResourceFromZip[];
}

export enum ExtractFolderResult {
  NEW_FOLDER,
  FOLDER_MERGE
}

export interface ISalesforceStaticResourceFromZip extends ISalesforceApexComponentRecord {
  isDirectory: boolean;
  name: string;
  entryName: string;
  ContentType: string;
  getData: () => Uint8Array[];
}

export class SalesforceStaticFolder {
  public static zip(fileInsideFolder: string): Promise<{ buffer: Buffer; resourceName: string }> {
    const extractedInfo = SalesforceStaticFolder.extractResourceInfoForFileInsizeZip(fileInsideFolder);

    if (extractedInfo) {
      return new Promise((resolve, reject) => {
        const writeToDisk = fs.createWriteStream(extractedInfo.zipToWrite + '.zip');
        const archive = archiver('zip');
        archive.on('error', (err: any) => {
          reject(err);
        });

        writeToDisk.on('close', () => {
          resolve({
            buffer: fs.readFileSync(extractedInfo.zipToWrite + '.zip'),
            resourceName: extractedInfo.resourceName
          });
        });

        archive.pipe(writeToDisk);
        archive.directory(extractedInfo.folderToZip, '/');
        archive.finalize();
      });
    } else {
      return Promise.reject(l('CouldNotExtractLocalPath', fileInsideFolder));
    }
  }

  public static extractResourceInfoForFileInsizeZip(fileInsizeZip: string) {
    const matchForFileInsideZip = fileInsizeZip.match(/(.*[\/\\]([^\/\\]+))_unzip[\/\\]/);
    const matchForZipFolder = fileInsizeZip.match(/(.*[\/\\]([^\/\\]+))_unzip/);
    const matchForFolder = fileInsizeZip.match(/(.*[\/\\]([^\/\\]+))/);
    if (matchForFileInsideZip) {
      return {
        folderToZip: matchForFileInsideZip[0],
        zipToWrite: matchForFileInsideZip[1],
        resourceName: matchForFileInsideZip[2]
      };
    } else if (matchForZipFolder) {
      return {
        folderToZip: matchForZipFolder[0],
        zipToWrite: matchForZipFolder[1],
        resourceName: matchForZipFolder[2]
      };
    } else if (matchForFolder) {
      return {
        folderToZip: matchForFolder[0],
        zipToWrite: matchForFolder[1],
        resourceName: matchForFolder[2]
      };
    } else {
      return null;
    }
  }

  constructor(public salesforceAPI: SalesforceAPI, public record: ISalesforceApexComponentRecord) {}

  public extract(res: { body: zlib.Gunzip | PassThrough }, config: SalesforceConfig) {
    if (this.record != null) {
      return new Promise<ExtractFolderResult>((resolve, reject) => {
        const standardPath = SalesforceLocalFileManager.getStandardPathOfFileLocally(
          this.record.Name,
          SalesforceResourceType.STATIC_RESOURCE_FOLDER,
          this.salesforceAPI.config
        );

        const standardPathUnzip = SalesforceLocalFileManager.getStandardPathOfFileLocally(
          this.record.Name,
          SalesforceResourceType.STATIC_RESOURCE_FOLDER_UNZIP,
          this.salesforceAPI.config
        );

        if (standardPath) {
          const parsedPath = parsePath(standardPath);
          mkdirp.sync(parsedPath.dir);

          res.body.pipe(fs.createWriteStream(standardPath)).on('finish', async () => {
            if (standardPathUnzip) {
              const zip = <IAdmZip>new AdmZip(standardPath);

              if (!fs.existsSync(standardPathUnzip)) {
                await this.extractNewFolder(zip, standardPathUnzip);

                const allEntries = zip.getEntries();
                allEntries.forEach(entry => {
                  this.saveContentInDiffStore(entry, standardPathUnzip);
                });

                resolve(ExtractFolderResult.NEW_FOLDER);
              } else {
                const allEntries: Array<Promise<void | DiffResult | boolean>> = zip.getEntries().map(entry => {
                  return this.extractSingleFile(entry, standardPathUnzip, config);
                });

                await Promise.all(allEntries);
                resolve(ExtractFolderResult.FOLDER_MERGE);
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
    SalesforceAPI.saveComponentInDiffStore(
      entry.entryName,
      SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP,
      SalesforceResourceLocation.DIST,
      entry.getData().toString()
    );

    const localContent = SalesforceLocalFileManager.getContentOfFileLocally(path.join(pathToUnzip, entry.entryName));
    if (localContent) {
      SalesforceAPI.saveComponentInDiffStore(
        entry.entryName,
        SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP,
        SalesforceResourceLocation.LOCAL,
        localContent
      );
    }
  }

  private extractSingleFile(entry: ISalesforceStaticResourceFromZip, pathToUnzip: string, config: SalesforceConfig) {
    this.saveContentInDiffStore(entry, pathToUnzip);
    const localContent = SalesforceLocalFileManager.getContentOfFileLocally(path.join(pathToUnzip, entry.entryName));

    if (entry.isDirectory) {
      return Promise.resolve();
    } else if (localContent) {
      return SalesforceLocalFileManager.diffComponentWithLocalVersion(
        entry.entryName,
        SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP,
        config,
        path.join(pathToUnzip, entry.entryName)
      );
    } else {
      return SalesforceLocalFileManager.saveFile(
        entry.entryName,
        entry.getData().toString(),
        path.join(pathToUnzip, entry.entryName)
      );
    }
  }
}
