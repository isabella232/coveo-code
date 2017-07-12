import * as vscode from 'vscode';
import { IDocumentation, ReferenceDocumentation } from "../referenceDocumentation";
import * as htmlToText from 'html-to-text';
import * as _ from 'lodash';

export class ComponentOptionValues {
  private possibleValues: string[];
  constructor(public componentOptionDocumentation: IDocumentation) {
    if (!_.isEmpty(componentOptionDocumentation.constrainedValues)) {
      this.possibleValues = componentOptionDocumentation.constrainedValues;
    } else {
      this.possibleValues = this.getMarkupValueExampleFromType();
    }
  }

  public getCompletions(): vscode.CompletionItem[] {
    if (!_.isEmpty(this.componentOptionDocumentation.constrainedValues)) {
      return this.possibleValues.map(possibleValue => new CompletionItemForOptions(possibleValue, this.componentOptionDocumentation));
    } else {
      return [new CompletionItemForOptionsWithExamples(this.possibleValues, this.componentOptionDocumentation)];
    }
  }

  private getMarkupValueExampleFromType(): string[] {
    let ret = [];
    if (this.componentOptionDocumentation.type) {
      switch (this.componentOptionDocumentation.type.toLowerCase()) {
        case 'boolean':
          ret = ['true', 'false'];
          break;
        case 'string':
          ret = ['foo'];
          break;
        case 'ifieldoption':
          ret = ['@foo'];
          break;
        case 'number':
          ret = ['1', '2', '3'];
          break;
        default:
          ret = ['foo'];
          break;
      }
    }
    return ret;
  }
}

class CompletionItemForOptions extends vscode.CompletionItem {
  constructor(public possibleValue: string, public optionDocumentation: IDocumentation) {
    super(possibleValue, vscode.CompletionItemKind.TypeParameter);
    this.documentation = htmlToText.fromString(optionDocumentation.comment, {
      ignoreHref: true,
      wordwrap: null,
      preserveNewlines: true
    });
    if (optionDocumentation.type) {
      this.detail = `Type : ${optionDocumentation.type}`;
    }
  }
}

class CompletionItemForOptionsWithExamples extends vscode.CompletionItem {
  constructor(public possibleValues: string[], public optionDocumentation: IDocumentation) {
    super(`Possible Coveo option values ...`, vscode.CompletionItemKind.TypeParameter);
    let htmlToTransform = ` <h1>Example(s) : </h1> <pre>${this.createMarkupExamples()}</pre> ${optionDocumentation.comment}`;
    if (optionDocumentation.type) {
      this.detail = `Name : ${optionDocumentation.name} ; Type : ${optionDocumentation.type}`
    }
    this.documentation = htmlToText.fromString(htmlToTransform, {
      ignoreHref: true,
      wordwrap: null,
      preserveNewlines: true
    });
    this.filterText = ' ';
    this.insertText = this.possibleValues[0];
  }

  private createMarkupExamples(): string[] {
    return this.possibleValues.map(possibleValue => `${ReferenceDocumentation.camelCaseToHyphen(this.optionDocumentation.name)}='${possibleValue}'<br/>`);
  }
}