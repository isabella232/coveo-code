import * as vscode from 'vscode';
import * as _ from 'lodash';
import { getAllComponentsSymbol, doCompleteScanOfSymbol } from '../documentService';
import { ReferenceDocumentation } from '../referenceDocumentation';

export class DiagnosticProvider {
  constructor(
    public diagnosticCollection: vscode.DiagnosticCollection,
    public referenceDocumentation: ReferenceDocumentation
  ) {}

  public updateDiagnostics(document: vscode.TextDocument) {
    this.diagnosticCollection.clear();
    let allDiagnostics: vscode.Diagnostic[] = [];
    const allComponentsSymbols = getAllComponentsSymbol(this.referenceDocumentation, document);
    allComponentsSymbols.forEach(componentSymbol => {
      const component = this.referenceDocumentation.getDocumentation(componentSymbol);
      if (component && component.options) {
        allDiagnostics = allDiagnostics.concat(this.diagnoseDuplicateOptions(document, componentSymbol));
      }
    });
    this.diagnosticCollection.set(document.uri, allDiagnostics);
  }

  private diagnoseDuplicateOptions(
    document: vscode.TextDocument,
    componentSymbol: vscode.SymbolInformation
  ): vscode.Diagnostic[] {
    let allDiagnostics: vscode.Diagnostic[] = [];
    const completeScan = doCompleteScanOfSymbol(componentSymbol, document);
    const scanWithOnlyUnique = _.uniqBy(completeScan, scan => scan.attributeName);
    const duplicates = _.difference(completeScan, scanWithOnlyUnique);
    if (!_.isEmpty(duplicates)) {
      allDiagnostics = allDiagnostics.concat(
        duplicates.map(duplicate => {
          return new vscode.Diagnostic(
            duplicate.rangeInDocument,
            'Remove duplicate option inside the same component.',
            vscode.DiagnosticSeverity.Error
          );
        })
      );
    }
    return allDiagnostics;
  }
}
