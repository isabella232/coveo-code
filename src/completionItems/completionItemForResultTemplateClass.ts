import * as vscode from 'vscode';

const inlineDocumentation = 'A Coveo result template need to have the "result-template" css class';

export class CompletionItemForResultTemplateClass extends vscode.CompletionItem {
  constructor() {
    super('result-template (coveo)', vscode.CompletionItemKind.TypeParameter);
    this.insertText = 'result-template';
    this.documentation = inlineDocumentation;
  }
}
