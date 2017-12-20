import * as vscode from 'vscode';
import * as _ from 'lodash';

import { ReferenceDocumentation, IDocumentation } from '../referenceDocumentation';
import {
  getComponentAtPosition,
  getOptionAtPosition,
  doCompleteScanOfCurrentSymbol,
  getResultTemplateAtPosition,
  getResultTemplateAttributeAtPosition,
  IScanOfAttributeValue,
  getResultTemplateComponentAtPosition,
  getResultTemplateComponentOptionAtPosition
} from '../documentService';
import { ComponentOptionValues } from '../completionItems/componentOptionValues';
import { ComponentOption } from '../completionItems/componentOption';
import { ResultTemplate } from '../completionItems/resultTemplate';

export class HTMLCompletionItemProvider implements vscode.CompletionItemProvider {
  constructor(public referenceDocumentation: ReferenceDocumentation) {}

  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Thenable<vscode.CompletionItem[]> {
    return new Promise<vscode.CompletionItem[]>(async (resolve, reject) => {
      let completionItems: vscode.CompletionItem[] = [];

      const currentOptionComponentInsideResultTemplate = await getResultTemplateComponentOptionAtPosition(
        this.referenceDocumentation,
        position,
        document
      );
      if (currentOptionComponentInsideResultTemplate) {
        completionItems = completionItems.concat(
          this.provideCompletionsForComponentOptionsValues(currentOptionComponentInsideResultTemplate)
        );
        resolve(completionItems);
        return;
      }

      const currentComponentInsideResultTemplate = await getResultTemplateComponentAtPosition(
        this.referenceDocumentation,
        position,
        document
      );
      if (currentComponentInsideResultTemplate) {
        completionItems = completionItems.concat(
          this.provideCompletionCompletionsForComponentOptions(currentComponentInsideResultTemplate, position, document)
        );
        resolve(completionItems);
        return;
      }

      const currentOptionForComponentOutsideOfResultTemplate = getOptionAtPosition(
        this.referenceDocumentation,
        position,
        document
      );
      if (currentOptionForComponentOutsideOfResultTemplate) {
        completionItems = completionItems.concat(
          this.provideCompletionsForComponentOptionsValues(currentOptionForComponentOutsideOfResultTemplate)
        );
        resolve(completionItems);
        return;
      }

      const currentOptionForResultTemplate = getResultTemplateAttributeAtPosition(position, document);
      if (currentOptionForResultTemplate) {
        completionItems = completionItems.concat(
          this.provideCompletionsForResultTemplateAttribute(currentOptionForResultTemplate)
        );
        resolve(completionItems);
        return;
      }

      const currentComponent = getComponentAtPosition(this.referenceDocumentation, position, document);
      if (currentComponent) {
        completionItems = completionItems.concat(
          this.provideCompletionCompletionsForComponentOptions(currentComponent, position, document)
        );
        resolve(completionItems);
        return;
      }

      const currentResultTemplate = getResultTemplateAtPosition(position, document);
      if (currentResultTemplate) {
        completionItems = completionItems.concat(this.provideCompletionsForResultTemplate());
        resolve(completionItems);
        return;
      }

      // TODO completions on component names
      resolve(completionItems);
    });
  }

  private provideCompletionsForComponentOptionsValues(currentOption: IDocumentation) {
    return new ComponentOptionValues(currentOption).getCompletions();
  }

  private provideCompletionsForResultTemplateAttribute(currentResultTemplateAttribute: IScanOfAttributeValue) {
    return new ResultTemplate().getCompletionsForAttributesValues(currentResultTemplateAttribute);
  }

  private provideCompletionCompletionsForComponentOptions(
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
