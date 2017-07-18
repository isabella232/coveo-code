import * as vscode from 'vscode';
import * as _ from 'lodash';
import { validMimeTypesHTML, validMimeTypesUnderscore, validMimeTypes } from '../validResultTemplatesMimeTypes';
import { getAllPossibleResultTemplatesSymbols, doCompleteScanOfSymbol, getContentOfTemplate } from '../documentService';
import * as cheerio from 'cheerio';

export class ResultTemplatesDiagnostics {
  public provideDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
    let allDiagnostics: vscode.Diagnostic[] = [];

    const allPossibleResultTemplates = getAllPossibleResultTemplatesSymbols(document);
    _.each(allPossibleResultTemplates, template => {
      allDiagnostics = allDiagnostics.concat(this.diagnoseMissingClass(template, document));
      allDiagnostics = allDiagnostics.concat(this.diagnoseMissingType(template, document));
      allDiagnostics = allDiagnostics.concat(this.diagnoseDuplicateConditions(template, document));
      allDiagnostics = allDiagnostics.concat(this.diagnoseContentOfTemplate(template, document));
    });
    return allDiagnostics;
  }

  private diagnoseMissingClass(symbol: vscode.SymbolInformation, document: vscode.TextDocument): vscode.Diagnostic[] {
    const ret: vscode.Diagnostic[] = [];
    const completeScan = doCompleteScanOfSymbol(symbol, document);
    const classNameScan = _.find(completeScan, scan => scan.attributeName.toLowerCase() == 'class');
    const validationMessageForClassName = `Result templates should have the "result-template" class name`;
    if (classNameScan) {
      const hasResultTemplateClass = /result-template/.test(classNameScan.attributeValue);
      if (!hasResultTemplateClass) {
        ret.push(
          new vscode.Diagnostic(
            classNameScan.rangeInDocument,
            validationMessageForClassName,
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    } else {
      ret.push(
        new vscode.Diagnostic(symbol.location.range, validationMessageForClassName, vscode.DiagnosticSeverity.Error)
      );
    }
    return ret;
  }

  private diagnoseMissingType(symbol: vscode.SymbolInformation, document: vscode.TextDocument): vscode.Diagnostic[] {
    const ret: vscode.Diagnostic[] = [];
    const completeScan = doCompleteScanOfSymbol(symbol, document);
    const templateTypeScan = _.find(completeScan, scan => scan.attributeName.toLowerCase() == 'type');
    const validationMessageForMimeType = `Result templates should have a valid "type" attribute. Possible values are ${validMimeTypesHTML.join(
      ', '
    )} for "HTML" templates, and ${validMimeTypesUnderscore.join(', ')} for "Underscore" templates`;
    if (templateTypeScan) {
      const templateTypeValue = templateTypeScan.attributeValue;
      if (_.indexOf(validMimeTypes, templateTypeValue) == -1) {
        ret.push(new vscode.Diagnostic(symbol.location.range, validationMessageForMimeType));
      }
    } else {
      ret.push(new vscode.Diagnostic(symbol.location.range, validationMessageForMimeType));
    }

    return ret;
  }

  private diagnoseDuplicateConditions(
    symbol: vscode.SymbolInformation,
    document: vscode.TextDocument
  ): vscode.Diagnostic[] {
    const ret: vscode.Diagnostic[] = [];
    const completeScan = doCompleteScanOfSymbol(symbol, document);
    const conditionScan = _.find(completeScan, scan => scan.attributeName.toLowerCase() == 'data-condition');
    const fieldValueScan = _.find(completeScan, scan => /data-field-[a-zA-Z]/i.test(scan.attributeName));
    if (conditionScan && fieldValueScan) {
      ret.push(
        new vscode.Diagnostic(
          symbol.location.range,
          'Result template should not have both a "data-condition" and data-field attribute. Choose one or the other. The data-field attribute is the recommended method.'
        )
      );
    }
    return ret;
  }

  private diagnoseConditions(
    allPossibleResultTemplates: vscode.SymbolInformation[],
    document: vscode.TextDocument
  ): vscode.Diagnostic[] {
    let allDiagnostics: vscode.Diagnostic[] = [];

    const resultTemplateInsideResultList = _.filter(
      allPossibleResultTemplates,
      template => (template.containerName ? /CoveoResultList/.test(template.containerName) : false)
    );

    const nonDefaultResultTemplates = _.slice(
      resultTemplateInsideResultList,
      0,
      resultTemplateInsideResultList.length - 1
    );

    const defaultResultTemplate = _.last(resultTemplateInsideResultList);

    _.each(nonDefaultResultTemplates, nonDefaultResultTemplate => {
      allDiagnostics = allDiagnostics.concat(this.diagnoseMissingCondition(nonDefaultResultTemplate, document));
    });

    if (defaultResultTemplate) {
      allDiagnostics = allDiagnostics.concat(this.diagnoseNonRequiredCondition(defaultResultTemplate, document));
    }

    return allDiagnostics;
  }

  private diagnoseMissingCondition(
    symbol: vscode.SymbolInformation,
    document: vscode.TextDocument
  ): vscode.Diagnostic[] {
    const ret: vscode.Diagnostic[] = [];
    const completeScan = doCompleteScanOfSymbol(symbol, document);
    const conditionScan = _.find(completeScan, scan => scan.attributeName.toLowerCase() == 'data-condition');
    const fieldValueScan = _.find(completeScan, scan => /data-field-[a-zA-Z]/i.test(scan.attributeName));

    if (!conditionScan && !fieldValueScan) {
      ret.push(
        new vscode.Diagnostic(
          symbol.location.range,
          'Non default result template have a "data-field-{replace this with field name}" attribute. This allows the template to load conditionally for each type of result.'
        )
      );
    } else if (conditionScan && _.isEmpty(conditionScan.attributeValue)) {
      ret.push(
        new vscode.Diagnostic(
          symbol.location.range,
          'Result template should have a valid "data-condition" which is not empty.'
        )
      );
    }

    return ret;
  }

  private diagnoseNonRequiredCondition(
    symbol: vscode.SymbolInformation,
    document: vscode.TextDocument
  ): vscode.Diagnostic[] {
    const ret: vscode.Diagnostic[] = [];
    const completeScan = doCompleteScanOfSymbol(symbol, document);
    const conditionScan = _.find(completeScan, scan => scan.attributeName.toLowerCase() == 'data-condition');
    const fieldValueScan = _.find(completeScan, scan => /data-field-[a-zA-Z]/i.test(scan.attributeName));

    if (conditionScan) {
      ret.push(
        new vscode.Diagnostic(
          conditionScan.rangeInDocument,
          'The last default template in a CoveoResultList should not have a data-condition attribute. This allows it to act as a default/catch-all template'
        )
      );
    }

    if (fieldValueScan) {
      ret.push(
        new vscode.Diagnostic(
          fieldValueScan.rangeInDocument,
          'The last default template in a CoveoResultList should not have a data-field attribute. This allows it to act as a default/catch-all template'
        )
      );
    }

    return ret;
  }

  private diagnoseContentOfTemplate(
    symbol: vscode.SymbolInformation,
    document: vscode.TextDocument
  ): vscode.Diagnostic[] {
    const ret: vscode.Diagnostic[] = [];
    const content = getContentOfTemplate(symbol, document);
    if (content.trim() == '') {
      ret.push(
        new vscode.Diagnostic(symbol.location.range, 'Templates should not be empty', vscode.DiagnosticSeverity.Error)
      );
    } else {
      const addInvalidRoot = () =>
        ret.push(
          new vscode.Diagnostic(
            symbol.location.range,
            'Templates should have a single "root" element. This means a single "div" element inside which your whole template should be contained',
            vscode.DiagnosticSeverity.Error
          )
        );
      const $ = cheerio.load(content);
      const root = $.root();
      const body = root.find('body');
      const allChildren = _.filter(body[0].children, child => child.tagName != null);
      if (allChildren.length == 0 || allChildren.length > 1) {
        addInvalidRoot();
      }
    }
    return ret;
  }
}
