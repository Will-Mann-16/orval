import fs from 'fs-extra';
import { generateModelsInline, generateMutatorImports } from '../generators';
import { WriteModeProps } from '../types';
import {
  camel,
  getFileInfo,
  isFunction,
  isSyntheticDefaultImportsAllow,
  upath,
} from '../utils';
import { generateTarget } from './target';
import { getOrvalGeneratedTypes } from './types';

export const writeSingleMode = async ({
  builder,
  output,
  specsName,
  header,
  needSchema,
}: WriteModeProps): Promise<string[]> => {
  try {
    const { path, dirname } = getFileInfo(output.target, {
      backupFilename: camel(builder.info.title),
    });

    const {
      imports,
      importsMock,
      implementation,
      implementationMock,
      mutators,
      clientMutators,
      formData,
      formUrlEncoded,
      paramsSerializer,
    } = generateTarget(builder, output);

    let data = header;

    const schemasPath = output.schemas
      ? upath.relativeSafe(dirname, getFileInfo(output.schemas).dirname)
      : undefined;

    const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
      output.tsconfig,
    );

    data += builder.imports({
      client: output.client,
      implementation,
      imports: schemasPath
        ? [
            {
              exports: imports.filter(
                (imp) =>
                  !importsMock.some((impMock) => imp.name === impMock.name),
              ),
              dependency: schemasPath,
            },
          ]
        : [],
      specsName,
      hasSchemaDir: !!output.schemas,
      isAllowSyntheticDefaultImports,
      hasGlobalMutator: !!output.override.mutator,
      hasParamsSerializerOptions: !!output.override.paramsSerializerOptions,
      packageJson: output.packageJson,
    });

    if (output.mock) {
      data += builder.importsMock({
        implementation: implementationMock,
        imports: schemasPath
          ? [{ exports: importsMock, dependency: schemasPath }]
          : [],
        specsName,
        hasSchemaDir: !!output.schemas,
        isAllowSyntheticDefaultImports,
        options: !isFunction(output.mock) ? output.mock : undefined,
      });
    }

    if (mutators) {
      data += generateMutatorImports({ mutators, implementation });
    }

    if (clientMutators) {
      data += generateMutatorImports({ mutators: clientMutators });
    }

    if (formData) {
      data += generateMutatorImports({ mutators: formData });
    }

    if (formUrlEncoded) {
      data += generateMutatorImports({ mutators: formUrlEncoded });
    }

    if (paramsSerializer) {
      data += generateMutatorImports({ mutators: paramsSerializer });
    }

    if (implementation.includes('NonReadonly<')) {
      data += getOrvalGeneratedTypes();
      data += '\n';
    }

    if (!output.schemas && needSchema) {
      data += generateModelsInline(builder.schemas);
    }

    data += `\n\n${implementation}`;

    if (output.mock) {
      data += '\n\n';
      data += implementationMock;
    }

    await fs.outputFile(path, data);

    return [path];
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing file => ${e}`;
  }
};
