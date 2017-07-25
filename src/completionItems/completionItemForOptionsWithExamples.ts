import * as vscode from 'vscode';
import * as htmlToText from 'html-to-text';
import { IDocumentation, ReferenceDocumentation } from '../referenceDocumentation';
import { l } from '../strings/Strings';

export class CompletionItemForOptionsWithExamples extends vscode.CompletionItem {
  constructor(public possibleValues: string[], public optionDocumentation: IDocumentation) {
    super(l('PossibleOptionValues'), vscode.CompletionItemKind.TypeParameter);
    const htmlToTransform = ` <h1>Example(s) : </h1> <pre>${this.createMarkupExamples().join(
      '\n'
    )}</pre> ${optionDocumentation.comment}`;
    this.documentation = htmlToText.fromString(htmlToTransform, {
      ignoreHref: true,
      wordwrap: null,
      preserveNewlines: true
    });

    if (optionDocumentation.type) {
      this.detail = `Name : ${optionDocumentation.name} ; Type : ${optionDocumentation.type}`;
    }

    this.filterText = ' ';
    if (optionDocumentation.miscAttributes.defaultValue) {
      this.insertText = optionDocumentation.miscAttributes.defaultValue;
    } else {
      this.insertText = this.possibleValues[0];
    }
  }

  private createMarkupExamples(): string[] {
    return this.possibleValues.map(
      possibleValue => `${ReferenceDocumentation.camelCaseToHyphen(this.optionDocumentation.name)}='${possibleValue}'`
    );
  }
}
