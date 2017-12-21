import * as _ from 'lodash';
import * as vscode from 'vscode';

export interface IDocumentation {
  name: string;
  comment: string;
  type?: string;
  constrainedValues?: string[];
  miscAttributes: {
    defaultValue?: string;
    required?: string;
  };
  options: IDocumentation[];
  isCoveoComponent: boolean;
}

const documentationJSON: {
  [component: string]: IDocumentation;
} = require('../data/documentation.json');

export class ReferenceDocumentation {
  private static documentations: { [component: string]: IDocumentation };
  private static documentationCache: { [symbol: string]: IDocumentation } = {};

  constructor() {
    if (ReferenceDocumentation.documentations == null) {
      ReferenceDocumentation.documentations = documentationJSON;
    }
  }

  public static camelCaseToHyphen(optionName: string) {
    const camelCaseToHyphenRegex = /([A-Z])|\W+(\w)/g;
    return `data-${optionName.replace(camelCaseToHyphenRegex, '-$1$2').toLowerCase()}`;
  }

  public getAllComponents(): IDocumentation[] | undefined {
    return _.filter(ReferenceDocumentation.documentations, doc => {
      return doc.isCoveoComponent;
    });
  }

  public getDocumentation(symbol: vscode.SymbolInformation): IDocumentation | undefined {
    if (!symbol.name) {
      return undefined;
    }
    // Try to hit cache which associate a symbol in the HTML document to the linked documentation node.
    // Otherwise, try to find any documentation that match the current HTML node, and add it to the cache.
    if (ReferenceDocumentation.documentationCache[symbol.name]) {
      return ReferenceDocumentation.documentationCache[symbol.name];
    }

    const allComponents = _.keys(ReferenceDocumentation.documentations);
    const regex = /[a-z-A-Z]*\.([a-z-A-Z]+)/;
    const componentFound = _.find(allComponents, (component: string) => {
      const matches = regex.exec(symbol.name);
      if (matches && matches[1]) {
        return `Coveo${component}` == matches[1];
      }
      return false;
    });

    if (componentFound) {
      ReferenceDocumentation.documentationCache[symbol.name] = ReferenceDocumentation.documentations[componentFound];
      return ReferenceDocumentation.documentationCache[symbol.name];
    } else {
      return undefined;
    }
  }
}
