-- 优化清屿光影（shoot_id=1）现有套餐备注
-- mysql --default-character-set=utf8mb4 -u root -p xinglian < sql/update-commercial-shoot-packages-remarks.sql

UPDATE commercial_shoot_packages SET remark = '身体数据三视图 1 张 · 图集 1 张 · 简单精修 10 张' WHERE id = 1;
UPDATE commercial_shoot_packages SET remark = '3 套风格服饰 · 3 组造型设计 · 精修单片 16 张' WHERE id = 2;
UPDATE commercial_shoot_packages SET remark = '5 套风格服饰 · 5 组造型设计 · 精修单片 26 张' WHERE id = 3;
UPDATE commercial_shoot_packages SET remark = '方案、妆造与拍摄内容一对一沟通 · 按实际需求定制报价' WHERE id = 4;
UPDATE commercial_shoot_packages SET remark = '资深团队全案定制 · 场景/妆造/修图全程一对一 · 专属档期优先' WHERE id = 5;
UPDATE commercial_shoot_packages SET remark = '含基础妆造 · 拍摄 1 张 · 精修交付 1 张' WHERE id = 6;
UPDATE commercial_shoot_packages SET remark = '标准证件照拍摄 · 基础修图 · 电子版 + 冲印 1 张' WHERE id = 7;
