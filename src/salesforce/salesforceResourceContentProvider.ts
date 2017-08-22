import * as vscode from 'vscode';
import { DiffContentStore } from '../diffContentStore';
import { SalesforceResourceLocation, SalesforceAPI } from './salesforceAPI';
import { ApexResourceType } from './salesforceResourceTypes';
export class SalesforceResourceContentProvider {
  public static scheme = 'coveocodesalesforceresource';

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

  public static getComponentTypeFromPreviewUri(uri: vscode.Uri): ApexResourceType | undefined {
    const regex = /type-([^\/]+)/;
    const results = regex.exec(uri.path);
    if (results) {
      const decoded = decodeURIComponent(results[1]);
      if (decoded == ApexResourceType.APEX_COMPONENT) {
        return ApexResourceType.APEX_COMPONENT;
      }
      if (decoded == ApexResourceType.APEX_PAGE) {
        return ApexResourceType.APEX_PAGE;
      }
      if (decoded == ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP) {
        return ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP;
      }
      return ApexResourceType.STATIC_RESOURCE_SIMPLE;
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
    const keyValue = SalesforceResourceContentProvider.getComponentNameFromPreviewUri(uri);
    const locationAsString = SalesforceResourceContentProvider.getLocationFromPreviewUri(uri);
    const type = SalesforceResourceContentProvider.getComponentTypeFromPreviewUri(uri);
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
