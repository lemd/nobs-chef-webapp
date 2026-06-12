import { createClient, type Session, type User } from '@supabase/supabase-js'
import { reactive } from 'vue'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjc3V5bmZieWt2bmNlbm1oamZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODQyMDEsImV4cCI6MjA5Njc2MDIwMX0.6DXkVvNHxFdHXd2sTQINMUjQCi3ILkP3a_jb0bKMJFk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const auth = reactive<{
  user: User | null
  session: Session | null
  loading: boolean
}>({
  user: null,
  session: null,
  loading: true,
})

export async function initAuth(): Promise<void> {
  // Wait for the first onAuthStateChange event — this correctly handles both:
  //   • Normal page load: fires INITIAL_SESSION with stored session (or null)
  //   • Post-OAuth redirect: fires SIGNED_IN after processing the URL hash
  return new Promise<void>((resolve) => {
    supabase.auth.onAuthStateChange((_event, session) => {
      auth.session = session
      auth.user = session?.user ?? null
      if (auth.loading) {
        auth.loading = false
        resolve()
      }
    })
  })
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/' },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export function getAccessToken(): string | null {
  return auth.session?.access_token ?? null
}
