import { createMemoryReader, Reader, Writer } from "@previewjs/core/vfs";
import path from "path";
import { createVueTypeScriptReader } from "./vue-reader";

describe("createVueTypeScriptReader", () => {
  let memoryReader: Reader & Writer;
  let reader: Reader;

  beforeEach(() => {
    memoryReader = createMemoryReader();
    reader = createVueTypeScriptReader(memoryReader);
  });

  it("extracts from script", async () => {
    memoryReader.updateFile(
      path.join(__dirname, "virtual", "App.vue"),
      `
<template>
  <h1>{{ msg }}</h1>
</template>
<script lang="ts">
export default {
  name: 'App',
  props: {}
}
</script>

    `
    );
    const virtualFile = await reader.read(
      path.join(__dirname, "virtual", "App.vue.ts")
    );
    if (virtualFile?.kind !== "file") {
      throw new Error();
    }
    expect(await virtualFile.read()).toEqual(`
const pjs_component = {
    name: "App",
    props: {}
} as const;


import {PropType as PJS_PropType} from 'vue/types/options';

type PJS_OptionalPropType<T> = PJS_PropType<T> | {type: PJS_PropType<T>; required: false};
type PJS_RequiredPropType<T> = {type: PJS_PropType<T>; required: true};
type PJS_OptionalPropsKeys<T> = {
  [K in keyof T]: T[K] extends PJS_OptionalPropType<any> ? K : never;
}[keyof T];
type PJS_RequiredPropsKeys<T> = {
  [K in keyof T]: T[K] extends PJS_RequiredPropType<any> ? K : never;
}[keyof T];
type PJS_CombinedProps<T> = {
  [K in PJS_OptionalPropsKeys<T>]?: T[K] extends PJS_OptionalPropType<infer S> ? S : never;
} & {
  [K in PJS_RequiredPropsKeys<T>]: T[K] extends PJS_RequiredPropType<infer S> ? S : never;
};
type PJS_ExtractProps<T> = T extends { props: any } ? PJS_CombinedProps<T['props']> : {}
type PJS_Props = PJS_ExtractProps<typeof pjs_component>;
`);
  });
});
