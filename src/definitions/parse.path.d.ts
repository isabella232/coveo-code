export interface IParsedPath {
  absolute: string;
  base: string;
  basename: string;
  dir: string;
  dirname: string;
  ext: string;
  extname: string;
  isAbsolute: boolean;
  name: string;
  path: string;
  root: string;
  stem: string;
}

export function pathParser(path: string): IParsedPath;
