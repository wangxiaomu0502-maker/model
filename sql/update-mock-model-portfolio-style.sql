-- 为所有 mock 模特补齐：风格定位 5 张；作品集 2 个文件夹 × 各 2 张
-- 执行（务必带 utf8mb4，否则中文文件夹名会乱码）：
--   mysql --default-character-set=utf8mb4 -h... -u... -p xinglian < sql/update-mock-model-portfolio-style.sql

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @mock_img_url := 'https://xinglian-1426391077.cos.ap-beijing.myqcloud.com/models/cards/2/1779087606774.jpg';

SET @style_position_json := JSON_OBJECT(
  'photos',
  JSON_ARRAY(
    JSON_OBJECT('id', 'mock_sp_1', 'url', @mock_img_url),
    JSON_OBJECT('id', 'mock_sp_2', 'url', @mock_img_url),
    JSON_OBJECT('id', 'mock_sp_3', 'url', @mock_img_url),
    JSON_OBJECT('id', 'mock_sp_4', 'url', @mock_img_url),
    JSON_OBJECT('id', 'mock_sp_5', 'url', @mock_img_url)
  )
);

SET @portfolio_json := JSON_OBJECT(
  'folders',
  JSON_ARRAY(
    JSON_OBJECT('id', 'mock_folder_1', 'name', '商拍案例', 'coverPhotoId', 'mock_pf_1_1'),
    JSON_OBJECT('id', 'mock_folder_2', 'name', '走秀活动', 'coverPhotoId', 'mock_pf_2_1')
  ),
  'photos',
  JSON_ARRAY(
    JSON_OBJECT('id', 'mock_pf_1_1', 'folderId', 'mock_folder_1', 'url', @mock_img_url),
    JSON_OBJECT('id', 'mock_pf_1_2', 'folderId', 'mock_folder_1', 'url', @mock_img_url),
    JSON_OBJECT('id', 'mock_pf_2_1', 'folderId', 'mock_folder_2', 'url', @mock_img_url),
    JSON_OBJECT('id', 'mock_pf_2_2', 'folderId', 'mock_folder_2', 'url', @mock_img_url)
  )
);

INSERT INTO model_extra_data (user_id)
SELECT u.id
FROM users u
WHERE u.role = 1
  AND COALESCE(u.is_mock, 0) = 1
  AND NOT EXISTS (
    SELECT 1 FROM model_extra_data mex WHERE mex.user_id = u.id
  );

UPDATE model_extra_data mex
INNER JOIN users u ON u.id = mex.user_id
   AND u.role = 1
   AND COALESCE(u.is_mock, 0) = 1
SET mex.style_position_json = @style_position_json,
    mex.portfolio_json = @portfolio_json;
