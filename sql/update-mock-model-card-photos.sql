-- 将所有 mock 模特的模卡照片统一补齐为 9 张
-- 执行：mysql -h... -u... -p xinglian < sql/update-mock-model-card-photos.sql

SET @mock_card_url := 'https://xinglian-1426391077.cos.ap-beijing.myqcloud.com/models/cards/2/1779087606774.jpg';

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
SET mex.card_json = JSON_SET(
  COALESCE(mex.card_json, JSON_OBJECT()),
  '$.photoAngles',
  JSON_ARRAY(
    JSON_OBJECT('key', 'mock_1', 'label', '模卡1', 'url', @mock_card_url),
    JSON_OBJECT('key', 'mock_2', 'label', '模卡2', 'url', @mock_card_url),
    JSON_OBJECT('key', 'mock_3', 'label', '模卡3', 'url', @mock_card_url),
    JSON_OBJECT('key', 'mock_4', 'label', '模卡4', 'url', @mock_card_url),
    JSON_OBJECT('key', 'mock_5', 'label', '模卡5', 'url', @mock_card_url),
    JSON_OBJECT('key', 'mock_6', 'label', '模卡6', 'url', @mock_card_url),
    JSON_OBJECT('key', 'mock_7', 'label', '模卡7', 'url', @mock_card_url),
    JSON_OBJECT('key', 'mock_8', 'label', '模卡8', 'url', @mock_card_url),
    JSON_OBJECT('key', 'mock_9', 'label', '模卡9', 'url', @mock_card_url)
  )
);
