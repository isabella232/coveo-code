import * as vscode from 'vscode';
import { getAllComponentsSymbol } from '../documentService';
import { ReferenceDocumentation } from '../referenceDocumentation';
import * as _ from 'lodash';

export class CodeLensProvider implements vscode.CodeLensProvider {
  constructor(public referenceDocumentation: ReferenceDocumentation) {}

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Thenable<vscode.CodeLens[]> {
    return new Promise((resolve, reject) => {
      const allComponentsSymbols = getAllComponentsSymbol(this.referenceDocumentation, document);
      let resolves: vscode.CodeLens[] = [];
      const onlineDoc = _.map(allComponentsSymbols, (componentSymbol: vscode.SymbolInformation) => {
        const documentation = this.referenceDocumentation.getDocumentation(componentSymbol);
        if (documentation) {
          return new vscode.CodeLens(componentSymbol.location.range, {
            title: `Coveo online documentation...`,
            command: 'vscode.open',
            arguments: [
              vscode.Uri.parse(`https://coveo.github.io/search-ui/components/${documentation.name.toLowerCase()}.html`)
            ],
            tooltip: `View online documentaion about the ${documentation.name} component`
          });
        }

        return undefined;
      });

      const previewHtml = _.map(allComponentsSymbols, (componentSymbol: vscode.SymbolInformation) => {
        const documentation = this.referenceDocumentation.getDocumentation(componentSymbol);
        if (documentation) {
          return new vscode.CodeLens(componentSymbol.location.range, {
            title: `Live preview`,
            command: 'vscode.previewHtml',
            arguments: [
              vscode.Uri.parse(`https://coveo.github.io/search-ui/components/${documentation.name.toLowerCase()}.html`)
            ],
            tooltip: `View online documentaion about the ${documentation.name} component`
          });
        }
        return undefined;
      });

      resolves = resolves.concat(_.compact(onlineDoc));
      resolve(resolves);
    });
  }

  public resolveCodeLens?(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens> {
    return null;
  }
}
