import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock localStorage globally before any module imports
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock IndexedDB for backup tests
Object.defineProperty(globalThis, "indexedDB", {
  value: {
    open: vi.fn(),
    deleteDatabase: vi.fn(),
    cmp: vi.fn(),
    databases: vi.fn(),
  },
  writable: true,
  configurable: true,
});

// Polyfill Blob.arrayBuffer() for jsdom using FileReader
if (typeof Blob !== "undefined" && typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
// Also ensure File has it (File inherits from Blob)
if (typeof File !== "undefined" && typeof File.prototype.arrayBuffer !== "function") {
  File.prototype.arrayBuffer = Blob.prototype.arrayBuffer;
}
