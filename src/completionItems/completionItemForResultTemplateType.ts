import * as vscode from 'vscode';
import { l } from '../strings/Strings';

export class CompletionItemForResultTemplateType extends vscode.CompletionItem {
  constructor(mimeType: string, kind: string) {
    super(`${mimeType} (coveo)`, vscode.CompletionItemKind.TypeParameter);
    this.documentation = l('MimetypeDocumentation', kind);
    this.insertText = mimeType;
  }
}
