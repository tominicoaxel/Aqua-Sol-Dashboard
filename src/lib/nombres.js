// ─── Cómo se decide que dos nombres son la misma persona ────────────────────
// "Sofía Ferreyra", "SOFIA FERREYRA" y "sofia  ferreyra" son una sola clienta. La
// regla vive en su propio archivo por dos motivos:
//
//  1. Tiene que haber UNA definición. El importador la usa para cruzar filas, la
//     base la guarda en `nombre_normalizado` y su índice único se apoya en ella.
//     Dos implementaciones que puedan divergir significan clientes duplicados.
//
//  2. `importer.js` arrastra SheetJS (512 kB) y se carga bajo demanda. Si el mapeo
//     de la base importara desde ahí para conseguir esta función, se llevaría la
//     biblioteca de planillas entera al bundle principal — que es exactamente lo
//     que la carga diferida evita.

/** Minúsculas, sin acentos y sin símbolos: la forma comparable de un texto. */
export const normalizar = (t) =>
  String(t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** La clave de identidad de una persona, con los espacios colapsados. */
export const claveNombre = (n) => normalizar(n).replace(/\s+/g, ' ')
