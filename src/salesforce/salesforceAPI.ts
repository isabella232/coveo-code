import { SalesforceConnection } from './salesforceConnection';
import * as jsforce from 'jsforce';
import * as _ from 'lodash';
import { SalesforceConfig } from './salesforceConfig';
import * as vscode from 'vscode';
import * as write from 'write';

interface ISalesforceApexComponentRecord {
  Name: string;
  Markup: string;
}

export class SalesforceAPI {
  private config: SalesforceConfig;
  private salesforceConnection: SalesforceConnection;

  public constructor() {
    this.config = new SalesforceConfig();
    this.salesforceConnection = new SalesforceConnection(this.config);
  }

  public retrieveApexComponent() {
    this.salesforceConnection.login().then((connection: jsforce.Connection) => {
      connection
        .sobject('ApexComponent')
        .find({})
        .execute({ autoFetch: true })
        .then((records: ISalesforceApexComponentRecord[]) => {
          vscode.window
            .showQuickPick(_.map(records, record => record.Name), {
              ignoreFocusOut: true,
              placeHolder: `Please select the Apex component which contains the Coveo component to edit`,
              matchOnDetail: true,
              matchOnDescription: true
            })
            .then(selected => {
              if (selected) {
                const recordSelected = _.find(records, record => record.Name == selected);

                if (recordSelected && vscode.workspace.rootPath) {
                  const path = require('path').join(
                    vscode.workspace.rootPath,
                    this.config.getOutputFolder(),
                    `${recordSelected.Name}.cmp`
                  );
                  write(path, recordSelected.Markup);
                }
              }
            });
        });
    });
  }
}
