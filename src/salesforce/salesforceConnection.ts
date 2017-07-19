import { SalesforceConfig } from './salesforceConfig';
import * as jsforce from 'jsforce';
import * as vscode from 'vscode';

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
      const username = this.config.getUsername();
      const password = this.config.getPassword();
      const securityToken = this.config.getSecurityToken();
      if (username && password) {
        return this.connection.login(username, password + securityToken).then(userInfo => {
          vscode.window.setStatusBarMessage(
            `Connected to Salesforce as ${username} to organization ${userInfo.organizationId}`
          );
          SalesforceConnection.validConnection = this.connection;
          return SalesforceConnection.validConnection;
        });
      } else {
        return Promise.reject('Invalid salesforce login configuration');
      }
    }
  }

  public invalidateConnection() {
    if (SalesforceConnection.validConnection) {
      SalesforceConnection.validConnection.logout();
    }
    SalesforceConnection.validConnection = undefined;
  }
}
