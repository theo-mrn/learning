import { Extension, wrappingInputRule } from "@tiptap/core";
import { buildOrderedListAttrsFromMarker } from "@tiptap/extension-list";

/** `i. ` en début de ligne ouvre une liste en romain minuscule.
 *
 * La règle d'entrée de `OrderedList` est `/^(\d+)\.\s$/` : elle ne réagit
 * qu'aux chiffres, donc taper « i. » ne produisait rien. Le reste de la
 * mécanique existe déjà en amont — l'attribut `type` de `orderedList` est
 * rendu en `type="i"`, que le navigateur numérote seul — il ne manquait que
 * le déclencheur.
 *
 * Volontairement limité aux romains, pas étendu à `a.` : une liste ouverte
 * par « a. » entrerait en conflit avec une phrase commençant par « a. »
 * (« a. condition »), alors que « i. » ne s'écrit pas en français courant.
 */
export const RomanList = Extension.create({
  name: "romanList",

  addInputRules() {
    const orderedList = this.editor.schema.nodes.orderedList;
    if (!orderedList) return [];

    return [
      wrappingInputRule({
        // Ancré sur les seuls caractères romains minuscules, et non sur
        // `[a-z]+`, pour ne pas avaler un mot suivi d'un point.
        find: /^\s*([ivxlcdm]+)\.\s$/,
        type: orderedList,
        getAttributes: (match) => buildOrderedListAttrsFromMarker(match[1]),
        // Une liste romaine déjà ouverte juste au-dessus absorbe l'élément
        // plutôt que d'en démarrer une seconde qui repartirait à « i. ».
        joinPredicate: (_match, node) => node.attrs.type === "i",
      }),
    ];
  },
});
