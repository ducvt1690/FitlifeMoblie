// ExerciseDB OSS v1 API Integration
// Endpoint: https://oss.exercisedb.dev/api/v1/exercises

export const EXERCISE_API_BASE = 'https://oss.exercisedb.dev/api/v1';

// Initial 10 exercises from ExerciseDB API
export const INITIAL_API_EXERCISES = [
  {
    exerciseId: '0JtKWum',
    name: 'dumbbell burpee',
    viName: 'Burpee kết hợp tạ đơn đốt mỡ (Dumbbell Burpee)',
    gifUrl: 'https://static.exercisedb.dev/media/0JtKWum.gif',
    bodyParts: ['cardio'],
    equipments: ['dumbbell'],
    targetMuscles: ['cardiovascular system'],
    secondaryMuscles: ['quadriceps', 'hamstrings', 'calves', 'deltoids', 'triceps', 'core'],
    instructions: [
      'Step:1 Begin in a standing position with your feet about shoulder width and a dumbbell in each hand.',
      'Step:2 Before moving, lower your body into a squat position, placing the dumbbells on the ground in front of you.',
      'Step:3 Start at a pace that lets the feet and arms move in sync.',
      'Step:4 Move at a repeatable pace, keeping the motion smooth and your breathing steady.',
      'Step:5 Keep the pattern repeatable as speed increases.',
      'Step:6 Keep the rhythm for the planned interval, slowing if your form starts to slip.',
    ],
    viInstructions: [
      'Bước 1: Đứng thẳng, hai chân rộng bằng vai, mỗi tay cầm một quả tạ đơn.',
      'Bước 2: Hạ người xuống tư thế Squat và đặt hai quả tạ xuống sàn ngay trước mũi chân.',
      'Bước 3: Chống tay lên tạ, bật nhảy hai chân ra sau vào tư thế Plank thẳng người.',
      'Bước 4: Thực hiện 1 nhịp hít đất trên tạ (tùy chọn) rồi bật thu hai chân về gần tạ.',
      'Bước 5: Đạp mạnh gót chân, cầm tạ đứng thẳng dậy đồng thời giữ lưng thẳng.',
      'Bước 6: Duy trì nhịp độ đều đặn kết hợp hít thở sâu suốt hiệp tập.',
    ],
  },
  {
    exerciseId: '0br45wL',
    name: 'push-up inside leg kick',
    viName: 'Hít đất đá chân trong (Push-up Inside Leg Kick)',
    gifUrl: 'https://static.exercisedb.dev/media/0br45wL.gif',
    bodyParts: ['upper legs'],
    equipments: ['bodyweight'],
    targetMuscles: ['glutes'],
    secondaryMuscles: ['quadriceps', 'hamstrings', 'calves', 'core'],
    instructions: [
      'Step:1 Begin in a push-up position with your hands just beyond shoulder width and your feet together.',
      'Step:2 Lower your body toward the ground by bending your elbows, with your spine steady and your core engaged.',
      'Step:3 Brace the abdomen and glutes so the shoulders, hips and ankles move together.',
      'Step:4 Bend your elbows to lower your chest while keeping your body in one line.',
      'Step:5 Keep the head in line with the spine as the elbows bend.',
      'Step:6 Press back to straight arms, keeping the body line intact.',
    ],
    viInstructions: [
      'Bước 1: Bắt đầu ở tư thế hít đất, hai tay chống rộng hơn vai một chút, hai chân khép.',
      'Bước 2: Hạ thấp cơ thể xuống bằng cách gập khuỷu tay, giữ lưng thẳng và siết cơ bụng.',
      'Bước 3: Gồng chặt cơ bụng và cơ mông kết hợp đá chân luân phiên qua bên đối diện.',
      'Bước 4: Giữ trục vai - hông - cổ chân ổn định khi hạ ngực.',
      'Bước 5: Đầu giữ thẳng hàng với cột sống, mắt nhìn xuống sàn.',
      'Bước 6: Đẩy mạnh tay trở lại tư thế thẳng tay ban đầu.',
    ],
  },
  {
    exerciseId: '03lzqwk',
    name: 'assisted hanging knee raise',
    viName: 'Treo xà nâng gối tập bụng (Assisted Hanging Knee Raise)',
    gifUrl: 'https://static.exercisedb.dev/media/03lzqwk.gif',
    bodyParts: ['waist'],
    equipments: ['assisted'],
    targetMuscles: ['abdominals'],
    secondaryMuscles: ['hip flexors'],
    instructions: [
      'Step:1 Suspend yourself from a pull-up bar with your arms straight and your palms turned away from you.',
      'Step:2 Brace your trunk muscles and lift your knees toward your chest, bending at the hips and knees.',
      'Step:3 Brace the abdomen and keep the shoulders anchored to the support.',
      'Step:4 Lift your legs by bracing your trunk and moving at the hips rather than swinging.',
      'Step:5 Slow the legs before they pull the lower back out of position.',
      'Step:6 Lower the legs slowly without swinging or losing your trunk position.',
    ],
    viInstructions: [
      'Bước 1: Treo người trên xà đơn với hai tay duỗi thẳng, lòng bàn tay hướng về trước.',
      'Bước 2: Gồng chặt cơ lõi (core) và kéo hai đầu gối lên về phía ngực.',
      'Bước 3: Siết chặt cơ bụng và giữ hai vai cố định, không rụt cổ.',
      'Bước 4: Nâng chân bằng lực cuộn cơ bụng và hông thay vì đung đưa lấy đà.',
      'Bước 5: Kiểm soát nhịp dừng ở đỉnh để cảm nhận cơ bụng co tối đa.',
      'Bước 6: Hạ hai chân xuống chậm rãi có kiểm soát, không để người lắc lư.',
    ],
  },
  {
    exerciseId: '05Cf2v8',
    name: 'impossible dips',
    viName: 'Chống đẩy xà kép (Impossible Dips)',
    gifUrl: 'https://static.exercisedb.dev/media/05Cf2v8.gif',
    bodyParts: ['upper arms'],
    equipments: ['bodyweight'],
    targetMuscles: ['triceps'],
    secondaryMuscles: ['pectorals', 'deltoids'],
    instructions: [
      'Step:1 Set yourself between two parallel bars with your arms straight and your body suspended in the air.',
      'Step:2 Before moving, bend your knees and cross your ankles.',
      'Step:3 Set the shoulders down and keep the elbows pointed mostly behind you.',
      'Step:4 Bend the elbows to lower between the supports; stop at a comfortable shoulder depth.',
      'Step:5 Choose a depth that lets the shoulders stay comfortable.',
      'Step:6 Press through the hands to rise, then reset the shoulders before another rep.',
    ],
    viInstructions: [
      'Bước 1: Chống hai tay thẳng trên hai thanh xà kép, nâng toàn bộ cơ thể lên không.',
      'Bước 2: Gập nhẹ đầu gối và bắt chéo hai cổ chân để giữ thăng bằng.',
      'Bước 3: Hạ vai xuống (không rụt vai) và giữ khuỷu tay hướng ra phía sau.',
      'Bước 4: Gập khuỷu tay từ từ hạ thấp thân người xuống mức vai cảm thấy thoải mái.',
      'Bước 5: Giữ thân người ổn định, cảm nhận lực căng ở cơ tay sau và ngực.',
      'Bước 6: Đẩy mạnh qua lòng bàn tay để nâng người lên vị trí ban đầu.',
    ],
  },
  {
    exerciseId: '0CXGHya',
    name: 'Cable Crossover',
    viName: 'Ép ngực với máy cáp đôi (Cable Crossover)',
    gifUrl: 'https://static.exercisedb.dev/media/0CXGHya.gif',
    bodyParts: ['chest'],
    equipments: ['cable'],
    targetMuscles: ['pectorals'],
    secondaryMuscles: ['deltoids', 'triceps'],
    instructions: [
      'Step:1 Set the cable pulleys to chest height.',
      'Step:2 Take your place in the center of the cable machine with one foot in front of the other.',
      'Step:3 Keep a soft elbow bend and set the shoulders before moving the arms.',
      'Step:4 Bring the handles across the front of your chest in a broad arc, keeping a slight elbow bend.',
      'Step:5 Keep the elbow angle nearly unchanged through the arc.',
      'Step:6 Open the arms back along the same arc without dropping the load.',
    ],
    viInstructions: [
      'Bước 1: Điều chỉnh ròng rọc máy cáp ở độ cao ngang ngực.',
      'Bước 2: Đứng ở giữa khung máy cáp, một chân bước lên trước để giữ trụ vững.',
      'Bước 3: Hơi trùng nhẹ khuỷu tay và mở ngực trước khi kéo.',
      'Bước 4: Kéo hai tay cầm khép lại trước ngực theo hình vòng cung rộng như đang ôm gốc cây.',
      'Bước 5: Giữ góc gập khuỷu tay cố định trong suốt quỹ đạo kéo.',
      'Bước 6: Mở hai tay từ từ trở lại vị trí ban đầu để kéo giãn cơ ngực có kiểm soát.',
    ],
  },
  {
    exerciseId: '0dCyly0',
    name: 'barbell seated bradford rocky press',
    viName: 'Ngồi đẩy vai tạ đòn Rocky (Bradford Rocky Press)',
    gifUrl: 'https://static.exercisedb.dev/media/0dCyly0.gif',
    bodyParts: ['shoulders'],
    equipments: ['barbell'],
    targetMuscles: ['deltoids'],
    secondaryMuscles: ['triceps', 'upper back'],
    instructions: [
      'Step:1 Take a seat on a bench with your back straight and feet planted.',
      'Step:2 Take hold of the barbell with palms facing down, just beyond shoulder width.',
      'Step:3 Brace the torso and align the wrists with the forearms.',
      'Step:4 Press the weight or handles away while keeping your trunk braced.',
      'Step:5 Keep the wrists stacked and use a shoulder path that feels natural.',
      'Step:6 Lower the weight to its starting height under control before pressing again.',
    ],
    viInstructions: [
      'Bước 1: Ngồi thẳng lưng trên ghế tập, hai bàn chân đặt vững trên sàn.',
      'Bước 2: Nắm thanh tạ đòn rộng hơn vai một chút, lòng bàn tay hướng về trước.',
      'Bước 3: Gồng chặt thân trên, giữ cổ tay thẳng hàng với cẳng tay.',
      'Bước 4: Đẩy thanh tạ qua đầu chuyển luân phiên trước mặt và sau gáy.',
      'Bước 5: Giữ cổ tay chắc chắn và di chuyển theo quỹ đạo khớp vai tự nhiên.',
      'Bước 6: Hạ tạ xuống có kiểm soát trước khi thực hiện lần đẩy tiếp theo.',
    ],
  },
  {
    exerciseId: '0I5fUyn',
    name: 'band underhand pulldown',
    viName: 'Kéo dây kháng lực tập lưng xô (Band Underhand Pulldown)',
    gifUrl: 'https://static.exercisedb.dev/media/0I5fUyn.gif',
    bodyParts: ['back'],
    equipments: ['resistance band'],
    targetMuscles: ['latissimus dorsi'],
    secondaryMuscles: ['biceps', 'forearms'],
    instructions: [
      'Step:1 Connect the band to a high anchor point, such as a pull-up bar or sturdy beam.',
      'Step:2 Face the anchor point from a stable stance with feet about shoulder width.',
      'Step:3 Sit tall and set the shoulders before drawing the handle down.',
      'Step:4 Pull the handle down by driving your elbows toward your ribs; keep your torso steady.',
      'Step:5 Control the band on the way back instead of letting it snap you into position.',
      'Step:6 Let the handle rise steadily until the arms are long, then reset the shoulders.',
    ],
    viInstructions: [
      'Bước 1: Cố định dây kháng lực vào điểm neo cao (như xà đơn hoặc khung cửa chắc chắn).',
      'Bước 2: Ngồi hoặc quỳ đối diện điểm neo, nắm dây với lòng bàn tay ngửa.',
      'Bước 3: Giữ lưng thẳng, mở ngực và hạ bả vai trước khi kéo.',
      'Bước 4: Kéo dây xuống bằng cách ép hai khuỷu tay sát về phía mạng sườn.',
      'Bước 5: Siết cơ lưng xô ở điểm thấp nhất và giữ thân người cố định.',
      'Bước 6: Thả tay từ từ lên cao theo lực căng của dây, không thả giật đột ngột.',
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
    instructions: [
      'Step:1 Stand tall with your feet about shoulder width and hold a dumbbell in each hand, palms facing your body.',
      'Step:2 With your upper arms stationary, exhale and curl the weights while contracting your biceps.',
      'Step:3 Set the shoulders and upper arms before bending the elbows.',
      'Step:4 Curl the weight with your palms facing down, keeping the elbows close and torso still.',
      'Step:5 Keep the torso quiet and let the elbow bend lift the weight.',
      'Step:6 Lower until the elbows are nearly straight, keeping the upper arms still.',
    ],
    viInstructions: [
      'Bước 1: Đứng thẳng, hai chân rộng bằng vai, mỗi tay cầm một quả tạ đơn, mu bàn tay hướng về trước.',
      'Bước 2: Giữ bắp tay trên cố định sát sườn, thở ra và cuốn tạ lên ngang vai.',
      'Bước 3: Khóa cố định khớp vai, chỉ cử động khớp khuỷu tay.',
      'Bước 4: Cuốn tạ lên với lòng bàn tay úp xuống để kích hoạt cả bắp tay trước và cẳng tay.',
      'Bước 5: Giữ lưng thẳng đứng, không đung đưa lưng để lấy đà.',
      'Bước 6: Hạ tạ từ từ về vị trí duỗi tay ban đầu.',
    ],
  },
  {
    exerciseId: '0jp9Rlz',
    name: 'Single-Leg Floor Calf Raise',
    viName: 'Nhón bắp chân 1 chân trên sàn (Single-Leg Calf Raise)',
    gifUrl: 'https://static.exercisedb.dev/media/0jp9Rlz.gif',
    bodyParts: ['lower legs'],
    equipments: ['bodyweight'],
    targetMuscles: ['calves'],
    secondaryMuscles: ['ankles', 'feet'],
    instructions: [
      'Step:1 Stand and set your feet about hip width and place your hands on a wall or sturdy object for balance.',
      'Step:2 Before moving, lift one foot off the ground and balance on the other foot.',
      'Step:3 Let the ankles move freely while the rest of the body stays quiet.',
      'Step:4 Rise through the balls of your feet, lifting the heels as high as you can without rocking.',
      'Step:5 Keep the pelvis level as the supporting leg does the work.',
      'Step:6 Lower the heels at a measured pace before rising again; switch sides when the set calls for it.',
    ],
    viInstructions: [
      'Bước 1: Đứng thẳng, đặt nhẹ tay lên tường hoặc ghế để giữ thăng bằng.',
      'Bước 2: Nhấc một bàn chân lên khỏi sàn, dồn trọng tâm vào chân trụ.',
      'Bước 3: Giữ thân người thẳng, chỉ chuyển động ở khớp cổ chân.',
      'Bước 4: Nhón cao gót chân hết mức có thể bằng lực của ức bàn chân và bắp chân.',
      'Bước 5: Giữ hông cân bằng, siết bắp chân 1 giây ở điểm cao nhất.',
      'Bước 6: Hạ gót chân xuống chậm rãi rồi lặp lại, sau đó đổi chân.',
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
    instructions: [
      'Step:1 Position yourself face down on the floor with your legs extended behind you.',
      'Step:2 Set your hands on the floor next to your lower ribs, fingers pointing forward.',
      'Step:3 Settle into the starting position and take an easy breath before moving deeper.',
      'Step:4 Ease toward the stretch until you feel mild tension; keep breathing and avoid bouncing.',
      'Step:5 Stay in a mild stretch rather than pulling farther with momentum.',
      'Step:6 Hold the position with steady breathing, then release gently; repeat on the other side if needed.',
    ],
    viInstructions: [
      'Bước 1: Nằm sấp trên sàn, hai chân duỗi thẳng ra phía sau.',
      'Bước 2: Đặt hai bàn tay xuống sàn cạnh xương sườn dưới, các ngón tay hướng về phía trước.',
      'Bước 3: Ổn định tư thế chuẩn bị và hít một hơi nhẹ trước khi nâng người.',
      'Bước 4: Ấn tay nâng ngực mở căng vừa phải, giữ nhịp thở đều và không nhún giật.',
      'Bước 5: Duy trì độ căng dễ chịu cho cột sống lưng và cơ ngực.',
      'Bước 6: Giữ tư thế kết hợp thở đều, sau đó hạ xuống nhẹ nhàng.',
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

  // Estimate calories & difficulty based on bodyPart / equipment
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

  return {
    id,
    exerciseId: id,
    title,
    rawName: raw.name,
    gifUrl: raw.gifUrl || `https://static.exercisedb.dev/media/${id}.gif`,
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
      cleanSteps[5] ||
      'Thở ra khi phát lực (nâng/đẩy/kéo), hít sâu bằng mũi khi hạ tạ hoặc trở về vị trí đầu.',
    durationSec,
    targetReps: bodyPart === 'cardio' ? null : 12,
    reps: bodyPart === 'cardio' ? '3 hiệp x 60s' : '3 hiệp x 12 lần',
    calories,
    expReward,
    level,
  };
}

export async function fetchExercisesFromApi({ cursor = null, limit = 25, search = '' } = {}) {
  try {
    let url = `${EXERCISE_API_BASE}/exercises?limit=${limit}`;
    if (cursor) {
      url += `&after=${encodeURIComponent(cursor)}`;
    }
    if (search && search.trim()) {
      url = `${EXERCISE_API_BASE}/exercises/search?search=${encodeURIComponent(
        search.trim()
      )}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    const rawList = Array.isArray(json.data) ? json.data : [];

    const presetMap = {};
    INITIAL_API_EXERCISES.forEach((item) => {
      presetMap[item.exerciseId] = item;
    });

    const normalized = rawList.map((item) => {
      const preset = presetMap[item.exerciseId];
      return normalizeApiExercise(preset ? { ...item, ...preset } : item);
    });

    if (!cursor && !search) {
      normalized.sort((a, b) => {
        if (a.id === '01qpYSe') return 1;
        if (b.id === '01qpYSe') return -1;
        if (a.id === '0JtKWum') return -1;
        if (b.id === '0JtKWum') return 1;
        return 0;
      });
    }

    return {
      success: true,
      exercises: normalized,
      meta: json.meta || { hasNextPage: false, nextCursor: null, total: normalized.length },
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      exercises: INITIAL_API_EXERCISES.map(normalizeApiExercise),
      meta: { hasNextPage: true, nextCursor: '0JtKWum', total: 1500 },
    };
  }
}

export async function fetchExerciseDetailById(exerciseId) {
  try {
    const res = await fetch(`${EXERCISE_API_BASE}/exercises/${exerciseId}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.success && json?.data) {
      const preset = INITIAL_API_EXERCISES.find((x) => x.exerciseId === exerciseId);
      return normalizeApiExercise(preset ? { ...json.data, ...preset } : json.data);
    }
    return null;
  } catch (e) {
    return null;
  }
}
