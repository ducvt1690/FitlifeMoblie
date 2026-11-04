import { useEffect, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform } from 'react-native';

const IOS = Platform.OS === 'ios';

// Height of the on-screen keyboard, 0 while hidden. iOS uses the "will" events and animates with the keyboard.
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const update = (e, h) => {
      if (IOS && e?.duration) LayoutAnimation.configureNext({ duration: e.duration, update: { type: LayoutAnimation.Types.keyboard } });
      setHeight(h);
    };
    const show = Keyboard.addListener(IOS ? 'keyboardWillShow' : 'keyboardDidShow', e => update(e, e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(IOS ? 'keyboardWillHide' : 'keyboardDidHide', e => update(e, 0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}

// True while the on-screen keyboard is up.
export function useKeyboardVisible() {
  return useKeyboardHeight() > 0;
}
