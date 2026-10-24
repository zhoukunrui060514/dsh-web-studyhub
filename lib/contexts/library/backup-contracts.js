const text = { type: 'string' }, object = { type: 'object', additionalProperties: true };
const schema = (properties, required, description) => ({ input: { type: 'object', properties, required, additionalProperties: false }, output: object, description });
export const backupSchemas = {
  'backup.export.prepare': schema({}, [], 'Prepare a bounded single-file or multipart portable backup including all referenced images.'),
  'backup.export.part': schema({ transferId: text, name: text }, ['transferId', 'name'], 'Read one prepared backup part, at most 8 MiB encoded.'),
  'backup.restore.prepare': schema({ manifest: object }, ['manifest'], 'Stage a verified portable manifest without replacing library state.'),
  'backup.restore.upload': schema({ transferId: text, part: object }, ['transferId', 'part'], 'Validate and stage one backup part, idempotently.'),
  'backup.restore.commit': schema({ transferId: text }, ['transferId'], 'Verify every staged part and all resources, then use the existing library restore.'),
};
