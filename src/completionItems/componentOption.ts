import * as vscode from 'vscode';
import { ReferenceDocumentation, IDocumentation } from '../referenceDocumentation';
import * as htmlToText from 'html-to-text';

export class ComponentOption extends vscode.CompletionItem {
  constructor(public info: IDocumentation) {
    super(ReferenceDocumentation.camelCaseToHyphen(info.name) + ' (coveo)', vscode.CompletionItemKind.Keyword);
    this.documentation = htmlToText.fromString(info.comment, {
      ignoreHref: true,
      preserveNewlines: true,
      wordwrap: null
    });
    this.insertText = ReferenceDocumentation.camelCaseToHyphen(info.name);
  }
}
