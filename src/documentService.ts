import * as vscode from 'vscode';
import * as _ from 'lodash';
import { ReferenceDocumentation, IDocumentation } from './referenceDocumentation';
import { getLanguageService, LanguageService, TokenType } from 'vscode-html-languageservice';
import { validMimeTypes } from './validResultTemplatesMimeTypes';
const htmlLangService: LanguageService = getLanguageService();

export interface IScanOfAttributeValue {
  attributeName: string;
  attributeValue: string;
  activeUnderCursor: boolean;
  rangeInDocument: vscode.Range;
}

export function formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions) {
  const transformedDoc = _transformTextDocumentApi(document);
  const range = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));

  return htmlLangService.format(transformedDoc, range, options);
}

export function getComponentAtPosition(
  referenceDocumentation: ReferenceDocumentation,
  position: vscode.Position,
  document: vscode.TextDocument
): IDocumentation | undefined {
  const transformedDoc = _transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  const symbols = _transformSymbols(<any>htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc));
  const currentSymbol = _getCurrentSymbol(symbols, position);
  if (currentSymbol) {
    return referenceDocumentation.getDocumentation(currentSymbol);
  }

  return undefined;
}

export function getComponentSuggestionAtPosition(
  referenceDocumentation: ReferenceDocumentation,
  position: vscode.Position,
  document: vscode.TextDocument
) {
  const scanned = doCompleteScanOfCurrentSymbol(document, position);
  const active = _.find(scanned, scan => scan.activeUnderCursor);
  if (active && active.attributeName && active.attributeName.toLowerCase() == 'class') {
    return referenceDocumentation.getAllComponents();
  }
  return undefined;
}

export async function getResultTemplateComponentAtPosition(
  referenceDocumentation: ReferenceDocumentation,
  position: vscode.Position,
  document: vscode.TextDocument
) {
  const resultTemplateAtPosition = getResultTemplateAtPosition(position, document);
  if (resultTemplateAtPosition) {
    const { newDocument, newPosition } = await _transformDocAndPositionForResultTemplate(
      resultTemplateAtPosition,
      document,
      position
    );
    return getComponentAtPosition(referenceDocumentation, newPosition, newDocument);
  }
  return undefined;
}

export function getResultTemplateAtPosition(
  position: vscode.Position,
  document: vscode.TextDocument
): vscode.SymbolInformation | undefined {
  const transformedDoc = _transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  const symbols = _transformSymbols(<any>htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc));
  const currentSymbol = _getCurrentSymbol(symbols, position);
  const allTemplates = getAllPossibleResultTemplatesSymbols(document);

  if (currentSymbol) {
    const currentTemplate = _.find(allTemplates, template =>
      template.location.range.isEqual(currentSymbol.location.range)
    );

    if (currentTemplate) {
      return currentTemplate;
    }
  }

  return undefined;
}

