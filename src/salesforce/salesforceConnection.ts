import { SalesforceConfig } from './salesforceConfig';
import * as jsforce from 'jsforce';
import * as vscode from 'vscode';
import { l } from '../strings/Strings';

export class SalesforceConnection {
  private static validConnection: jsforce.Connection | undefined;

  private connection: jsforce.Connection;
  constructor(public config: SalesforceConfig) {
    if (config.doValidation()) {
      this.connection = new jsforce.Connection({
        loginUrl: config.getOrganizationUrl()
      });
    }
  }

  public login(): Promise<jsforce.Connection> {
    if (SalesforceConnection.validConnection) {
      return Promise.resolve(SalesforceConnection.validConnection);
    } else {
      return <Promise<jsforce.Connection>>vscode.window.withProgress(
        {
          title: l('SalesforceConnection'),
          location: vscode.ProgressLocation.Window
        },
        (progress): Promise<jsforce.Connection> => {
          const username = this.config.getUsername();
          const password = this.config.getPassword();
          const securityToken = this.config.getSecurityToken();
          if (username && password) {
            progress.report({ message: l('SaleforceConnecting') });
            return this.connection.login(username, password + securityToken).then(userInfo => {
              SalesforceConnection.validConnection = this.connection;
              return SalesforceConnection.validConnection;
            });
          } else {
            return Promise.reject(l('SalesforceInvalidLoginConfig'));
          }
        }
      );
    }
  }

  public invalidateConnection() {
    if (SalesforceConnection.validConnection) {
      SalesforceConnection.validConnection.logout();
    }
    SalesforceConnection.validConnection = undefined;
  }
}
