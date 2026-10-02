import { MotionGlobalConfig, DeliveryCodeCard } from 'client-app';

// Static card: jump framer-motion entry animations to their end state.
MotionGlobalConfig.skipAnimations = true;

export const Code = () => (
  <div className="max-w-md">
    <DeliveryCodeCard code="4827" />
  </div>
);
