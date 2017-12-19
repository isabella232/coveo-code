import { ISalesforceRecord, SalesforceAPI, SalesforceResourceLocation, ISalesforceResourceAPI } from './salesforceAPI';
import { SalesforceResourceType, filetypesDefinition } from '../filetypes/filetypesConverter';
import * as jsforce from 'jsforce';
import * as _ from 'lodash';
import { SalesforceAura } from './salesforceAuraFolder';
import * as vscode from 'vscode';
import { l } from '../strings/Strings';

export interface ISalesforceAuraDefinitionBundle extends ISalesforceRecord {
  DeveloperName: string;
  Language: string;
  MasterLabel: string;
  NameSpacePrefix: string;
  Description: string;
}

export interface ISalesforceAuraDefinition extends ISalesforceRecord {
  Source: string;
  DefType: SalesforceResourceType;
}

export class SalesforceAuraAPI implements ISalesforceResourceAPI {
  public constructor(public connection: jsforce.Connection) {}

  public async retrieveLightningBundle(name: string, allRecords?: ISalesforceAuraDefinitionBundle[]) {
    allRecords = allRecords || (await this.listAllRessources());

    const recordSelected = _.find(allRecords, record => record.MasterLabel == name);

    if (recordSelected) {
      const fetchAuraComponent = this.connection
        .sobject('AuraDefinition')
        .find({ AuraDefinitionBundleId: recordSelected.Id })
        .execute({ autoFetch: true })
        .then((records: any) => records);

      await vscode.window.setStatusBarMessage(l('SalesforceListingLightning'), fetchAuraComponent);
      const matchingAuraComponents: ISalesforceAuraDefinition[] = await fetchAuraComponent;
      matchingAuraComponents.forEach(fileInBundle => {
        const salesforceResourceType = SalesforceAura.coerceApiNameToEnum(fileInBundle);
        const matchOnSalesforceResourceType = _.find(
          filetypesDefinition,
          definition => definition.salesforceResourceType == salesforceResourceType
        );
        const suffix =
          matchOnSalesforceResourceType && matchOnSalesforceResourceType.suffix
            ? matchOnSalesforceResourceType.suffix
            : '';
        SalesforceAPI.saveComponentInDiffStore(
          `${name}${suffix}`,
          salesforceResourceType,
          SalesforceResourceLocation.DIST,
          fileInBundle.Source
        );
      });

      return matchingAuraComponents;
    }
    return null;
  }

  public async listAllRessources(): Promise<ISalesforceAuraDefinitionBundle[]> {
    const listAllRessources = this.connection
      .sobject('AuraDefinitionBundle')
      .find({})
      .execute({ autoFetch: true })
      .then((records: ISalesforceAuraDefinitionBundle[]) => records);
    await vscode.window.setStatusBarMessage(l('SalesforceListingLightning'), listAllRessources);
    return await listAllRessources;
  }
}
