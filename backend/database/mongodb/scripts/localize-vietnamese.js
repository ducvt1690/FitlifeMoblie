'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFile } = require('node:process');
const { MongoClient } = require('mongodb');
const { collections } = require('../schema');

const NAME_VI = {
  I4hDWkc: 'Hít đất', lBDjFxJ: 'Kéo xà', iYzB0Cz: 'Squat với tạ đòn', ila4NZS: 'Deadlift tạ đòn',
  EIeI8Vf: 'Đẩy ngực với tạ đòn', A6wtbuL: 'Đẩy vai với tạ đơn', '3s4NnTh': 'Cuốn tạ tay',
  '1TVoin7': 'Duỗi tay sau với tạ đòn', IZVHb27: 'Chùng chân', RRWFUcw: 'Chùng chân với tạ đơn',
  '10Z2DXU': 'Đạp đùi máy', '17lJ1kr': 'Gập chân máy', '6HmFgmx': 'Nâng bắp chân',
  u0cNiij: 'Cầu mông', Pjbc0Kt: 'Đẩy hông', CosupLu: 'Plank xoay', '5VXmnV5': 'Plank nghiêng',
  '1ZFqTDN': 'Gập bụng đạp xe', Bn6TXyO: 'Gập bụng', XVDdcoj: 'Xoay eo', '4Ml7QFO': 'Nâng chân treo',
  RJgzwny: 'Leo núi', dK9394r: 'Burpee', e1e76I2: 'Nhảy dây', UVo2Qs2: 'Đá chân',
  LEprlgG: 'Kéo xô bằng cáp', A3P4O0R: 'Kéo cáp ngồi', '0CXGHya': 'Ép ngực bằng cáp',
  '0mB6wHO': 'Giãn cơ chạy bộ', '01qpYSe': 'Tư thế rắn hổ mang',
};

