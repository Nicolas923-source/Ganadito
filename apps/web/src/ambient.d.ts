/// <reference types="vite/client" />

declare module '$app/environment' {
  export const browser: boolean;
  export const dev: boolean;
  export const building: boolean;
  export const version: string;
}

declare module '$app/env' {
  export const browser: boolean;
  export const dev: boolean;
  export const building: boolean;
  export const version: string;
}

declare module '$app/state' {
  export const page: {
    params: Record<string, string>;
    url: URL;
    status: number;
    error: any;
    data: any;
  };
}

declare module '$app/stores' {
  export const page: any;
}
