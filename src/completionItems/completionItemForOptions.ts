import * as htmlToText from 'html-to-text';
import * as vscode from 'vscode';
import { IDocumentation } from '../referenceDocumentation';

export class CompletionItemForOptions extends vscode.CompletionItem {
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
