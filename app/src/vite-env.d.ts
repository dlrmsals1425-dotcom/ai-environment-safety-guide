/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VWORLD_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
