import * as vscode from 'vscode';
import * as _ from 'lodash';
import { IDocumentation } from '../referenceDocumentation';
import { CompletionItemForOptions } from './completionItemForOptions';
import { CompletionItemForOptionsWithExamples } from './completionItemForOptionsWithExamples';

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
      this.componentOptionDocumentation.miscAttributes.defaultValue
    ) {
      return {
        completionToUse: CompletionItemForOptionsWithExamples,
        valuesToUse: [this.componentOptionDocumentation.miscAttributes.defaultValue]
      };
    }
    return {
      completionToUse: CompletionItemForOptionsWithExamples,
      valuesToUse: ['foo']
    };
  }

  private determineCompletionProviderFromType() {
    const padDefaultValueWithFakeValues = (fakeValues: string[]): string[] => {
      if (this.componentOptionDocumentation.miscAttributes.defaultValue) {
        return _.uniq([this.componentOptionDocumentation.miscAttributes.defaultValue].concat(fakeValues));
      }
      return fakeValues;
    };

    if (this.componentOptionDocumentation.type) {
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

    return {
      completionToUse: CompletionItemForOptionsWithExamples,
      valuesToUse: padDefaultValueWithFakeValues(['foo'])
    };
  }
}
