import { DATABASE_VERSION } from "./constants";

type TableLayout = {
  key: boolean;
  [key: string]: boolean;
};

export class Database {
  private database!: IDBDatabase; // Use definite assignment assertion

  constructor() {
    const request = window.indexedDB.open("database", DATABASE_VERSION);

    request.onerror = () => {
      throw new Error("Database could not be opened!");
    };

    request.onsuccess = (event: Event) => {
      console.log("Database request was successful.");

      const target = event.target as IDBOpenDBRequest;
      this.database = target.result;

      this.database.onerror = (event: Event) => {
        const target = event.target as IDBRequest;
        throw new Error(
          (target.error as DOMException)?.message ?? "Database error",
        );
      };
    };

    // Handle DB version upgrade (needed for createObjectStore)
    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      console.log("Database upgrade triggered.");
      const target = event.target as IDBOpenDBRequest;
      this.database = target.result;
    };
  }

  createTable(name: string, layout: TableLayout) {
    if (!this.database) throw new Error("Database not initialized yet.");

    const columns = Object.keys(layout);
    if (columns.length === 0) return;

    const store = this.database.createObjectStore(name, {
      keyPath: columns[0],
    });

    for (const [column, unique] of Object.entries(layout)) {
      store.createIndex(column, column, { unique });
    }
  }

  async retrieveEntry<T>(table: string, key: string): Promise<T | undefined> {
    if (!this.database) throw new Error("Database not initialized yet.");

    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction(table, "readonly");
      const store = transaction.objectStore(table);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }

  async store(table: string, data: Record<string, any>): Promise<void> {
    if (!this.database) throw new Error("Database not initialized yet.");

    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction(table, "readwrite");
      const store = transaction.objectStore(table);
      const request = store.put(data); // use put to allow updates

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
