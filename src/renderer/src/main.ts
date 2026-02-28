import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '@fontsource/instrument-serif'
import '@fontsource-variable/atkinson-hyperlegible-next'
import '@fontsource-variable/atkinson-hyperlegible-mono'

const app = createApp(App)

app.use(router)

app.mount('#app')
