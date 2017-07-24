const i18n = require('i18n-2');

const i18ninstance = new i18n({
  locales: ['en'],
  extension: '.json'
});

export const l = (toTranslate: string, ...parameters: any[]) => {
  let funcArgs = [toTranslate];
  if (parameters) {
    funcArgs = funcArgs.concat(parameters);
  }
  return i18ninstance.__.apply(i18ninstance, funcArgs);
};
