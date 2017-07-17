import * as vscode from 'vscode';
import { getAllPossibleResultTemplatesSymbols, doCompleteScanOfSymbol } from '../documentService';

export class ResultTemplatesDiagnostics {
  public provideDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
    const allDiagnostics: vscode.Diagnostic[] = [];

    const allPossibleResultTemplates = getAllPossibleResultTemplatesSymbols(document);

    return allDiagnostics;
  }

  private diagnoseMissingClass(symbol: vscode.SymbolInformation, document: vscode.TextDocument) {
    const completeScan = doCompleteScanOfSymbol(symbol, document);
  }
}
