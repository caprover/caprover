const store = window.localStorage;

class StorageHelper {
  getSomeKey() {
    return !!store.getItem("SomeKey");
  }

  setSomeKey() {
    store.setItem("SomeKey", "1");
  }
}

const instance = new StorageHelper();
export default instance;
