declare global {
  interface ImportMeta {
    main: boolean;
  }
  var process: {
    env: Record<string, string | undefined>;
    exit(code?: number): never;
  };
}
export {};
