import * as _ from 'lodash';
import { ApexResourceType } from '../salesforce/salesforceResourceTypes';
const parsePath = require('parse-filepath');

export interface IFileTypeDefinition {
  extension: string;
  contentType: string | undefined;
  apexType: ApexResourceType;
}

const filetypesDefinition: IFileTypeDefinition[] = [
  {
    extension: 'js',
    contentType: 'text/javascript',
    apexType: ApexResourceType.STATIC_RESOURCE_SIMPLE
  },
  {
    extension: 'html',
    contentType: 'text/html',
    apexType: ApexResourceType.STATIC_RESOURCE_SIMPLE
  },
  {
    extension: 'css',
    contentType: 'text/css',
    apexType: ApexResourceType.STATIC_RESOURCE_SIMPLE
  },
  {
    extension: 'ejs',
    contentType: 'text/javascript',
    apexType: ApexResourceType.STATIC_RESOURCE_SIMPLE
  },
  {
    extension: 'cmp',
    contentType: undefined,
    apexType: ApexResourceType.APEX_COMPONENT
  },
  {
    extension: 'page',
    contentType: undefined,
    apexType: ApexResourceType.APEX_PAGE
  },
  {
    extension: 'zip',
    contentType: 'application/zip',
    apexType: ApexResourceType.STATIC_RESOURCE_FOLDER
  }
];

export const getExtensionFromContentType = (contentType: string) => {
  const definition = _.find(
    filetypesDefinition,
    def => (def.contentType ? def.contentType.toLowerCase() == contentType.toLowerCase() : false)
  );
  if (definition) {
    return definition.extension;
  }

  return undefined;
};

export const getContentTypeFromExtension = (extension: string) => {
  const definition = _.find(filetypesDefinition, def => def.extension.toLowerCase() == extension.toLowerCase());
  if (definition) {
    return definition.contentType;
  }

  return undefined;
};

export const getExtensionFromTypeOrPath = (type: ApexResourceType, filePath: string) => {
  if (type == ApexResourceType.STATIC_RESOURCE_SIMPLE || type == ApexResourceType.STATIC_RESOURCE_INSIDE_UNZIP) {
    return parsePath(filePath).extname.replace(/\./, '');
  } else {
    const definition = _.find(filetypesDefinition, def => def.apexType == type);
    if (definition) {
      return definition.extension;
    }
  }

  return undefined;
};
