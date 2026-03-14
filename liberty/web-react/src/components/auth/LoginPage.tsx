import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'

export default function LoginPage() {
  const [name, setName] = useState('')
  const { authSubmit } = useApp()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    authSubmit(name.trim())
  }

  return (
    <div className="min-h-screen bg-liberty-black flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="bg-liberty-black-lighter rounded-2xl p-10 shadow-2xl border border-liberty-black-card">
          <div className="text-center mb-8">
            <motion.img
              src="/assets/logo.png"
              alt="LIBERTY"
              className="w-20 h-20 mx-auto mb-4"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            />
            <h1 className="text-3xl font-bold text-liberty-yellow mb-2">LIBERTY</h1>
            <p className="text-gray-400">Comunicação segura</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-liberty-black-light border-2 border-liberty-black-lighter text-white placeholder-gray-500 focus:border-liberty-yellow focus:outline-none transition-colors"
              required
              autoComplete="username"
            />
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-lg bg-liberty-yellow text-black font-bold hover:bg-liberty-yellow-gold transition-colors"
            >
              Continuar
            </motion.button>
          </form>

          <p className="mt-4 text-center text-gray-400 text-sm">
            Digite seu nome. Se for novo, uma conta será criada automaticamente.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
