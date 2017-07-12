import * as vscode from 'vscode';
import * as _ from 'lodash';
import { ReferenceDocumentation, IDocumentation } from '../referenceDocumentation';
import {
  fromDocumentToComponent,
  getCurrentSymbol,
  fromDocumentToComponentOption,
  doCompleteScanOfCurrentSymbol
} from '../documentService';
import { ComponentOptionValues } from '../completionItems/ComponentOptionValues';
import { ComponentOption } from '../completionItems/ComponentOption';

export class HTMLCompletionItemProvider implements vscode.CompletionItemProvider {
  constructor(public referenceDocumentation: ReferenceDocumentation) {}
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Thenable<vscode.CompletionItem[]> {
    return new Promise<vscode.CompletionItem[]>((resolve, reject) => {
      let completionItems: vscode.CompletionItem[] = [];

      const possibleCurrentOptionActive = fromDocumentToComponentOption(
        this.referenceDocumentation,
        position,
        document
      );

      if (possibleCurrentOptionActive) {
        completionItems = completionItems.concat(
          new ComponentOptionValues(possibleCurrentOptionActive).getCompletions()
        );
      } else {
        const currentComponent = fromDocumentToComponent(this.referenceDocumentation, position, document);
        if (currentComponent) {
          const optionsCompletions: vscode.CompletionItem[] = _.chain(currentComponent.options)
            .filter(option => {
              const completeScan = doCompleteScanOfCurrentSymbol(document, position);
              const existInScan = _.find(
                completeScan,
                scan => scan.attributeName == `${ReferenceDocumentation.camelCaseToHyphen(option.name)}`
              );
              return existInScan == null;
            })
            .map(option => new ComponentOption(option))
            .value();
          completionItems = completionItems.concat(optionsCompletions);
        }
      }
      resolve(completionItems);
    });
  }
}
