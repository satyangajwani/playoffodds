// Re-export the generated CSS module. Splitting it out lets us swap to a Workers Assets
// binding in Phase E without rippling import changes through the templates.

export { styleSheetText } from "./styles.gen.ts";
