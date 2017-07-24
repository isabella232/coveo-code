import * as vscode from 'vscode';
import { IDocumentation } from '../referenceDocumentation';
import * as htmlToText from 'html-to-text';

export class ComponentName extends vscode.CompletionItem {
  constructor(public info: IDocumentation) {
    super(`Coveo${info.name}`);

    this.documentation = htmlToText.fromString(info.comment, {
      ignoreHref: true,
      preserveNewlines: true,
      wordwrap: null
    });
  }
}
