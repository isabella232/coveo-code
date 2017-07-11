const _ = require('lodash');
const writeFile = require('write');
const rawDocumentationJSON = require('coveo-search-ui/bin/docgen/docgen.json');

const documentations = {};

const formattedDocumentations = _.chain(rawDocumentationJSON)
  .filter((doc) => {
    return isComponent(doc);
  })
  .map((doc) => {
    return {
      name: doc.name,
      comment: doc.comment,
      options: []
    };
  })
  .value();

formattedDocumentations.forEach((formattedDocumentation) => {
  documentations[formattedDocumentation.name] = formattedDocumentation;

  rawDocumentationJSON.forEach((rawComment) => {
    const isOption = isComponentOption(formattedDocumentation, rawComment);
    if (isOption && isOption[1]) {
      const optFormatted = {
        name: isOption[1],
        comment: rawComment.comment
      };
      documentations[formattedDocumentation.name].options.push(optFormatted);
    }
  });
});

function isComponent(doc) {
  return /^[^.]+$/i.test(doc.name);
}

function isComponentOption(formattedDocumentation, rawComment) {
  const regex = new RegExp(`^${formattedDocumentation.name}\.options\.([a-zA-Z]+)$`, 'i');
  return rawComment.name.match(regex);
}

writeFile('./out/data/documentation.json', JSON.stringify(documentations));
