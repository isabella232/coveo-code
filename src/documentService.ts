import * as vscode from 'vscode';
import { ReferenceDocumentation, IDocumentation } from './referenceDocumentation';
import * as _ from 'lodash';
import { getLanguageService, LanguageService, Scanner, TokenType } from 'vscode-html-languageservice';
import { validMimeTypes } from './validResultTemplatesMimeTypes';

const htmlLangService: LanguageService = getLanguageService();

export function getComponentAtPosition(
  referenceDocumentation: ReferenceDocumentation,
  position: vscode.Position,
  document: vscode.TextDocument
): IDocumentation | undefined {
  const transformedDoc = transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  const symbols = htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc);
  const currentSymbol = _getCurrentSymbol(<any>symbols, position);
  if (currentSymbol) {
    return referenceDocumentation.getDocumentation(currentSymbol);
  }
  return undefined;
}

export function getOptionAtPosition(
  referenceDocumentation: ReferenceDocumentation,
  position: vscode.Position,
  document: vscode.TextDocument
): IDocumentation | undefined {
  const currentComponent = getComponentAtPosition(referenceDocumentation, position, document);

  if (currentComponent) {
    const currentActiveAttribute = getScanOfActiveAttributeValue(document, position);
    if (currentActiveAttribute) {
      const optionThatMatch = _.find(
        currentComponent.options,
        option => `${ReferenceDocumentation.camelCaseToHyphen(option.name)}` == currentActiveAttribute.attributeName
      );
      return optionThatMatch;
    }
  }
  return undefined;
}

export function getAllComponentsSymbol(
  referenceDocumentation: ReferenceDocumentation,
  document: vscode.TextDocument
): vscode.SymbolInformation[] {
  const transformedDoc = transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  // This needs to be done because there's an incompatibility between the htmllanguage service type and the latest d.ts for VS code API
  const symbols = <any>htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc);

  return _.filter(symbols, (symbol: vscode.SymbolInformation) => {
    return referenceDocumentation.getDocumentation(symbol) != null;
  });
}

export function getAllPossibleResultTemplatesSymbols(document: vscode.TextDocument) {
  const transformedDoc = transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  const symbols = <any>htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc);

  return _.filter(symbols, (symbol: vscode.SymbolInformation) => {
    let isResultTemplate = false;
    if (/script/.test(symbol.name)) {
      const scanOfScript = doCompleteScanOfSymbol(symbol, document);
      const hasClass = _.find(scanOfScript, scan => scan.attributeName.toLowerCase() == 'class');
      if (hasClass) {
        const hasCorrectCssClass = /result-template/.test(hasClass.attributeValue);
        isResultTemplate = isResultTemplate || hasCorrectCssClass;
      }
      const hasType = _.find(scanOfScript, scan => scan.attributeName.toLowerCase() == 'type');
      if (hasType) {
        const hasCorrectMimeTypes =
          _.find(validMimeTypes, possibleMime => new RegExp(possibleMime).test(hasType.attributeValue)) != null;
        isResultTemplate = isResultTemplate || hasCorrectMimeTypes;
      }
    }
    return isResultTemplate;
  });
}

export function getCurrentSymbol(position: vscode.Position, document: vscode.TextDocument) {
  const transformedDoc = transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  const symbols = htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc);
  return _getCurrentSymbol(<any>symbols, position);
}

export function doCompleteScanOfSymbol(
  symbol: vscode.SymbolInformation,
  document: vscode.TextDocument,
  currentCursorOffset: number = 0
) {
  const scanner = htmlLangService.createScanner(document.getText(_createRange(symbol.location.range)));
  const currentSymbolOffset = document.offsetAt(_createRange(symbol.location.range).start);

  let cursorOffsetInSymbol = currentCursorOffset - currentSymbolOffset;
  const completeScanOfAttributeValues: IScanOfAttributeValue[] = [];
  let doScan: any = scanner.scan();
  const shouldExitScan = () => {
    return (
      scanner.getTokenType() == TokenType.EOS ||
      scanner.getTokenType() == TokenType.StartTagClose ||
      scanner.getTokenType() == TokenType.StartTagSelfClose
    );
  };
  while (!shouldExitScan()) {
    if (scanner.getTokenType() == TokenType.AttributeName) {
      const beginningOfAttributeNameOffset = scanner.getTokenOffset();
      const attributeName = scanner.getTokenText();
      let attributeValue = '';
      let activeUnderCursor = false;
      doScan = scanner.scan();
      if (scanner.getTokenType() == TokenType.DelimiterAssign) {
        doScan = scanner.scan();
        if (scanner.getTokenType() == TokenType.AttributeValue) {
          attributeValue = scanner.getTokenText();
          if (
            scanner.getTokenOffset() + scanner.getTokenLength() >= cursorOffsetInSymbol &&
            scanner.getTokenOffset() <= cursorOffsetInSymbol
          ) {
            activeUnderCursor = true;
          }
        }
        // Need to exit early if we scanned too far while trying to match an attribute with it's value
        if (shouldExitScan()) {
          break;
        }
      }
      if (shouldExitScan()) {
        break;
      }

      const scanOfAttributeValues = {
        attributeName: attributeName,
        attributeValue: attributeValue,
        activeUnderCursor: activeUnderCursor,
        rangeInDocument: new vscode.Range(
          document.positionAt(beginningOfAttributeNameOffset + currentSymbolOffset),
          document.positionAt(scanner.getTokenOffset() + currentSymbolOffset + scanner.getTokenLength())
        )
      };
      completeScanOfAttributeValues.push(scanOfAttributeValues);
    }
    doScan = scanner.scan();
  }
  return completeScanOfAttributeValues;
}

export function doCompleteScanOfCurrentSymbol(
  document: vscode.TextDocument,
  position: vscode.Position
): IScanOfAttributeValue[] | undefined {
  const currentSymbol = getCurrentSymbol(position, document);
  const currentCursorOffset = document.offsetAt(position);
  if (currentSymbol) {
    return doCompleteScanOfSymbol(currentSymbol, document, currentCursorOffset);
  }
  return undefined;
}

function transformTextDocumentApi(document: vscode.TextDocument) {
  // this need to be done because there's an incompatibility between the htmllanguage service and the latest d.ts for VS code API.
  let transform: any = {};
  Object.assign(transform, document);
  transform.uri = document.uri.toString();
  return transform;
}

function _getCurrentSymbol(
  symbols: vscode.SymbolInformation[],
  position: vscode.Position
): vscode.SymbolInformation | undefined {
  return _.findLast(symbols, (symbol: vscode.SymbolInformation) => {
    return new vscode.Range(symbol.location.range.start, symbol.location.range.end).contains(position);
  });
}

function _createRange(oldRangeObject: vscode.Range) {
  // Necessary because the API is incompatible between htmlLanguage service and new vs code versions
  return new vscode.Range(oldRangeObject.start, oldRangeObject.end);
}

export interface IScanOfAttributeValue {
  attributeName: string;
  attributeValue: string;
  activeUnderCursor: boolean;
  rangeInDocument: vscode.Range;
}

function getScanOfActiveAttributeValue(
  document: vscode.TextDocument,
  position: vscode.Position
): IScanOfAttributeValue | undefined {
  return _.find(doCompleteScanOfCurrentSymbol(document, position), scan => scan.activeUnderCursor);
}
