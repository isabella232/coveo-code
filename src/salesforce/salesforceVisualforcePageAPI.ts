import { ConnectionExtends } from '../definitions/jsforce';
import { ISalesforceResourceAPI, SalesforceAPI, SalesforceResourceLocation } from './salesforceAPI';
import { SalesforceResourceType } from '../filetypes/filetypesConverter';
import { SalesforceLocalFileManager, DiffResult } from './salesforceLocalFileManager';
import * as vscode from 'vscode';
import { ISalesforceApexComponentRecord } from './salesforceApexComponentAPI';
import { l } from '../strings/Strings';

export class SalesforceVisualforcePageAPI implements ISalesforceResourceAPI {
  public constructor(public connection: ConnectionExtends) {}

  public async listAllRessources() {
    const allRecords: Promise<ISalesforceApexComponentRecord[]> = this.connection
      .sobject('ApexPage')
      .find({})
      .execute({ autoFetch: true })
      .then((records: ISalesforceApexComponentRecord[]) => records);
    vscode.window.setStatusBarMessage(l('SalesforceListingApex'), allRecords);
    return await allRecords;
  }

  public async extract(record: ISalesforceApexComponentRecord, salesforceAPI: SalesforceAPI) {
    SalesforceAPI.saveComponentInDiffStore(
      record.Name,
      SalesforceResourceType.APEX_PAGE,
      SalesforceResourceLocation.DIST,
      record.Markup
    );

    const outcome = await SalesforceLocalFileManager.diffComponentWithLocalVersion(
      record.Name,
      SalesforceResourceType.APEX_PAGE,
      salesforceAPI.config
    );
    const path = SalesforceLocalFileManager.getStandardPathOfFileLocally(
      record.Name,
      SalesforceResourceType.APEX_PAGE,
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
