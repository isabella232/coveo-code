import * as _ from 'lodash';
import * as vscode from 'vscode';

interface IRawComponentComment {
  name: string;
  comment: string;
}

export interface IDocumentation extends IRawComponentComment {
  options: IRawComponentComment[];
}

const documentationJSON: IRawComponentComment[] = require('coveo-search-ui/bin/docgen/docgen.json');

export class ReferenceDocumentation {
  private static documentations: { [component: string]: IDocumentation };

  constructor() {
    if (ReferenceDocumentation.documentations == null) {
      ReferenceDocumentation.documentations = {};
      this.fillTree();
    }
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

  private fillTree() {
    const formattedDocumentations = _.chain(documentationJSON)
      .filter((doc: IRawComponentComment) => {
        return this.isComponent(doc);
      })
      .map((doc: IRawComponentComment) => {
        return {
          name: doc.name,
          comment: doc.comment,
          options: []
        };
      })
      .value();

    formattedDocumentations.forEach(
      (formattedDocumentation: IDocumentation) => {
        ReferenceDocumentation.documentations[
          formattedDocumentation.name
        ] = formattedDocumentation;

        documentationJSON.forEach((rawComment: IRawComponentComment) => {
          const isOption = this.isComponentOption(
            formattedDocumentation,
            rawComment
          );
          if (isOption && isOption[1]) {
            const optFormatted: IRawComponentComment = {
              name: isOption[1],
              comment: rawComment.comment
            };
            ReferenceDocumentation.documentations[
              formattedDocumentation.name
            ].options.push(optFormatted);
          }
        });
      }
    );
  }

  private isComponent(doc: IRawComponentComment) {
    return /^[^.]+$/i.test(doc.name);
  }

  private isComponentOption(
    formattedDocumentation: IDocumentation,
    rawComment: IRawComponentComment
  ) {
    const regex: RegExp = new RegExp(
      `^${formattedDocumentation.name}\.options\.([a-zA-Z]+)$`,
      'i'
    );
    return rawComment.name.match(regex);
  }
}
