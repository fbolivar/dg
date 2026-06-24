"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useRoleStore } from '@/shared/stores/role-store'

export default function LoginPage() {
  const router = useRouter()
  const { setRole } = useRoleStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function doLogin(em: string, pw: string) {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, password: pw }),
      })
      const data = await res.json()
      if (res.ok && data.user) {
        setRole(data.user.role)
        router.push(data.user.role === 'cliente' ? '/portal' : '/dashboard')
        router.refresh()
      } else {
        setError(data.error || 'Correo o contraseña incorrectos')
        setLoading(false)
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    await doLogin(email, password)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A2B4A] to-[#0f1d33] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2">
            <Image
              src="/logo.png"
              alt="DG&A Logo"
              width={180}
              height={60}
              className="object-contain"
              priority
            />
          </div>
          <p className="text-white/40 text-sm mt-3">Intelligence Desk</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Iniciar sesión</h2>
          <p className="text-sm text-gray-500 mb-6">Accede a tu cuenta DG&A</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@dga.com"
                required
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1A2B4A]/20 focus:border-[#1A2B4A] transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1A2B4A]/20 focus:border-[#1A2B4A] transition-all"
                />
                <button
                  type="button"
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A2B4A] hover:bg-[#243b66] text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Ingresando...</> : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-[11px] mt-6">
          © 2026 DG&A Abogados · Plataforma confidencial
        </p>
      </div>
    </div>
  )
}
