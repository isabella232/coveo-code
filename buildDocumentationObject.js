const _ = require('lodash');
const writeFile = require('write');
const rawDocumentationJSON = require('coveo-search-ui/bin/docgen/docgen.json');

const documentations = {};

const formattedDocumentations = _.chain(rawDocumentationJSON)
  .filter(doc => isComponent(doc))
  .map(doc => {
    return {
      name: doc.name,
      comment: doc.comment,
      options: [],
      type: doc.type,
      constrainedValues: doc.constrainedValues,
      miscAttributes: doc.miscAttributes || {},
      isCoveoComponent: true
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
        comment: rawComment.comment,
        type: rawComment.type,
        constrainedValues: rawComment.constrainedValues,
        miscAttributes: rawComment.miscAttributes || {}
      };
      documentations[formattedDocumentation.name].options.push(optFormatted);
    }
  });
});

function isComponent(doc) {
  if (doc.isCoveoComponent != null) {
    return doc.isCoveoComponent;
  } else {
    const isInterface = /(^I)[a-z]+$/i.test(doc.name);
    const isController = /(^[a-z]+Controller$).*$/i.test(doc.name);
    const isEvent = /(^[a-z]+Event).*$/i.test(doc.name);
    const containsDot = /[.]+/i.test(doc.name)
    return !isInterface && !isController && !isEvent && !containsDot
  }
}

function isComponentOption(formattedDocumentation, rawComment) {
  const regex = new RegExp(`^${formattedDocumentation.name}\.options\.([a-zA-Z]+)$`, 'i');
  return rawComment.name.match(regex);
}

writeFile('./out/data/documentation.json', JSON.stringify(documentations));
