import * as vscode from 'vscode';
import { ReferenceDocumentation, IDocumentation } from './referenceDocumentation';
import * as _ from 'lodash';
import { getLanguageService, LanguageService } from 'vscode-html-languageservice';

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

export function getAllComponentsSymbol(componentsInfo, document: vscode.TextDocument): vscode.SymbolInformation[] {
  const transformedDoc = transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  // This needs to be done because there's an incompatibility between the htmllanguage service type and the latest d.ts for VS code API
  const symbols = <any>htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc);
  return _.filter(symbols, (symbol: vscode.SymbolInformation) => {
    return componentsInfo.getComponent(symbol) != null;
  });
}

export function getCurrentSymbol(
  componentsInfo: ReferenceDocumentation,
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
  let transform;
  Object.assign(transform, document);
  transform.uri = document.uri.toString();
  return transform;
}

function _getCurrentSymbol(symbols: vscode.SymbolInformation[], position: vscode.Position): vscode.SymbolInformation {
  return _.findLast(symbols, (symbol: vscode.SymbolInformation) => {
    return new vscode.Range(symbol.location.range.start, symbol.location.range.end).contains(position);
  });
}
