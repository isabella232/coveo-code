import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as htmlToText from 'html-to-text';
import * as removeMarkdown from 'remove-markdown';
import { ReferenceDocumentation, IDocumentation } from '../referenceDocumentation'
import { fromDocumentToComponent, getCurrentSymbol, fromDocumentToComponentOption } from "../documentService";

const camelCaseToHyphenRegex = /([A-Z])|\W+(\w)/g;

function camelCaseToHyphen(name: string) {
  return 'data-' + name.replace(camelCaseToHyphenRegex, '-$1$2').toLowerCase();
}

export class HTMLCompletionItemProvider implements vscode.CompletionItemProvider {

  constructor(public referenceDocumentation: ReferenceDocumentation) {
  }
  public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {

    return new Promise<vscode.CompletionItem[]>((resolve, reject) => {
      let completionItems: vscode.CompletionItem[] = [];
      document.getWordRangeAtPosition
      const currentComponent = fromDocumentToComponent(this.referenceDocumentation, position, document);
      const currentOptions = fromDocumentToComponentOption(this.referenceDocumentation, position, document);
      if (currentComponent) {
        const optionsCompletions: vscode.CompletionItem[] = currentComponent.options.map((option: IDocumentation) => {
          return new ComponentOptionCompletionItem(option);
        });
        completionItems = completionItems.concat(optionsCompletions);
      }

      resolve(completionItems);
    });
  }
}

class ComponentOptionCompletionItem extends vscode.CompletionItem {
  constructor(public info: IDocumentation) {
    super(camelCaseToHyphen(info.name), vscode.CompletionItemKind.Text);
    this.documentation = htmlToText.fromString(info.comment, {
      ignoreHref: true,
      wordwrap: null,
      preserveNewlines: true
    });
    this.kind = vscode.CompletionItemKind.Value;
  }
}