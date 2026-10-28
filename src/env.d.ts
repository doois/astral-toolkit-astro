/// <reference types="astro/client" />

declare module "astral:config" {
  const config: import("./lib/routes.ts").AstralConfig;
  export default config;
}

declare namespace App {
  interface Locals {
    /** Cache tags of what the page rendered (the middleware sends them as Cache-Tag and keys the HTML cache by them). */
    tags: string[];
    /** How many images the page rendered so far: the first one is the eager, high-priority one. */
    images: number;
  }
}
