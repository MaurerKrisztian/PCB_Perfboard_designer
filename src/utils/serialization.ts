export function serialize(instance) {
  return  JSON.stringify(instance);
}

export function unserialize(str, theClass) {
  const instance = new theClass();                  // NOTE: if your constructor checks for unpassed arguments, then just pass dummy ones to prevent throwing an error
  const serializedObject = str//JSON.parse(str);
  Object.assign(instance, serializedObject);
  return instance;
}
