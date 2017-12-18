import { ConnectionExtends } from '../definitions/jsforce';
import { ISalesforceApexComponentRecord, ISalesforceResourceAPI } from './salesforceAPI';

export class SalesforceVisualforcePageAPI implements ISalesforceResourceAPI {
  public constructor(public connection: ConnectionExtends) {}

  public async listAllRessources() {
    const allRecords: ISalesforceApexComponentRecord[] = await this.connection
      .sobject('ApexPage')
      .find({})
      .execute({ autoFetch: true })
      .then((records: ISalesforceApexComponentRecord[]) => records);

    return allRecords;
  }
}
