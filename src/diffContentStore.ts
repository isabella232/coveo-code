export class DiffContentStore {
  private static store: { [key: string]: string } = {};

  public static add(key: string, content: string) {
    DiffContentStore.store[key] = content;
  }

  public static remove(key: string) {
    if (DiffContentStore.store[key]) {
      delete DiffContentStore.store[key];
    }
  }

  public static get(key: string) {
    return DiffContentStore.store[key];
  }

  public static reset() {
    DiffContentStore.store = {};
  }
}
