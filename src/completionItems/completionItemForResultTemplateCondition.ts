import * as vscode from 'vscode';
import * as htmlToText from 'html-to-text';

const inlineDocumentationForCondition = `<p>To determine which result template applies by explicitly using field values, you have to add one or several data-field- attributes to the script tag of each result template under the ResultList component.</p>
<p>
The following rules apply:
</p>
<ul>
<li>In each data-field-[somefieldname] attribute, you can replace [somefieldname] by any field (e.g.,  data-field-author, data-field-filetype, data-field-source, data-field-sfid, etc.).</li>

<li>You can either specify no value (e.g., data-field-author), a single value (e.g., data-field-author='John Doe') or several comma-separated values (e.g., data-field-author='John Doe,Jane Doe,John Smith,Jane Smith') for a field.
Specifying no value will return true if the required field for the current QueryResult contains any value (i.e., if it is not null).
Specifying a single value will return true if the required field value for the current QueryResult matches the specified value.

When specifying a list of values, each comma effectively act as a OR logical operator. Therefore, the required field value for the current QueryResult only has to match one of the comma-separated values to satisfy the condition.</li>

<li>You can add several data-field- attributes to a single result template script tag (e.g., <script id=myId class='result-template' type='text/underscore' data-field-myfirstfield='foo,bar' data-field-mysecond-field='baz'>[...]</script>).
Each new data-field- effectively adds a AND logical operator to the logical expression. Therefore, a QueryResult must satisfy each individual data-field- condition in a result template script tag to satisfy the entire expression.</li>

<li>The data-field- attribute is optional. If you do not add one to the script tag of one of your result templates, it will fallback to its default value, which is true.</li>
</ul>
<p>
This means that this result template will always apply when it is evaluated.
</p>
`;

export class CompletionItemForResultTemplateCondition extends vscode.CompletionItem {
  constructor() {
    super('data-field-{replace with field name} (coveo)', vscode.CompletionItemKind.TypeParameter);
    this.documentation = htmlToText.fromString(inlineDocumentationForCondition, {
      ignoreHref: true,
      wordwrap: null,
      preserveNewlines: true
    });
    this.insertText = 'data-field-{replace with field name}';
  }
}
