import { styled, View } from 'tamagui';

import { palette } from '@/constants/theme';

type Props = {
  progress: number; // 0..1+
  color?: string;
  height?: number;
};

// ═══════════════════════════════════════════════════════════════
// 🎨 Styled Components
// ═══════════════════════════════════════════════════════════════

const Track = styled(View, {
  width: '100%',
  overflow: 'hidden',
  borderRadius: '$full',
  backgroundColor: '$border',
});

const Fill = styled(View, {
  height: '100%',
  borderRadius: '$full',
});

// ═══════════════════════════════════════════════════════════════
// 🏠 Component
// ═══════════════════════════════════════════════════════════════

export function ProgressBar({ progress, color, height = 8 }: Props) {
  const clamped = Math.max(0, Math.min(progress, 1));
  const over = progress > 1;
  const barColor = over ? palette.expense : color ?? palette.primary;

  return (
    <Track height={height}>
      <Fill
        width={`${clamped * 100}%`}
        backgroundColor={barColor}
      />
    </Track>
  );
}
