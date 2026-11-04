// ExerciseDB API Curated Exercises (5 bài tập cho mỗi nhóm cơ)

export const EXERCISE_API_BASE = 'https://oss.exercisedb.dev/api/v1';

// Danh sách 40 bài tập chuẩn (Mỗi nhóm cơ 5 bài tập, 100% ảnh động GIF hoạt động ổn định)
export const INITIAL_API_EXERCISES = [
  // ==================== 1. CARDIO (5 BÀI) ====================
  {
    exerciseId: '0JtKWum',
    name: 'dumbbell burpee',
    viName: 'Burpee kết hợp tạ đơn đốt mỡ (Dumbbell Burpee)',
    gifUrl: 'https://static.exercisedb.dev/media/0JtKWum.gif',
    bodyParts: ['cardio'],
    equipments: ['dumbbell'],
    targetMuscles: ['cardiovascular system'],
    secondaryMuscles: ['quadriceps', 'hamstrings', 'calves', 'deltoids', 'core'],
    viInstructions: [
      'Bước 1: Đứng thẳng, hai chân rộng bằng vai, mỗi tay cầm một quả tạ đơn.',
      'Bước 2: Hạ người xuống tư thế Squat và đặt hai quả tạ xuống sàn ngay trước mũi chân.',
      'Bước 3: Chống tay lên tạ, bật nhảy hai chân ra sau vào tư thế Plank thẳng người.',
      'Bước 4: Thực hiện 1 nhịp hít đất trên tạ rồi bật thu hai chân về gần tạ.',
      'Bước 5: Đạp mạnh gót chân, cầm tạ đứng thẳng dậy đồng thời giữ lưng thẳng.',
    ],
  },
  {
    exerciseId: '0Yz8WdV',
    name: 'bear crawl',
    viName: 'Bò gấu toàn thân đốt mỡ (Bear Crawl)',
    gifUrl: 'https://static.exercisedb.dev/media/0Yz8WdV.gif',
    bodyParts: ['cardio'],
    equipments: ['bodyweight'],
    targetMuscles: ['cardiovascular system'],
    secondaryMuscles: ['core', 'deltoids', 'quadriceps'],
    viInstructions: [
      'Bước 1: Chống hai tay và mũi chân xuống sàn, đầu gối gập vuông góc và nhấc nhẹ khỏi mặt đất.',
      'Bước 2: Giữ lưng phẳng song song với mặt sàn, mắt nhìn về phía trước.',
      'Bước 3: Bước đồng thời tay phải và chân trái lên phía trước một nhịp ngắn.',
      'Bước 4: Đổi bên bước tiếp tay trái và chân phải, duy trì cơ bụng siết chặt.',
      'Bước 5: Giữ nhịp thở đều đặn và không để hông nhấp nhô quá cao.',
    ],
  },
  {
    exerciseId: '1g5bPpA',
    name: 'Jack Jump',
    viName: 'Bật nhảy vung tay toàn thân (Jumping Jacks)',
    gifUrl: 'https://static.exercisedb.dev/media/1g5bPpA.gif',
    bodyParts: ['cardio'],
    equipments: ['bodyweight'],
    targetMuscles: ['cardiovascular system'],
    secondaryMuscles: ['calves', 'deltoids', 'glutes'],
    viInstructions: [
      'Bước 1: Đứng thẳng tự nhiên, hai chân khép sát, hai tay đặt dọc theo thân người.',
      'Bước 2: Bật nhảy tách hai chân rộng hơn vai đồng thời vung hai tay lên cao qua đầu.',
      'Bước 3: Tiếp đất nhẹ nhàng bằng mũi bàn chân, đầu gối hơi trùng để giảm chấn.',
      'Bước 4: Bật nhảy thu hai chân về vị trí khép và hạ tay xuống cạnh đùi.',
      'Bước 5: Lặp lại liên tục với tốc độ ổn định để tăng nhịp tim đốt mỡ.',
    ],
  },
  {
    exerciseId: '5MRH8H2',
    name: 'ski step',
    viName: 'Bước nhảy trượt tuyết ngang (Ski Step)',
    gifUrl: 'https://static.exercisedb.dev/media/5MRH8H2.gif',
    bodyParts: ['cardio'],
    equipments: ['bodyweight'],
    targetMuscles: ['cardiovascular system'],
    secondaryMuscles: ['quadriceps', 'glutes', 'calves'],
    viInstructions: [
      'Bước 1: Đứng thẳng, hai chân khép nhẹ, hai khuỷu tay gập tự nhiên trước ngực.',
      'Bước 2: Bật nhảy nhịp nhàng sang bên phải rồi sang bên trái như động tác trượt tuyết.',
      'Bước 3: Kết hợp đánh hai tay nhịp nhàng theo chiều bật nhảy để giữ thăng bằng.',
      'Bước 4: Tiếp đất êm bằng nửa trước bàn chân, giữ thân trên thẳng.',
      'Bước 5: Duy trì tốc độ đều đặn trong suốt thời gian hiệp tập.',
    ],
  },
  {
    exerciseId: '6FMU51h',
    name: 'Semi Squat Jump',
    viName: 'Bật nhảy bán Squat bùng nổ (Semi Squat Jump)',
    gifUrl: 'https://static.exercisedb.dev/media/6FMU51h.gif',
    bodyParts: ['cardio'],
    equipments: ['bodyweight'],
    targetMuscles: ['cardiovascular system'],
    secondaryMuscles: ['quadriceps', 'glutes', 'calves'],
    viInstructions: [
      'Bước 1: Đứng thẳng, hai chân mở rộng bằng vai, mũi chân hơi hướng nhẹ ra ngoài.',
      'Bước 2: Đẩy hông ra sau và hạ người xuống tư thế bán Squat (gối gập khoảng 45 độ).',
      'Bước 3: Phát lực bật nhảy thẳng lên cao đồng thời vung tay tạo đà.',
      'Bước 4: Tiếp đất êm ái bằng mũi chân rồi chuyển ngay vào nhịp hạ Squat tiếp theo.',
      'Bước 5: Giữ lưng thẳng, mắt nhìn về trước và thở ra khi bật nhảy.',
    ],
  },

  // ==================== 2. CHEST / NGỰC (5 BÀI) ====================
  {
    exerciseId: '0CXGHya',
    name: 'Cable Crossover',
    viName: 'Ép ngực với máy cáp đôi (Cable Crossover)',
    gifUrl: 'https://static.exercisedb.dev/media/0CXGHya.gif',
    bodyParts: ['chest'],
    equipments: ['cable'],
    targetMuscles: ['pectorals'],
    secondaryMuscles: ['deltoids', 'triceps'],
    viInstructions: [
      'Bước 1: Điều chỉnh ròng rọc máy cáp ở độ cao ngang ngực hoặc trên vai.',
      'Bước 2: Đứng ở giữa khung máy cáp, một chân bước lên trước để giữ trụ vững.',
      'Bước 3: Hơi trùng nhẹ khuỷu tay và mở ngực trước khi kéo.',
      'Bước 4: Kéo hai tay cầm khép lại trước ngực theo hình vòng cung rộng.',
      'Bước 5: Mở hai tay từ từ trở lại vị trí ban đầu để kéo giãn cơ ngực có kiểm soát.',
    ],
  },
  {
    exerciseId: '11wrviz',
    name: 'isometric wipers',
    viName: 'Hít đất trượt ngang siết cơ ngực (Isometric Wipers)',
    gifUrl: 'https://static.exercisedb.dev/media/11wrviz.gif',
    bodyParts: ['chest'],
    equipments: ['bodyweight'],
    targetMuscles: ['pectorals'],
    secondaryMuscles: ['triceps', 'deltoids', 'core'],
    viInstructions: [
      'Bước 1: Bắt đầu ở tư thế chống đẩy với hai bàn tay đặt rộng hơn vai.',
      'Bước 2: Hạ thấp ngực xuống sát sàn và giữ độ cao ổn định.',
      'Bước 3: Dịch chuyển trọng tâm thân trên sang bên tay phải rồi trượt sang bên tay trái.',
      'Bước 4: Giữ cơ bụng và cơ mông siết chặt để lưng không bị võng.',
      'Bước 5: Đẩy người lên vị trí thẳng tay sau khi hoàn thành nhịp trượt hai bên.',
    ],
  },
  {
    exerciseId: '13TpY4H',
    name: 'raise single arm push-up',
    viName: 'Hít đất kết hợp nâng một tay (Raise Single-Arm Push-up)',
    gifUrl: 'https://static.exercisedb.dev/media/13TpY4H.gif',
    bodyParts: ['chest'],
    equipments: ['bodyweight'],
    targetMuscles: ['pectorals'],
    secondaryMuscles: ['deltoids', 'triceps', 'core'],
    viInstructions: [
      'Bước 1: Vào tư thế hít đất chuẩn, hai bàn chân mở rộng bằng hông để giữ thăng bằng.',
      'Bước 2: Gập khuỷu tay hạ ngực xuống gần chạm mặt sàn.',
      'Bước 3: Đẩy mạnh người lên đồng thời duỗi thẳng một cánh tay vươn về phía trước.',
      'Bước 4: Đặt tay trở lại sàn và lặp lại động tác, đổi tay ở lần đẩy tiếp theo.',
      'Bước 5: Giữ hông cố định, tránh xoay nghiêng người quá mức khi giơ tay.',
    ],
  },
  {
    exerciseId: '1PLE8e9',
    name: 'dumbbell incline twisted flyes',
    viName: 'Nằm ghế dốc lên banh ngực tạ đơn (Incline Dumbbell Flyes)',
    gifUrl: 'https://static.exercisedb.dev/media/1PLE8e9.gif',
    bodyParts: ['chest'],
    equipments: ['dumbbell'],
    targetMuscles: ['pectorals'],
    secondaryMuscles: ['deltoids'],
    viInstructions: [
      'Bước 1: Nằm tựa lưng trên ghế dốc lên 30-45 độ, hai tay cầm tạ đơn giơ thẳng trên ngực.',
      'Bước 2: Hơi gập nhẹ khuỷu tay, từ từ mở rộng hai cánh tay sang hai bên theo hình vòng cung.',
      'Bước 3: Hạ tạ đến khi cảm nhận cơ ngực trên được kéo căng tối đa.',
      'Bước 4: Siết cơ ngực, ép hai quả tạ trở lại vị trí ban đầu phía trên ngực.',
      'Bước 5: Hít sâu khi mở tay hạ tạ và thở ra khi ép tạ lên.',
    ],
  },
  {
    exerciseId: '1qrWgZ2',
    name: 'dumbbell decline hammer press',
    viName: 'Nằm ghế dốc xuống đẩy ngực tạ đơn (Decline Hammer Press)',
    gifUrl: 'https://static.exercisedb.dev/media/1qrWgZ2.gif',
    bodyParts: ['chest'],
    equipments: ['dumbbell'],
    targetMuscles: ['pectorals'],
    secondaryMuscles: ['triceps', 'deltoids'],
    viInstructions: [
      'Bước 1: Nằm cố định chân trên ghế dốc xuống, hai tay cầm tạ đơn với lòng bàn tay hướng vào nhau.',
      'Bước 2: Đặt hai quả tạ ngang tầm ngực dưới, khuỷu tay khép góc 45 độ.',
      'Bước 3: Thở ra, đẩy mạnh hai quả tạ thẳng lên trên ngực và siết chặt cơ ngực dưới.',
      'Bước 4: Từ từ hạ tạ xuống vị trí chuẩn bị một cách có kiểm soát.',
      'Bước 5: Luôn giữ lưng trên và bả vai ép chặt vào mặt ghế.',
    ],
  },

  // ==================== 3. BACK / LƯNG (5 BÀI) ====================
  {
    exerciseId: '0I5fUyn',
    name: 'band underhand pulldown',
    viName: 'Kéo dây kháng lực tập lưng xô (Band Underhand Pulldown)',
    gifUrl: 'https://static.exercisedb.dev/media/DptumMx.gif',
    bodyParts: ['back'],
    equipments: ['resistance band'],
    targetMuscles: ['latissimus dorsi'],
    secondaryMuscles: ['biceps', 'forearms'],
    viInstructions: [
      'Bước 1: Cố định dây kháng lực vào điểm neo cao (như xà đơn hoặc khung cửa chắc chắn).',
      'Bước 2: Ngồi hoặc quỳ đối diện điểm neo, nắm dây với lòng bàn tay ngửa.',
      'Bước 3: Giữ lưng thẳng, mở ngực và hạ bả vai trước khi kéo.',
      'Bước 4: Kéo dây xuống bằng cách ép hai khuỷu tay sát về phía mạng sườn.',
      'Bước 5: Thả tay từ từ lên cao theo lực căng của dây, không thả giật đột ngột.',
    ],
  },
  {
    exerciseId: '0V2YQjW',
    name: 'Pull-Up (Neutral Grip)',
    viName: 'Kéo xà đơn tay nắm trung tính (Neutral Grip Pull-Up)',
    gifUrl: 'https://static.exercisedb.dev/media/0V2YQjW.gif',
    bodyParts: ['back'],
    equipments: ['bodyweight'],
    targetMuscles: ['latissimus dorsi'],
    secondaryMuscles: ['biceps', 'upper back', 'core'],
    viInstructions: [
      'Bước 1: Nắm hai thanh tay cầm song song trên xà đơn với hai lòng bàn tay hướng vào nhau.',
      'Bước 2: Treo thẳng người, hơi ưỡn ngực và ghìm hai bả vai xuống dưới.',
      'Bước 3: Kéo cơ thể lên cao bằng lực cơ xô lưng và cánh tay cho tới khi cằm vượt qua xà.',
      'Bước 4: Giữ 1 giây ở đỉnh và siết chặt cơ lưng xô.',
      'Bước 5: Hạ người xuống chậm rãi về tư thế duỗi tay hoàn toàn, không đung đưa chân.',
    ],
  },
  {
    exerciseId: '1PK5Uo3',
    name: 'cable incline pushdown',
    viName: 'Kéo cáp thẳng tay tập xô lưng (Cable Lat Pushdown)',
    gifUrl: 'https://static.exercisedb.dev/media/1PK5Uo3.gif',
    bodyParts: ['back'],
    equipments: ['cable'],
    targetMuscles: ['latissimus dorsi'],
    secondaryMuscles: ['triceps', 'core'],
    viInstructions: [
      'Bước 1: Đứng hoặc nằm nghiêng trên ghế trước máy kéo cáp cao, hai tay nắm thanh đòn.',
      'Bước 2: Giữ hai cánh tay gần như duỗi thẳng, chỉ hơi khóa nhẹ khớp khuỷu tay.',
      'Bước 3: Dùng lực cơ xô kéo thanh cáp theo hình vòng cung từ trên cao xuống chạm đùi.',
      'Bước 4: Cảm nhận hai dải cơ xô hai bên sườn co chặt ở điểm cuối.',
      'Bước 5: Từ từ đưa thanh cáp trở lại vị trí cao ngang đầu mà không gập khuỷu tay.',
    ],
  },
  {
    exerciseId: '1jXLYEw',
    name: 'standing lateral stretch',
    viName: 'Đứng nghiêng lườn giãn cơ lưng xô (Standing Lateral Stretch)',
    gifUrl: 'https://static.exercisedb.dev/media/1jXLYEw.gif',
    bodyParts: ['back'],
    equipments: ['bodyweight'],
    targetMuscles: ['latissimus dorsi'],
    secondaryMuscles: ['abdominals', 'erector spinae'],
    viInstructions: [
      'Bước 1: Đứng thẳng, hai chân mở rộng bằng vai, đan hoặc giơ cao tay qua đầu.',
      'Bước 2: Hít sâu, từ từ nghiêng thân trên sang một bên để kéo giãn toàn bộ cơ xô và lườn.',
      'Bước 3: Giữ hông cố định ở giữa, không xoay vặn lưng.',
      'Bước 4: Duy trì tư thế căng giãn trong 10-15 giây kết hợp thở đều.',
      'Bước 5: Trở về tư thế đứng thẳng và thực hiện tương tự cho bên đối diện.',
    ],
  },
  {
    exerciseId: '01qpYSe',
    name: 'upward facing dog',
    viName: 'Chó ngửa mặt giãn cơ lưng (Upward Facing Dog)',
    gifUrl: 'https://static.exercisedb.dev/media/01qpYSe.gif',
    bodyParts: ['back'],
    equipments: ['bodyweight'],
    targetMuscles: ['erector spinae'],
    secondaryMuscles: ['deltoids', 'pectorals'],
    viInstructions: [
      'Bước 1: Nằm sấp trên sàn, hai chân duỗi thẳng ra phía sau.',
      'Bước 2: Đặt hai bàn tay xuống sàn cạnh xương sườn dưới, các ngón tay hướng về phía trước.',
      'Bước 3: Ấn tay nâng ngực mở căng vừa phải, giữ nhịp thở đều.',
      'Bước 4: Duy trì độ căng dễ chịu cho cột sống lưng và cơ ngực.',
      'Bước 5: Giữ tư thế kết hợp thở sâu, sau đó hạ xuống nhẹ nhàng.',
    ],
  },

  // ==================== 4. WAIST / EO & BỤNG (5 BÀI) ====================
  {
    exerciseId: '03lzqwk',
    name: 'assisted hanging knee raise',
    viName: 'Treo xà nâng gối tập bụng (Assisted Hanging Knee Raise)',
    gifUrl: 'https://static.exercisedb.dev/media/03lzqwk.gif',
    bodyParts: ['waist'],
    equipments: ['assisted'],
    targetMuscles: ['abdominals'],
    secondaryMuscles: ['hip flexors'],
    viInstructions: [
      'Bước 1: Treo người trên xà đơn với hai tay duỗi thẳng, lòng bàn tay hướng về trước.',
      'Bước 2: Gồng chặt cơ lõi (core) và kéo hai đầu gối lên về phía ngực.',
      'Bước 3: Siết chặt cơ bụng và giữ hai vai cố định, không rụt cổ.',
      'Bước 4: Kiểm soát nhịp dừng ở đỉnh để cảm nhận cơ bụng co tối đa.',
      'Bước 5: Hạ hai chân xuống chậm rãi có kiểm soát, không để người lắc lư.',
    ],
  },
  {
    exerciseId: '196HJGw',
    name: 'hip raise (bent knee)',
    viName: 'Nằm nâng hông co gối tập bụng dưới (Bent-Knee Hip Raise)',
    gifUrl: 'https://static.exercisedb.dev/media/196HJGw.gif',
    bodyParts: ['waist'],
    equipments: ['bodyweight'],
    targetMuscles: ['abdominals'],
    secondaryMuscles: ['hip flexors', 'core'],
    viInstructions: [
      'Bước 1: Nằm ngửa trên thảm, hai tay xuôi dọc theo thân người, lòng bàn tay úp xuống sàn.',
      'Bước 2: Co hai đầu gối tạo góc 90 độ, nhấc hai bàn chân lên khỏi mặt đất.',
      'Bước 3: Thở ra, dùng lực cơ bụng dưới cuộn xương chậu và nhấc hông lên khỏi sàn.',
      'Bước 4: Giữ đầu gối hướng về phía ngực và siết bụng 1 giây ở đỉnh.',
      'Bước 5: Hít vào, hạ hông trở lại thảm một cách chậm rãi.',
    ],
  },
  {
    exerciseId: '1GPHRyK',
    name: 'janda sit-up',
    viName: 'Gập bụng cô lập cơ lõi (Janda Sit-up)',
    gifUrl: 'https://static.exercisedb.dev/media/1GPHRyK.gif',
    bodyParts: ['waist'],
    equipments: ['bodyweight'],
    targetMuscles: ['abdominals'],
    secondaryMuscles: ['core'],
    viInstructions: [
      'Bước 1: Nằm ngửa trên sàn, gập đầu gối và ấn mạnh hai gót chân xuống mặt thảm.',
      'Bước 2: Đặt hai tay chéo trước ngực hoặc chạm nhẹ sau thái dương.',
      'Bước 3: Siết cơ đùi sau và mông đồng thời cuộn cơ bụng nâng thân trên ngồi dậy.',
      'Bước 4: Giữ cằm hơi hướng về ngực, không dùng tay kéo gập cổ.',
      'Bước 5: Hạ lưng từ từ xuống thảm từng đốt sống một.',
    ],
  },
  {
    exerciseId: '1ZFqTDN',
    name: 'Bicycle Crunch',
    viName: 'Gập bụng đạp xe trên không (Bicycle Crunch)',
    gifUrl: 'https://static.exercisedb.dev/media/1ZFqTDN.gif',
    bodyParts: ['waist'],
    equipments: ['bodyweight'],
    targetMuscles: ['abdominals'],
    secondaryMuscles: ['hip flexors', 'core'],
    viInstructions: [
      'Bước 1: Nằm ngửa trên thảm, hai tay đặt nhẹ sau đầu, nhấc hai vai và chân lên khỏi sàn.',
      'Bước 2: Co gối phải lên về phía ngực đồng thời xoay vai trái chạm khuỷu tay trái vào gối phải.',
      'Bước 3: Duỗi thẳng chân phải ra đồng thời đổi bên co gối trái chạm khuỷu tay phải.',
      'Bước 4: Thực hiện liên tục như động tác đạp xe đạp trên không.',
      'Bước 5: Tập trung xoay bằng cơ liên sườn và thở đều theo từng nhịp.',
    ],
  },
  {
    exerciseId: '2gPfomN',
    name: '3/4 sit-up',
    viName: 'Gập bụng 3/4 cơ bản (3/4 Sit-up)',
    gifUrl: 'https://static.exercisedb.dev/media/2gPfomN.gif',
    bodyParts: ['waist'],
    equipments: ['bodyweight'],
    targetMuscles: ['abdominals'],
    secondaryMuscles: ['hip flexors'],
    viInstructions: [
      'Bước 1: Nằm ngửa trên sàn, co hai đầu gối và đặt hai bàn chân phẳng trên mặt đất.',
      'Bước 2: Đặt nhẹ các đầu ngón tay cạnh tai, mở rộng hai khuỷu tay.',
      'Bước 3: Thở ra, gồng cơ bụng nâng thân người lên tới góc khoảng 3/4 đường ngồi dậy.',
      'Bước 4: Giữ lực căng liên tục ở cơ bụng, không ngả hết lưng nghỉ hẳn dưới sàn.',
      'Bước 5: Hít vào hạ thân người xuống có kiểm soát rồi thực hiện nhịp tiếp theo.',
    ],
  },

  // ==================== 5. UPPER ARMS / TAY (5 BÀI) ====================
  {
    exerciseId: '05Cf2v8',
    name: 'impossible dips',
    viName: 'Chống đẩy xà kép tập tay sau (Parallel Bar Dips)',
    gifUrl: 'https://static.exercisedb.dev/media/05Cf2v8.gif',
    bodyParts: ['upper arms'],
    equipments: ['bodyweight'],
    targetMuscles: ['triceps'],
    secondaryMuscles: ['pectorals', 'deltoids'],
    viInstructions: [
      'Bước 1: Chống hai tay thẳng trên hai thanh xà kép, nâng toàn bộ cơ thể lên không.',
      'Bước 2: Gập nhẹ đầu gối và bắt chéo hai cổ chân để giữ thăng bằng.',
      'Bước 3: Hạ vai xuống (không rụt vai) và giữ khuỷu tay hướng ra phía sau.',
      'Bước 4: Gập khuỷu tay từ từ hạ thấp thân người xuống mức vuông góc.',
      'Bước 5: Đẩy mạnh qua lòng bàn tay để nâng người lên vị trí ban đầu.',
    ],
  },
  {
    exerciseId: '0IgNjSM',
    name: 'dumbbell standing reverse curl',
    viName: 'Đứng cuốn tạ đơn sấp tay (Dumbbell Reverse Curl)',
    gifUrl: 'https://static.exercisedb.dev/media/0IgNjSM.gif',
    bodyParts: ['upper arms'],
    equipments: ['dumbbell'],
    targetMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    viInstructions: [
      'Bước 1: Đứng thẳng, hai chân rộng bằng vai, mỗi tay cầm một quả tạ đơn, mu bàn tay hướng về trước.',
      'Bước 2: Giữ bắp tay trên cố định sát sườn, thở ra và cuốn tạ lên ngang vai.',
      'Bước 3: Khóa cố định khớp vai, chỉ cử động khớp khuỷu tay.',
      'Bước 4: Giữ lưng thẳng đứng, không đung đưa lưng để lấy đà.',
      'Bước 5: Hạ tạ từ từ về vị trí duỗi tay ban đầu.',
    ],
  },
  {
    exerciseId: '1cTf2Ux',
    name: 'EZ-Bar Standing French Press',
    viName: 'Đứng duỗi tạ đòn sau đầu tập tay sau (EZ-Bar French Press)',
    gifUrl: 'https://static.exercisedb.dev/media/1cTf2Ux.gif',
    bodyParts: ['upper arms'],
    equipments: ['barbell'],
    targetMuscles: ['triceps'],
    secondaryMuscles: ['forearms'],
    viInstructions: [
      'Bước 1: Đứng thẳng, hai tay nắm thanh đòn EZ với khoảng cách hẹp và giơ thẳng qua đầu.',
      'Bước 2: Khép hai bắp tay trên cố định gần sát hai bên tai.',
      'Bước 3: Hít vào, gập khuỷu tay hạ thanh tạ ra phía sau đầu một cách chậm rãi.',
      'Bước 4: Thở ra, dùng lực cơ tay sau duỗi thẳng cánh tay đẩy tạ trở lại vị trí cao nhất.',
      'Bước 5: Giữ thân người vững, không ưỡn võng lưng dưới.',
    ],
  },
  {
    exerciseId: '1V1gj1u',
    name: 'barbell seated close-grip concentration curl',
    viName: 'Ngồi cuốn tạ đòn tập trung cơ tay trước (Concentration Curl)',
    gifUrl: 'https://static.exercisedb.dev/media/1V1gj1u.gif',
    bodyParts: ['upper arms'],
    equipments: ['barbell'],
    targetMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    viInstructions: [
      'Bước 1: Ngồi trên ghế phẳng, hai chân mở rộng, tì mặt sau bắp tay lên phần đùi trong.',
      'Bước 2: Nắm thanh tạ đòn với lòng bàn tay hướng lên trên.',
      'Bước 3: Thở ra, cố định khuỷu tay trên đùi và cuốn thanh tạ lên phía cằm.',
      'Bước 4: Siết chặt cơ bắp tay trước (con chuột) 1 giây ở đỉnh động tác.',
      'Bước 5: Hít vào và hạ thanh tạ xuống chậm rãi đến khi tay gần duỗi thẳng.',
    ],
  },
  {
    exerciseId: '1VpF8db',
    name: 'Dumbbell Biceps Curl Lunge With Bowling Motion',
    viName: 'Chùng chân kết hợp cuốn tạ đơn (Dumbbell Curl Lunge)',
    gifUrl: 'https://static.exercisedb.dev/media/1VpF8db.gif',
    bodyParts: ['upper arms'],
    equipments: ['dumbbell'],
    targetMuscles: ['biceps'],
    secondaryMuscles: ['quadriceps', 'glutes', 'forearms'],
    viInstructions: [
      'Bước 1: Đứng thẳng, hai tay cầm tạ đơn đặt dọc theo hai bên hông.',
      'Bước 2: Bước một chân dài về phía sau và hạ hông vào tư thế Lunge.',
      'Bước 3: Đồng thời cuốn tạ đơn lên ngang vai để kích hoạt cơ tay trước.',
      'Bước 4: Đạp gót chân trước đứng thẳng dậy đồng thời hạ tạ xuống có kiểm soát.',
      'Bước 5: Luân phiên đổi chân và duy trì lưng thẳng suốt bài tập.',
    ],
  },

  // ==================== 6. SHOULDERS / VAI (5 BÀI) ====================
  {
    exerciseId: '0dCyly0',
    name: 'barbell seated bradford rocky press',
    viName: 'Ngồi đẩy vai tạ đòn Rocky (Bradford Rocky Press)',
    gifUrl: 'https://static.exercisedb.dev/media/0dCyly0.gif',
    bodyParts: ['shoulders'],
    equipments: ['barbell'],
    targetMuscles: ['deltoids'],
    secondaryMuscles: ['triceps', 'upper back'],
    viInstructions: [
      'Bước 1: Ngồi thẳng lưng trên ghế tập, hai bàn chân đặt vững trên sàn.',
      'Bước 2: Nắm thanh tạ đòn rộng hơn vai một chút, lòng bàn tay hướng về trước.',
      'Bước 3: Gồng chặt thân trên, giữ cổ tay thẳng hàng với cẳng tay.',
      'Bước 4: Đẩy thanh tạ qua đầu chuyển luân phiên trước mặt và sau gáy.',
      'Bước 5: Hạ tạ xuống có kiểm soát trước khi thực hiện lần đẩy tiếp theo.',
    ],
  },
  {
    exerciseId: '1DN3iz4',
    name: 'smith upright row',
    viName: 'Kéo tạ dọc thân tập cơ vai & cầu vai (Smith Upright Row)',
    gifUrl: 'https://static.exercisedb.dev/media/1DN3iz4.gif',
    bodyParts: ['shoulders'],
    equipments: ['leverage machine'],
    targetMuscles: ['deltoids'],
    secondaryMuscles: ['upper back', 'biceps'],
    viInstructions: [
      'Bước 1: Đứng thẳng trước thanh đòn máy Smith, hai tay nắm thanh tạ rộng ngang vai.',
      'Bước 2: Tháo chốt an toàn, để thanh tạ áp sát phía trước đùi.',
      'Bước 3: Thở ra, dẫn động bằng hai khuỷu tay kéo thanh tạ thẳng đứng lên ngang ngực trên.',
      'Bước 4: Giữ hai khuỷu tay luôn cao hơn cổ tay ở điểm trên cùng.',
      'Bước 5: Hít vào, hạ thanh tạ từ từ về vị trí ban đầu.',
    ],
  },
  {
    exerciseId: '1TkiAFK',
    name: 'Dumbbell Single-Arm Shoulder Press',
    viName: 'Đứng đẩy vai một tay với tạ đơn (Single-Arm Shoulder Press)',
    gifUrl: 'https://static.exercisedb.dev/media/1TkiAFK.gif',
    bodyParts: ['shoulders'],
    equipments: ['dumbbell'],
    targetMuscles: ['deltoids'],
    secondaryMuscles: ['triceps', 'core'],
    viInstructions: [
      'Bước 1: Đứng thẳng, hai chân rộng bằng vai, một tay cầm tạ đơn đặt ngang tầm vai.',
      'Bước 2: Tay còn lại chống hông hoặc duỗi nhẹ để giữ cân bằng cơ lõi.',
      'Bước 3: Thở ra, đẩy mạnh quả tạ thẳng lên qua đầu cho đến khi tay duỗi thẳng.',
      'Bước 4: Giữ thân người thẳng đứng, không nghiêng lườn sang bên đối diện.',
      'Bước 5: Hạ tạ từ từ về ngang vai và đổi tay sau khi hoàn thành đủ số lần.',
    ],
  },
  {
    exerciseId: '2KGnL6M',
    name: 'Machine Single-Arm Shoulder Press',
    viName: 'Ngồi đẩy vai một tay với máy (Machine Shoulder Press)',
    gifUrl: 'https://static.exercisedb.dev/media/2KGnL6M.gif',
    bodyParts: ['shoulders'],
    equipments: ['leverage machine'],
    targetMuscles: ['deltoids'],
    secondaryMuscles: ['triceps'],
    viInstructions: [
      'Bước 1: Ngồi ngay ngắn trên ghế máy đẩy vai, lưng tựa sát vào đệm ghế.',
      'Bước 2: Một tay nắm tay cầm của máy ở độ cao ngang vai.',
      'Bước 3: Thở ra và đẩy tay cầm thẳng lên cao mà không khóa cứng khớp khuỷu tay.',
      'Bước 4: Giữ nhịp 1 giây ở đỉnh để cô lập cơ vai.',
      'Bước 5: Từ từ hạ tay cầm về vị trí ban đầu rồi lặp lại.',
    ],
  },
  {
    exerciseId: '3d7wHyd',
    name: 'dumbbell bench seated press',
    viName: 'Ngồi ghế đẩy vai đôi với tạ đơn (Seated Dumbbell Press)',
    gifUrl: 'https://static.exercisedb.dev/media/3d7wHyd.gif',
    bodyParts: ['shoulders'],
    equipments: ['dumbbell'],
    targetMuscles: ['deltoids'],
    secondaryMuscles: ['triceps', 'upper back'],
    viInstructions: [
      'Bước 1: Ngồi thẳng lưng trên ghế tập, hai tay cầm hai quả tạ đơn đặt ngang tầm tai.',
      'Bước 2: Lòng bàn tay hướng về phía trước, cẳng tay vuông góc với mặt sàn.',
      'Bước 3: Thở ra, đẩy đồng thời hai quả tạ lên cao qua đầu cho đến khi gần chạm nhau.',
      'Bước 4: Không chạm mạnh hai quả tạ vào nhau ở đỉnh động tác.',
      'Bước 5: Hít vào, hạ hai quả tạ từ từ xuống ngang tai có kiểm soát.',
    ],
  },

  // ==================== 7. UPPER LEGS / ĐÙI & MÔNG (5 BÀI) ====================
  {
    exerciseId: '0br45wL',
    name: 'push-up inside leg kick',
    viName: 'Hít đất đá chân trong (Push-up Inside Leg Kick)',
    gifUrl: 'https://static.exercisedb.dev/media/0br45wL.gif',
    bodyParts: ['upper legs'],
    equipments: ['bodyweight'],
    targetMuscles: ['glutes'],
    secondaryMuscles: ['quadriceps', 'hamstrings', 'core'],
    viInstructions: [
      'Bước 1: Bắt đầu ở tư thế hít đất, hai tay chống rộng hơn vai một chút.',
      'Bước 2: Hạ thấp cơ thể xuống bằng cách gập khuỷu tay, giữ lưng thẳng.',
      'Bước 3: Gồng chặt cơ bụng và cơ mông kết hợp đá chân luân phiên qua bên đối diện.',
      'Bước 4: Giữ trục vai - hông - cổ chân ổn định khi hạ ngực.',
      'Bước 5: Đẩy mạnh tay trở lại tư thế thẳng tay ban đầu.',
    ],
  },
  {
    exerciseId: '0lQnxMZ',
    name: 'weighted sissy squat',
    viName: 'Squat cô lập cơ đùi trước (Weighted Sissy Squat)',
    gifUrl: 'https://static.exercisedb.dev/media/0lQnxMZ.gif',
    bodyParts: ['upper legs'],
    equipments: ['dumbbell'],
    targetMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes', 'calves', 'core'],
    viInstructions: [
      'Bước 1: Cố định bắp chân và cổ chân vào đệm giữ của ghế tập Sissy Squat, ôm bánh tạ trước ngực.',
      'Bước 2: Giữ thẳng trục từ đầu gối qua hông lên tới vai.',
      'Bước 3: Hít vào, gập đầu gối hạ thấp hông ra phía sau cho đến khi đùi song song với sàn.',
      'Bước 4: Thở ra, phát lực từ cơ đùi trước để đẩy người đứng thẳng lên.',
      'Bước 5: Luôn siết chặt cơ bụng để bảo vệ vùng thắt lưng.',
    ],
  },
  {
    exerciseId: '10Z2DXU',
    name: 'sled 45° leg press',
    viName: 'Đạp đùi góc 45 độ trên máy (45° Leg Press)',
    gifUrl: 'https://static.exercisedb.dev/media/10Z2DXU.gif',
    bodyParts: ['upper legs'],
    equipments: ['leverage machine'],
    targetMuscles: ['glutes'],
    secondaryMuscles: ['quadriceps', 'hamstrings', 'calves'],
    viInstructions: [
      'Bước 1: Ngồi vào máy đạp đùi 45 độ, lưng và mông áp chặt vào đệm tựa.',
      'Bước 2: Đặt hai bàn chân lên bàn đạp rộng bằng vai, mở khóa chốt an toàn.',
      'Bước 3: Hít vào, từ từ gập đầu gối hạ bàn đạp xuống cho đến khi đùi tạo góc 90 độ.',
      'Bước 4: Thở ra, đạp mạnh qua gót chân đẩy bàn đạp lên nhưng không khóa cứng khớp gối.',
      'Bước 5: Không để mông bị nhấc khỏi đệm ghế khi hạ tạ sâu.',
    ],
  },
  {
    exerciseId: '0xDpB4L',
    name: 'Band Seated Hip Abduction',
    viName: 'Ngồi dạng đùi với dây kháng lực (Band Hip Abduction)',
    gifUrl: 'https://static.exercisedb.dev/media/0xDpB4L.gif',
    bodyParts: ['upper legs'],
    equipments: ['resistance band'],
    targetMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    viInstructions: [
      'Bước 1: Đeo vòng dây kháng lực quanh hai đầu gối và ngồi thẳng lưng trên ghế.',
      'Bước 2: Đặt hai bàn chân trên sàn rộng bằng hông, hai tay giữ cạnh ghế.',
      'Bước 3: Thở ra, dùng lực cơ mông ngoài mở rộng hai đầu gối sang hai bên căng hết mức.',
      'Bước 4: Giữ 1-2 giây ở điểm mở rộng nhất để kích hoạt cơ mông.',
      'Bước 5: Từ từ khép hai đầu gối trở lại vị trí ban đầu theo lực kiểm soát.',
    ],
  },
  {
    exerciseId: '0mB6wHO',
    name: 'runners stretch',
    viName: 'Chùng chân căng giãn cơ đùi sau (Runners Stretch)',
    gifUrl: 'https://static.exercisedb.dev/media/0mB6wHO.gif',
    bodyParts: ['upper legs'],
    equipments: ['bodyweight'],
    targetMuscles: ['hamstrings'],
    secondaryMuscles: ['glutes', 'calves', 'hip flexors'],
    viInstructions: [
      'Bước 1: Bước dài một chân lên phía trước vào tư thế Lunge thấp, hai tay chống xuống sàn.',
      'Bước 2: Hạ thấp hông xuống để mở khớp háng và kéo giãn cơ gập hông.',
      'Bước 3: Từ từ đẩy hông ra sau và duỗi thẳng chân trước để kéo giãn sâu cơ đùi sau.',
      'Bước 4: Giữ nhịp thở sâu và thư giãn cơ đùi trong 15-20 giây.',
      'Bước 5: Chuyển trọng tâm về trước và đổi chân thực hiện tương tự.',
    ],
  },

  // ==================== 8. LOWER LEGS / BẮP CHÂN (5 BÀI) ====================
  {
    exerciseId: '0jp9Rlz',
    name: 'Single-Leg Floor Calf Raise',
    viName: 'Nhón bắp chân 1 chân trên sàn (Single-Leg Calf Raise)',
    gifUrl: 'https://static.exercisedb.dev/media/0jp9Rlz.gif',
    bodyParts: ['lower legs'],
    equipments: ['bodyweight'],
    targetMuscles: ['calves'],
    secondaryMuscles: ['ankles', 'feet'],
    viInstructions: [
      'Bước 1: Đứng thẳng, đặt nhẹ tay lên tường hoặc ghế để giữ thăng bằng.',
      'Bước 2: Nhấc một bàn chân lên khỏi sàn, dồn trọng tâm vào chân trụ.',
      'Bước 3: Giữ thân người thẳng, chỉ chuyển động ở khớp cổ chân.',
      'Bước 4: Nhón cao gót chân hết mức có thể bằng lực của ức bàn chân và bắp chân.',
      'Bước 5: Hạ gót chân xuống chậm rãi rồi lặp lại, sau đó đổi chân.',
    ],
  },
  {
    exerciseId: '1kB3Wmk',
    name: 'dumbbell single leg calf raise',
    viName: 'Đứng nhón bắp chân 1 chân cầm tạ đơn (Dumbbell Calf Raise)',
    gifUrl: 'https://static.exercisedb.dev/media/1kB3Wmk.gif',
    bodyParts: ['lower legs'],
    equipments: ['dumbbell'],
    targetMuscles: ['calves'],
    secondaryMuscles: ['ankles'],
    viInstructions: [
      'Bước 1: Một tay cầm tạ đơn, tay kia vịn vào điểm tựa chắc chắn, đứng bằng 1 chân trên bục thấp.',
      'Bước 2: Để gót chân trụ hạ thấp nhẹ xuống dưới mép bục để kéo giãn cơ bắp chân.',
      'Bước 3: Thở ra, nhón mạnh gót chân lên cao tối đa và siết cứng bắp chân.',
      'Bước 4: Giữ đỉnh co cơ 1 giây, đầu gối giữ thẳng tự nhiên.',
      'Bước 5: Hạ gót chân xuống từ từ và đổi bên sau khi hoàn thành hiệp tập.',
    ],
  },
  {
    exerciseId: '2IHEa2T',
    name: 'barbell floor calf raise',
    viName: 'Đứng gánh tạ đòn nhón bắp chân (Barbell Calf Raise)',
    gifUrl: 'https://static.exercisedb.dev/media/2IHEa2T.gif',
    bodyParts: ['lower legs'],
    equipments: ['barbell'],
    targetMuscles: ['calves'],
    secondaryMuscles: ['quadriceps', 'core'],
    viInstructions: [
      'Bước 1: Đặt thanh tạ đòn trên cầu vai sau giống tư thế Squat, hai chân đứng rộng bằng hông.',
      'Bước 2: Gồng chặt cơ bụng, giữ lưng thẳng đứng và mắt nhìn về phía trước.',
      'Bước 3: Thở ra, dồn lực vào ức bàn chân nhón hai gót chân lên cao hết mức.',
      'Bước 4: Siết chặt cơ bắp chân ở vị trí cao nhất trong 1 giây.',
      'Bước 5: Hít vào, hạ hai gót chân chạm sàn một cách có kiểm soát.',
    ],
  },
  {
    exerciseId: '0S75mYG',
    name: 'Smith Seated Single-Leg Calf Raise',
    viName: 'Ngồi nhón bắp chân với máy Smith (Seated Calf Raise)',
    gifUrl: 'https://static.exercisedb.dev/media/0S75mYG.gif',
    bodyParts: ['lower legs'],
    equipments: ['leverage machine'],
    targetMuscles: ['calves'],
    secondaryMuscles: ['ankles'],
    viInstructions: [
      'Bước 1: Ngồi trên ghế phẳng đặt dưới thanh đòn máy Smith, đặt phần đùi sát dưới thanh đệm.',
      'Bước 2: Đặt mũi bàn chân lên bục kê phía trước để gót chân có khoảng duỗi.',
      'Bước 3: Nhón mạnh gót chân lên cao để đẩy thanh tạ lên bằng lực cơ bắp chân.',
      'Bước 4: Giữ 1 giây ở đỉnh rồi từ từ hạ gót chân xuống sâu để kéo giãn cơ.',
      'Bước 5: Thực hiện đều đặn cả hai chân để phát triển bắp chân cân đối.',
    ],
  },
  {
    exerciseId: '2ORFMoR',
    name: 'hack calf raise',
    viName: 'Đạp nhón bắp chân trên máy Hack (Hack Calf Raise)',
    gifUrl: 'https://static.exercisedb.dev/media/2ORFMoR.gif',
    bodyParts: ['lower legs'],
    equipments: ['leverage machine'],
    targetMuscles: ['calves'],
    secondaryMuscles: ['ankles'],
    viInstructions: [
      'Bước 1: Tựa lưng và vai vào đệm máy Hack Squat, đặt nửa trước bàn chân lên mép bàn đạp.',
      'Bước 2: Giữ hai chân duỗi thẳng vừa phải (không khóa cứng khớp gối).',
      'Bước 3: Hạ thấp gót chân để kéo giãn tối đa cơ bắp chân sau.',
      'Bước 4: Thở ra, đạp mạnh mũi chân để nhón cao hết biên độ cổ chân.',
      'Bước 5: Hạ xuống chậm rãi và lặp lại đủ số lần mục tiêu.',
    ],
  },
];

