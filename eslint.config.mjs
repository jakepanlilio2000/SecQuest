import js from "@eslint/js";
import globals from "globals";
import babelParser from "@babel/eslint-parser";
import nextPlugin from "@next/eslint-plugin-next";
export default [
  {ignores:["node_modules/**",".next/**","data/**",".npm-cache/**","playwright-report/**","test-results/**","next-env.d.ts"]},
  {files:["**/*.{js,mjs,cjs,ts,tsx}"],languageOptions:{parser:babelParser,ecmaVersion:"latest",sourceType:"module",globals:{...globals.browser,...globals.node},parserOptions:{requireConfigFile:false,babelOptions:{babelrc:false,configFile:false,parserOpts:{plugins:["typescript","jsx"]}}}},plugins:{"@next/next":nextPlugin},rules:{...js.configs.recommended.rules,...nextPlugin.configs["core-web-vitals"].rules,"no-undef":"off","no-unused-vars":"off","no-empty":["error",{allowEmptyCatch:true}]}},
];

