import { styled, View, XStack, YStack } from 'tamagui';

/**
 * BorderedStack — Base components with border defaults.
 *
 * Eliminates the need to repeat `borderWidth: 1` and `borderColor: '$border'`
 * on every bordered element. Extend these for custom components.
 *
 * Usage:
 *   const MyCard = styled(BorderedStack, { padding: '$md' });
 *   // borderWidth: 1 and borderColor: '$border' are inherited
 */

// ═══════════════════════════════════════════════════════════════
// 🎨 BASE — View with border defaults
// ═══════════════════════════════════════════════════════════════

export const BorderedView = styled(View, {
  borderWidth: 1,
  borderColor: '$border',
});

export const BorderedYStack = styled(YStack, {
  borderWidth: 1,
  borderColor: '$border',
});

export const BorderedXStack = styled(XStack, {
  borderWidth: 1,
  borderColor: '$border',
});

// ═══════════════════════════════════════════════════════════════
// 🏷️ CHIP — For filter chips, category chips, payment method chips
// ═══════════════════════════════════════════════════════════════

export const BorderedChip = styled(View, {
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$full',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',

  variants: {
    active: {
      true: {
        backgroundColor: '$primary',
        borderColor: '$primary',
      },
      false: {
        backgroundColor: '$card',
      },
    },
    size: {
      sm: {
        height: 34,
        paddingHorizontal: '$md',
        gap: '$xs',
      },
      md: {
        height: 38,
        paddingHorizontal: '$lg',
      },
    },
  } as const,

  defaultVariants: {
    active: false,
    size: 'md',
  },
});

// ═══════════════════════════════════════════════════════════════
// 📝 INPUT — For text inputs with border
// ═══════════════════════════════════════════════════════════════

export const BorderedInput = styled(View, {
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$md',
  backgroundColor: '$background',
  paddingHorizontal: '$md',
  height: 48,

  variants: {
    error: {
      true: {
        borderColor: '#F59E0B66',
      },
    },
  } as const,
});

// ═══════════════════════════════════════════════════════════════
// 📋 ITEM ROW — For list items with border
// ═══════════════════════════════════════════════════════════════

export const BorderedItemRow = styled(XStack, {
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$md',
  alignItems: 'center',
  padding: '$md',
  gap: '$md',
});
