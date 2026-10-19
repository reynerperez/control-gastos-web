// Tipografía Inter (misma familia que usa el tema de Tamagui, igual que el móvil)
import '@fontsource-variable/inter'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TamaguiProvider, Theme } from 'tamagui'

import App from './App'
// Design system compartido con la app móvil (archivo copiado del proyecto Expo)
import tamaguiConfig from './tamagui.config'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <Theme name="dark">
        <App />
      </Theme>
    </TamaguiProvider>
  </StrictMode>
)
