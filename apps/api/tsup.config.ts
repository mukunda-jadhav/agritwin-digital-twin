import {defineConfig} from 'tsup';
export default defineConfig({entry:['src/server.ts'],format:['esm'],outDir:'dist',splitting:false,noExternal:['@agritwin/shared'],target:'node22'});
