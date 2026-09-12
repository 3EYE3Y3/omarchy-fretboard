import fs from "node:fs"
import vm from "node:vm"
import { fileURLToPath } from "node:url"

export function loadQmlJs(path) {
  const filename = path instanceof URL ? fileURLToPath(path) : String(path)
  const source = fs.readFileSync(filename, "utf8").replace(/^\.pragma library\s*/m, "")
  const context = vm.createContext({ Date, Math, Number, String, Array, Object, JSON, RegExp, isFinite, NaN, encodeURIComponent })
  vm.runInContext(source, context, { filename })
  return context
}
