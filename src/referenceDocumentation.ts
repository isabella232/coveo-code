import * as _ from 'lodash';
import * as vscode from 'vscode';

export interface IDocumentation {
  name: string;
  comment: string;
  type?: string;
  constrainedValues?: string[];
  options: IDocumentation[];
}

const documentationJSON: { [component: string]: IDocumentation } = require('../data/documentation.json');

export class ReferenceDocumentation {
  private static documentations: { [component: string]: IDocumentation };

  constructor() {
    if (ReferenceDocumentation.documentations == null) {
      ReferenceDocumentation.documentations = documentationJSON;
    }
  }

  public static camelCaseToHyphen(optionName: string) {
    const camelCaseToHyphenRegex = /([A-Z])|\W+(\w)/g;
    return `data-${optionName.replace(camelCaseToHyphenRegex, '-$1$2').toLowerCase()}`;
  }

  public getComponent(symbol: vscode.SymbolInformation): IDocumentation {
    const allComponents = _.keys(ReferenceDocumentation.documentations);
    const componentFound = _.find(allComponents, (component: string) => {
      if (symbol.name) {
        return symbol.name.indexOf(component) != -1;
      }
      return false;
    });
    if (componentFound) {
      return ReferenceDocumentation.documentations[componentFound];
    } else {
      return null;
    }
  }

  private getFromTree(name: string): IDocumentation {
    if (ReferenceDocumentation.documentations[name] != null) {
      return ReferenceDocumentation.documentations[name];
    }
    const withoutCoveo = name.replace('Coveo', '');
    if (ReferenceDocumentation.documentations[withoutCoveo] != null) {
      return ReferenceDocumentation.documentations[withoutCoveo];
    }
    return null;
  }
}
