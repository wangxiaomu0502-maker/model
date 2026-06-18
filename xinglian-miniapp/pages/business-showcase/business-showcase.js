const {
  INTRO_POINTS,
  FLOW_STEPS,
  buildShowcaseCases,
  buildShowcaseSummary
} = require("../../utils/business-showcase-cases.js");

Page({
  data: {
    summary: buildShowcaseSummary(),
    introPoints: INTRO_POINTS,
    flowSteps: FLOW_STEPS,
    cases: buildShowcaseCases()
  }
});
