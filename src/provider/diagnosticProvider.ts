import * as vscode from 'vscode';
import * as _ from 'lodash';
import { getAllComponentsSymbol, doCompleteScanOfSymbol } from '../documentService';
import { ReferenceDocumentation, IDocumentation } from '../referenceDocumentation';

export class DiagnosticProvider {
  constructor(public diagnosticCollection: vscode.DiagnosticCollection, public referenceDocumentation: ReferenceDocumentation) {}

  public updateDiagnostics(document: vscode.TextDocument) {
    this.diagnosticCollection.clear();
    let allDiagnostics: vscode.Diagnostic[] = [];
    const allComponentsSymbols = getAllComponentsSymbol(this.referenceDocumentation, document);
    allComponentsSymbols.forEach(componentSymbol => {
      const component = this.referenceDocumentation.getDocumentation(componentSymbol);
      if (component && component.options) {
        allDiagnostics = allDiagnostics.concat(this.diagnoseDuplicateOptions(document, componentSymbol));
        allDiagnostics = allDiagnostics.concat(this.diagnoseMissingRequiredOptions(document, componentSymbol, component));
        allDiagnostics = allDiagnostics.concat(this.diagnoseInvalidConstrainedValues(document, componentSymbol, component));
      }
    });
    this.diagnosticCollection.set(document.uri, allDiagnostics);
  }

  private diagnoseDuplicateOptions(document: vscode.TextDocument, componentSymbol: vscode.SymbolInformation): vscode.Diagnostic[] {
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
      const matchScanWithOption = _.map(requiredOptions, requiredOption => {
        const foundInScan = _.find(
          completeScan,
          scan => scan.attributeName == ReferenceDocumentation.camelCaseToHyphen(requiredOption.name)
        );
        return {
          scan: foundInScan,
          option: requiredOption
        };
      });
      const missingRequiredOptions = matchScanWithOption.filter(
        scannedOption => scannedOption.scan == null || _.isEmpty(this.attributeValueWithNoQuote(scannedOption.scan.attributeValue))
      );
      allDiagnostics = allDiagnostics.concat(
        missingRequiredOptions.map(missingRequiredOption => {
          return new vscode.Diagnostic(
            componentSymbol.location.range,
            `The option ${missingRequiredOption.option.name} is required. Markup value is ${ReferenceDocumentation.camelCaseToHyphen(
              missingRequiredOption.option.name
            )}`,
            vscode.DiagnosticSeverity.Error
          );
        })
      );
    }
    return allDiagnostics;
  }

  private diagnoseInvalidConstrainedValues(
    document: vscode.TextDocument,
    componentSymbol: vscode.SymbolInformation,
    component: IDocumentation
  ) {
    let allDiagnostics: vscode.Diagnostic[] = [];
    const allOptionsWithConstrainedValues = _.filter(component.options, option => !_.isEmpty(option.constrainedValues));

    if (!_.isEmpty(allOptionsWithConstrainedValues)) {
      const allOptionsWithConstrainedValuesMarkup = allOptionsWithConstrainedValues.map(optionWithConstrainedValue =>
        ReferenceDocumentation.camelCaseToHyphen(optionWithConstrainedValue.name)
      );
      const completeScan = doCompleteScanOfSymbol(componentSymbol, document);
      const currentScanWhichNeedConstrainedValues = _.filter(
        completeScan,
        scan => _.indexOf(allOptionsWithConstrainedValuesMarkup, scan.attributeName) != -1
      );
      const allScanWhichMatchWithMarkup = _.chain(allOptionsWithConstrainedValues)
        .map(optionWithConstrainedValues => {
          const foundInScan = _.find(
            currentScanWhichNeedConstrainedValues,
            scanWhichNeedConstrainedValues =>
              scanWhichNeedConstrainedValues.attributeName ==
              ReferenceDocumentation.camelCaseToHyphen(optionWithConstrainedValues.name) !=
              null
          );
          if (foundInScan) {
            return {
              scan: foundInScan,
              option: optionWithConstrainedValues
            };
          }
          return null;
        })
        .compact()
        .value();

      _.each(allScanWhichMatchWithMarkup, optionThatIsPossiblyInError => {
        const allUniquePossibleValuesFromDocumentation = _.chain(optionThatIsPossiblyInError.option.constrainedValues)
          .flatMap(constrainedValue => constrainedValue.split(','))
          .uniq()
          .value();

        const valuesInAttributeNotPossible = _.chain(optionThatIsPossiblyInError.scan.attributeValue.replace(/"/g, '').split(','))
          .difference(allUniquePossibleValuesFromDocumentation)
          .without('')
          .value();

        allDiagnostics = allDiagnostics.concat(
          valuesInAttributeNotPossible.map(
            valueNotPossibleInAttribute =>
              new vscode.Diagnostic(
                optionThatIsPossiblyInError.scan.rangeInDocument,
                `Value ${valueNotPossibleInAttribute} is not a valid value for the option ${optionThatIsPossiblyInError.option.name}`,
                vscode.DiagnosticSeverity.Error
              )
          )
        );
      });
    }
    return allDiagnostics;
  }

  private diagnoseInvalidOptionType(document: vscode.TextDocument, componentSymbol: vscode.SymbolInformation, component: IDocumentation) {}

  private attributeValueWithNoQuote(attributeValue: string): string {
    return attributeValue.replace(/'"/g, '');
  }
}
