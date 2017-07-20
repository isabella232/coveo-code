import * as vscode from 'vscode';
import { DiffContentStore } from '../diffContentStore';

export enum SalesforceResourceLocation {
  LOCAL = 'local',
  DIST = 'dist'
}

export class SalesforceResourceContentProvider implements vscode.TextDocumentContentProvider {
  public static scheme = 'coveocodesalesforceresource';

  public static getDiffStoreScheme(key: string, location: SalesforceResourceLocation) {
    return `${SalesforceResourceContentProvider.scheme}:${location}:${key}`;
  }

  public static getUri(key: string, location: SalesforceResourceLocation): vscode.Uri {
    return vscode.Uri.parse(`${SalesforceResourceContentProvider.scheme}://location:${location}/key:${key}.cmp`);
  }

  public static getKeyFromUri(uri: vscode.Uri): string | undefined {
    const regex = /key:(.+).cmp/;
    const results = regex.exec(uri.path);
    if (results) {
      return results[1];
    }
    return undefined;
  }

  public static getTypeFromUri(uri: vscode.Uri): string | undefined {
    const regex = /location:(.+)/;
    const results = regex.exec(uri.authority);
    if (results) {
      return results[1];
    }
    return undefined;
  }

  public provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
    const keyValue = SalesforceResourceContentProvider.getKeyFromUri(uri);
    const locationAsString = SalesforceResourceContentProvider.getTypeFromUri(uri);
    let location: SalesforceResourceLocation;
    if (locationAsString && locationAsString == SalesforceResourceLocation.LOCAL) {
      location = SalesforceResourceLocation.LOCAL;
    } else {
      location = SalesforceResourceLocation.DIST;
    }

    if (keyValue) {
      return DiffContentStore.get(SalesforceResourceContentProvider.getDiffStoreScheme(keyValue, location));
    }

    return '';
  }
}
