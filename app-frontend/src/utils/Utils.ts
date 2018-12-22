import { number } from "prop-types";

export default {
  copyObject<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T;
  },

  map<T>(array: T[], callback: (value: T, index: number) => any): any[] {
    const rows: any[] = [];
    for (let index = 0; index < array.length; index++) {
      const element = array[index];
      rows.push(callback(element, index));
    }
    return rows;
  }
};