const BODY_PART_VI = {
  back: 'Lưng (Back)',
  waist: 'Eo & Bụng (Waist)',
  'upper arms': 'Tay trên (Upper Arms)',
  'lower arms': 'Cẳng tay (Forearms)',
  'upper legs': 'Đùi & Mông (Upper Legs)',
  'lower legs': 'Bắp chân (Calves)',
  chest: 'Ngực (Chest)',
  shoulders: 'Vai (Shoulders)',
  cardio: 'Tim mạch & Đốt mỡ (Cardio)',
  neck: 'Cổ (Neck)',
};

const MUSCLE_VI = {
  'erector spinae': 'Cơ dựng sống lưng',
  deltoids: 'Cơ vai (Deltoids)',
  pectorals: 'Cơ ngực (Pectorals)',
  abdominals: 'Cơ bụng (Abdominals)',
  'hip flexors': 'Cơ gập hông',
  triceps: 'Cơ tay sau (Triceps)',
  biceps: 'Cơ tay trước (Biceps)',
  forearms: 'Cơ cẳng tay',
  glutes: 'Cơ mông (Glutes)',
  quadriceps: 'Cơ đùi trước (Quads)',
  hamstrings: 'Cơ đùi sau (Hamstrings)',
  calves: 'Cơ bắp chân (Calves)',
  core: 'Cơ lõi (Core)',
  'latissimus dorsi': 'Cơ xô lưng (Lats)',
  'upper back': 'Cơ lưng trên',
  ankles: 'Khớp cổ chân',
  feet: 'Cơ bàn chân',
  'cardiovascular system': 'Hệ tim mạch (Cardio)',
};

