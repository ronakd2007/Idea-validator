import { useEffect, useState } from 'react';

export interface DeviceCapabilities {
  reducedMotion: boolean;
  isMobile: boolean;
}

export function useDeviceCapabilities(): DeviceCapabilities {
  const [caps, setCaps] = useState<DeviceCapabilities>({ reducedMotion: false, isMobile: false });

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia('(max-width: 767px)');

    const update = () => setCaps({ reducedMotion: motionQuery.matches, isMobile: mobileQuery.matches });
    update();

    motionQuery.addEventListener('change', update);
    mobileQuery.addEventListener('change', update);
    return () => {
      motionQuery.removeEventListener('change', update);
      mobileQuery.removeEventListener('change', update);
    };
  }, []);

  return caps;
}
