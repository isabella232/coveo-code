import * as vscode from 'vscode';

export class CompletionItemForResultTemplateType extends vscode.CompletionItem {
  constructor(mimeType: string, kind: string) {
    super(`${mimeType} (coveo)`, vscode.CompletionItemKind.TypeParameter);
    this.documentation = `Specify a mimeType that determine the type of template. This mimeType create an ${kind} template`;
    this.insertText = mimeType;
  }
}
