import {
  IoWater, IoRestaurant, IoBarbell, IoMoon, IoHappy, IoCheckmarkCircle, IoChatbubbleEllipses,
} from 'react-icons/io5';

// Mỗi nhiệm vụ (backend/database/mongodb/data/catalogs.json) kèm icon và trang để hoàn thành nó.
export const QUEST_META = {
  q_water: { icon: IoWater, to: '/app/logs#water' },
  q_workout: { icon: IoBarbell, to: '/app/logs#workout' },
  q_meal: { icon: IoRestaurant, to: '/app/logs#meal' },
  q_sleep: { icon: IoMoon, to: '/app/logs#sleep' },
  q_mood: { icon: IoHappy, to: '/app/logs#mood' },
  q_checkin: { icon: IoCheckmarkCircle, to: '/app/quests' },
  q_chat: { icon: IoChatbubbleEllipses, to: '/app/coach' },
};
