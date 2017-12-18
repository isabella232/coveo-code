import { ISalesforceRecord, SalesforceAPI, SalesforceResourceLocation } from './salesforceAPI';
import { SalesforceResourceType, filetypesDefinition } from '../filetypes/filetypesConverter';
import * as jsforce from 'jsforce';
import * as _ from 'lodash';
import { SalesforceAura } from './salesforceAuraFolder';

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

export class SalesforceAuraAPI {
  public constructor(public connection: jsforce.Connection) {}

  public async retrieveLightningBundle(name: string, allRecords?: ISalesforceAuraDefinitionBundle[]) {
    allRecords = allRecords || (await this.retrieveAllLightningBundles());

    const recordSelected = _.find(allRecords, record => record.MasterLabel == name);

    if (recordSelected) {
      const matchingAuraComponents: ISalesforceAuraDefinition[] = await this.connection
        .sobject('AuraDefinition')
        .find({ AuraDefinitionBundleId: recordSelected.Id })
        .execute({ autoFetch: true })
        .then((records: any) => records);

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

  public async retrieveAllLightningBundles(): Promise<ISalesforceAuraDefinitionBundle[]> {
    return await this.connection
      .sobject('AuraDefinitionBundle')
      .find({})
      .execute({ autoFetch: true })
      .then((records: ISalesforceAuraDefinitionBundle[]) => records);
  }
}
