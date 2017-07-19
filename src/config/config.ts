import * as vscode from 'vscode';
import { SalesforceConfig } from '../salesforce/salesforceConfig';
import { SalesforceConnection } from '../salesforce/salesforceConnection';

export class Config {
  public salesforceConfig: SalesforceConfig;
  constructor() {
    this.salesforceConfig = new SalesforceConfig();
  }

  public tryConnecting() {
    return this.tryConnectingToSalesforce();
  }

  public tryConnectingToSalesforce() {
    if (this.salesforceConfig.doValidation()) {
      return new SalesforceConnection(this.salesforceConfig).login();
    } else {
      this.salesforceConfig.doValidation(false);
      return Promise.reject('Salesforce configuration is invalid');
    }
  }
}
