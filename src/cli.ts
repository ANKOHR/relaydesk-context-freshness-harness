import { resolve } from "node:path";
import { loadSource } from "./ingest.js";
import { retrieve } from "./retrieve.js";
import { ContextStore, canonicalJson } from "./store.js";

const [, , command, ...args] = process.argv;
const root = resolve(process.cwd());
const store = new ContextStore(resolve(root, "state"));

if (command === "ingest") {
  for (const path of args) console.log(canonicalJson(store.ingest(loadSource(resolve(root, path)))));
} else if (command === "retrieve") {
  console.log(JSON.stringify(retrieve(store.current(), args.join(" ")), null, 2));
} else if (command === "rebuild") {
  console.log(JSON.stringify(store.rebuildCurrent(), null, 2));
} else {
  console.error("usage: ingest <files...> | retrieve <query...> | rebuild");
  process.exitCode = 2;
}
