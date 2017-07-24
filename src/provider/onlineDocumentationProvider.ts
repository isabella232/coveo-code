import * as vscode from 'vscode';
import { getComponentAtPosition, getOptionAtPosition } from '../documentService';
import { ReferenceDocumentation } from '../referenceDocumentation';
import { l } from '../strings/Strings';

const baseComponentDocumentationLink = `https://coveo.github.io/search-ui/components/`;

export class OnlineDocumentationProvider {
  constructor(public referenceDocumentation: ReferenceDocumentation) {}

  public openDocumentation(position: vscode.Position, document: vscode.TextDocument) {
    const currentComponent = getComponentAtPosition(this.referenceDocumentation, position, document);
    const currentOption = getOptionAtPosition(this.referenceDocumentation, position, document);
    if (!currentComponent) {
      vscode.window.showInformationMessage(l('NoDocumentation'));
    } else {
      let componentLink = `${baseComponentDocumentationLink}${currentComponent.name.toLowerCase()}.html`;
      if (currentOption) {
        componentLink += `#options.${currentOption.name.toLowerCase()}`;
      }
      vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(componentLink));
    }
  }
}
