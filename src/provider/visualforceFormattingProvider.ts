import * as vscode from 'vscode';
import { formatDocument } from '../documentService';

export class VisualforceFormattingProvider implements vscode.DocumentFormattingEditProvider {
  public provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken
  ): Thenable<vscode.TextEdit[]> {
    return Promise.resolve(formatDocument(document, options));
  }
}
