const MODEL_LIST_TAB_URL = "/pages/model-list/model-list";
const HOME_INTRO_URL = "/pages/home-intro/home-intro";

function getCurrentPageRoute() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  return (current && current.route) || "";
}

function isOnHomeIntroPage() {
  return getCurrentPageRoute() === "pages/home-intro/home-intro";
}

function switchToModelListTab() {
  const app = getApp();
  if (isOnHomeIntroPage()) {
    app.globalData.modelListFromHomeIntro = true;
  }
  wx.switchTab({ url: MODEL_LIST_TAB_URL });
}

function consumeModelListFromHomeIntro() {
  const app = getApp();
  const fromHomeIntro = Boolean(app.globalData.modelListFromHomeIntro);
  app.globalData.modelListFromHomeIntro = false;
  return fromHomeIntro;
}

function backToHomeIntro() {
  wx.reLaunch({ url: HOME_INTRO_URL });
}

module.exports = {
  switchToModelListTab,
  consumeModelListFromHomeIntro,
  backToHomeIntro
};
