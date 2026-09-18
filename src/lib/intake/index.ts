export type {
  IntakePublicStatus,
  IntakeSettings,
  IntakeSettingsPatch,
} from "./types";
export {
  resolveIntakeStatus,
  shouldAutoOpen,
} from "./status";
export {
  formatReopensAtForDisplay,
  substituteFechaPlaceholder,
} from "./format-fecha";
export {
  getIntakeSettings,
  patchIntakeSettings,
  validateIntakePatch,
} from "./service";
export { corsHeaders, withCors, resolveCorsOrigin } from "./cors";
