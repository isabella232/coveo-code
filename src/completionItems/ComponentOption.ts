import * as vscode from 'vscode';
import { IDocumentation, ReferenceDocumentation } from "../referenceDocumentation";
import * as htmlToText from 'html-to-text';

export class ComponentOption extends vscode.CompletionItem {
  constructor(public info: IDocumentation) {
    super(ReferenceDocumentation.camelCaseToHyphen(info.name) + ' (coveo)', vscode.CompletionItemKind.Keyword);
    this.documentation = htmlToText.fromString(info.comment, {
      ignoreHref: true,
      wordwrap: null,
      preserveNewlines: true
    });
    this.insertText = ReferenceDocumentation.camelCaseToHyphen(info.name);
  }
}
