import * as vscode from 'vscode';
import { ReferenceDocumentation, IDocumentation } from './referenceDocumentation';
import * as _ from 'lodash';
import { getLanguageService, LanguageService, Scanner, TokenType } from 'vscode-html-languageservice';

const htmlLangService: LanguageService = getLanguageService();

export function fromDocumentToComponent(
  referenceDocumentation: ReferenceDocumentation,
  position: vscode.Position,
  document: vscode.TextDocument
): IDocumentation {
  const transformedDoc = transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  const symbols = htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc);
  const currentSymbol = _getCurrentSymbol(<any>symbols, position);
  return referenceDocumentation.getDocumentation(currentSymbol);
}

export function fromDocumentToComponentOption(
  referenceDocumentation: ReferenceDocumentation,
  position: vscode.Position,
  document: vscode.TextDocument
): IDocumentation {
  const currentComponent = fromDocumentToComponent(referenceDocumentation, position, document);

  if (currentComponent) {
    const currentActiveAttribute = getScanOfActiveAttributeValue(document, position);
    if (currentActiveAttribute) {
      const optionThatMatch = _.find(
        currentComponent.options,
        option => `${ReferenceDocumentation.camelCaseToHyphen(option.name)}` == currentActiveAttribute.attributeName
      );
      if (optionThatMatch) {
        return {
          comment: optionThatMatch.comment,
          name: optionThatMatch.name,
          type: optionThatMatch.type,
          options: [],
          constrainedValues: optionThatMatch.constrainedValues
        };
      }
    }
  }
}

export function isOptionAlreadySetOnComponent(
  position: vscode.Position,
  document: vscode.TextDocument,
  option: IDocumentation
) {
  const completeScan = doCompleteScanOfCurrentSymbol(document, position);
  const existInScan = _.find(
    completeScan,
    scan => scan.attributeName == `${ReferenceDocumentation.camelCaseToHyphen(option.name)}`
  );
  return existInScan != null;
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
  let doScan = scanner.scan();
  while (doScan != TokenType.StartTagClose) {
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
): IScanOfAttributeValue[] {
  const currentSymbol = getCurrentSymbol(position, document);
  const currentCursorOffset = document.offsetAt(position);
  return doCompleteScanOfSymbol(currentSymbol, document, currentCursorOffset);
}

function transformTextDocumentApi(document: vscode.TextDocument) {
  // this need to be done because there's an incompatibility between the htmllanguage service and the latest d.ts for VS code API.
  let transform: any = {};
  Object.assign(transform, document);
  transform.uri = document.uri.toString();
  return transform;
}

function _getCurrentSymbol(symbols: vscode.SymbolInformation[], position: vscode.Position): vscode.SymbolInformation {
  return _.findLast(symbols, (symbol: vscode.SymbolInformation) => {
    return new vscode.Range(symbol.location.range.start, symbol.location.range.end).contains(position);
  });
}

function _createRange(oldRangeObject: vscode.Range) {
  // Necessary because the API is incompatible between htmlLanguage service and new vs code versions
  return new vscode.Range(oldRangeObject.start, oldRangeObject.end);
}

interface IScanOfAttributeValue {
  attributeName: string;
  attributeValue: string;
  activeUnderCursor: boolean;
  rangeInDocument: vscode.Range;
}

function getScanOfActiveAttributeValue(
  document: vscode.TextDocument,
  position: vscode.Position
): IScanOfAttributeValue {
  return _.find(doCompleteScanOfCurrentSymbol(document, position), scan => scan.activeUnderCursor);
}
