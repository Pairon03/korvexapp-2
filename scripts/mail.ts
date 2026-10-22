import { readdir, readFile } from "node:fs/promises";
const files = (await readdir(".local/mail")).sort();
console.log(await readFile(`.local/mail/${files.at(-1)}`, "utf8"));
