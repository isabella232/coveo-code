import * as vscode from 'vscode';
import * as _ from 'lodash';
import { CompletionItemForResultTemplateCondition } from './completionItemForResultTemplateCondition';
import { CompletionItemForResultTemplateClass } from './completionItemForResultTemplateClass';
import { CompletionItemForResultTemplateType } from './completionItemForResultTemplateType';
import { validMimeTypes } from '../validResultTemplatesMimeTypes';
import { IScanOfAttributeValue } from '../documentService';

export class ResultTemplate {
  public getCompletionsForAttributes(): vscode.CompletionItem[] {
    const ret: vscode.CompletionItem[] = [];
    ret.push(new CompletionItemForResultTemplateCondition());
    return ret;
  }
  public getCompletionsForAttributesValues(scan: IScanOfAttributeValue) {
    const ret: vscode.CompletionItem[] = [];
    if (scan.attributeName.toLowerCase() == 'class') {
      if (!/result-template/.test(scan.attributeValue)) {
        ret.push(new CompletionItemForResultTemplateClass());
      }
    }
    if (scan.attributeName.toLowerCase() == 'type') {
      if (_.indexOf(validMimeTypes, scan.attributeValue) == -1) {
        ret.push(new CompletionItemForResultTemplateType('text/html', 'HTML'));
        ret.push(new CompletionItemForResultTemplateType('text/underscore', 'underscore'));
      }
    }
    return ret;
  }
}
