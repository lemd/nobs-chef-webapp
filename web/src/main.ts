import { createApp } from 'vue'
import router from './router.ts'
import App from './App.vue'
import './style.css'
import { initAuth } from './composables/useAuth.ts'

// Resolve auth state before mounting so the router guard works on first render
initAuth().then(() => {
  createApp(App).use(router).mount('#app')
})
