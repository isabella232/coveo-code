import { ISalesforceAuraDefinition } from './salesforceAPI';
import { DiffResult, SalesforceLocalFileManager } from './salesforceLocalFileManager';
import { SalesforceConfig } from './salesforceConfig';
import { SalesforceResourceType } from '../filetypes/filetypesConverter';
const parsepath = require('parse-filepath');

export class SalesforceAura {
  public static coerceApiNameToEnum(bundleFile: ISalesforceAuraDefinition): SalesforceResourceType {
    return SalesforceResourceType[`AURA_${bundleFile.DefType}` as any] as SalesforceResourceType;
  }

  public async extract(name: string, bundle: ISalesforceAuraDefinition[], config: SalesforceConfig) {
    /*const output = */ await bundle.map(async fileInBundle => {
      const standardPath = SalesforceLocalFileManager.getStandardPathOfFileLocally(
        name,
        SalesforceAura.coerceApiNameToEnum(fileInBundle),
        config
      );
      if (standardPath) {
        const baseName = parsepath(standardPath).basename;
        const outcome = await SalesforceLocalFileManager.diffComponentWithLocalVersion(
          name,
          SalesforceAura.coerceApiNameToEnum(fileInBundle),
          config,
          standardPath
        );
        if (outcome == DiffResult.FILE_DOES_NOT_EXIST_LOCALLY) {
          return SalesforceLocalFileManager.saveFile(baseName, fileInBundle.Source, standardPath);
        }
      }

      return null;
    });
  }
}
