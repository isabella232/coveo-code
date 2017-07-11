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
  return referenceDocumentation.getComponent(currentSymbol);
}

export function fromDocumentToComponentOption(referenceDocumentation: ReferenceDocumentation, position: vscode.Position, document: vscode.TextDocument) {
  const currentComponent = fromDocumentToComponent(referenceDocumentation, position, document);

  if (currentComponent) {
    const scanner = getScannerUnderCurrentCursorPosition(document, position);
    if(scanner.getTokenType() == TokenType.AttributeValue) {

    }
    // const currentWordRange = document.getWordRangeAtPosition(position, )
  }
}

export function getAllComponentsSymbol(referenceDocumentation: ReferenceDocumentation, document: vscode.TextDocument): vscode.SymbolInformation[] {
  const transformedDoc = transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  // This needs to be done because there's an incompatibility between the htmllanguage service type and the latest d.ts for VS code API
  const symbols = <any>htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc);
  return _.filter(symbols, (symbol: vscode.SymbolInformation) => {
    return referenceDocumentation.getComponent(symbol) != null;
  });
}

export function getCurrentSymbol(
  position: vscode.Position,
  document: vscode.TextDocument
) {
  const transformedDoc = transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  const symbols = htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc);
  return _getCurrentSymbol(<any>symbols, position);
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

function getScannerUnderCurrentCursorPosition(document: vscode.TextDocument, position: vscode.Position): Scanner {
  const currentSymbol = getCurrentSymbol(position, document);
  const scanner = htmlLangService.createScanner(document.getText(_createRange(currentSymbol.location.range)));
  const currentCursorOffset = document.offsetAt(position);
  const currentSymbolOffset = document.offsetAt(_createRange(currentSymbol.location.range).start);

  let cursorOffsetInSymbol = currentCursorOffset - currentSymbolOffset;

  let doScan = scanner.scan();
  while (doScan != TokenType.EOS) {
    if ((scanner.getTokenOffset() + scanner.getTokenLength()) < cursorOffsetInSymbol) {
      doScan = scanner.scan();
    } else {
      break;
    }
  }
  return scanner;
}

function getScannerPointToComponentOption(scanner: Scanner, document: vscode.TextDocument) {
  
}

function getTokenTypeUnderCursor(document: vscode.TextDocument, position: vscode.Position) {

}
