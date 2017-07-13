import * as vscode from 'vscode';
import { IDocumentation, ReferenceDocumentation } from '../referenceDocumentation';
import * as htmlToText from 'html-to-text';
import * as _ from 'lodash';

interface ICompletionProvider {
  completionToUse: new (possibleValue: string[], optionDocumentation: IDocumentation) => vscode.CompletionItem;
  valuesToUse: string[];
}

export class ComponentOptionValues {
  private completionProvider: ICompletionProvider;
  constructor(public componentOptionDocumentation: IDocumentation) {
    this.completionProvider = this.determineCompletionProviderFromDocumentation();
  }

  public getCompletions(): vscode.CompletionItem[] {
    if (this.completionProvider.completionToUse == CompletionItemForOptions) {
      return this.completionProvider.valuesToUse.map(
        valueToUse => new this.completionProvider.completionToUse([valueToUse], this.componentOptionDocumentation)
      );
    } else {
      return [
        new this.completionProvider.completionToUse(
          this.completionProvider.valuesToUse,
          this.componentOptionDocumentation
        )
      ];
    }
  }

  private determineCompletionProviderFromDocumentation(): ICompletionProvider {
    if (this.componentOptionDocumentation.type) {
      return this.determineCompletionProviderFromType();
    }
    if (this.componentOptionDocumentation.constrainedValues) {
      return {
        completionToUse: CompletionItemForOptions,
        valuesToUse: this.componentOptionDocumentation.constrainedValues
      };
    }
    if (
      this.componentOptionDocumentation.miscAttributes &&
      this.componentOptionDocumentation.miscAttributes['defaultValue']
    ) {
      return {
        completionToUse: CompletionItemForOptionsWithExamples,
        valuesToUse: [this.componentOptionDocumentation.miscAttributes['defaultValue']]
      };
    }
    return {
      completionToUse: CompletionItemForOptionsWithExamples,
      valuesToUse: ['foo']
    };
  }

  private determineCompletionProviderFromType() {
    const padDefaultValueWithFakeValues = (fakeValues: string[]): string[] => {
      if (this.componentOptionDocumentation.miscAttributes['defaultValue']) {
        return _.uniq([this.componentOptionDocumentation.miscAttributes['defaultValue']].concat(fakeValues));
      }
      return fakeValues;
    };

    switch (this.componentOptionDocumentation.type.toLowerCase()) {
      case 'boolean':
        return {
          completionToUse: CompletionItemForOptions,
          valuesToUse: padDefaultValueWithFakeValues(['true', 'false'])
        };
      case 'string':
        return {
          completionToUse: CompletionItemForOptionsWithExamples,
          valuesToUse: padDefaultValueWithFakeValues(['foo', 'bar'])
        };
      case 'ifieldoption':
        return {
          completionToUse: CompletionItemForOptionsWithExamples,
          valuesToUse: padDefaultValueWithFakeValues(['@foo', '@bar'])
        };
      case 'number':
        return {
          completionToUse: CompletionItemForOptionsWithExamples,
          valuesToUse: padDefaultValueWithFakeValues(['1', '2', '3'])
        };
      case 'array':
        return {
          completionToUse: CompletionItemForOptionsWithExamples,
          valuesToUse: padDefaultValueWithFakeValues(['foo', 'foo,bar'])
        };
      default:
        return {
          completionToUse: CompletionItemForOptionsWithExamples,
          valuesToUse: padDefaultValueWithFakeValues(['foo'])
        };
    }
  }
}

class CompletionItemForOptions extends vscode.CompletionItem {
  constructor(public possibleValues: string[], public optionDocumentation: IDocumentation) {
    super(possibleValues[0], vscode.CompletionItemKind.TypeParameter);
    this.documentation = htmlToText.fromString(optionDocumentation.comment, {
      ignoreHref: true,
      wordwrap: null,
      preserveNewlines: true
    });
    if (optionDocumentation.type) {
      this.detail = `Name : ${optionDocumentation.name} ; Type : ${optionDocumentation.type}`;
    }
  }
}

class CompletionItemForOptionsWithExamples extends vscode.CompletionItem {
  constructor(public possibleValues: string[], public optionDocumentation: IDocumentation) {
    super(`Possible Coveo option values ...`, vscode.CompletionItemKind.TypeParameter);
    let htmlToTransform = ` <h1>Example(s) : </h1> <pre>${this.createMarkupExamples()}</pre> ${optionDocumentation.comment}`;
    this.documentation = htmlToText.fromString(htmlToTransform, {
      ignoreHref: true,
      wordwrap: null,
      preserveNewlines: true
    });

    if (optionDocumentation.type) {
      this.detail = `Name : ${optionDocumentation.name} ; Type : ${optionDocumentation.type}`;
    }

    this.filterText = ' ';
    if (optionDocumentation.miscAttributes['defaultValue']) {
      this.insertText = optionDocumentation.miscAttributes['defaultValue'];
    } else {
      this.insertText = this.possibleValues[0];
    }
  }

  private createMarkupExamples(): string[] {
    return this.possibleValues.map(
      possibleValue =>
        `${ReferenceDocumentation.camelCaseToHyphen(this.optionDocumentation.name)}='${possibleValue}'<br/>`
    );
  }
}
