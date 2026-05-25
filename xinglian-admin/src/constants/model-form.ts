export const MODEL_PHOTO_ANGLES = [
  { key: "frontFull", label: "正面全身" },
  { key: "backFull", label: "背面全身" },
  { key: "leftFull", label: "左侧面全身" },
  { key: "rightFull", label: "右侧面全身" },
  { key: "halfFront", label: "半身正面" },
  { key: "faceCloseup", label: "面部特写" },
  { key: "dynamicFull", label: "全身动态" },
  { key: "bodyCurve", label: "三围展示" },
  { key: "bikiniLingerie", label: "比基尼/内衣" }
] as const;

export const MODEL_MEASUREMENT_FIELDS = [
  { key: "height", label: "身高", unit: "cm" },
  { key: "weight", label: "体重", unit: "kg" },
  { key: "bust", label: "胸围", unit: "cm" },
  { key: "waist", label: "腰围", unit: "cm" },
  { key: "hip", label: "臀围", unit: "cm" },
  { key: "shoulder", label: "肩宽", unit: "cm" },
  { key: "armSpan", label: "臂展", unit: "cm" },
  { key: "legLength", label: "腿长", unit: "cm" },
  { key: "shoeSize", label: "鞋码", unit: "码" }
] as const;

export const MODEL_HAIR_COLORS = ["黑色", "棕色", "深棕色", "浅棕色", "金色", "红棕色", "亚麻色", "其他"];
export const MODEL_SKIN_COLORS = ["白皙", "自然肤色", "小麦色", "健康古铜", "深色", "其他"];

export const DEFAULT_MODEL_MEASUREMENTS: Record<string, string> = {
  height: "168",
  weight: "48",
  bust: "84",
  waist: "62",
  hip: "90",
  shoulder: "40",
  armSpan: "168",
  legLength: "90",
  shoeSize: "37"
};