const EQUIPMENT_VI = {
  bodyweight: 'Trọng lượng cơ thể (Bodyweight)',
  'body weight': 'Trọng lượng cơ thể (Bodyweight)',
  assisted: 'Có hỗ trợ (Assisted)',
  cable: 'Máy kéo cáp (Cable)',
  barbell: 'Tạ đòn (Barbell)',
  dumbbell: 'Tạ đơn (Dumbbell)',
  'resistance band': 'Dây kháng lực (Band)',
  band: 'Dây kháng lực (Band)',
  'leverage machine': 'Máy tập (Machine)',
  kettlebell: 'Tạ ấm (Kettlebell)',
};

function formatTitleCase(str = '') {
  return str
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

export function normalizeApiExercise(raw) {
  const id = raw.exerciseId || raw.id;
  const bodyPart = (raw.bodyParts && raw.bodyParts[0]) || 'cardio';
  const equipment = (raw.equipments && raw.equipments[0]) || 'bodyweight';

  const allMuscles = [
    ...(raw.targetMuscles || []),
    ...(raw.secondaryMuscles || []),
  ];
  const musclesVi = allMuscles.map((m) => MUSCLE_VI[m.toLowerCase()] || formatTitleCase(m));

  const cleanSteps = (raw.viInstructions || raw.instructions || []).map((step, idx) => {
    const cleaned = String(step).replace(/^Step\s*:\s*\d+\s*/i, '').trim();
    if (cleaned.startsWith('Bước ')) return cleaned;
    return `Bước ${idx + 1}: ${cleaned}`;
  });

  const isCardioOrLegs = bodyPart === 'cardio' || bodyPart === 'upper legs';
  const isHard =
    raw.name?.includes('impossible') ||
    raw.name?.includes('burpee') ||
    raw.name?.includes('kick');
  const level = isHard ? 'Khó' : isCardioOrLegs ? 'Trung bình' : 'Dễ';
  const calories = isHard ? 55 : isCardioOrLegs ? 45 : 30;
  const expReward = isHard ? 25 : isCardioOrLegs ? 20 : 15;
  const durationSec = bodyPart === 'cardio' ? 60 : 45;

  const title = raw.viName || formatTitleCase(raw.name || 'Exercise');

  const BROKEN_GIF_MAP = {
    '0I5fUyn': 'https://static.exercisedb.dev/media/DptumMx.gif',
    '0MlxeMn': 'https://static.exercisedb.dev/media/RVwzP10.gif',
  };
  const resolvedGifUrl =
    BROKEN_GIF_MAP[id] || raw.gifUrl || `https://static.exercisedb.dev/media/${id}.gif`;

  return {
    id,
    exerciseId: id,
    title,
    rawName: raw.name,
    gifUrl: resolvedGifUrl,
    category: bodyPart,
    bodyPartLabel: BODY_PART_VI[bodyPart] || formatTitleCase(bodyPart),
    equipment: EQUIPMENT_VI[equipment.toLowerCase()] || formatTitleCase(equipment),
    rawEquipment: equipment.toLowerCase(),
    muscles: musclesVi.length ? musclesVi : ['Toàn thân'],
    instructions: cleanSteps,
    description: cleanSteps.slice(0, 2).join(' '),
    prep: cleanSteps[0] || 'Vào tư thế chuẩn bị vững chắc, giữ lưng thẳng.',
    action: cleanSteps.slice(1, 4).join('\n') || 'Thực hiện động tác đều đặn theo hình mẫu.',
    mistakes:
      cleanSteps[4] ||
      'Tránh vung giật lấy đà hoặc nín thở; luôn kiểm soát tốc độ ở cả pha lên và pha hạ.',
    breathing:
      'Thở ra khi phát lực (nâng/đẩy/kéo), hít sâu bằng mũi khi hạ tạ hoặc trở về vị trí đầu.',
    durationSec,
    targetReps: bodyPart === 'cardio' ? null : 12,
    reps: bodyPart === 'cardio' ? '3 hiệp x 60s' : '3 hiệp x 12 lần',
    calories,
    expReward,
    level,
  };
}

export async function fetchExercisesFromApi({ search = '' } = {}) {
  const allCurated = INITIAL_API_EXERCISES.map(normalizeApiExercise);
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    const matched = allCurated.filter(
      (ex) =>
        ex.title.toLowerCase().includes(q) ||
        ex.rawName?.toLowerCase().includes(q) ||
        ex.bodyPartLabel?.toLowerCase().includes(q)
    );
    return {
      success: true,
      exercises: matched,
      meta: { hasNextPage: false, nextCursor: null, total: matched.length },
    };
  }
  return {
    success: true,
    exercises: allCurated,
    meta: { hasNextPage: false, nextCursor: null, total: allCurated.length },
  };
}

export async function fetchExerciseDetailById(exerciseId) {
  const preset = INITIAL_API_EXERCISES.find((x) => x.exerciseId === exerciseId);
  if (preset) return normalizeApiExercise(preset);
  return null;
}
