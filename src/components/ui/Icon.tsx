import type { IconType } from 'react-icons'
import {
  IoAdd,
  IoAddCircle,
  IoAirplane,
  IoAlertCircle,
  IoArrowBack,
  IoArrowDown,
  IoArrowUp,
  IoBulbOutline,
  IoBus,
  IoCafe,
  IoCalendar,
  IoCar,
  IoCard,
  IoCart,
  IoCash,
  IoChatbubbleEllipses,
  IoCheckbox,
  IoCheckmark,
  IoCheckmarkCircle,
  IoChevronBack,
  IoChevronDown,
  IoChevronForward,
  IoChevronUp,
  IoClose,
  IoCloseCircle,
  IoCreate,
  IoEllipsisHorizontal,
  IoFastFood,
  IoFilter,
  IoFitness,
  IoFlash,
  IoGameController,
  IoGift,
  IoHome,
  IoInformationCircle,
  IoLaptop,
  IoList,
  IoLocation,
  IoLockClosed,
  IoLogOut,
  IoMail,
  IoMap,
  IoMedkit,
  IoOptions,
  IoPaw,
  IoPencil,
  IoPerson,
  IoPersonAdd,
  IoPieChart,
  IoPricetag,
  IoQrCode,
  IoReceipt,
  IoRepeat,
  IoReturnDownBack,
  IoSearch,
  IoSettings,
  IoShirt,
  IoSchool,
  IoSquareOutline,
  IoStorefront,
  IoSwapHorizontal,
  IoText,
  IoTime,
  IoTrash,
  IoWallet,
  IoWarning,
} from 'react-icons/io5'

// ═══════════════════════════════════════════════════════════════
// 🎯 ICON MAP — nombres de Ionicons (usados en la BD y en la app
//    móvil) → iconos SVG de react-icons (io5 = Ionicons 5).
//
//    La BD guarda el nombre del icono de Ionicons (`categories.icon`),
//    así que este mapa es la única capa que traduce a web. Si agregas
//    un icono nuevo en la app móvil, agrégalo también aquí.
// ═══════════════════════════════════════════════════════════════

export const ICON_MAP: Record<string, IconType> = {
  // Categorías por defecto
  'fast-food': IoFastFood,
  car: IoCar,
  home: IoHome,
  medkit: IoMedkit,
  'game-controller': IoGameController,
  cart: IoCart,
  flash: IoFlash,
  cash: IoCash,
  'cash-outline': IoCash,
  laptop: IoLaptop,
  gift: IoGift,
  airplane: IoAirplane,
  school: IoSchool,
  fitness: IoFitness,
  shirt: IoShirt,
  paw: IoPaw,
  cafe: IoCafe,
  bus: IoBus,
  wallet: IoWallet,
  'wallet-outline': IoWallet,
  pricetag: IoPricetag,

  // UI
  add: IoAdd,
  'add-circle': IoAddCircle,
  'add-circle-outline': IoAddCircle,
  close: IoClose,
  'close-circle': IoCloseCircle,
  search: IoSearch,
  filter: IoFilter,
  'options-outline': IoOptions,
  time: IoTime,
  checkbox: IoCheckbox,
  'square-outline': IoSquareOutline,
  checkmark: IoCheckmark,
  'checkmark-circle': IoCheckmarkCircle,
  'bulb-outline': IoBulbOutline,
  bulb: IoBulbOutline,
  'chevron-back': IoChevronBack,
  'chevron-forward': IoChevronForward,
  'chevron-up': IoChevronUp,
  'chevron-down': IoChevronDown,
  'arrow-back': IoArrowBack,
  'arrow-down': IoArrowDown,
  'arrow-up': IoArrowUp,
  'trash-outline': IoTrash,
  trash: IoTrash,
  'create-outline': IoCreate,
  'pencil-outline': IoPencil,
  'ellipsis-horizontal': IoEllipsisHorizontal,
  'calendar-outline': IoCalendar,
  'storefront-outline': IoStorefront,
  'text-outline': IoText,
  'person-outline': IoPerson,
  person: IoPerson,
  'person-add': IoPersonAdd,
  mail: IoMail,
  'lock-closed': IoLockClosed,
  'log-out-outline': IoLogOut,
  'receipt-outline': IoReceipt,
  list: IoList,
  'map-outline': IoMap,
  'location-outline': IoLocation,
  'chatbubble-ellipses-outline': IoChatbubbleEllipses,
  'information-circle': IoInformationCircle,
  'alert-circle-outline': IoAlertCircle,
  'pie-chart-outline': IoPieChart,
  'swap-horiz': IoSwapHorizontal,
  'settings-outline': IoSettings,
  'return-down-back': IoReturnDownBack,
  repeat: IoRepeat,
  'repeat-outline': IoRepeat,
  'qr-code': IoQrCode,
  warning: IoWarning,

  // Métodos de pago
  card: IoCard,
  'card-outline': IoCard,
}

/** Icono de respaldo cuando la BD trae un nombre que no está en el mapa. */
export const FALLBACK_ICON_NAME = 'pricetag'

/** Nombres disponibles para el selector de iconos de Ajustes (paridad con móvil). */
export const ICON_OPTIONS = [
  'fast-food',
  'car',
  'home',
  'medkit',
  'game-controller',
  'cart',
  'flash',
  'cash',
  'laptop',
  'gift',
  'airplane',
  'school',
  'fitness',
  'shirt',
  'paw',
  'cafe',
  'bus',
  'wallet',
]

type Props = {
  /** Nombre de icono de Ionicons (formato que guarda la BD) */
  name: string
  size?: number
  color?: string
}

/**
 * AppIcon — renderiza un icono SVG a partir del nombre de Ionicons.
 * Usa el label/aria oculto porque los iconos son decorativos: el texto
 * siempre acompaña al icono en la UI.
 */
export function AppIcon({ name, size = 20, color }: Props) {
  const Icon = ICON_MAP[name] ?? ICON_MAP[FALLBACK_ICON_NAME]
  return <Icon size={size} color={color} aria-hidden focusable={false} />
}
