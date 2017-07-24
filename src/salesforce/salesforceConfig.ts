import * as vscode from 'vscode';
import { l } from '../strings/Strings';

export class SalesforceConfig {
  private orgConfig: vscode.WorkspaceConfiguration;
  private localConfig: vscode.WorkspaceConfiguration;
  constructor() {
    this.orgConfig = vscode.workspace.getConfiguration('coveocode.salesforce.organization');
    this.localConfig = vscode.workspace.getConfiguration('coveocode.salesforce.local');
  }
  public doValidation(silent = true): boolean {
    let isValid = true;
    const showWarningMessage = (section: string) => {
      if (!silent) {
        vscode.window.showWarningMessage(l('SalesforceMissingConfig', section));
      }
    };

    if (this.orgConfig) {
      const password = this.getPassword();
      if (password == undefined) {
        isValid = false;
        showWarningMessage('password');
      }
      const username = this.getUsername();
      if (username == undefined) {
        isValid = false;
        showWarningMessage('username');
      }
      const securityToken = this.getSecurityToken();
      if (securityToken == undefined) {
        isValid = false;
        showWarningMessage('securityToken');
      }
    }
    return isValid;
  }

  public getPassword() {
    return this.orgConfig.get<string>('password');
  }

  public getUsername() {
    return this.orgConfig.get<string>('username');
  }

  public getSecurityToken() {
    return this.orgConfig.get<string>('securityToken');
  }

  public getOrganizationUrl() {
    return this.orgConfig.get<string>('loginUrl') || 'https://login.salesforce.com/';
  }

  public getOutputFolder() {
    return this.localConfig.get<string>('outputFolder') || './coveocode/salesforce';
  }
}
