import * as vscode from 'vscode';
import { ReferenceDocumentation } from '../referenceDocumentation';
import { OptionsDiagnostics } from '../diagnostics/optionsDiagnostics';
import { ResultTemplatesDiagnostics } from '../diagnostics/resultTemplatesDiagnostics';

export const canProvideDiagnosticFor = ['html', 'visualforce'];

export class DiagnosticProvider {
  constructor(
    public diagnosticCollection: vscode.DiagnosticCollection,
    public referenceDocumentation: ReferenceDocumentation
  ) {}

  public updateDiagnostics(document: vscode.TextDocument) {
    this.diagnosticCollection.clear();
    if (canProvideDiagnosticFor.indexOf(document.languageId.toLowerCase()) != -1) {
      let allDiagnostics: vscode.Diagnostic[] = [];
      allDiagnostics = allDiagnostics.concat(
        new OptionsDiagnostics(this.referenceDocumentation).provideDiagnostics(document)
      );
      allDiagnostics = allDiagnostics.concat(new ResultTemplatesDiagnostics().provideDiagnostics(document));
      this.diagnosticCollection.set(document.uri, allDiagnostics);
    }
  }
}
