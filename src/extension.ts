'use strict';

import * as vscode from 'vscode';
import { ReferenceDocumentation } from './referenceDocumentation';
import { CodeLensProvider } from './provider/codeLensProvider';

const refererenceDocumentation = new ReferenceDocumentation();

export function activate(context: vscode.ExtensionContext) {

    const codeLensProvider = vscode.languages.registerCodeLensProvider('html', new CodeLensProvider(refererenceDocumentation));

    context.subscriptions.push(codeLensProvider);
}