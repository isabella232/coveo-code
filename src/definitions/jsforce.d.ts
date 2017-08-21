/* tslint:disable */
import * as jsforce from 'jsforce';

export interface IMetadataForComponent {
  apiVersion: number;
  fullName: string;
  label: string;
  content?: string;
  Body?: string;
}

export interface IMedataUpsertResult {
  created: boolean;
  fullName: string;
  success: boolean;
  errors: {
    fields: string;
    message: string;
    statusCode: string;
  };
}

export class MetadataActions {
  public update(resource: string, metadata: IMetadataForComponent, callback?: () => any): Promise<any>;
  public upsert(resource: string, metadata: any, callback?: () => any): Promise<IMedataUpsertResult>;
  public read(resource: string, names: string[]): Promise<any>;
}

export class ConnectionExtends extends jsforce.Connection {
  public metadata: MetadataActions;
  public query(SOQL: string): Promise<any>;
  public apex: any;
  public instanceUrl: string;
  accessToken: string;
}
