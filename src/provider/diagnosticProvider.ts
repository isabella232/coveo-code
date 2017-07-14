import * as vscode from 'vscode';
import * as _ from 'lodash';
import { getAllComponentsSymbol, doCompleteScanOfSymbol, IScanOfAttributeValue } from '../documentService';
import { ReferenceDocumentation, IDocumentation } from '../referenceDocumentation';
import { OptionsDiagnostics } from '../diagnostics/optionsDiagnostics';

export class DiagnosticProvider {
  constructor(public diagnosticCollection: vscode.DiagnosticCollection, public referenceDocumentation: ReferenceDocumentation) {}

  public updateDiagnostics(document: vscode.TextDocument) {
    this.diagnosticCollection.clear();
    let allDiagnostics: vscode.Diagnostic[] = [];
    allDiagnostics = allDiagnostics.concat(new OptionsDiagnostics(this.referenceDocumentation).provideDiagnostics(document));
    this.diagnosticCollection.set(document.uri, allDiagnostics);
  }
}
