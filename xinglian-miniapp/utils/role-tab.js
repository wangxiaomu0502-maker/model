/** 各角色登录/注册后默认进入的 tab 页（须已在 app.json tabBar.list 注册） */
function homeTabPathForRole(role) {
  const r = Number(role);
  if (r >= 1 && r <= 5) return "pages/home/home";
  return null;
}

function homeTabUrlForRole(role) {
  const path = homeTabPathForRole(role);
  return path ? `/${path}` : null;
}

module.exports = { homeTabPathForRole, homeTabUrlForRole };
