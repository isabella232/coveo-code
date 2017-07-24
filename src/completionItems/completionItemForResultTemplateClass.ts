import * as vscode from 'vscode';
import { l } from '../strings/Strings';

export class CompletionItemForResultTemplateClass extends vscode.CompletionItem {
  constructor() {
    super('result-template (coveo)', vscode.CompletionItemKind.TypeParameter);
    this.insertText = 'result-template';
    this.documentation = l('MissingTemplateClass');
  }
}
