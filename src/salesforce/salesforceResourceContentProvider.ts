import * as vscode from 'vscode';
import { DiffContentStore } from '../diffContentStore';

export enum SalesforceResourceLocation {
  LOCAL = 'local',
  DIST = 'dist'
}

export class SalesforceResourceContentProvider implements vscode.TextDocumentContentProvider {
  public static scheme = 'coveocodesalesforceresource';

  public static getDiffStoreScheme(componentName: string, location: SalesforceResourceLocation) {
    return `${SalesforceResourceContentProvider.scheme}:${location}:${componentName}`;
  }

  public static getUri(componentName: string, location: SalesforceResourceLocation): vscode.Uri {
    return vscode.Uri.parse(
      `${SalesforceResourceContentProvider.scheme}://location:${location}/key:${componentName}.cmp`
    );
  }

  public static getComponentNameFromUri(uri: vscode.Uri): string | undefined {
    const regex = /key:(.+).cmp/;
    const results = regex.exec(uri.path);
    if (results) {
      return results[1];
    }
    return undefined;
  }

  public static getComponentNameFromFilePath(path: vscode.Uri): string | undefined {
    if (path.fsPath) {
      const regex = /.+\/(.+)\.cmp/;
      const results = regex.exec(path.fsPath);
      if (results) {
        return results[1];
      }
    }
    return undefined;
  }

  public static getLocationFromUri(uri: vscode.Uri): SalesforceResourceLocation | undefined {
    const regex = /location:(.+)/;
    const results = regex.exec(uri.authority);
    if (results) {
      if (results[1] == SalesforceResourceLocation.DIST) {
        return SalesforceResourceLocation.DIST;
      } else if (results[1] == SalesforceResourceLocation.LOCAL) {
        return SalesforceResourceLocation.LOCAL;
      } else {
        return undefined;
      }
    }
    return undefined;
  }

  public provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
    const keyValue = SalesforceResourceContentProvider.getComponentNameFromUri(uri);
    const locationAsString = SalesforceResourceContentProvider.getLocationFromUri(uri);
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
