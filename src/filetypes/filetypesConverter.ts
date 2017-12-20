const parsePath = require('parse-filepath');
import * as path from 'path';
import * as _ from 'lodash';

export enum SalesforceResourceType {
  APEX_COMPONENT = 'ApexComponent',
  APEX_PAGE = 'ApexPage',
  STATIC_RESOURCE_SIMPLE = 'StaticResourceSimple',
  STATIC_RESOURCE_FOLDER = 'StaticResourceFolder',
  STATIC_RESOURCE_FOLDER_UNZIP = 'StaticResourceFolderUnzip',
  STATIC_RESOURCE_INSIDE_UNZIP = 'StaticResourceInsideUnzip',
  AURA_APPLICATION = 'AuraApplication',
  AURA_CONTROLLER = 'AuraController',
  AURA_COMPONENT = 'AuraComponent',
  AURA_EVENT = 'AuraEvent',
  AURA_HELPER = 'AuraHelper',
  AURA_INTERFACE = 'AuraInterface',
  AURA_RENDERER = 'AuraRenderer',
  AURA_STYLE = 'AuraStyle',
  AURA_PROVIDER = 'AuraProvider',
  AURA_MODEL = 'AuraModel',
  AURA_TESTSUITE = 'AuraTestSuite',
  AURA_DOCUMENTATION = 'AuraDocumentation',
  AURA_TOKENS = 'AuraTokens',
  AURA_DESIGN = 'AuraDesign',
  AURA_SVG = 'AuraSvg'
}

export interface IFileTypeDefinition {
  extension?: string;
  contentType: string | undefined;
  salesforceResourceType: SalesforceResourceType;
  subfolder: string;
  suffix?: string;
  metadataApiName: string;
  matcher?: (path: string) => boolean;
}

export const filetypesDefinition: IFileTypeDefinition[] = [
  {
    extension: 'js',
    contentType: 'text/javascript',
    salesforceResourceType: SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
    subfolder: 'staticresources',
    metadataApiName: 'StaticResource'
  },
  {
    extension: 'html',
    contentType: 'text/html',
    salesforceResourceType: SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
    subfolder: 'staticresources',
    metadataApiName: 'StaticResource'
  },
  {
    extension: 'css',
    contentType: 'text/css',
    salesforceResourceType: SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
    subfolder: 'staticresources',
    metadataApiName: 'StaticResource'
  },
  {
    extension: 'ejs',
    contentType: 'text/javascript',
    salesforceResourceType: SalesforceResourceType.STATIC_RESOURCE_SIMPLE,
    subfolder: 'staticresources',
    metadataApiName: 'StaticResource'
  },
  {
    extension: 'component',
    contentType: undefined,
    salesforceResourceType: SalesforceResourceType.APEX_COMPONENT,
    subfolder: `pages${path.sep}sfdc`,
    metadataApiName: 'ApexComponent'
  },
  {
    extension: 'page',
    contentType: undefined,
    salesforceResourceType: SalesforceResourceType.APEX_PAGE,
    subfolder: `pages${path.sep}sfdc`,
    metadataApiName: 'ApexPage'
  },
  {
    extension: 'zip',
    contentType: 'application/zip',
    salesforceResourceType: SalesforceResourceType.STATIC_RESOURCE_FOLDER,
    subfolder: 'staticresources',
    metadataApiName: 'StaticResource'
  },
  {
    extension: 'zip',
    contentType: 'application/zip',
    salesforceResourceType: SalesforceResourceType.STATIC_RESOURCE_FOLDER_UNZIP,
    subfolder: 'staticresources',
    metadataApiName: 'StaticResource'
  },
  {
    contentType: 'application/zip',
    salesforceResourceType: SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP,
    subfolder: 'staticresources',
    metadataApiName: 'StaticResource',
    matcher: filePath => filePath.indexOf('_unzip') != -1
  },
  {
    extension: 'app',
    contentType: undefined,
    salesforceResourceType: SalesforceResourceType.AURA_APPLICATION,
    subfolder: 'aura',
    metadataApiName: 'AuraDefinition'
  },
  {
    extension: 'js',
    contentType: 'text/javascript',
    suffix: 'Controller',
    salesforceResourceType: SalesforceResourceType.AURA_CONTROLLER,
    subfolder: 'aura',
    metadataApiName: 'AuraDefinition'
  },
  {
    extension: 'cmp',
    contentType: undefined,
    salesforceResourceType: SalesforceResourceType.AURA_COMPONENT,
    subfolder: 'aura',
    metadataApiName: 'AuraDefinition'
  },
  {
    extension: 'evt',
    contentType: undefined,
    salesforceResourceType: SalesforceResourceType.AURA_EVENT,
    subfolder: 'aura',
    metadataApiName: 'AuraDefinition'
  },
  {
    extension: 'js',
    contentType: 'text/javascript',
    suffix: 'Helper',
    salesforceResourceType: SalesforceResourceType.AURA_HELPER,
    subfolder: 'aura',
    metadataApiName: 'AuraDefinition'
  },
  {
    extension: 'js',
    contentType: 'text/javascript',
    suffix: 'Renderer',
    salesforceResourceType: SalesforceResourceType.AURA_RENDERER,
    subfolder: 'aura',
    metadataApiName: 'AuraDefinition'
  },
  {
    extension: 'css',
    contentType: 'text/css',
    salesforceResourceType: SalesforceResourceType.AURA_STYLE,
    subfolder: 'aura',
    metadataApiName: 'AuraDefinition'
  },
  {
    extension: 'design',
    contentType: undefined,
    salesforceResourceType: SalesforceResourceType.AURA_DESIGN,
    subfolder: 'aura',
    metadataApiName: 'AuraDefinition'
  },
  {
    extension: 'svg',
    contentType: undefined,
    salesforceResourceType: SalesforceResourceType.AURA_SVG,
    subfolder: 'aura',
    metadataApiName: 'AuraDefinition'
  },
  {
    extension: 'auradoc',
    contentType: undefined,
    salesforceResourceType: SalesforceResourceType.AURA_DOCUMENTATION,
    subfolder: 'aura',
    metadataApiName: 'AuraDefinition'
  }
];

export const getExtensionFromTypeOrPath = (type: SalesforceResourceType, filePath: string) => {
  if (
    type == SalesforceResourceType.STATIC_RESOURCE_SIMPLE ||
    type == SalesforceResourceType.STATIC_RESOURCE_INSIDE_UNZIP
  ) {
    return parsePath(filePath).extname.replace(/\./, '');
  } else {
    const definition = _.find(filetypesDefinition, def => def.salesforceResourceType == type);
    if (definition) {
      return definition.extension;
    }
  }

  return undefined;
};