export async function getResultTemplateComponentOptionAtPosition(
  referenceDocumentation: ReferenceDocumentation,
  position: vscode.Position,
  document: vscode.TextDocument
) {
  const resultTemplateAtPosition = getResultTemplateAtPosition(position, document);
  const resultTemplateComponentAtPosition = await getResultTemplateComponentAtPosition(
    referenceDocumentation,
    position,
    document
  );
  if (resultTemplateAtPosition && resultTemplateComponentAtPosition) {
    const { newDocument, newPosition } = await _transformDocAndPositionForResultTemplate(
      resultTemplateAtPosition,
      document,
      position
    );
    const currentActiveAttribute = _getScanOfActiveAttributeValue(newDocument, newPosition);

    if (currentActiveAttribute) {
      const optionThatMatch = _.find(
        resultTemplateComponentAtPosition.options,
        option => `${ReferenceDocumentation.camelCaseToHyphen(option.name)}` == currentActiveAttribute.attributeName
      );

      return optionThatMatch;
    }
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
    const currentActiveAttribute = _getScanOfActiveAttributeValue(document, position);

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

export function getResultTemplateAttributeAtPosition(
  position: vscode.Position,
  document: vscode.TextDocument
): IScanOfAttributeValue | undefined {
  const currentTemplate = getResultTemplateAtPosition(position, document);

  if (currentTemplate) {
    const currentActiveAttribute = _getScanOfActiveAttributeValue(document, position);

    if (currentActiveAttribute) {
      const attributeNameLowerCase = currentActiveAttribute.attributeName.toLowerCase();
      if (attributeNameLowerCase == 'class' || attributeNameLowerCase == 'type') {
        return currentActiveAttribute;
      }
    }
  }

  return undefined;
}

export function getAllComponentsSymbol(
  referenceDocumentation: ReferenceDocumentation,
  document: vscode.TextDocument
): vscode.SymbolInformation[] {
  const transformedDoc = _transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  const symbols = _transformSymbols(<any>htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc));

  return _.filter(symbols, (symbol: vscode.SymbolInformation) => {
    return referenceDocumentation.getDocumentation(symbol) != null;
  });
}

export function getAllPossibleResultTemplatesSymbols(document: vscode.TextDocument) {
  const transformedDoc = _transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  const symbols = _transformSymbols(<any>htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc));

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
  const transformedDoc = _transformTextDocumentApi(document);
  const htmlDoc = htmlLangService.parseHTMLDocument(transformedDoc);
  const symbols = _transformSymbols(<any>htmlLangService.findDocumentSymbols(transformedDoc, htmlDoc));

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
  scanner.scan();

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

      scanner.scan();

      if (scanner.getTokenType() == TokenType.DelimiterAssign) {
        scanner.scan();

        if (scanner.getTokenType() == TokenType.AttributeValue) {
          attributeValue = scanner.getTokenText().replace(/['"]/g, '');
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

    scanner.scan();
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

export function getContentOfTemplate(template: vscode.SymbolInformation, document: vscode.TextDocument): string {
  const scanner = htmlLangService.createScanner(document.getText(_createRange(template.location.range)));
  let doScan: number = scanner.scan();
  let content = '';

  while (
    doScan != TokenType.EOS &&
    doScan != TokenType.EndTag &&
    doScan != TokenType.EndTagClose &&
    doScan != TokenType.Unknown
  ) {
    if (doScan == TokenType.Script) {
      content += scanner.getTokenText();
    }

    doScan = scanner.scan();
  }

  return content;
}

function _transformTextDocumentApi(document: vscode.TextDocument) {
  // Necessary because the API is incompatible between htmlLanguage service and new vs code versions
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

function _transformSymbols(symbols: vscode.SymbolInformation[]): vscode.SymbolInformation[] {
  // Necessary because the API is incompatible between htmlLanguage service and new vs code versions
  return symbols.map(symbol => _transformRange(symbol));
}

function _transformRange(symbol: vscode.SymbolInformation) {
  // Necessary because the API is incompatible between htmlLanguage service and new vs code versions
  symbol.location = new vscode.Location(
    symbol.location.uri,
    new vscode.Range(symbol.location.range.start, symbol.location.range.end)
  );
  return symbol;
}

function _getScanOfActiveAttributeValue(
  document: vscode.TextDocument,
  position: vscode.Position
): IScanOfAttributeValue | undefined {
  return _.find(doCompleteScanOfCurrentSymbol(document, position), scan => scan.activeUnderCursor);
}

async function _transformDocAndPositionForResultTemplate(
  resultTemplate: vscode.SymbolInformation,
  document: vscode.TextDocument,
  position: vscode.Position
) {
  const newDocument = await vscode.workspace.openTextDocument({
    content: getContentOfTemplate(resultTemplate, document)
  });
  const newPosition = position.translate(-resultTemplate.location.range.start.line);
  return {
    newDocument,
    newPosition
  };
}
