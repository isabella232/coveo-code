import { ISalesforceResourceAPI, SalesforceAPI, SalesforceResourceLocation } from './salesforceAPI';
import { ConnectionExtends } from '../definitions/jsforce';
import { SalesforceResourceType } from '../filetypes/filetypesConverter';
import { SalesforceLocalFileManager, DiffResult } from './salesforceLocalFileManager';
import * as vscode from 'vscode';

export interface ISalesforceApexComponentRecord {
  Name: string;
  Markup: string;
  ContentType?: string;
}

export class SalesforceApexComponentAPI implements ISalesforceResourceAPI {
  public constructor(public connection: ConnectionExtends) {}

  public async listAllRessources() {
    const allRecords: ISalesforceApexComponentRecord[] = await this.connection
      .sobject('ApexComponent')
      .find({})
      .execute({ autoFetch: true })
      .then((records: ISalesforceApexComponentRecord[]) => records);

    return allRecords;
  }

  public async extract(record: ISalesforceApexComponentRecord, salesforceAPI: SalesforceAPI) {
    SalesforceAPI.saveComponentInDiffStore(
      record.Name,
      SalesforceResourceType.APEX_COMPONENT,
      SalesforceResourceLocation.DIST,
      record.Markup
    );

    const outcome = await SalesforceLocalFileManager.diffComponentWithLocalVersion(
      record.Name,
      SalesforceResourceType.APEX_COMPONENT,
      salesforceAPI.config
    );

    const path = SalesforceLocalFileManager.getStandardPathOfFileLocally(
      record.Name,
      SalesforceResourceType.APEX_COMPONENT,
      salesforceAPI.config
    );

    if (outcome == DiffResult.FILE_DOES_NOT_EXIST_LOCALLY && path) {
      await SalesforceLocalFileManager.saveFile(record.Name, record.Markup, path);
      const doc = await vscode.workspace.openTextDocument(path);
      await vscode.window.showTextDocument(doc);
    }

    return outcome;
  }
}
