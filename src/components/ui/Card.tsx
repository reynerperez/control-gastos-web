import { styled, YStack } from 'tamagui';

/**
 * Card — Componente contenedor con borde y border-radius.
 * Usa tokens de Tamagui: $card, $border, $radius.lg, $space.lg
 */
export const Card = styled(YStack, {
  backgroundColor: '$card',
  borderColor: '$border',
  borderWidth: 1,
  borderRadius: '$xl',
  padding: '$lg',
  shadowColor: '#000000',
  shadowOpacity: 0.16,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },

  variants: {
    noPadding: {
      true: {
        padding: 0,
      },
    },
    noBorder: {
      true: {
        borderWidth: 0,
      },
    },
    primary: {
      true: {
        backgroundColor: '$primary',
        borderColor: '$primary',
      },
    },
  } as const,

  defaultVariants: {
    noPadding: false,
    noBorder: false,
  },
});