const BODY_VI = {
  back: 'Lưng', chest: 'Ngực', shoulders: 'Vai', 'upper legs': 'Đùi', 'lower legs': 'Bắp chân',
  waist: 'Bụng và eo', 'upper arms': 'Bắp tay', cardio: 'Cardio', neck: 'Cổ',
};
const EQUIPMENT_VI = {
  bodyweight: 'Trọng lượng cơ thể', barbell: 'Tạ đòn', dumbbell: 'Tạ đơn', cable: 'Cáp',
  machine: 'Máy tập', 'leverage machine': 'Máy tập', 'resistance band': 'Dây kháng lực',
  band: 'Dây kháng lực', weighted: 'Tạ thêm', rope: 'Dây', 'ab wheel': 'Con lăn bụng',
  sled: 'Máy đẩy tạ', 'sled machine': 'Máy đẩy tạ', 'stability ball': 'Bóng tập',
};
const MUSCLE_VI = {
  'erector spinae': 'Cơ dựng sống', deltoids: 'Cơ delta', pectorals: 'Cơ ngực', abdominals: 'Cơ bụng',
  'hip flexors': 'Cơ gấp hông', quadriceps: 'Cơ tứ đầu đùi', hamstrings: 'Cơ gân kheo',
  glutes: 'Cơ mông', biceps: 'Cơ nhị đầu', triceps: 'Cơ tam đầu', calves: 'Cơ bắp chân',
  'latissimus dorsi': 'Cơ lưng xô', 'upper back': 'Lưng trên', 'lower back': 'Thắt lưng', forearms: 'Cẳng tay',
};
const INSTRUCTIONS_VI = {
  I4hDWkc: ['Đặt hai tay rộng hơn vai, giữ thân người thành một đường thẳng.', 'Hạ ngực có kiểm soát về gần sàn.', 'Đẩy người trở lại và siết cơ ngực, cơ bụng.'],
  lBDjFxJ: ['Nắm thanh xà chắc chắn, hai tay rộng hơn vai.', 'Kéo người lên đến khi cằm vượt qua thanh xà.', 'Hạ xuống từ từ và giữ thân người ổn định.'],
  iYzB0Cz: ['Đặt tạ đòn trên vai và đứng vững.', 'Đẩy hông ra sau, gập gối hạ người xuống.', 'Đạp sàn đứng lên, giữ lưng trung lập.'],
  ila4NZS: ['Đứng trước tạ, chân rộng bằng hông và giữ lưng thẳng.', 'Đẩy hông ra sau, hạ người nắm thanh tạ.', 'Đạp sàn đứng lên, giữ tạ sát chân rồi hạ có kiểm soát.'],
  EIeI8Vf: ['Nằm trên ghế, hai chân đặt chắc trên sàn.', 'Hạ thanh tạ về ngực với khuỷu tay kiểm soát.', 'Đẩy thanh tạ lên và không khóa cứng khuỷu tay.'],
  A6wtbuL: ['Giữ tạ đơn ngang vai, thân người thẳng.', 'Đẩy tạ lên trên đầu khi thở ra.', 'Hạ tạ về vai thật chậm.'],
  '3s4NnTh': ['Giữ tạ hai bên thân, lòng bàn tay hướng lên.', 'Gập khuỷu tay cuốn tạ lên mà không vung người.', 'Hạ tạ chậm về vị trí ban đầu.'],
  '1TVoin7': ['Nằm trên ghế và giữ tạ đòn phía trên ngực.', 'Gập khuỷu tay hạ tạ về gần trán.', 'Duỗi tay đưa tạ về vị trí ban đầu.'],
  IZVHb27: ['Đứng thẳng, bước một chân về phía trước.', 'Hạ gối sau gần sàn, giữ gối trước cùng hướng mũi chân.', 'Đạp chân trước trở về tư thế đứng.'],
  RRWFUcw: ['Giữ tạ đơn hai bên thân và đứng thẳng.', 'Bước dài về trước, hạ người thành tư thế chùng chân.', 'Đẩy chân trước trở lại và đổi bên.'],
  '10Z2DXU': ['Đặt chân lên bàn đạp, lưng tựa vào ghế.', 'Gập gối hạ bàn đạp có kiểm soát.', 'Đạp duỗi chân rồi trở về mà không khóa gối.'],
  '17lJ1kr': ['Nằm sấp trên máy và đặt cổ chân vào đệm.', 'Gập gối kéo đệm về phía mông.', 'Hạ chân chậm về vị trí ban đầu.'],
  '6HmFgmx': ['Đứng vững trên bậc, giữ thăng bằng.', 'Nhón gót lên cao và siết bắp chân.', 'Hạ gót xuống chậm để căng cơ.'],
  u0cNiij: ['Nằm ngửa, co gối và đặt bàn chân trên sàn.', 'Đẩy hông lên, siết cơ mông ở điểm cao nhất.', 'Hạ hông chậm về sàn.'],
  Pjbc0Kt: ['Tựa lưng trên ghế, đặt tạ trên hông.', 'Đẩy hông lên đến khi thân người gần song song sàn.', 'Siết cơ mông rồi hạ hông có kiểm soát.'],
  CosupLu: ['Vào tư thế plank, giữ thân người thẳng.', 'Xoay người mở một tay lên trần.', 'Trở về plank và đổi bên, không võng lưng.'],
  '5VXmnV5': ['Nằm nghiêng, chống khuỷu tay dưới vai.', 'Nâng hông tạo thành một đường thẳng.', 'Giữ cơ bụng siết chặt rồi hạ xuống từ từ.'],
  '1ZFqTDN': ['Nằm ngửa, đặt tay sau đầu và nâng chân.', 'Xoay thân đưa khuỷu tay về gối đối diện.', 'Đổi bên nhịp nhàng, không kéo cổ.'],
  Bn6TXyO: ['Nằm ngửa, co gối và đặt bàn chân trên sàn.', 'Siết bụng nâng thân trên lên.', 'Hạ người chậm về sàn.'],
  XVDdcoj: ['Ngồi co gối, giữ lưng thẳng và hơi ngả người.', 'Xoay thân đưa tay sang hai bên.', 'Giữ bụng siết và chuyển động có kiểm soát.'],
  '4Ml7QFO': ['Treo người trên xà, giữ chân thẳng.', 'Siết bụng nâng chân lên ngang hông hoặc cao hơn.', 'Hạ chân từ từ, tránh đung đưa.'],
  RJgzwny: ['Vào tư thế plank cao, giữ vai trên cổ tay.', 'Luân phiên kéo gối về phía ngực.', 'Giữ hông ổn định và thở đều.'],
  dK9394r: ['Từ tư thế đứng, hạ người vào squat.', 'Đưa chân ra sau vào plank và thực hiện chống đẩy nếu phù hợp.', 'Thu chân rồi bật đứng lên.'],
  e1e76I2: ['Giữ dây ở hai tay và đứng thẳng.', 'Xoay cổ tay đưa dây qua đầu.', 'Nhảy nhẹ bằng mũi chân, giữ nhịp đều.'],
  UVo2Qs2: ['Nằm ngửa, duỗi chân và siết cơ bụng.', 'Luân phiên nâng chân thấp lên xuống.', 'Giữ lưng dưới áp sàn và thở đều.'],
  LEprlgG: ['Ngồi thẳng và nắm thanh kéo rộng hơn vai.', 'Kéo thanh về phía ngực trên, siết cơ lưng.', 'Thả thanh lên có kiểm soát.'],
  A3P4O0R: ['Ngồi thẳng, nắm tay cầm và giữ lưng trung lập.', 'Kéo tay cầm về phía bụng, ép hai bả vai.', 'Duỗi tay ra chậm mà không gù lưng.'],
  '0CXGHya': ['Đứng giữa hai tay cáp, chân vững.', 'Kéo hai tay vào trước ngực theo vòng cung.', 'Mở tay trở lại từ từ để căng cơ ngực.'],
  '0mB6wHO': ['Bước một chân ra trước và giữ gót chân chạm sàn.', 'Gập nhẹ người về phía chân trước.', 'Giữ lưng dài, thở đều rồi đổi bên.'],
  '01qpYSe': ['Nằm sấp, đặt tay cạnh ngực.', 'Duỗi tay nâng thân trên, giữ vai xa tai.', 'Giữ hông gần sàn và thở đều.'],
};

