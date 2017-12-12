import * as vscode from 'vscode';
import { DiffContentStore } from '../diffContentStore';
import { SalesforceResourceLocation, SalesforceAPI } from './salesforceAPI';
import {
  getExtensionFromTypeOrPath,
  filetypesDefinition,
  SalesforceResourceType
} from '../filetypes/filetypesConverter';
import * as _ from 'lodash';

export class SalesforceResourcePreviewContentProvider {
  public static scheme = 'coveocodesalesforceresource';

  public static getPreviewUri(
    componentName: string,
    type: SalesforceResourceType,
    location: SalesforceResourceLocation,
    filePath: string
  ): vscode.Uri {
    const matchOnSalesforceResourceType = _.find(
      filetypesDefinition,
      definition => definition.salesforceResourceType == type
    );
    const suffix =
      matchOnSalesforceResourceType && matchOnSalesforceResourceType.suffix ? matchOnSalesforceResourceType.suffix : '';

    return vscode.Uri.parse(
      `${SalesforceResourcePreviewContentProvider.scheme}://location-${encodeURIComponent(
        location.replace(/[\/\.]/g, '')
      )}/key-${encodeURIComponent(componentName.replace(/[\/\.]/g, '') + suffix)}/type-${type.replace(
        /[\/\.]/g,
        ''
      )}/preview.${getExtensionFromTypeOrPath(type, filePath)}?tstamp=${Date.now()}&localPath=${encodeURIComponent(
        filePath
      )}`
    );
  }

  public static getComponentNameFromPreviewUri(uri: vscode.Uri): string | undefined {
    const regex = /key-([^\/]+)/;
    const results = regex.exec(uri.path);
    if (results) {
      return decodeURIComponent(results[1]);
    }
    return undefined;
  }

  public static getLocalFilePathFromPreviewUri(uri: vscode.Uri): string | undefined {
    const regex = /localpath-([^\/]+)/;
    const results = regex.exec(uri.path);
    if (results) {
      return decodeURIComponent(results[1]);
    }
    return undefined;
  }

  public static getComponentTypeFromPreviewUri(uri: vscode.Uri): SalesforceResourceType | undefined {
    const regex = /type-([^\/]+)/;
    const results = regex.exec(uri.path);
    if (results) {
      const decoded = decodeURIComponent(results[1]);
      return decoded as SalesforceResourceType;
    }
    return undefined;
  }

  public static getLocationFromPreviewUri(uri: vscode.Uri): SalesforceResourceLocation | undefined {
    const regex = /location-([^\/]+)/;
    const results = regex.exec(uri.authority);
    if (results) {
      if (decodeURIComponent(results[1]) == SalesforceResourceLocation.DIST) {
        return SalesforceResourceLocation.DIST;
      } else if (decodeURIComponent(results[1]) == SalesforceResourceLocation.LOCAL) {
        return SalesforceResourceLocation.LOCAL;
      } else {
        return undefined;
      }
    }
    return undefined;
  }

  public static getQueryParameterByName(name: string, uri: vscode.Uri): string | undefined {
    name = name.replace(/[\[\]]/g, '\\$&');

    const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
    const results = regex.exec(uri.query);

    if (!results) {
      return undefined;
    }
    if (!results[2]) {
      return '';
    }
    return decodeURIComponent(results[2]);
  }

  public provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
    const keyValue = SalesforceResourcePreviewContentProvider.getComponentNameFromPreviewUri(uri);
    const locationAsString = SalesforceResourcePreviewContentProvider.getLocationFromPreviewUri(uri);
    const type = SalesforceResourcePreviewContentProvider.getComponentTypeFromPreviewUri(uri);
    let location: SalesforceResourceLocation;
    if (locationAsString && locationAsString == SalesforceResourceLocation.LOCAL) {
      location = SalesforceResourceLocation.LOCAL;
    } else {
      location = SalesforceResourceLocation.DIST;
    }

    if (keyValue && type) {
      return DiffContentStore.get(SalesforceAPI.getDiffStoreScheme(keyValue, type, location));
    }

    return '';
  }
}
