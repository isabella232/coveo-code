import * as vscode from 'vscode';
import * as _ from 'lodash';
import { getAllComponentsSymbol, doCompleteScanOfSymbol } from '../documentService';
import { ReferenceDocumentation, IDocumentation } from '../referenceDocumentation';

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
        allDiagnostics = allDiagnostics.concat(
          this.diagnoseMissingRequiredOptions(document, componentSymbol, component)
        );
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

  private diagnoseMissingRequiredOptions(
    document: vscode.TextDocument,
    componentSymbol: vscode.SymbolInformation,
    component: IDocumentation
  ) {
    let allDiagnostics: vscode.Diagnostic[] = [];
    const requiredOptions = _.filter(component.options, option => option.miscAttributes['required'] == 'true');
    if (!_.isEmpty(requiredOptions)) {
      const completeScan = doCompleteScanOfSymbol(componentSymbol, document);
      let isMissingAtLeastOneRequiredOption = false;
      const missingRequiredOptions = requiredOptions.filter(requiredOption => {
        return (
          _.find(
            completeScan,
            scan => scan.attributeName == ReferenceDocumentation.camelCaseToHyphen(requiredOption.name)
          ) == null
        );
      });
      allDiagnostics = allDiagnostics.concat(
        missingRequiredOptions.map(missingRequiredOption => {
          return new vscode.Diagnostic(
            componentSymbol.location.range,
            `The option ${missingRequiredOption.name} is required. Markup value is ${ReferenceDocumentation.camelCaseToHyphen(
              missingRequiredOption.name
            )}`,
            vscode.DiagnosticSeverity.Error
          );
        })
      );
    }
    return allDiagnostics;
  }
}
