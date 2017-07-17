import * as vscode from 'vscode';
import * as _ from 'lodash';
import { ReferenceDocumentation, IDocumentation } from '../referenceDocumentation';
import {
  getComponentAtPosition,
  getCurrentSymbol,
  getOptionAtPosition,
  doCompleteScanOfCurrentSymbol,
  getResultTemplateAtPosition,
  getResultTemplateAttributeAtPosition,
  IScanOfAttributeValue
} from '../documentService';
import { ComponentOptionValues } from '../completionItems/ComponentOptionValues';
import { ComponentOption } from '../completionItems/ComponentOption';
import { ResultTemplate } from '../completionItems/resultTemplate';

export class HTMLCompletionItemProvider implements vscode.CompletionItemProvider {
  constructor(public referenceDocumentation: ReferenceDocumentation) {}
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Thenable<vscode.CompletionItem[]> {
    return new Promise<vscode.CompletionItem[]>((resolve, reject) => {
      let completionItems: vscode.CompletionItem[] = [];

      const currentOption = getOptionAtPosition(this.referenceDocumentation, position, document);
      const currentOptionInResultTemplate = getResultTemplateAttributeAtPosition(position, document);
      const currentComponent = getComponentAtPosition(this.referenceDocumentation, position, document);
      const currentResultTemplate = getResultTemplateAtPosition(position, document);

      if (currentOption) {
        completionItems = completionItems.concat(this.provideCompletionsForComponentOptions(currentOption));
      } else if (currentOptionInResultTemplate) {
        completionItems = completionItems.concat(
          this.provideCompletionsForResultTemplateAttribute(currentOptionInResultTemplate)
        );
      } else if (currentComponent) {
        completionItems = completionItems.concat(
          this.providecompletionCompletionsForComponent(currentComponent, position, document)
        );
      } else if (currentResultTemplate) {
        completionItems = completionItems.concat(this.provideCompletionsForResultTemplate());
      }
      resolve(completionItems);
    });
  }

  private provideCompletionsForComponentOptions(currentOption: IDocumentation) {
    return new ComponentOptionValues(currentOption).getCompletions();
  }

  private provideCompletionsForResultTemplateAttribute(currentResultTemplateAttribute: IScanOfAttributeValue) {
    return new ResultTemplate().getCompletionsForAttributesValues(currentResultTemplateAttribute);
  }

  private providecompletionCompletionsForComponent(
    currentComponent: IDocumentation,
    position: vscode.Position,
    document: vscode.TextDocument
  ) {
    return _.chain(currentComponent.options)
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
  }

  private provideCompletionsForResultTemplate() {
    return new ResultTemplate().getCompletionsForAttributes();
  }
}
