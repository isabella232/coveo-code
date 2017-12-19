import * as zlib from 'zlib';
import { PassThrough } from 'stream';
import { ConnectionExtends } from '../definitions/jsforce';
import { SalesforceAPI, SalesforceResourceLocation } from './salesforceAPI';
import * as _ from 'lodash';
import * as vscode from 'vscode';
import { SalesforceResourceType } from '../filetypes/filetypesConverter';
import { SalesforceLocalFileManager, DiffResult } from './salesforceLocalFileManager';
import { Gunzip } from 'zlib';
import { SalesforceStaticFolder } from './salesforceStaticFolder';
import { ISalesforceApexComponentRecord } from './salesforceApexComponentAPI';
import { l } from '../strings/Strings';
const fetch = require('node-fetch');

export interface ISalesforceStaticResourceRecord extends ISalesforceApexComponentRecord {
  Body: string;
  ContentType: string;
}

export class SalesforceStaticResourceAPI {
  public constructor(public connection: ConnectionExtends) {}

  public async listAllRessources() {
    const allRecords: Promise<ISalesforceStaticResourceRecord[]> = this.connection
      .sobject('StaticResource')
      .find()
      .execute({ autoFetch: true })
      .then((records: ISalesforceStaticResourceRecord[]) => records);
    vscode.window.setStatusBarMessage(l('SalesforceListingStaticResources'), allRecords);
    return await allRecords;
  }

  public async downloadResource(resourceRecord: any) {
    const res: Promise<{
      body: zlib.Gunzip | PassThrough;
    }> = fetch(`${this.connection.instanceUrl}${resourceRecord.Body || resourceRecord.attributes.url}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.connection.accessToken}`
      }
    });
    vscode.window.setStatusBarMessage(l('SalesforceDownloading'), res);
    return await res;
  }

  public async getResourceRecordByName(name: string) {
    const allRecords = await this.listAllRessources();
    return _.find(allRecords, record => record.Name == name);
  }

  public read(res: { body: zlib.Gunzip | PassThrough }): Promise<string> {
    return new Promise((resolve, reject) => {
      let content = '';
      res.body.on('data', (data: Uint8Array) => {
        content += data.toString();
      });
      res.body.on('finish', () => {
        resolve(content);
      });
      res.body.on('error', (err: any) => {
        reject(err);
      });
      res.body.read();
    });
  }

  public async extractLocally(
    resourceRecord: ISalesforceStaticResourceRecord,
    staticResourceData: { body: Gunzip | PassThrough },
    salesforceAPI: SalesforceAPI
  ) {
    if (resourceRecord.ContentType == 'application/zip') {
      return await new SalesforceStaticFolder(salesforceAPI, resourceRecord).extract(
        staticResourceData,
        salesforceAPI.config
      );
    } else {
      const content = await this.read(staticResourceData);

      SalesforceAPI.saveComponentInDiffStore(
        resourceRecord.Name,
        SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
        SalesforceResourceLocation.DIST,
        content
      );

      const outcome = await SalesforceLocalFileManager.diffComponentWithLocalVersion(
        resourceRecord.Name,
        SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
        salesforceAPI.config,
        SalesforceLocalFileManager.getStandardPathOfFileLocally(
          resourceRecord.Name,
          SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
          salesforceAPI.config,
          resourceRecord.ContentType
        )
      );

      if (outcome == DiffResult.FILE_DOES_NOT_EXIST_LOCALLY) {
        let contentType = '';
        if (resourceRecord.ContentType) {
          contentType = resourceRecord.ContentType;
        }

        const defaultPath = SalesforceLocalFileManager.getStandardPathOfFileLocally(
          resourceRecord.Name,
          SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
          salesforceAPI.config,
          contentType
        );
        if (defaultPath) {
          await SalesforceLocalFileManager.saveFile(resourceRecord.Name, content, defaultPath);
          const doc = await vscode.workspace.openTextDocument(defaultPath);
          await vscode.window.showTextDocument(doc);
        }
      }
      return Promise.resolve(outcome);
    }
  }
}