function translate(values, dictionary) {
  return values.map(value => dictionary[value.toLowerCase()] || value);
}

async function main() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) loadEnvFile(envPath);
  const uri = process.env.MONGODB_URI;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('Configure MONGODB_URI.');
  if (process.env.MONGODB_DB_NAME !== 'fitlife') throw new Error('MONGODB_DB_NAME must be fitlife.');
  const definition = collections.find(entry => entry.name === 'exercises');
  const client = new MongoClient(uri, { appName: 'FitLifeVietnameseLocalization', serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const db = client.db('fitlife');
    await db.command({ collMod: 'exercises', validator: definition.validator,
      validationLevel: definition.validationLevel, validationAction: definition.validationAction });
    const now = new Date();
    const rows = await db.collection('exercises').find({ source: 'exercisedb_v1' }).toArray();
    let localized = 0;
    for (const row of rows) {
      const name = NAME_VI[row.source_exercise_id];
      if (!name || !INSTRUCTIONS_VI[row.source_exercise_id]) throw new Error(`Missing Vietnamese mapping for ${row.source_exercise_id}.`);
      await db.collection('exercises').updateOne({ _id: row._id }, { $set: {
        name_vi: name,
        body_parts_vi: translate(row.body_parts, BODY_VI),
        equipments_vi: translate(row.equipments, EQUIPMENT_VI),
        target_muscles_vi: translate(row.target_muscles, MUSCLE_VI),
        secondary_muscles_vi: translate(row.secondary_muscles, MUSCLE_VI),
        instructions_vi: INSTRUCTIONS_VI[row.source_exercise_id],
        updated_at: now,
      } });
      localized += 1;
    }
    await db.collection('workout_logs').updateMany({ title: 'MMA Shadow Boxing' }, { $set: { title: 'Đấm gió MMA', updated_at: now } });
    await db.collection('workout_templates').updateMany({ title: 'MMA Shadow Boxing' }, { $set: { title: 'Đấm gió MMA', updated_at: now } });
    console.log(JSON.stringify({ database: 'fitlife', displayLanguage: 'vi', localizedExercises: localized,
      translatedWorkoutLabels: true }, null, 2));
  } finally { await client.close(); }
}

if (require.main === module) main().catch(error => {
  console.error(`Vietnamese localization failed (${error.name || 'Error'}): ${error.message}`);
  process.exitCode = 1;
});

module.exports = { NAME_VI, INSTRUCTIONS_VI, BODY_VI, EQUIPMENT_VI, MUSCLE_VI };
